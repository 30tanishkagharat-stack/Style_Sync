import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import type { CalendarEntry, ClothingItem, Outfit, UserProfile, UserSettings } from './types';

function clampString(val: string | undefined | null, maxLen: number, fallback = ''): string {
  const trimmed = (val ?? '').trim() || fallback.trim();
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

function isVerifiedFirebaseUser(): { uid: string; email: string; displayName: string } | null {
  const user = auth.currentUser;
  if (!user || !user.emailVerified || !user.email) return null;
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || user.email.split('@')[0] || 'StyleSync Member',
  };
}

export async function syncProfileToFirestore(
  profile: UserProfile,
  settings?: UserSettings
): Promise<void> {
  const fbUser = isVerifiedFirebaseUser();
  if (!fbUser) return;

  const docPath = `users/${fbUser.uid}/private/profile`;
  const ref = doc(db, 'users', fbUser.uid, 'private', 'profile');

  try {
    const existing = await getDoc(ref);
    const displayName = clampString(profile.name, 100, fbUser.displayName);
    const gender = profile.gender === 'male' ? 'male' : 'female';
    const baseFields = {
      displayName,
      gender,
      stylePreferences: clampString(profile.style_preferences, 300),
      preferredColors: clampString(profile.preferred_colors, 300),
      avoidColors: clampString(profile.avoid_colors, 300),
      fitPreference: clampString(profile.fit_preference, 120),
      bio: clampString(profile.bio, 500),
      preferredCity: clampString(settings?.preferred_city, 120),
      temperatureUnit: settings?.temperature_unit === 'F' ? 'F' : 'C',
      updatedAt: serverTimestamp(),
    };

    if (!existing.exists()) {
      await setDoc(ref, {
        uid: fbUser.uid,
        email: clampString(fbUser.email, 254),
        ...baseFields,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, baseFields);
    }
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      docPath
    );
  }
}

export async function syncWardrobeItemToFirestore(item: ClothingItem): Promise<void> {
  const fbUser = isVerifiedFirebaseUser();
  if (!fbUser) return;

  const docId = `item_${item.id}`;
  const docPath = `users/${fbUser.uid}/wardrobe/${docId}`;
  const ref = doc(db, 'users', fbUser.uid, 'wardrobe', docId);

  try {
    const existing = await getDoc(ref);
    const fields = {
      name: clampString(item.name, 140, 'Garment'),
      category: item.category,
      targetGender: item.target_gender || 'unisex',
      color: clampString(item.color, 60, 'Neutral'),
      secondaryColor: clampString(item.secondary_color, 60),
      pattern: clampString(item.pattern, 60, 'Solid'),
      style: clampString(item.style, 80, 'Casual'),
      season: item.season || 'All-Season',
      notes: clampString(item.notes, 500),
      imagePath: clampString(item.image_path, 512),
      wearCount: Math.max(0, Math.floor(item.wear_count || 0)),
      isFavourite: Boolean(item.is_favourite),
      updatedAt: serverTimestamp(),
    };

    if (!existing.exists()) {
      await setDoc(ref, {
        uid: fbUser.uid,
        localId: item.id,
        ...fields,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, fields);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function deleteWardrobeItemFromFirestore(localId: number): Promise<void> {
  const fbUser = isVerifiedFirebaseUser();
  if (!fbUser) return;

  const docId = `item_${localId}`;
  const docPath = `users/${fbUser.uid}/wardrobe/${docId}`;
  try {
    await deleteDoc(doc(db, 'users', fbUser.uid, 'wardrobe', docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export async function syncOutfitToFirestore(outfit: Outfit): Promise<void> {
  const fbUser = isVerifiedFirebaseUser();
  if (!fbUser) return;

  const docId = `outfit_${outfit.id}`;
  const docPath = `users/${fbUser.uid}/outfits/${docId}`;
  const ref = doc(db, 'users', fbUser.uid, 'outfits', docId);

  try {
    const existing = await getDoc(ref);
    const fields = {
      name: clampString(outfit.name, 140, 'Saved Outfit'),
      occasion: clampString(outfit.occasion, 80, 'Casual'),
      reasoning: clampString(outfit.reasoning, 600),
      source: outfit.source || 'manual',
      weatherContext: clampString(outfit.weather_context, 200),
      itemIds: outfit.items
        .map((i) => i.id)
        .filter((id) => Number.isInteger(id))
        .slice(0, 20),
      wearCount: Math.max(0, Math.floor(outfit.wear_count || 0)),
      isFavourite: Boolean(outfit.is_favourite),
      updatedAt: serverTimestamp(),
    };

    if (!existing.exists()) {
      await setDoc(ref, {
        uid: fbUser.uid,
        localId: outfit.id,
        ...fields,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, fields);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function deleteOutfitFromFirestore(localId: number): Promise<void> {
  const fbUser = isVerifiedFirebaseUser();
  if (!fbUser) return;

  const docId = `outfit_${localId}`;
  const docPath = `users/${fbUser.uid}/outfits/${docId}`;
  try {
    await deleteDoc(doc(db, 'users', fbUser.uid, 'outfits', docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export async function syncCalendarEntryToFirestore(entry: CalendarEntry): Promise<void> {
  const fbUser = isVerifiedFirebaseUser();
  if (!fbUser) return;

  const docId = `cal_${entry.id}`;
  const docPath = `users/${fbUser.uid}/calendar/${docId}`;
  const ref = doc(db, 'users', fbUser.uid, 'calendar', docId);

  try {
    const existing = await getDoc(ref);
    const fields = {
      plannedDate: clampString(entry.planned_date, 10),
      title: clampString(entry.title, 140, 'Planned Look'),
      occasion: clampString(entry.occasion, 80, 'Casual'),
      notes: clampString(entry.notes, 500),
      itemIds: (entry.item_ids || []).filter((id) => Number.isInteger(id)).slice(0, 20),
      updatedAt: serverTimestamp(),
    };

    if (!existing.exists()) {
      await setDoc(ref, {
        uid: fbUser.uid,
        localId: entry.id,
        ...fields,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, fields);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function deleteCalendarEntryFromFirestore(localId: number): Promise<void> {
  const fbUser = isVerifiedFirebaseUser();
  if (!fbUser) return;

  const docId = `cal_${localId}`;
  const docPath = `users/${fbUser.uid}/calendar/${docId}`;
  try {
    await deleteDoc(doc(db, 'users', fbUser.uid, 'calendar', docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export async function fetchCloudSnapshotCounts(): Promise<{
  wardrobeCount: number;
  outfitsCount: number;
}> {
  const fbUser = isVerifiedFirebaseUser();
  if (!fbUser) return { wardrobeCount: 0, outfitsCount: 0 };

  const wardrobePath = `users/${fbUser.uid}/wardrobe`;
  const outfitsPath = `users/${fbUser.uid}/outfits`;
  try {
    const [wSnap, oSnap] = await Promise.all([
      getDocs(query(collection(db, 'users', fbUser.uid, 'wardrobe'), where('uid', '==', fbUser.uid))),
      getDocs(query(collection(db, 'users', fbUser.uid, 'outfits'), where('uid', '==', fbUser.uid))),
    ]);
    return { wardrobeCount: wSnap.size, outfitsCount: oSnap.size };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `${wardrobePath} | ${outfitsPath}`);
  }
}

export async function clearWardrobeFromFirestore(): Promise<void> {
  const fbUser = isVerifiedFirebaseUser();
  if (!fbUser) return;

  const wardrobePath = `users/${fbUser.uid}/wardrobe`;
  let snap;
  try {
    snap = await getDocs(
      query(collection(db, 'users', fbUser.uid, 'wardrobe'), where('uid', '==', fbUser.uid))
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, wardrobePath);
  }

  for (const d of snap.docs) {
    try {
      await deleteDoc(d.ref);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${wardrobePath}/${d.id}`);
    }
  }
}

export async function deleteAllUserDataFromFirestore(): Promise<void> {
  const fbUser = isVerifiedFirebaseUser();
  if (!fbUser) return;

  const subcollections = ['wardrobe', 'outfits', 'calendar'] as const;
  for (const colName of subcollections) {
    const colPath = `users/${fbUser.uid}/${colName}`;
    let snap;
    try {
      snap = await getDocs(
        query(collection(db, 'users', fbUser.uid, colName), where('uid', '==', fbUser.uid))
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, colPath);
    }

    for (const d of snap.docs) {
      try {
        await deleteDoc(d.ref);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `${colPath}/${d.id}`);
      }
    }
  }

  const profilePath = `users/${fbUser.uid}/private/profile`;
  try {
    await deleteDoc(doc(db, 'users', fbUser.uid, 'private', 'profile'));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, profilePath);
  }
}
