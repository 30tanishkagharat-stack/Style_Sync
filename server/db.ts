import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  AuthUser,
  CalendarEntry,
  ClothingCategory,
  ClothingItem,
  DashboardData,
  GarmentGender,
  GenderOption,
  GenerationHistoryEntry,
  Outfit,
  OutfitItemDetail,
  OutfitSuggestionDraft,
  SeasonTag,
  StorageInfo,
  UserProfile,
  UserSettings,
  WearHistoryEntry,
} from '../src/types.ts';

export const DATA_DIR = process.env.STYLESYNC_DATA_DIR
  ? path.resolve(process.env.STYLESYNC_DATA_DIR)
  : path.resolve(process.cwd(), 'data');

export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
export const DB_PATH = path.join(DATA_DIR, 'stylesync.db');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL DEFAULT 'StyleSync Member',
      email TEXT NOT NULL DEFAULT '',
      style_preferences TEXT NOT NULL DEFAULT 'Minimalist, Tailored, Quiet Luxury',
      preferred_colors TEXT NOT NULL DEFAULT 'Cream, Charcoal, Camel, Rust, Espresso',
      avoid_colors TEXT NOT NULL DEFAULT 'Neon',
      fit_preference TEXT NOT NULL DEFAULT 'Relaxed Tailored',
      bio TEXT NOT NULL DEFAULT 'Building a thoughtful, versatile capsule wardrobe.',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      gemma_model TEXT NOT NULL DEFAULT 'gemma-4-26b-a4b-it',
      preferred_city TEXT NOT NULL DEFAULT 'New York',
      preferred_lat REAL DEFAULT 40.7128,
      preferred_lon REAL DEFAULT -74.006,
      temperature_unit TEXT NOT NULL DEFAULT 'C' CHECK (temperature_unit IN ('C', 'F')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS clothing_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'accessories')),
      color TEXT NOT NULL DEFAULT 'Neutral',
      secondary_color TEXT NOT NULL DEFAULT '',
      pattern TEXT NOT NULL DEFAULT 'Solid',
      style TEXT NOT NULL DEFAULT 'Casual',
      season TEXT NOT NULL DEFAULT 'All-Season',
      notes TEXT NOT NULL DEFAULT '',
      image_path TEXT NOT NULL,
      wear_count INTEGER NOT NULL DEFAULT 0,
      last_worn_at TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS outfits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      occasion TEXT NOT NULL DEFAULT 'Casual',
      reasoning TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'gemma' CHECK (source IN ('gemma', 'local-fallback', 'manual')),
      weather_context TEXT NOT NULL DEFAULT '',
      wear_count INTEGER NOT NULL DEFAULT 0,
      last_worn_at TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS outfit_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      outfit_id INTEGER NOT NULL,
      clothing_item_id INTEGER NOT NULL,
      slot_role TEXT NOT NULL DEFAULT 'piece',
      FOREIGN KEY (outfit_id) REFERENCES outfits(id) ON DELETE CASCADE,
      FOREIGN KEY (clothing_item_id) REFERENCES clothing_items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS favourites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_type TEXT NOT NULL CHECK (item_type IN ('clothing', 'outfit')),
      clothing_item_id INTEGER DEFAULT NULL,
      outfit_id INTEGER DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (clothing_item_id) REFERENCES clothing_items(id) ON DELETE CASCADE,
      FOREIGN KEY (outfit_id) REFERENCES outfits(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_fav_clothing
      ON favourites(clothing_item_id) WHERE clothing_item_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_fav_outfit
      ON favourites(outfit_id) WHERE outfit_id IS NOT NULL;

    CREATE TABLE IF NOT EXISTS wear_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worn_date TEXT NOT NULL,
      outfit_id INTEGER DEFAULT NULL,
      clothing_item_id INTEGER DEFAULT NULL,
      occasion TEXT NOT NULL DEFAULT 'Daily',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (outfit_id) REFERENCES outfits(id) ON DELETE SET NULL,
      FOREIGN KEY (clothing_item_id) REFERENCES clothing_items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS outfit_calendar (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      planned_date TEXT NOT NULL,
      outfit_id INTEGER DEFAULT NULL,
      title TEXT NOT NULL,
      occasion TEXT NOT NULL DEFAULT 'Casual',
      notes TEXT NOT NULL DEFAULT '',
      item_ids_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (outfit_id) REFERENCES outfits(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      gender TEXT NOT NULL DEFAULT 'female' CHECK (gender IN ('female', 'male')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS generation_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      occasion TEXT NOT NULL DEFAULT 'Casual',
      custom_prompt TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'gemma' CHECK (source IN ('gemma', 'local-fallback')),
      model_used TEXT NOT NULL DEFAULT '',
      weather_context TEXT NOT NULL DEFAULT '',
      outfits_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT OR IGNORE INTO user_profile (id) VALUES (1);
    INSERT OR IGNORE INTO user_settings (id) VALUES (1);
  `);

  const profileCols = db.prepare('PRAGMA table_info(user_profile)').all() as Array<{ name: string }>;
  if (!profileCols.some((c) => c.name === 'gender')) {
    db.exec(
      "ALTER TABLE user_profile ADD COLUMN gender TEXT NOT NULL DEFAULT 'female' CHECK (gender IN ('female', 'male'))"
    );
  }

  const clothingCols = db.prepare('PRAGMA table_info(clothing_items)').all() as Array<{ name: string }>;
  if (!clothingCols.some((c) => c.name === 'target_gender')) {
    db.exec(
      "ALTER TABLE clothing_items ADD COLUMN target_gender TEXT NOT NULL DEFAULT 'unisex' CHECK (target_gender IN ('unisex', 'female', 'male'))"
    );
  }
}

initDatabase();

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, originalHash] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(originalHash, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

db.prepare("DELETE FROM users WHERE email = 'demo@stylesync.app'").run();

function createSessionForUser(userId: number): string {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(
    token,
    userId,
    expiresAt
  );
  return token;
}

function syncActiveProfileFromUser(user: AuthUser): void {
  db.prepare(
    "UPDATE user_profile SET name = ?, email = ?, gender = ?, updated_at = datetime('now') WHERE id = 1"
  ).run(user.name, user.email, user.gender);
}

export function registerUser(input: {
  name: string;
  email: string;
  password: string;
  gender: GenderOption;
}): { user: AuthUser; token: string } {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim() || 'StyleSync Member';
  const gender: GenderOption = input.gender === 'male' ? 'male' : 'female';

  if (!email || !email.includes('@')) {
    throw new Error('Please enter a valid email address.');
  }
  if (input.password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as
    | { id: number }
    | undefined;
  if (existing) {
    throw new Error('An account with this email already exists. Please sign in.');
  }

  const passwordHash = hashPassword(input.password);
  const info = db
    .prepare('INSERT INTO users (name, email, password_hash, gender) VALUES (?, ?, ?, ?)')
    .run(name, email, passwordHash, gender);

  const user: AuthUser = {
    id: Number(info.lastInsertRowid),
    name,
    email,
    gender,
  };
  syncActiveProfileFromUser(user);
  const token = createSessionForUser(user.id);
  return { user, token };
}

export function loginUser(input: {
  email: string;
  password: string;
  gender?: GenderOption;
}): { user: AuthUser; token: string } {
  const email = input.email.trim().toLowerCase();
  const row = db
    .prepare('SELECT id, name, email, password_hash, gender FROM users WHERE email = ?')
    .get(email) as
    | { id: number; name: string; email: string; password_hash: string; gender: GenderOption }
    | undefined;

  if (!row || !verifyPassword(input.password, row.password_hash)) {
    throw new Error('Invalid email or password.');
  }

  const gender: GenderOption =
    input.gender === 'male' || input.gender === 'female' ? input.gender : row.gender;
  if (gender !== row.gender) {
    db.prepare('UPDATE users SET gender = ? WHERE id = ?').run(gender, row.id);
  }

  const user: AuthUser = {
    id: row.id,
    name: row.name,
    email: row.email,
    gender,
  };
  syncActiveProfileFromUser(user);
  const token = createSessionForUser(user.id);
  return { user, token };
}

export function loginGuestUser(genderInput: GenderOption): { user: AuthUser; token: string } {
  const gender: GenderOption = genderInput === 'male' ? 'male' : 'female';
  const email = 'member@stylesync.local';
  const existing = db
    .prepare('SELECT id, name, email, gender FROM users WHERE email = ?')
    .get(email) as AuthUser | undefined;

  let user: AuthUser;
  if (existing) {
    db.prepare('UPDATE users SET gender = ? WHERE id = ?').run(gender, existing.id);
    user = { ...existing, gender };
  } else {
    const info = db
      .prepare('INSERT INTO users (name, email, password_hash, gender) VALUES (?, ?, ?, ?)')
      .run('StyleSync Member', email, hashPassword(crypto.randomBytes(16).toString('hex')), gender);
    user = {
      id: Number(info.lastInsertRowid),
      name: 'StyleSync Member',
      email,
      gender,
    };
  }

  syncActiveProfileFromUser(user);
  const token = createSessionForUser(user.id);
  return { user, token };
}

export function loginFirebaseUser(input: {
  email: string;
  name: string;
  gender?: GenderOption;
}): { user: AuthUser; token: string } {
  const email = input.email.trim().toLowerCase();
  if (!email) {
    throw new Error('Firebase account email is required.');
  }

  const existing = db
    .prepare('SELECT id, name, email, gender FROM users WHERE email = ?')
    .get(email) as AuthUser | undefined;

  let user: AuthUser;
  if (existing) {
    const resolvedGender: GenderOption =
      input.gender === 'male' || input.gender === 'female' ? input.gender : existing.gender;
    const resolvedName = existing.name || input.name.trim() || email.split('@')[0];
    if (resolvedGender !== existing.gender || resolvedName !== existing.name) {
      db.prepare('UPDATE users SET name = ?, gender = ? WHERE id = ?').run(
        resolvedName,
        resolvedGender,
        existing.id
      );
    }
    user = {
      id: existing.id,
      name: resolvedName,
      email: existing.email,
      gender: resolvedGender,
    };
  } else {
    const gender: GenderOption = input.gender === 'male' ? 'male' : 'female';
    const name = input.name.trim() || email.split('@')[0] || 'StyleSync Member';
    const info = db
      .prepare('INSERT INTO users (name, email, password_hash, gender) VALUES (?, ?, ?, ?)')
      .run(name, email, hashPassword(crypto.randomBytes(24).toString('hex')), gender);
    user = {
      id: Number(info.lastInsertRowid),
      name,
      email,
      gender,
    };
  }

  syncActiveProfileFromUser(user);
  const token = createSessionForUser(user.id);
  return { user, token };
}

export function getSessionUser(token: string | undefined): AuthUser | null {
  if (!token) return null;
  const row = db
    .prepare(
      `
      SELECT u.id, u.name, u.email, u.gender, s.expires_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = ?
      `
    )
    .get(token) as (AuthUser & { expires_at: string }) | undefined;

  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    gender: row.gender,
  };
}

export function logoutSession(token: string | undefined): void {
  if (!token) return;
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function changeUserPassword(
  userId: number,
  currentPassword: string,
  newPassword: string
): void {
  if (!newPassword || newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters.');
  }
  const row = db
    .prepare('SELECT id, password_hash FROM users WHERE id = ?')
    .get(userId) as { id: number; password_hash: string } | undefined;
  if (!row) {
    throw new Error('Account not found.');
  }
  if (!verifyPassword(currentPassword, row.password_hash)) {
    throw new Error('Current password is incorrect.');
  }
  const nextHash = hashPassword(newPassword);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(nextHash, userId);
}

export function deleteUserAccount(userId: number): void {
  const items = db
    .prepare('SELECT image_path FROM clothing_items')
    .all() as Array<{ image_path: string }>;

  for (const item of items) {
    if (item.image_path.startsWith('/uploads/')) {
      const fullPath = path.join(UPLOADS_DIR, path.basename(item.image_path));
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
        } catch {
          // Ignore file removal errors
        }
      }
    }
  }

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM wear_history').run();
    db.prepare('DELETE FROM generation_history').run();
    db.prepare('DELETE FROM favourites').run();
    db.prepare('DELETE FROM outfit_calendar').run();
    db.prepare('DELETE FROM outfit_items').run();
    db.prepare('DELETE FROM outfits').run();
    db.prepare('DELETE FROM clothing_items').run();
    db.prepare(
      `
      UPDATE user_profile
      SET name = 'StyleSync Member',
          email = '',
          gender = 'female',
          style_preferences = 'Minimalist, Tailored, Quiet Luxury',
          preferred_colors = 'Cream, Charcoal, Camel, Rust, Espresso',
          avoid_colors = 'Neon',
          fit_preference = 'Relaxed Tailored',
          bio = 'Building a thoughtful, versatile capsule wardrobe.',
          updated_at = datetime('now')
      WHERE id = 1
      `
    ).run();
    db.prepare(
      `
      UPDATE user_settings
      SET gemma_model = 'gemma-4-26b-a4b-it',
          preferred_city = 'New York',
          preferred_lat = 40.7128,
          preferred_lon = -74.006,
          temperature_unit = 'C',
          updated_at = datetime('now')
      WHERE id = 1
      `
    ).run();
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  });

  tx();
}

export function getProfile(sessionUser?: AuthUser | null): UserProfile {
  const profile = db.prepare('SELECT * FROM user_profile WHERE id = 1').get() as UserProfile;
  if (sessionUser?.email) {
    const cleanEmail = sessionUser.email.trim();
    if (profile.email !== cleanEmail) {
      const nextName =
        profile.name === 'StyleSync Member' && sessionUser.name
          ? sessionUser.name
          : profile.name;
      db.prepare(
        "UPDATE user_profile SET email = ?, name = ?, updated_at = datetime('now') WHERE id = 1"
      ).run(cleanEmail, nextName);
      return { ...profile, email: cleanEmail, name: nextName };
    }
  }
  return profile;
}

export function getSettings(): UserSettings {
  return db.prepare('SELECT * FROM user_settings WHERE id = 1').get() as UserSettings;
}

export function updateProfileAndSettings(
  payload: {
    profile?: Partial<Omit<UserProfile, 'id' | 'updated_at'>>;
    settings?: Partial<Omit<UserSettings, 'id' | 'updated_at'>>;
  },
  sessionUser?: AuthUser | null
): { profile: UserProfile; settings: UserSettings } {
  const currentProfile = getProfile(sessionUser);
  const currentSettings = getSettings();

  if (payload.profile) {
    const p = { ...currentProfile, ...payload.profile };
    const preservedEmail = (sessionUser?.email || currentProfile.email).trim();
    const gender: GenderOption = p.gender === 'male' ? 'male' : 'female';
    db.prepare(`
      UPDATE user_profile
      SET name = ?, email = ?, gender = ?, style_preferences = ?, preferred_colors = ?,
          avoid_colors = ?, fit_preference = ?, bio = ?, updated_at = datetime('now')
      WHERE id = 1
    `).run(
      p.name.trim() || 'StyleSync Member',
      preservedEmail,
      gender,
      p.style_preferences.trim(),
      p.preferred_colors.trim(),
      p.avoid_colors.trim(),
      p.fit_preference.trim(),
      p.bio.trim()
    );
    if (preservedEmail) {
      db.prepare('UPDATE users SET name = ?, gender = ? WHERE email = ?').run(
        p.name.trim() || 'StyleSync Member',
        gender,
        preservedEmail.toLowerCase()
      );
    }
  }

  if (payload.settings) {
    const s = { ...currentSettings, ...payload.settings };
    const model = (s.gemma_model || 'gemma-4-26b-a4b-it').trim();
    db.prepare(`
      UPDATE user_settings
      SET gemma_model = ?, preferred_city = ?, preferred_lat = ?, preferred_lon = ?,
          temperature_unit = ?, updated_at = datetime('now')
      WHERE id = 1
    `).run(
      model,
      (s.preferred_city || 'New York').trim(),
      s.preferred_lat ?? null,
      s.preferred_lon ?? null,
      s.temperature_unit === 'F' ? 'F' : 'C'
    );
  }

  return { profile: getProfile(), settings: getSettings() };
}

export function listClothingItems(params?: {
  category?: string;
  target_gender?: string;
  search?: string;
  season?: string;
  color?: string;
  sort?: string;
}): ClothingItem[] {
  const conditions: string[] = [];
  const args: unknown[] = [];

  if (params?.category && params.category !== 'all') {
    conditions.push('c.category = ?');
    args.push(params.category);
  }
  if (params?.target_gender && params.target_gender !== 'all') {
    conditions.push('c.target_gender = ?');
    args.push(params.target_gender);
  }
  if (params?.season && params.season !== 'all') {
    conditions.push('c.season = ?');
    args.push(params.season);
  }
  if (params?.color && params.color !== 'all') {
    conditions.push('(LOWER(c.color) LIKE ? OR LOWER(c.secondary_color) LIKE ?)');
    const cLike = `%${params.color.toLowerCase()}%`;
    args.push(cLike, cLike);
  }
  if (params?.search && params.search.trim()) {
    conditions.push(
      '(LOWER(c.name) LIKE ? OR LOWER(c.color) LIKE ? OR LOWER(c.style) LIKE ? OR LOWER(c.pattern) LIKE ? OR LOWER(c.notes) LIKE ?)'
    );
    const q = `%${params.search.trim().toLowerCase()}%`;
    args.push(q, q, q, q, q);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  let orderBy = 'ORDER BY c.created_at DESC, c.id DESC';
  if (params?.sort === 'most_worn') {
    orderBy = 'ORDER BY c.wear_count DESC, c.created_at DESC';
  } else if (params?.sort === 'least_worn') {
    orderBy = 'ORDER BY c.wear_count ASC, c.created_at DESC';
  } else if (params?.sort === 'name_asc') {
    orderBy = 'ORDER BY LOWER(c.name) ASC';
  }

  const rows = db
    .prepare(
      `
      SELECT c.*,
        CASE WHEN f.id IS NOT NULL THEN 1 ELSE 0 END AS is_fav_num
      FROM clothing_items c
      LEFT JOIN favourites f ON f.clothing_item_id = c.id AND f.item_type = 'clothing'
      ${whereClause}
      ${orderBy}
      `
    )
    .all(...args) as (ClothingItem & { is_fav_num: number })[];

  return rows.map(({ is_fav_num, ...rest }) => ({
    ...rest,
    is_favourite: Boolean(is_fav_num),
  }));
}

export function getClothingItemById(id: number): ClothingItem | null {
  const row = db
    .prepare(
      `
      SELECT c.*,
        CASE WHEN f.id IS NOT NULL THEN 1 ELSE 0 END AS is_fav_num
      FROM clothing_items c
      LEFT JOIN favourites f ON f.clothing_item_id = c.id AND f.item_type = 'clothing'
      WHERE c.id = ?
      `
    )
    .get(id) as (ClothingItem & { is_fav_num: number }) | undefined;
  if (!row) return null;
  const { is_fav_num, ...rest } = row;
  return { ...rest, is_favourite: Boolean(is_fav_num) };
}

export function createClothingItem(input: {
  name: string;
  category: ClothingCategory;
  target_gender?: GarmentGender;
  color: string;
  secondary_color?: string;
  pattern?: string;
  style?: string;
  season?: SeasonTag;
  notes?: string;
  image_path: string;
}): ClothingItem {
  const targetGender: GarmentGender =
    input.target_gender === 'female' || input.target_gender === 'male'
      ? input.target_gender
      : 'unisex';

  const result = db
    .prepare(
      `
      INSERT INTO clothing_items (name, category, target_gender, color, secondary_color, pattern, style, season, notes, image_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .run(
      input.name.trim(),
      input.category,
      targetGender,
      input.color.trim() || 'Neutral',
      (input.secondary_color || '').trim(),
      (input.pattern || 'Solid').trim(),
      (input.style || 'Casual').trim(),
      input.season || 'All-Season',
      (input.notes || '').trim(),
      input.image_path
    );

  return getClothingItemById(Number(result.lastInsertRowid))!;
}

export function updateClothingItem(
  id: number,
  updates: Partial<{
    name: string;
    category: ClothingCategory;
    target_gender: GarmentGender;
    color: string;
    secondary_color: string;
    pattern: string;
    style: string;
    season: SeasonTag;
    notes: string;
  }>
): ClothingItem | null {
  const existing = getClothingItemById(id);
  if (!existing) return null;

  db.prepare(
    `
    UPDATE clothing_items
    SET name = ?, category = ?, target_gender = ?, color = ?, secondary_color = ?, pattern = ?,
        style = ?, season = ?, notes = ?, updated_at = datetime('now')
    WHERE id = ?
    `
  ).run(
    (updates.name ?? existing.name).trim(),
    updates.category ?? existing.category,
    updates.target_gender ?? existing.target_gender ?? 'unisex',
    (updates.color ?? existing.color).trim(),
    (updates.secondary_color ?? existing.secondary_color).trim(),
    (updates.pattern ?? existing.pattern).trim(),
    (updates.style ?? existing.style).trim(),
    updates.season ?? existing.season,
    (updates.notes ?? existing.notes).trim(),
    id
  );

  return getClothingItemById(id);
}

export function deleteClothingItem(id: number): boolean {
  const existing = getClothingItemById(id);
  if (!existing) return false;

  const info = db.prepare('DELETE FROM clothing_items WHERE id = ?').run(id);
  if (info.changes > 0 && existing.image_path.startsWith('/uploads/')) {
    const filename = path.basename(existing.image_path);
    const fullPath = path.join(UPLOADS_DIR, filename);
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
      } catch {
        // Ignore cleanup failure
      }
    }
  }
  return info.changes > 0;
}

export function clearAllWardrobeImages(): number[] {
  const rows = db
    .prepare('SELECT id, image_path FROM clothing_items')
    .all() as Array<{ id: number; image_path: string }>;

  for (const row of rows) {
    if (row.image_path.startsWith('/uploads/')) {
      const fullPath = path.join(UPLOADS_DIR, path.basename(row.image_path));
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
        } catch {
          // Ignore cleanup failure
        }
      }
    }
  }

  db.prepare('DELETE FROM clothing_items').run();
  return rows.map((r) => r.id);
}

export function listOutfits(): Outfit[] {
  const outfits = db
    .prepare(
      `
      SELECT o.*,
        CASE WHEN f.id IS NOT NULL THEN 1 ELSE 0 END AS is_fav_num
      FROM outfits o
      LEFT JOIN favourites f ON f.outfit_id = o.id AND f.item_type = 'outfit'
      ORDER BY o.created_at DESC, o.id DESC
      `
    )
    .all() as (Omit<Outfit, 'items' | 'is_favourite'> & { is_fav_num: number })[];

  const itemStmt = db.prepare(
    `
    SELECT c.*, oi.slot_role
    FROM outfit_items oi
    JOIN clothing_items c ON c.id = oi.clothing_item_id
    WHERE oi.outfit_id = ?
    ORDER BY oi.id ASC
    `
  );

  return outfits.map(({ is_fav_num, ...outfit }) => ({
    ...outfit,
    is_favourite: Boolean(is_fav_num),
    items: itemStmt.all(outfit.id) as OutfitItemDetail[],
  }));
}

export function getOutfitById(id: number): Outfit | null {
  const outfit = db
    .prepare(
      `
      SELECT o.*,
        CASE WHEN f.id IS NOT NULL THEN 1 ELSE 0 END AS is_fav_num
      FROM outfits o
      LEFT JOIN favourites f ON f.outfit_id = o.id AND f.item_type = 'outfit'
      WHERE o.id = ?
      `
    )
    .get(id) as (Omit<Outfit, 'items' | 'is_favourite'> & { is_fav_num: number }) | undefined;

  if (!outfit) return null;
  const items = db
    .prepare(
      `
      SELECT c.*, oi.slot_role
      FROM outfit_items oi
      JOIN clothing_items c ON c.id = oi.clothing_item_id
      WHERE oi.outfit_id = ?
      ORDER BY oi.id ASC
      `
    )
    .all(id) as OutfitItemDetail[];

  const { is_fav_num, ...rest } = outfit;
  return { ...rest, is_favourite: Boolean(is_fav_num), items };
}

export function createOutfit(input: {
  name: string;
  occasion: string;
  reasoning?: string;
  source?: 'gemma' | 'local-fallback' | 'manual';
  weather_context?: string;
  item_ids: number[];
}): Outfit {
  const validItems = input.item_ids
    .map((itemId) => getClothingItemById(itemId))
    .filter((item): item is ClothingItem => item !== null);

  if (validItems.length === 0) {
    throw new Error('Outfit must include at least one valid wardrobe item.');
  }

  const tx = db.transaction(() => {
    const info = db
      .prepare(
        `
        INSERT INTO outfits (name, occasion, reasoning, source, weather_context)
        VALUES (?, ?, ?, ?, ?)
        `
      )
      .run(
        input.name.trim() || 'Curated Look',
        input.occasion.trim() || 'Casual',
        (input.reasoning || '').trim(),
        input.source || 'gemma',
        (input.weather_context || '').trim()
      );

    const outfitId = Number(info.lastInsertRowid);
    const insertItem = db.prepare(
      'INSERT INTO outfit_items (outfit_id, clothing_item_id, slot_role) VALUES (?, ?, ?)'
    );

    for (const item of validItems) {
      insertItem.run(outfitId, item.id, item.category);
    }

    return outfitId;
  });

  const outfitId = tx();
  return getOutfitById(outfitId)!;
}

export function deleteOutfit(id: number): boolean {
  const info = db.prepare('DELETE FROM outfits WHERE id = ?').run(id);
  return info.changes > 0;
}

export function toggleFavourite(
  itemType: 'clothing' | 'outfit',
  targetId: number
): { isFavourite: boolean } {
  if (itemType === 'clothing') {
    const existing = db
      .prepare("SELECT id FROM favourites WHERE item_type = 'clothing' AND clothing_item_id = ?")
      .get(targetId) as { id: number } | undefined;
    if (existing) {
      db.prepare('DELETE FROM favourites WHERE id = ?').run(existing.id);
      return { isFavourite: false };
    }
    const item = getClothingItemById(targetId);
    if (!item) throw new Error('Clothing item not found');
    db.prepare("INSERT INTO favourites (item_type, clothing_item_id) VALUES ('clothing', ?)").run(
      targetId
    );
    return { isFavourite: true };
  }

  const existing = db
    .prepare("SELECT id FROM favourites WHERE item_type = 'outfit' AND outfit_id = ?")
    .get(targetId) as { id: number } | undefined;
  if (existing) {
    db.prepare('DELETE FROM favourites WHERE id = ?').run(existing.id);
    return { isFavourite: false };
  }
  const outfit = getOutfitById(targetId);
  if (!outfit) throw new Error('Outfit not found');
  db.prepare("INSERT INTO favourites (item_type, outfit_id) VALUES ('outfit', ?)").run(targetId);
  return { isFavourite: true };
}

export function listFavourites(): { clothing: ClothingItem[]; outfits: Outfit[] } {
  const clothing = db
    .prepare(
      `
      SELECT c.*, 1 AS is_fav_num
      FROM favourites f
      JOIN clothing_items c ON c.id = f.clothing_item_id
      WHERE f.item_type = 'clothing'
      ORDER BY f.created_at DESC
      `
    )
    .all() as (ClothingItem & { is_fav_num: number })[];

  const outfitRows = db
    .prepare(
      `
      SELECT o.*
      FROM favourites f
      JOIN outfits o ON o.id = f.outfit_id
      WHERE f.item_type = 'outfit'
      ORDER BY f.created_at DESC
      `
    )
    .all() as Omit<Outfit, 'items' | 'is_favourite'>[];

  const itemStmt = db.prepare(
    `
    SELECT c.*, oi.slot_role
    FROM outfit_items oi
    JOIN clothing_items c ON c.id = oi.clothing_item_id
    WHERE oi.outfit_id = ?
    ORDER BY oi.id ASC
    `
  );

  return {
    clothing: clothing.map(({ is_fav_num, ...c }) => ({
      ...c,
      is_favourite: Boolean(is_fav_num),
    })),
    outfits: outfitRows.map((o) => ({
      ...o,
      is_favourite: true,
      items: itemStmt.all(o.id) as OutfitItemDetail[],
    })),
  };
}

export function logWear(input: {
  worn_date?: string;
  outfit_id?: number | null;
  clothing_item_ids?: number[];
  occasion?: string;
  notes?: string;
}): WearHistoryEntry[] {
  const wornDate = input.worn_date || new Date().toISOString().slice(0, 10);
  const occasion = (input.occasion || 'Daily').trim();
  const notes = (input.notes || '').trim();

  const tx = db.transaction(() => {
    const insertedIds: number[] = [];

    let itemIds = input.clothing_item_ids ? [...input.clothing_item_ids] : [];
    if (input.outfit_id) {
      const outfit = getOutfitById(input.outfit_id);
      if (outfit) {
        db.prepare(
          'UPDATE outfits SET wear_count = wear_count + 1, last_worn_at = ? WHERE id = ?'
        ).run(wornDate, outfit.id);
        if (itemIds.length === 0) {
          itemIds = outfit.items.map((i) => i.id);
        }
      }
    }

    const uniqueItemIds = Array.from(new Set(itemIds));
    if (uniqueItemIds.length === 0 && input.outfit_id) {
      const info = db
        .prepare(
          `
          INSERT INTO wear_history (worn_date, outfit_id, clothing_item_id, occasion, notes)
          VALUES (?, ?, NULL, ?, ?)
          `
        )
        .run(wornDate, input.outfit_id, occasion, notes);
      insertedIds.push(Number(info.lastInsertRowid));
    } else {
      for (const itemId of uniqueItemIds) {
        const item = getClothingItemById(itemId);
        if (!item) continue;
        db.prepare(
          'UPDATE clothing_items SET wear_count = wear_count + 1, last_worn_at = ? WHERE id = ?'
        ).run(wornDate, itemId);
        const info = db
          .prepare(
            `
            INSERT INTO wear_history (worn_date, outfit_id, clothing_item_id, occasion, notes)
            VALUES (?, ?, ?, ?, ?)
            `
          )
          .run(wornDate, input.outfit_id ?? null, itemId, occasion, notes);
        insertedIds.push(Number(info.lastInsertRowid));
      }
    }

    return insertedIds;
  });

  const ids = tx();
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  return db
    .prepare(
      `
      SELECT w.*,
        o.name AS outfit_name,
        c.name AS clothing_name,
        c.image_path AS clothing_image_path,
        c.category AS clothing_category
      FROM wear_history w
      LEFT JOIN outfits o ON o.id = w.outfit_id
      LEFT JOIN clothing_items c ON c.id = w.clothing_item_id
      WHERE w.id IN (${placeholders})
      ORDER BY w.worn_date DESC, w.id DESC
      `
    )
    .all(...ids) as WearHistoryEntry[];
}

export function listWearHistory(limit = 100): WearHistoryEntry[] {
  return db
    .prepare(
      `
      SELECT w.*,
        o.name AS outfit_name,
        c.name AS clothing_name,
        c.image_path AS clothing_image_path,
        c.category AS clothing_category
      FROM wear_history w
      LEFT JOIN outfits o ON o.id = w.outfit_id
      LEFT JOIN clothing_items c ON c.id = w.clothing_item_id
      ORDER BY w.worn_date DESC, w.id DESC
      LIMIT ?
      `
    )
    .all(limit) as WearHistoryEntry[];
}

export function deleteWearHistory(id: number): boolean {
  const row = db.prepare('SELECT * FROM wear_history WHERE id = ?').get(id) as
    | { id: number; clothing_item_id: number | null; outfit_id: number | null }
    | undefined;
  if (!row) return false;

  const tx = db.transaction(() => {
    if (row.clothing_item_id) {
      db.prepare(
        'UPDATE clothing_items SET wear_count = MAX(0, wear_count - 1) WHERE id = ?'
      ).run(row.clothing_item_id);
    }
    const info = db.prepare('DELETE FROM wear_history WHERE id = ?').run(id);
    return info.changes > 0;
  });

  return tx();
}

export function listCalendarEntries(monthPrefix?: string): CalendarEntry[] {
  const rows = (
    monthPrefix
      ? db
          .prepare(
            'SELECT * FROM outfit_calendar WHERE planned_date LIKE ? ORDER BY planned_date ASC, id ASC'
          )
          .all(`${monthPrefix}%`)
      : db.prepare('SELECT * FROM outfit_calendar ORDER BY planned_date ASC, id ASC').all()
  ) as {
    id: number;
    planned_date: string;
    outfit_id: number | null;
    title: string;
    occasion: string;
    notes: string;
    item_ids_json: string;
    created_at: string;
    updated_at: string;
  }[];

  return rows.map((row) => {
    let itemIds: number[] = [];
    try {
      const parsed = JSON.parse(row.item_ids_json);
      if (Array.isArray(parsed)) {
        itemIds = parsed.filter((n): n is number => typeof n === 'number');
      }
    } catch {
      itemIds = [];
    }

    if (itemIds.length === 0 && row.outfit_id) {
      const outfit = getOutfitById(row.outfit_id);
      if (outfit) {
        itemIds = outfit.items.map((i) => i.id);
      }
    }

    const items = itemIds
      .map((id) => getClothingItemById(id))
      .filter((item): item is ClothingItem => item !== null);

    return {
      id: row.id,
      planned_date: row.planned_date,
      outfit_id: row.outfit_id,
      title: row.title,
      occasion: row.occasion,
      notes: row.notes,
      item_ids: itemIds,
      items,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  });
}

export function createCalendarEntry(input: {
  planned_date: string;
  outfit_id?: number | null;
  title: string;
  occasion?: string;
  notes?: string;
  item_ids?: number[];
}): CalendarEntry {
  let itemIds = input.item_ids ?? [];
  if (itemIds.length === 0 && input.outfit_id) {
    const outfit = getOutfitById(input.outfit_id);
    if (outfit) {
      itemIds = outfit.items.map((i) => i.id);
    }
  }

  const info = db
    .prepare(
      `
      INSERT INTO outfit_calendar (planned_date, outfit_id, title, occasion, notes, item_ids_json)
      VALUES (?, ?, ?, ?, ?, ?)
      `
    )
    .run(
      input.planned_date,
      input.outfit_id ?? null,
      input.title.trim() || 'Planned Look',
      (input.occasion || 'Casual').trim(),
      (input.notes || '').trim(),
      JSON.stringify(itemIds)
    );

  const created = listCalendarEntries().find((e) => e.id === Number(info.lastInsertRowid));
  return created!;
}

export function updateCalendarEntry(
  id: number,
  updates: Partial<{
    planned_date: string;
    outfit_id: number | null;
    title: string;
    occasion: string;
    notes: string;
    item_ids: number[];
  }>
): CalendarEntry | null {
  const existing = listCalendarEntries().find((e) => e.id === id);
  if (!existing) return null;

  const itemIds = updates.item_ids ?? existing.item_ids;
  db.prepare(
    `
    UPDATE outfit_calendar
    SET planned_date = ?, outfit_id = ?, title = ?, occasion = ?, notes = ?,
        item_ids_json = ?, updated_at = datetime('now')
    WHERE id = ?
    `
  ).run(
    updates.planned_date ?? existing.planned_date,
    updates.outfit_id !== undefined ? updates.outfit_id : existing.outfit_id,
    (updates.title ?? existing.title).trim(),
    (updates.occasion ?? existing.occasion).trim(),
    (updates.notes ?? existing.notes).trim(),
    JSON.stringify(itemIds),
    id
  );

  return listCalendarEntries().find((e) => e.id === id) || null;
}

export function deleteCalendarEntry(id: number): boolean {
  const info = db.prepare('DELETE FROM outfit_calendar WHERE id = ?').run(id);
  return info.changes > 0;
}

export function getDashboardData(): Omit<DashboardData, 'dailySuggestion'> {
  const clothingCount = (
    db.prepare('SELECT COUNT(*) AS count FROM clothing_items').get() as { count: number }
  ).count;
  const outfitsCount = (
    db.prepare('SELECT COUNT(*) AS count FROM outfits').get() as { count: number }
  ).count;
  const favCount = (
    db.prepare('SELECT COUNT(*) AS count FROM favourites').get() as { count: number }
  ).count;
  const wearsCount = (
    db.prepare('SELECT COUNT(*) AS count FROM wear_history').get() as { count: number }
  ).count;
  const generationsCount = (
    db.prepare('SELECT COUNT(*) AS count FROM generation_history').get() as { count: number }
  ).count;

  const recentItems = listClothingItems({ sort: 'newest' }).slice(0, 6);
  const mostWornItems = listClothingItems({ sort: 'most_worn' }).slice(0, 4);
  const leastWornItems = listClothingItems({ sort: 'least_worn' }).slice(0, 4);

  const today = new Date().toISOString().slice(0, 10);
  const upcomingPlans = listCalendarEntries().filter((e) => e.planned_date >= today).slice(0, 4);

  return {
    stats: {
      totalClothing: clothingCount,
      totalOutfits: outfitsCount,
      totalFavourites: favCount,
      totalWears: wearsCount,
      totalGenerations: generationsCount,
    },
    recentItems,
    mostWornItems,
    leastWornItems,
    upcomingPlans,
  };
}

export function getStorageInfo(): StorageInfo {
  let dbSizeBytes = 0;
  try {
    if (fs.existsSync(DB_PATH)) {
      dbSizeBytes = fs.statSync(DB_PATH).size;
    }
  } catch {
    dbSizeBytes = 0;
  }

  let uploadsCount = 0;
  let uploadsSizeBytes = 0;
  try {
    const files = fs.readdirSync(UPLOADS_DIR);
    for (const file of files) {
      const fullPath = path.join(UPLOADS_DIR, file);
      const stat = fs.statSync(fullPath);
      if (stat.isFile()) {
        uploadsCount += 1;
        uploadsSizeBytes += stat.size;
      }
    }
  } catch {
    // ignore
  }

  return {
    dataDir: DATA_DIR,
    dbPath: DB_PATH,
    dbSizeBytes,
    uploadsCount,
    uploadsSizeBytes,
    hasServerApiKey: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()),
    electronReady: true,
  };
}

const STARTER_ASSETS: Array<{
  sourceFile: string;
  name: string;
  category: ClothingCategory;
  target_gender: GarmentGender;
  color: string;
  secondary_color: string;
  pattern: string;
  style: string;
  season: SeasonTag;
  notes: string;
}> = [
  {
    sourceFile: 'wardrobe_ivory_shirt_1794629023317.jpg',
    name: 'Ivory Silk Button-Down Shirt',
    category: 'tops',
    target_gender: 'unisex',
    color: 'Ivory',
    secondary_color: 'Pearl',
    pattern: 'Solid',
    style: 'Tailored',
    season: 'All-Season',
    notes: 'Lightweight crepe-de-chine button-down ideal for layering or office wear.',
  },
  {
    sourceFile: 'wardrobe_charcoal_trousers_1794629023918.jpg',
    name: 'Charcoal Pleated Wool Trousers',
    category: 'bottoms',
    target_gender: 'unisex',
    color: 'Charcoal',
    secondary_color: '',
    pattern: 'Solid',
    style: 'Minimalist',
    season: 'All-Season',
    notes: 'High-waisted pleated straight trousers with tailored drape.',
  },
  {
    sourceFile: 'wardrobe_camel_trench_1794629023997.jpg',
    name: 'Camel Belted Wool Trench Coat',
    category: 'outerwear',
    target_gender: 'unisex',
    color: 'Camel',
    secondary_color: 'Beige',
    pattern: 'Solid',
    style: 'Classic',
    season: 'Autumn',
    notes: 'Double-breasted mid-length trench coat for crisp mornings and travel.',
  },
  {
    sourceFile: 'wardrobe_rust_dress_1794629024628.jpg',
    name: 'Rust Ribbed Knit Midi Dress',
    category: 'dresses',
    target_gender: 'female',
    color: 'Rust',
    secondary_color: 'Terracotta',
    pattern: 'Ribbed',
    style: 'Smart Casual',
    season: 'Autumn',
    notes: 'Warm terracotta fine-ribbed knit midi with subtle waist definition.',
  },
  {
    sourceFile: 'wardrobe_leather_loafers_1794629025746.jpg',
    name: 'Espresso Calfskin Penny Loafers',
    category: 'shoes',
    target_gender: 'unisex',
    color: 'Espresso',
    secondary_color: 'Brown',
    pattern: 'Solid',
    style: 'Classic',
    season: 'All-Season',
    notes: 'Hand-stitched dark brown leather loafers for office and weekend wear.',
  },
  {
    sourceFile: 'wardrobe_cognac_tote_1794629026226.jpg',
    name: 'Structured Cognac Leather Tote',
    category: 'accessories',
    target_gender: 'unisex',
    color: 'Cognac',
    secondary_color: 'Brass',
    pattern: 'Solid',
    style: 'Minimalist',
    season: 'All-Season',
    notes: 'Everyday structured leather carryall sized for laptop and essentials.',
  },
];

export function loadStarterWardrobe(): { inserted: number; items: ClothingItem[] } {
  const profile = getProfile();
  const existingNames = new Set(listClothingItems().map((i) => i.name.toLowerCase()));
  const appDir = process.env.STYLESYNC_APP_DIR
    ? path.resolve(process.env.STYLESYNC_APP_DIR)
    : process.cwd();
  const assetsDir = path.resolve(appDir, 'src', 'assets', 'images');
  const created: ClothingItem[] = [];

  for (const item of STARTER_ASSETS) {
    if (profile.gender === 'male' && item.target_gender === 'female') continue;
    if (existingNames.has(item.name.toLowerCase())) continue;

    const srcPath = path.join(assetsDir, item.sourceFile);
    const destFilename = `starter_${item.sourceFile}`;
    const destPath = path.join(UPLOADS_DIR, destFilename);

    if (fs.existsSync(srcPath) && !fs.existsSync(destPath)) {
      fs.writeFileSync(destPath, fs.readFileSync(srcPath));
    }

    const row = createClothingItem({
      name: item.name,
      category: item.category,
      target_gender: item.target_gender,
      color: item.color,
      secondary_color: item.secondary_color,
      pattern: item.pattern,
      style: item.style,
      season: item.season,
      notes: item.notes,
      image_path: `/uploads/${destFilename}`,
    });
    created.push(row);
  }

  return { inserted: created.length, items: listClothingItems() };
}

interface StoredGeneratedOutfit {
  tempId: string;
  name: string;
  occasion: string;
  reasoning: string;
  stylingTip: string;
  source: 'gemma' | 'local-fallback';
  weatherContext?: string;
  itemIds: number[];
}

function hydrateGenerationHistoryRow(
  row: {
    id: number;
    occasion: string;
    custom_prompt: string;
    source: 'gemma' | 'local-fallback';
    model_used: string;
    weather_context: string;
    outfits_json: string;
    created_at: string;
  },
  itemMap: Map<number, ClothingItem>
): GenerationHistoryEntry {
  let rawOutfits: StoredGeneratedOutfit[] = [];
  try {
    rawOutfits = JSON.parse(row.outfits_json) as StoredGeneratedOutfit[];
    if (!Array.isArray(rawOutfits)) rawOutfits = [];
  } catch {
    rawOutfits = [];
  }

  const outfits: OutfitSuggestionDraft[] = rawOutfits
    .map<OutfitSuggestionDraft | null>((o, idx) => {
      const items = (Array.isArray(o.itemIds) ? o.itemIds : [])
        .map((id) => itemMap.get(Number(id)))
        .filter((item): item is ClothingItem => Boolean(item));
      if (items.length === 0) return null;
      return {
        tempId: o.tempId || `hist-${row.id}-${idx}`,
        name: o.name || `${row.occasion} Look ${idx + 1}`,
        occasion: o.occasion || row.occasion,
        reasoning: o.reasoning || '',
        stylingTip: o.stylingTip || '',
        source: o.source === 'local-fallback' ? 'local-fallback' : 'gemma',
        weatherContext: o.weatherContext || row.weather_context || '',
        items,
      };
    })
    .filter((x): x is OutfitSuggestionDraft => x !== null);

  return {
    id: row.id,
    occasion: row.occasion,
    custom_prompt: row.custom_prompt,
    source: row.source,
    model_used: row.model_used,
    weather_context: row.weather_context,
    outfits,
    created_at: row.created_at,
  };
}

export function recordGenerationHistory(input: {
  occasion: string;
  custom_prompt?: string;
  source: 'gemma' | 'local-fallback';
  model_used?: string;
  weather_context?: string;
  outfits: OutfitSuggestionDraft[];
}): GenerationHistoryEntry {
  const serialized: StoredGeneratedOutfit[] = input.outfits.map((o) => ({
    tempId: o.tempId,
    name: o.name,
    occasion: o.occasion,
    reasoning: o.reasoning,
    stylingTip: o.stylingTip,
    source: o.source,
    weatherContext: o.weatherContext,
    itemIds: o.items.map((i) => i.id),
  }));

  const info = db
    .prepare(
      `
      INSERT INTO generation_history (occasion, custom_prompt, source, model_used, weather_context, outfits_json)
      VALUES (?, ?, ?, ?, ?, ?)
      `
    )
    .run(
      input.occasion,
      input.custom_prompt || '',
      input.source,
      input.model_used || '',
      input.weather_context || '',
      JSON.stringify(serialized)
    );

  // Keep latest 40 history records
  db.prepare(
    `
    DELETE FROM generation_history
    WHERE id NOT IN (SELECT id FROM generation_history ORDER BY id DESC LIMIT 40)
    `
  ).run();

  const row = db
    .prepare('SELECT * FROM generation_history WHERE id = ?')
    .get(Number(info.lastInsertRowid)) as {
    id: number;
    occasion: string;
    custom_prompt: string;
    source: 'gemma' | 'local-fallback';
    model_used: string;
    weather_context: string;
    outfits_json: string;
    created_at: string;
  };

  const itemMap = new Map<number, ClothingItem>(listClothingItems().map((i) => [i.id, i]));
  return hydrateGenerationHistoryRow(row, itemMap);
}

export function listGenerationHistory(limit = 30): GenerationHistoryEntry[] {
  const rows = db
    .prepare('SELECT * FROM generation_history ORDER BY id DESC LIMIT ?')
    .all(limit) as Array<{
    id: number;
    occasion: string;
    custom_prompt: string;
    source: 'gemma' | 'local-fallback';
    model_used: string;
    weather_context: string;
    outfits_json: string;
    created_at: string;
  }>;

  const itemMap = new Map<number, ClothingItem>(listClothingItems().map((i) => [i.id, i]));
  return rows
    .map((row) => hydrateGenerationHistoryRow(row, itemMap))
    .filter((entry) => entry.outfits.length > 0);
}

export function deleteGenerationHistoryEntry(id: number): boolean {
  const info = db.prepare('DELETE FROM generation_history WHERE id = ?').run(id);
  return info.changes > 0;
}

export function clearGenerationHistory(): void {
  db.prepare('DELETE FROM generation_history').run();
}

