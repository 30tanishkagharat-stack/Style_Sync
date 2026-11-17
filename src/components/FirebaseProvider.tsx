import {
  deleteUser,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';

interface FirebaseContextValue {
  firebaseUser: User | null;
  authReady: boolean;
  cloudProfileExists: boolean;
  signInWithGoogle: () => Promise<User>;
  signInWithGoogleWithTokens: () => Promise<{
    user: User;
    googleIdToken?: string;
    googleAccessToken?: string;
  }>;
  signInWithGoogleCredential: (
    googleIdToken?: string,
    googleAccessToken?: string
  ) => Promise<void>;
  signOutFirebase: () => Promise<void>;
  deleteFirebaseAccount: () => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

export function FirebaseProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [cloudProfileExists, setCloudProfileExists] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !firebaseUser || !firebaseUser.emailVerified) {
      setCloudProfileExists(false);
      return;
    }

    const profilePath = `users/${firebaseUser.uid}/private/profile`;
    const unsub = onSnapshot(
      doc(db, 'users', firebaseUser.uid, 'private', 'profile'),
      (snap) => {
        setCloudProfileExists(snap.exists());
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, profilePath);
      }
    );

    return () => unsub();
  }, [authReady, firebaseUser]);

  const signInWithGoogle = async () => {
    const cred = await signInWithPopup(auth, googleProvider);
    return cred.user;
  };

  const signInWithGoogleWithTokens = async () => {
    const cred = await signInWithPopup(auth, googleProvider);
    const oauthCred = GoogleAuthProvider.credentialFromResult(cred);
    return {
      user: cred.user,
      googleIdToken: oauthCred?.idToken || undefined,
      googleAccessToken: oauthCred?.accessToken || undefined,
    };
  };

  const signInWithGoogleCredential = async (
    googleIdToken?: string,
    googleAccessToken?: string
  ) => {
    if (!googleIdToken && !googleAccessToken) return;
    const credential = GoogleAuthProvider.credential(
      googleIdToken ?? null,
      googleAccessToken ?? null
    );
    await signInWithCredential(auth, credential);
  };

  const signOutFirebase = async () => {
    await signOut(auth);
  };

  const deleteFirebaseAccount = async () => {
    if (!auth.currentUser) return;
    try {
      await deleteUser(auth.currentUser);
    } catch {
      await signOut(auth).catch(() => {});
    }
  };

  return (
    <FirebaseContext.Provider
      value={{
        firebaseUser,
        authReady,
        cloudProfileExists,
        signInWithGoogle,
        signInWithGoogleWithTokens,
        signInWithGoogleCredential,
        signOutFirebase,
        deleteFirebaseAccount,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase(): FirebaseContextValue {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebase must be used inside FirebaseProvider.');
  }
  return ctx;
}
