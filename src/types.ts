export type GenderOption = 'female' | 'male';

export type GarmentGender = 'unisex' | 'female' | 'male';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  gender: GenderOption;
}

export type ClothingCategory =
  | 'tops'
  | 'bottoms'
  | 'dresses'
  | 'outerwear'
  | 'shoes'
  | 'accessories';

export type SeasonTag = 'All-Season' | 'Spring' | 'Summer' | 'Autumn' | 'Winter';

export type OccasionType =
  | 'College'
  | 'Casual'
  | 'Office'
  | 'Party'
  | 'Travel'
  | 'Custom';

export interface ClothingItem {
  id: number;
  name: string;
  category: ClothingCategory;
  target_gender: GarmentGender;
  color: string;
  secondary_color: string;
  pattern: string;
  style: string;
  season: SeasonTag;
  notes: string;
  image_path: string;
  wear_count: number;
  last_worn_at: string | null;
  created_at: string;
  updated_at: string;
  is_favourite?: boolean;
}

export interface OutfitItemDetail extends ClothingItem {
  slot_role: string;
}

export interface Outfit {
  id: number;
  name: string;
  occasion: string;
  reasoning: string;
  source: 'gemma' | 'local-fallback' | 'manual';
  weather_context: string;
  wear_count: number;
  last_worn_at: string | null;
  created_at: string;
  items: OutfitItemDetail[];
  is_favourite?: boolean;
}

export interface OutfitSuggestionDraft {
  tempId: string;
  name: string;
  occasion: string;
  reasoning: string;
  stylingTip: string;
  source: 'gemma' | 'local-fallback';
  weatherContext?: string;
  items: ClothingItem[];
  savedOutfitId?: number;
  isFavourite?: boolean;
}

export interface GenerationHistoryEntry {
  id: number;
  occasion: string;
  custom_prompt: string;
  source: 'gemma' | 'local-fallback';
  model_used: string;
  weather_context: string;
  outfits: OutfitSuggestionDraft[];
  created_at: string;
}

export interface WearHistoryEntry {
  id: number;
  worn_date: string;
  outfit_id: number | null;
  outfit_name: string | null;
  clothing_item_id: number | null;
  clothing_name: string | null;
  clothing_image_path: string | null;
  clothing_category: string | null;
  occasion: string;
  notes: string;
  created_at: string;
}

export interface CalendarEntry {
  id: number;
  planned_date: string;
  outfit_id: number | null;
  title: string;
  occasion: string;
  notes: string;
  item_ids: number[];
  items: ClothingItem[];
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  gender: GenderOption;
  style_preferences: string;
  preferred_colors: string;
  avoid_colors: string;
  fit_preference: string;
  bio: string;
  updated_at: string;
}

export interface UserSettings {
  id: number;
  gemma_model: string;
  preferred_city: string;
  preferred_lat: number | null;
  preferred_lon: number | null;
  temperature_unit: 'C' | 'F';
  updated_at: string;
}

export interface StorageInfo {
  dataDir: string;
  dbPath: string;
  dbSizeBytes: number;
  uploadsCount: number;
  uploadsSizeBytes: number;
  hasServerApiKey: boolean;
  electronReady: boolean;
}

export interface WeatherCurrent {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  condition: string;
  isDay: boolean;
  unit: 'C' | 'F';
}

export interface WeatherForecastDay {
  date: string;
  weatherCode: number;
  condition: string;
  tempMax: number;
  tempMin: number;
  precipitationProbability: number;
  humidity?: number;
}

export interface WeatherReport {
  city: string;
  country?: string;
  latitude: number;
  longitude: number;
  timezone: string;
  fetchedAt: string;
  current: WeatherCurrent;
  daily: WeatherForecastDay[];
}

export interface CitySearchResult {
  id: number;
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
}

export interface DashboardData {
  stats: {
    totalClothing: number;
    totalOutfits: number;
    totalFavourites: number;
    totalWears: number;
    totalGenerations?: number;
  };
  recentItems: ClothingItem[];
  mostWornItems: ClothingItem[];
  leastWornItems: ClothingItem[];
  dailySuggestion: OutfitSuggestionDraft | null;
  upcomingPlans: CalendarEntry[];
}

export interface RecognitionResult {
  name: string;
  category: ClothingCategory;
  target_gender?: GarmentGender;
  color: string;
  secondary_color: string;
  pattern: string;
  style: string;
  season: SeasonTag;
  notes: string;
  confidenceNote?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  referencedItems?: ClothingItem[];
  modelUsed?: string;
  timestamp: string;
}

export interface StylesyncDesktopBridge {
  isElectron: boolean;
  platform: string;
  getDesktopInfo?: () => Promise<{
    isElectron: boolean;
    platform: string;
    appVersion: string;
    dataDir: string;
  }>;
  openDataFolder?: () => Promise<{ ok: boolean; error?: string }>;
  openExternalUrl?: (url: string) => Promise<{ ok: boolean; error?: string }>;
  focusWindow?: () => Promise<{ ok: boolean }>;
}

declare global {
  interface Window {
    stylesyncDesktop?: StylesyncDesktopBridge;
  }
}
