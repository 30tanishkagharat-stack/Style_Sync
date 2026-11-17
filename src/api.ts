import {
  clearWardrobeFromFirestore,
  deleteAllUserDataFromFirestore,
  deleteCalendarEntryFromFirestore,
  deleteOutfitFromFirestore,
  deleteWardrobeItemFromFirestore,
  syncCalendarEntryToFirestore,
  syncOutfitToFirestore,
  syncProfileToFirestore,
  syncWardrobeItemToFirestore,
} from './firestoreSync';
import type {
  AuthUser,
  CalendarEntry,
  CitySearchResult,
  ClothingItem,
  DashboardData,
  GenderOption,
  GenerationHistoryEntry,
  Outfit,
  OutfitSuggestionDraft,
  RecognitionResult,
  StorageInfo,
  UserProfile,
  UserSettings,
  WearHistoryEntry,
  WeatherReport,
} from './types';

const TOKEN_STORAGE_KEY = 'stylesync_session_token';

function getStoredToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function setStoredToken(token: string | null): void {
  try {
    if (token) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options?.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  // Authentication
  getMe: () => request<{ user: AuthUser }>('/api/auth/me'),

  login: async (payload: { email: string; password: string; gender?: GenderOption }) => {
    const res = await request<{ user: AuthUser; token: string }>('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setStoredToken(res.token);
    return res;
  },

  register: async (payload: {
    name: string;
    email: string;
    password: string;
    gender: GenderOption;
  }) => {
    const res = await request<{ user: AuthUser; token: string }>('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setStoredToken(res.token);
    return res;
  },

  loginGuest: async (gender: GenderOption) => {
    const res = await request<{ user: AuthUser; token: string }>('/api/auth/guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gender }),
    });
    setStoredToken(res.token);
    return res;
  },

  loginWithFirebase: async (payload: { idToken: string; gender?: GenderOption }) => {
    const res = await request<{ user: AuthUser; token: string }>('/api/auth/firebase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setStoredToken(res.token);
    return res;
  },

  startDesktopGoogleAuth: () =>
    request<{ nonce: string }>('/api/auth/desktop-google/start', {
      method: 'POST',
    }),

  completeDesktopGoogleAuth: (payload: {
    nonce: string;
    idToken: string;
    googleIdToken?: string;
    googleAccessToken?: string;
    gender?: GenderOption;
  }) =>
    request<{ ok: boolean; email: string }>('/api/auth/desktop-google/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  pollDesktopGoogleAuth: async (nonce: string) => {
    const res = await request<{
      status: 'pending' | 'complete' | 'expired';
      user?: AuthUser;
      token?: string;
      googleIdToken?: string;
      googleAccessToken?: string;
    }>(`/api/auth/desktop-google/status?nonce=${encodeURIComponent(nonce)}`);
    if (res.status === 'complete' && res.token) {
      setStoredToken(res.token);
    }
    return res;
  },

  logout: async () => {
    try {
      await request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
    } finally {
      setStoredToken(null);
    }
  },

  changePassword: (payload: { currentPassword: string; newPassword: string }) =>
    request<{ ok: boolean }>('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  deleteAccount: async () => {
    await deleteAllUserDataFromFirestore().catch(() => {});
    try {
      return await request<{ deleted: boolean }>('/api/auth/account', { method: 'DELETE' });
    } finally {
      setStoredToken(null);
    }
  },

  getDashboard: () => request<DashboardData>('/api/dashboard'),

  // Wardrobe
  listWardrobe: (params?: {
    category?: string;
    target_gender?: string;
    search?: string;
    season?: string;
    color?: string;
    sort?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.category) sp.set('category', params.category);
    if (params?.target_gender) sp.set('target_gender', params.target_gender);
    if (params?.search) sp.set('search', params.search);
    if (params?.season) sp.set('season', params.season);
    if (params?.color) sp.set('color', params.color);
    if (params?.sort) sp.set('sort', params.sort);
    const qs = sp.toString();
    return request<{ items: ClothingItem[] }>(`/api/wardrobe${qs ? `?${qs}` : ''}`);
  },

  uploadWardrobeFiles: async (
    files: File[],
    metadata: {
      name?: string;
      category: string;
      target_gender?: string;
      color: string;
      secondary_color?: string;
      pattern: string;
      style: string;
      season: string;
      notes?: string;
    }
  ) => {
    const fd = new FormData();
    for (const f of files) {
      fd.append('images', f);
    }
    if (metadata.name) fd.append('name', metadata.name);
    fd.append('category', metadata.category);
    if (metadata.target_gender) fd.append('target_gender', metadata.target_gender);
    fd.append('color', metadata.color);
    if (metadata.secondary_color) fd.append('secondary_color', metadata.secondary_color);
    fd.append('pattern', metadata.pattern);
    fd.append('style', metadata.style);
    fd.append('season', metadata.season);
    if (metadata.notes) fd.append('notes', metadata.notes);

    const res = await request<{ items: ClothingItem[] }>('/api/wardrobe', {
      method: 'POST',
      body: fd,
    });
    void Promise.all(res.items.map((item) => syncWardrobeItemToFirestore(item))).catch(() => {});
    return res;
  },

  saveRecognizedGarment: async (payload: {
    name: string;
    category: string;
    target_gender?: string;
    color: string;
    secondary_color: string;
    pattern: string;
    style: string;
    season: string;
    notes: string;
    image_path: string;
  }) => {
    const res = await request<{ items: ClothingItem[] }>('/api/wardrobe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    void Promise.all(res.items.map((item) => syncWardrobeItemToFirestore(item))).catch(() => {});
    return res;
  },

  loadStarterWardrobe: async () => {
    const res = await request<{ inserted: number; items: ClothingItem[] }>('/api/wardrobe/starter', {
      method: 'POST',
    });
    void Promise.all(res.items.map((item) => syncWardrobeItemToFirestore(item))).catch(() => {});
    return res;
  },

  updateClothingItem: async (id: number, updates: Partial<ClothingItem>) => {
    const res = await request<{ item: ClothingItem }>(`/api/wardrobe/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    void syncWardrobeItemToFirestore(res.item).catch(() => {});
    return res;
  },

  deleteClothingItem: async (id: number) => {
    const res = await request<{ deleted: boolean }>(`/api/wardrobe/${id}`, {
      method: 'DELETE',
    });
    void deleteWardrobeItemFromFirestore(id).catch(() => {});
    return res;
  },

  clearAllWardrobeImages: async () => {
    const res = await request<{ deletedCount: number; deletedIds: number[] }>('/api/wardrobe/all', {
      method: 'DELETE',
    });
    void clearWardrobeFromFirestore().catch(() => {});
    return res;
  },

  // AI Studio
  recognizeClothing: async (file: File) => {
    const fd = new FormData();
    fd.append('image', file);
    return request<{
      ok: boolean;
      modelUsed?: string;
      modelAttempted?: string;
      previewImagePath: string;
      recognition?: RecognitionResult;
      manualFallback?: boolean;
      error?: string;
    }>('/api/ai/recognize', {
      method: 'POST',
      body: fd,
    });
  },

  recommendOutfits: (payload: {
    occasion: string;
    customPrompt?: string;
    includeWeather?: boolean;
  }) =>
    request<{
      source: 'gemma' | 'local-fallback';
      modelUsed?: string;
      modelAttempted?: string;
      fallbackReason?: string;
      outfits: OutfitSuggestionDraft[];
      weather: WeatherReport | null;
      historyEntry?: GenerationHistoryEntry;
    }>('/api/ai/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  listGenerationHistory: () =>
    request<{ history: GenerationHistoryEntry[] }>('/api/ai/history'),

  deleteGenerationHistory: (id: number) =>
    request<{ deleted: boolean }>(`/api/ai/history/${id}`, {
      method: 'DELETE',
    }),

  clearGenerationHistory: () =>
    request<{ cleared: boolean }>('/api/ai/history', {
      method: 'DELETE',
    }),

  sendFashionChat: (payload: {
    message: string;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
  }) =>
    request<{
      reply: string;
      referencedItems: ClothingItem[];
      modelUsed: string;
    }>('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  // Outfits
  listOutfits: () => request<{ outfits: Outfit[] }>('/api/outfits'),

  saveOutfit: async (payload: {
    name: string;
    occasion: string;
    reasoning: string;
    source: 'gemma' | 'local-fallback' | 'manual';
    weather_context?: string;
    item_ids: number[];
  }) => {
    const res = await request<{ outfit: Outfit }>('/api/outfits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    void syncOutfitToFirestore(res.outfit).catch(() => {});
    return res;
  },

  deleteOutfit: async (id: number) => {
    const res = await request<{ deleted: boolean }>(`/api/outfits/${id}`, {
      method: 'DELETE',
    });
    void deleteOutfitFromFirestore(id).catch(() => {});
    return res;
  },

  markOutfitWorn: (id: number, payload?: { worn_date?: string; occasion?: string; notes?: string }) =>
    request<{ entries: WearHistoryEntry[] }>(`/api/outfits/${id}/wear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    }),

  // Favourites
  listFavourites: () => request<{ clothing: ClothingItem[]; outfits: Outfit[] }>('/api/favourites'),

  toggleFavourite: async (itemType: 'clothing' | 'outfit', targetId: number) => {
    const res = await request<{ isFavourite: boolean }>('/api/favourites/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemType, targetId }),
    });
    if (itemType === 'clothing') {
      void api
        .listWardrobe()
        .then((w) => {
          const item = w.items.find((i) => i.id === targetId);
          if (item) return syncWardrobeItemToFirestore(item);
        })
        .catch(() => {});
    } else {
      void api
        .listOutfits()
        .then((o) => {
          const outfit = o.outfits.find((x) => x.id === targetId);
          if (outfit) return syncOutfitToFirestore(outfit);
        })
        .catch(() => {});
    }
    return res;
  },

  // Wear History & Calendar
  getWearHistory: () =>
    request<{
      history: WearHistoryEntry[];
      mostWorn: ClothingItem[];
      leastWorn: ClothingItem[];
    }>('/api/wear-history'),

  logWear: (payload: {
    worn_date?: string;
    outfit_id?: number | null;
    clothing_item_ids?: number[];
    occasion?: string;
    notes?: string;
  }) =>
    request<{ entries: WearHistoryEntry[] }>('/api/wear-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  deleteWearHistory: (id: number) =>
    request<{ deleted: boolean }>(`/api/wear-history/${id}`, {
      method: 'DELETE',
    }),

  listCalendar: (month?: string) =>
    request<{ entries: CalendarEntry[] }>(
      `/api/calendar${month ? `?month=${encodeURIComponent(month)}` : ''}`
    ),

  createCalendarEntry: async (payload: {
    planned_date: string;
    outfit_id?: number | null;
    title: string;
    occasion: string;
    notes?: string;
    item_ids?: number[];
  }) => {
    const res = await request<{ entry: CalendarEntry }>('/api/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    void syncCalendarEntryToFirestore(res.entry).catch(() => {});
    return res;
  },

  updateCalendarEntry: async (
    id: number,
    updates: Partial<{
      planned_date: string;
      outfit_id: number | null;
      title: string;
      occasion: string;
      notes: string;
      item_ids: number[];
    }>
  ) => {
    const res = await request<{ entry: CalendarEntry }>(`/api/calendar/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    void syncCalendarEntryToFirestore(res.entry).catch(() => {});
    return res;
  },

  deleteCalendarEntry: async (id: number) => {
    const res = await request<{ deleted: boolean }>(`/api/calendar/${id}`, {
      method: 'DELETE',
    });
    void deleteCalendarEntryFromFirestore(id).catch(() => {});
    return res;
  },

  // Weather
  searchCities: (q: string) =>
    request<{ results: CitySearchResult[] }>(`/api/weather/search?q=${encodeURIComponent(q)}`),

  getWeatherForecast: (params?: { city?: string; lat?: number; lon?: number; unit?: 'C' | 'F' }) => {
    const sp = new URLSearchParams();
    if (params?.city) sp.set('city', params.city);
    if (params?.lat !== undefined) sp.set('lat', String(params.lat));
    if (params?.lon !== undefined) sp.set('lon', String(params.lon));
    if (params?.unit) sp.set('unit', params.unit);
    const qs = sp.toString();
    return request<{ weather: WeatherReport }>(`/api/weather/forecast${qs ? `?${qs}` : ''}`, {
      cache: 'no-store',
    });
  },

  suggestWeatherOutfits: (payload?: {
    city?: string;
    lat?: number;
    lon?: number;
    occasion?: string;
  }) =>
    request<{
      source: 'gemma' | 'local-fallback';
      modelUsed?: string;
      modelAttempted?: string;
      fallbackReason?: string;
      weather: WeatherReport;
      outfits: OutfitSuggestionDraft[];
      historyEntry?: GenerationHistoryEntry;
    }>('/api/weather/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    }),

  // Settings
  getSettings: () =>
    request<{
      profile: UserProfile;
      settings: UserSettings;
      storage: StorageInfo;
    }>('/api/settings'),

  updateSettings: async (payload: {
    profile?: Partial<UserProfile>;
    settings?: Partial<UserSettings>;
  }) => {
    const res = await request<{
      profile: UserProfile;
      settings: UserSettings;
      storage: StorageInfo;
    }>('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    void syncProfileToFirestore(res.profile, res.settings).catch(() => {});
    return res;
  },
};
