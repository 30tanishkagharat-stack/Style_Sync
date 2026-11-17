var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_config = require("dotenv/config");
var import_node_crypto2 = __toESM(require("node:crypto"), 1);
var import_node_dns = __toESM(require("node:dns"), 1);
var import_express = __toESM(require("express"), 1);
var import_node_fs2 = __toESM(require("node:fs"), 1);
var import_node_http = __toESM(require("node:http"), 1);
var import_node_path2 = __toESM(require("node:path"), 1);
var import_multer = __toESM(require("multer"), 1);

// server/db.ts
var import_better_sqlite3 = __toESM(require("better-sqlite3"), 1);
var import_node_crypto = __toESM(require("node:crypto"), 1);
var import_node_fs = __toESM(require("node:fs"), 1);
var import_node_path = __toESM(require("node:path"), 1);
var DATA_DIR = process.env.STYLESYNC_DATA_DIR ? import_node_path.default.resolve(process.env.STYLESYNC_DATA_DIR) : import_node_path.default.resolve(process.cwd(), "data");
var UPLOADS_DIR = import_node_path.default.join(DATA_DIR, "uploads");
var DB_PATH = import_node_path.default.join(DATA_DIR, "stylesync.db");
import_node_fs.default.mkdirSync(DATA_DIR, { recursive: true });
import_node_fs.default.mkdirSync(UPLOADS_DIR, { recursive: true });
var db = new import_better_sqlite3.default(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
function initDatabase() {
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
  const profileCols = db.prepare("PRAGMA table_info(user_profile)").all();
  if (!profileCols.some((c) => c.name === "gender")) {
    db.exec(
      "ALTER TABLE user_profile ADD COLUMN gender TEXT NOT NULL DEFAULT 'female' CHECK (gender IN ('female', 'male'))"
    );
  }
  const clothingCols = db.prepare("PRAGMA table_info(clothing_items)").all();
  if (!clothingCols.some((c) => c.name === "target_gender")) {
    db.exec(
      "ALTER TABLE clothing_items ADD COLUMN target_gender TEXT NOT NULL DEFAULT 'unisex' CHECK (target_gender IN ('unisex', 'female', 'male'))"
    );
  }
}
initDatabase();
function hashPassword(password) {
  const salt = import_node_crypto.default.randomBytes(16).toString("hex");
  const hash = import_node_crypto.default.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  const [salt, originalHash] = parts;
  const derived = import_node_crypto.default.scryptSync(password, salt, 64);
  const expected = Buffer.from(originalHash, "hex");
  if (derived.length !== expected.length) return false;
  return import_node_crypto.default.timingSafeEqual(derived, expected);
}
db.prepare("DELETE FROM users WHERE email = 'demo@stylesync.app'").run();
function createSessionForUser(userId) {
  const token = import_node_crypto.default.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3).toISOString();
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(
    token,
    userId,
    expiresAt
  );
  return token;
}
function syncActiveProfileFromUser(user) {
  db.prepare(
    "UPDATE user_profile SET name = ?, email = ?, gender = ?, updated_at = datetime('now') WHERE id = 1"
  ).run(user.name, user.email, user.gender);
}
function registerUser(input) {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim() || "StyleSync Member";
  const gender = input.gender === "male" ? "male" : "female";
  if (!email || !email.includes("@")) {
    throw new Error("Please enter a valid email address.");
  }
  if (input.password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    throw new Error("An account with this email already exists. Please sign in.");
  }
  const passwordHash = hashPassword(input.password);
  const info = db.prepare("INSERT INTO users (name, email, password_hash, gender) VALUES (?, ?, ?, ?)").run(name, email, passwordHash, gender);
  const user = {
    id: Number(info.lastInsertRowid),
    name,
    email,
    gender
  };
  syncActiveProfileFromUser(user);
  const token = createSessionForUser(user.id);
  return { user, token };
}
function loginUser(input) {
  const email = input.email.trim().toLowerCase();
  const row = db.prepare("SELECT id, name, email, password_hash, gender FROM users WHERE email = ?").get(email);
  if (!row || !verifyPassword(input.password, row.password_hash)) {
    throw new Error("Invalid email or password.");
  }
  const gender = input.gender === "male" || input.gender === "female" ? input.gender : row.gender;
  if (gender !== row.gender) {
    db.prepare("UPDATE users SET gender = ? WHERE id = ?").run(gender, row.id);
  }
  const user = {
    id: row.id,
    name: row.name,
    email: row.email,
    gender
  };
  syncActiveProfileFromUser(user);
  const token = createSessionForUser(user.id);
  return { user, token };
}
function loginGuestUser(genderInput) {
  const gender = genderInput === "male" ? "male" : "female";
  const email = "member@stylesync.local";
  const existing = db.prepare("SELECT id, name, email, gender FROM users WHERE email = ?").get(email);
  let user;
  if (existing) {
    db.prepare("UPDATE users SET gender = ? WHERE id = ?").run(gender, existing.id);
    user = { ...existing, gender };
  } else {
    const info = db.prepare("INSERT INTO users (name, email, password_hash, gender) VALUES (?, ?, ?, ?)").run("StyleSync Member", email, hashPassword(import_node_crypto.default.randomBytes(16).toString("hex")), gender);
    user = {
      id: Number(info.lastInsertRowid),
      name: "StyleSync Member",
      email,
      gender
    };
  }
  syncActiveProfileFromUser(user);
  const token = createSessionForUser(user.id);
  return { user, token };
}
function loginFirebaseUser(input) {
  const email = input.email.trim().toLowerCase();
  if (!email) {
    throw new Error("Firebase account email is required.");
  }
  const existing = db.prepare("SELECT id, name, email, gender FROM users WHERE email = ?").get(email);
  let user;
  if (existing) {
    const resolvedGender = input.gender === "male" || input.gender === "female" ? input.gender : existing.gender;
    const resolvedName = existing.name || input.name.trim() || email.split("@")[0];
    if (resolvedGender !== existing.gender || resolvedName !== existing.name) {
      db.prepare("UPDATE users SET name = ?, gender = ? WHERE id = ?").run(
        resolvedName,
        resolvedGender,
        existing.id
      );
    }
    user = {
      id: existing.id,
      name: resolvedName,
      email: existing.email,
      gender: resolvedGender
    };
  } else {
    const gender = input.gender === "male" ? "male" : "female";
    const name = input.name.trim() || email.split("@")[0] || "StyleSync Member";
    const info = db.prepare("INSERT INTO users (name, email, password_hash, gender) VALUES (?, ?, ?, ?)").run(name, email, hashPassword(import_node_crypto.default.randomBytes(24).toString("hex")), gender);
    user = {
      id: Number(info.lastInsertRowid),
      name,
      email,
      gender
    };
  }
  syncActiveProfileFromUser(user);
  const token = createSessionForUser(user.id);
  return { user, token };
}
function getSessionUser(token) {
  if (!token) return null;
  const row = db.prepare(
    `
      SELECT u.id, u.name, u.email, u.gender, s.expires_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = ?
      `
  ).get(token);
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    gender: row.gender
  };
}
function logoutSession(token) {
  if (!token) return;
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}
function changeUserPassword(userId, currentPassword, newPassword) {
  if (!newPassword || newPassword.length < 6) {
    throw new Error("New password must be at least 6 characters.");
  }
  const row = db.prepare("SELECT id, password_hash FROM users WHERE id = ?").get(userId);
  if (!row) {
    throw new Error("Account not found.");
  }
  if (!verifyPassword(currentPassword, row.password_hash)) {
    throw new Error("Current password is incorrect.");
  }
  const nextHash = hashPassword(newPassword);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(nextHash, userId);
}
function deleteUserAccount(userId) {
  const items = db.prepare("SELECT image_path FROM clothing_items").all();
  for (const item of items) {
    if (item.image_path.startsWith("/uploads/")) {
      const fullPath = import_node_path.default.join(UPLOADS_DIR, import_node_path.default.basename(item.image_path));
      if (import_node_fs.default.existsSync(fullPath)) {
        try {
          import_node_fs.default.unlinkSync(fullPath);
        } catch {
        }
      }
    }
  }
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM wear_history").run();
    db.prepare("DELETE FROM generation_history").run();
    db.prepare("DELETE FROM favourites").run();
    db.prepare("DELETE FROM outfit_calendar").run();
    db.prepare("DELETE FROM outfit_items").run();
    db.prepare("DELETE FROM outfits").run();
    db.prepare("DELETE FROM clothing_items").run();
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
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM users WHERE id = ?").run(userId);
  });
  tx();
}
function getProfile(sessionUser) {
  const profile = db.prepare("SELECT * FROM user_profile WHERE id = 1").get();
  if (sessionUser?.email) {
    const cleanEmail = sessionUser.email.trim();
    if (profile.email !== cleanEmail) {
      const nextName = profile.name === "StyleSync Member" && sessionUser.name ? sessionUser.name : profile.name;
      db.prepare(
        "UPDATE user_profile SET email = ?, name = ?, updated_at = datetime('now') WHERE id = 1"
      ).run(cleanEmail, nextName);
      return { ...profile, email: cleanEmail, name: nextName };
    }
  }
  return profile;
}
function getSettings() {
  return db.prepare("SELECT * FROM user_settings WHERE id = 1").get();
}
function updateProfileAndSettings(payload, sessionUser) {
  const currentProfile = getProfile(sessionUser);
  const currentSettings = getSettings();
  if (payload.profile) {
    const p = { ...currentProfile, ...payload.profile };
    const preservedEmail = (sessionUser?.email || currentProfile.email).trim();
    const gender = p.gender === "male" ? "male" : "female";
    db.prepare(`
      UPDATE user_profile
      SET name = ?, email = ?, gender = ?, style_preferences = ?, preferred_colors = ?,
          avoid_colors = ?, fit_preference = ?, bio = ?, updated_at = datetime('now')
      WHERE id = 1
    `).run(
      p.name.trim() || "StyleSync Member",
      preservedEmail,
      gender,
      p.style_preferences.trim(),
      p.preferred_colors.trim(),
      p.avoid_colors.trim(),
      p.fit_preference.trim(),
      p.bio.trim()
    );
    if (preservedEmail) {
      db.prepare("UPDATE users SET name = ?, gender = ? WHERE email = ?").run(
        p.name.trim() || "StyleSync Member",
        gender,
        preservedEmail.toLowerCase()
      );
    }
  }
  if (payload.settings) {
    const s = { ...currentSettings, ...payload.settings };
    const model = (s.gemma_model || "gemma-4-26b-a4b-it").trim();
    db.prepare(`
      UPDATE user_settings
      SET gemma_model = ?, preferred_city = ?, preferred_lat = ?, preferred_lon = ?,
          temperature_unit = ?, updated_at = datetime('now')
      WHERE id = 1
    `).run(
      model,
      (s.preferred_city || "New York").trim(),
      s.preferred_lat ?? null,
      s.preferred_lon ?? null,
      s.temperature_unit === "F" ? "F" : "C"
    );
  }
  return { profile: getProfile(), settings: getSettings() };
}
function listClothingItems(params) {
  const conditions = [];
  const args = [];
  if (params?.category && params.category !== "all") {
    conditions.push("c.category = ?");
    args.push(params.category);
  }
  if (params?.target_gender && params.target_gender !== "all") {
    conditions.push("c.target_gender = ?");
    args.push(params.target_gender);
  }
  if (params?.season && params.season !== "all") {
    conditions.push("c.season = ?");
    args.push(params.season);
  }
  if (params?.color && params.color !== "all") {
    conditions.push("(LOWER(c.color) LIKE ? OR LOWER(c.secondary_color) LIKE ?)");
    const cLike = `%${params.color.toLowerCase()}%`;
    args.push(cLike, cLike);
  }
  if (params?.search && params.search.trim()) {
    conditions.push(
      "(LOWER(c.name) LIKE ? OR LOWER(c.color) LIKE ? OR LOWER(c.style) LIKE ? OR LOWER(c.pattern) LIKE ? OR LOWER(c.notes) LIKE ?)"
    );
    const q = `%${params.search.trim().toLowerCase()}%`;
    args.push(q, q, q, q, q);
  }
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  let orderBy = "ORDER BY c.created_at DESC, c.id DESC";
  if (params?.sort === "most_worn") {
    orderBy = "ORDER BY c.wear_count DESC, c.created_at DESC";
  } else if (params?.sort === "least_worn") {
    orderBy = "ORDER BY c.wear_count ASC, c.created_at DESC";
  } else if (params?.sort === "name_asc") {
    orderBy = "ORDER BY LOWER(c.name) ASC";
  }
  const rows = db.prepare(
    `
      SELECT c.*,
        CASE WHEN f.id IS NOT NULL THEN 1 ELSE 0 END AS is_fav_num
      FROM clothing_items c
      LEFT JOIN favourites f ON f.clothing_item_id = c.id AND f.item_type = 'clothing'
      ${whereClause}
      ${orderBy}
      `
  ).all(...args);
  return rows.map(({ is_fav_num, ...rest }) => ({
    ...rest,
    is_favourite: Boolean(is_fav_num)
  }));
}
function getClothingItemById(id) {
  const row = db.prepare(
    `
      SELECT c.*,
        CASE WHEN f.id IS NOT NULL THEN 1 ELSE 0 END AS is_fav_num
      FROM clothing_items c
      LEFT JOIN favourites f ON f.clothing_item_id = c.id AND f.item_type = 'clothing'
      WHERE c.id = ?
      `
  ).get(id);
  if (!row) return null;
  const { is_fav_num, ...rest } = row;
  return { ...rest, is_favourite: Boolean(is_fav_num) };
}
function createClothingItem(input) {
  const targetGender = input.target_gender === "female" || input.target_gender === "male" ? input.target_gender : "unisex";
  const result = db.prepare(
    `
      INSERT INTO clothing_items (name, category, target_gender, color, secondary_color, pattern, style, season, notes, image_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
  ).run(
    input.name.trim(),
    input.category,
    targetGender,
    input.color.trim() || "Neutral",
    (input.secondary_color || "").trim(),
    (input.pattern || "Solid").trim(),
    (input.style || "Casual").trim(),
    input.season || "All-Season",
    (input.notes || "").trim(),
    input.image_path
  );
  return getClothingItemById(Number(result.lastInsertRowid));
}
function updateClothingItem(id, updates) {
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
    updates.target_gender ?? existing.target_gender ?? "unisex",
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
function deleteClothingItem(id) {
  const existing = getClothingItemById(id);
  if (!existing) return false;
  const info = db.prepare("DELETE FROM clothing_items WHERE id = ?").run(id);
  if (info.changes > 0 && existing.image_path.startsWith("/uploads/")) {
    const filename = import_node_path.default.basename(existing.image_path);
    const fullPath = import_node_path.default.join(UPLOADS_DIR, filename);
    if (import_node_fs.default.existsSync(fullPath)) {
      try {
        import_node_fs.default.unlinkSync(fullPath);
      } catch {
      }
    }
  }
  return info.changes > 0;
}
function clearAllWardrobeImages() {
  const rows = db.prepare("SELECT id, image_path FROM clothing_items").all();
  for (const row of rows) {
    if (row.image_path.startsWith("/uploads/")) {
      const fullPath = import_node_path.default.join(UPLOADS_DIR, import_node_path.default.basename(row.image_path));
      if (import_node_fs.default.existsSync(fullPath)) {
        try {
          import_node_fs.default.unlinkSync(fullPath);
        } catch {
        }
      }
    }
  }
  db.prepare("DELETE FROM clothing_items").run();
  return rows.map((r) => r.id);
}
function listOutfits() {
  const outfits = db.prepare(
    `
      SELECT o.*,
        CASE WHEN f.id IS NOT NULL THEN 1 ELSE 0 END AS is_fav_num
      FROM outfits o
      LEFT JOIN favourites f ON f.outfit_id = o.id AND f.item_type = 'outfit'
      ORDER BY o.created_at DESC, o.id DESC
      `
  ).all();
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
    items: itemStmt.all(outfit.id)
  }));
}
function getOutfitById(id) {
  const outfit = db.prepare(
    `
      SELECT o.*,
        CASE WHEN f.id IS NOT NULL THEN 1 ELSE 0 END AS is_fav_num
      FROM outfits o
      LEFT JOIN favourites f ON f.outfit_id = o.id AND f.item_type = 'outfit'
      WHERE o.id = ?
      `
  ).get(id);
  if (!outfit) return null;
  const items = db.prepare(
    `
      SELECT c.*, oi.slot_role
      FROM outfit_items oi
      JOIN clothing_items c ON c.id = oi.clothing_item_id
      WHERE oi.outfit_id = ?
      ORDER BY oi.id ASC
      `
  ).all(id);
  const { is_fav_num, ...rest } = outfit;
  return { ...rest, is_favourite: Boolean(is_fav_num), items };
}
function createOutfit(input) {
  const validItems = input.item_ids.map((itemId) => getClothingItemById(itemId)).filter((item) => item !== null);
  if (validItems.length === 0) {
    throw new Error("Outfit must include at least one valid wardrobe item.");
  }
  const tx = db.transaction(() => {
    const info = db.prepare(
      `
        INSERT INTO outfits (name, occasion, reasoning, source, weather_context)
        VALUES (?, ?, ?, ?, ?)
        `
    ).run(
      input.name.trim() || "Curated Look",
      input.occasion.trim() || "Casual",
      (input.reasoning || "").trim(),
      input.source || "gemma",
      (input.weather_context || "").trim()
    );
    const outfitId2 = Number(info.lastInsertRowid);
    const insertItem = db.prepare(
      "INSERT INTO outfit_items (outfit_id, clothing_item_id, slot_role) VALUES (?, ?, ?)"
    );
    for (const item of validItems) {
      insertItem.run(outfitId2, item.id, item.category);
    }
    return outfitId2;
  });
  const outfitId = tx();
  return getOutfitById(outfitId);
}
function deleteOutfit(id) {
  const info = db.prepare("DELETE FROM outfits WHERE id = ?").run(id);
  return info.changes > 0;
}
function toggleFavourite(itemType, targetId) {
  if (itemType === "clothing") {
    const existing2 = db.prepare("SELECT id FROM favourites WHERE item_type = 'clothing' AND clothing_item_id = ?").get(targetId);
    if (existing2) {
      db.prepare("DELETE FROM favourites WHERE id = ?").run(existing2.id);
      return { isFavourite: false };
    }
    const item = getClothingItemById(targetId);
    if (!item) throw new Error("Clothing item not found");
    db.prepare("INSERT INTO favourites (item_type, clothing_item_id) VALUES ('clothing', ?)").run(
      targetId
    );
    return { isFavourite: true };
  }
  const existing = db.prepare("SELECT id FROM favourites WHERE item_type = 'outfit' AND outfit_id = ?").get(targetId);
  if (existing) {
    db.prepare("DELETE FROM favourites WHERE id = ?").run(existing.id);
    return { isFavourite: false };
  }
  const outfit = getOutfitById(targetId);
  if (!outfit) throw new Error("Outfit not found");
  db.prepare("INSERT INTO favourites (item_type, outfit_id) VALUES ('outfit', ?)").run(targetId);
  return { isFavourite: true };
}
function listFavourites() {
  const clothing = db.prepare(
    `
      SELECT c.*, 1 AS is_fav_num
      FROM favourites f
      JOIN clothing_items c ON c.id = f.clothing_item_id
      WHERE f.item_type = 'clothing'
      ORDER BY f.created_at DESC
      `
  ).all();
  const outfitRows = db.prepare(
    `
      SELECT o.*
      FROM favourites f
      JOIN outfits o ON o.id = f.outfit_id
      WHERE f.item_type = 'outfit'
      ORDER BY f.created_at DESC
      `
  ).all();
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
      is_favourite: Boolean(is_fav_num)
    })),
    outfits: outfitRows.map((o) => ({
      ...o,
      is_favourite: true,
      items: itemStmt.all(o.id)
    }))
  };
}
function logWear(input) {
  const wornDate = input.worn_date || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const occasion = (input.occasion || "Daily").trim();
  const notes = (input.notes || "").trim();
  const tx = db.transaction(() => {
    const insertedIds = [];
    let itemIds = input.clothing_item_ids ? [...input.clothing_item_ids] : [];
    if (input.outfit_id) {
      const outfit = getOutfitById(input.outfit_id);
      if (outfit) {
        db.prepare(
          "UPDATE outfits SET wear_count = wear_count + 1, last_worn_at = ? WHERE id = ?"
        ).run(wornDate, outfit.id);
        if (itemIds.length === 0) {
          itemIds = outfit.items.map((i) => i.id);
        }
      }
    }
    const uniqueItemIds = Array.from(new Set(itemIds));
    if (uniqueItemIds.length === 0 && input.outfit_id) {
      const info = db.prepare(
        `
          INSERT INTO wear_history (worn_date, outfit_id, clothing_item_id, occasion, notes)
          VALUES (?, ?, NULL, ?, ?)
          `
      ).run(wornDate, input.outfit_id, occasion, notes);
      insertedIds.push(Number(info.lastInsertRowid));
    } else {
      for (const itemId of uniqueItemIds) {
        const item = getClothingItemById(itemId);
        if (!item) continue;
        db.prepare(
          "UPDATE clothing_items SET wear_count = wear_count + 1, last_worn_at = ? WHERE id = ?"
        ).run(wornDate, itemId);
        const info = db.prepare(
          `
            INSERT INTO wear_history (worn_date, outfit_id, clothing_item_id, occasion, notes)
            VALUES (?, ?, ?, ?, ?)
            `
        ).run(wornDate, input.outfit_id ?? null, itemId, occasion, notes);
        insertedIds.push(Number(info.lastInsertRowid));
      }
    }
    return insertedIds;
  });
  const ids = tx();
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  return db.prepare(
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
  ).all(...ids);
}
function listWearHistory(limit = 100) {
  return db.prepare(
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
  ).all(limit);
}
function deleteWearHistory(id) {
  const row = db.prepare("SELECT * FROM wear_history WHERE id = ?").get(id);
  if (!row) return false;
  const tx = db.transaction(() => {
    if (row.clothing_item_id) {
      db.prepare(
        "UPDATE clothing_items SET wear_count = MAX(0, wear_count - 1) WHERE id = ?"
      ).run(row.clothing_item_id);
    }
    const info = db.prepare("DELETE FROM wear_history WHERE id = ?").run(id);
    return info.changes > 0;
  });
  return tx();
}
function listCalendarEntries(monthPrefix) {
  const rows = monthPrefix ? db.prepare(
    "SELECT * FROM outfit_calendar WHERE planned_date LIKE ? ORDER BY planned_date ASC, id ASC"
  ).all(`${monthPrefix}%`) : db.prepare("SELECT * FROM outfit_calendar ORDER BY planned_date ASC, id ASC").all();
  return rows.map((row) => {
    let itemIds = [];
    try {
      const parsed = JSON.parse(row.item_ids_json);
      if (Array.isArray(parsed)) {
        itemIds = parsed.filter((n) => typeof n === "number");
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
    const items = itemIds.map((id) => getClothingItemById(id)).filter((item) => item !== null);
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
      updated_at: row.updated_at
    };
  });
}
function createCalendarEntry(input) {
  let itemIds = input.item_ids ?? [];
  if (itemIds.length === 0 && input.outfit_id) {
    const outfit = getOutfitById(input.outfit_id);
    if (outfit) {
      itemIds = outfit.items.map((i) => i.id);
    }
  }
  const info = db.prepare(
    `
      INSERT INTO outfit_calendar (planned_date, outfit_id, title, occasion, notes, item_ids_json)
      VALUES (?, ?, ?, ?, ?, ?)
      `
  ).run(
    input.planned_date,
    input.outfit_id ?? null,
    input.title.trim() || "Planned Look",
    (input.occasion || "Casual").trim(),
    (input.notes || "").trim(),
    JSON.stringify(itemIds)
  );
  const created = listCalendarEntries().find((e) => e.id === Number(info.lastInsertRowid));
  return created;
}
function updateCalendarEntry(id, updates) {
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
    updates.outfit_id !== void 0 ? updates.outfit_id : existing.outfit_id,
    (updates.title ?? existing.title).trim(),
    (updates.occasion ?? existing.occasion).trim(),
    (updates.notes ?? existing.notes).trim(),
    JSON.stringify(itemIds),
    id
  );
  return listCalendarEntries().find((e) => e.id === id) || null;
}
function deleteCalendarEntry(id) {
  const info = db.prepare("DELETE FROM outfit_calendar WHERE id = ?").run(id);
  return info.changes > 0;
}
function getDashboardData() {
  const clothingCount = db.prepare("SELECT COUNT(*) AS count FROM clothing_items").get().count;
  const outfitsCount = db.prepare("SELECT COUNT(*) AS count FROM outfits").get().count;
  const favCount = db.prepare("SELECT COUNT(*) AS count FROM favourites").get().count;
  const wearsCount = db.prepare("SELECT COUNT(*) AS count FROM wear_history").get().count;
  const generationsCount = db.prepare("SELECT COUNT(*) AS count FROM generation_history").get().count;
  const recentItems = listClothingItems({ sort: "newest" }).slice(0, 6);
  const mostWornItems = listClothingItems({ sort: "most_worn" }).slice(0, 4);
  const leastWornItems = listClothingItems({ sort: "least_worn" }).slice(0, 4);
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const upcomingPlans = listCalendarEntries().filter((e) => e.planned_date >= today).slice(0, 4);
  return {
    stats: {
      totalClothing: clothingCount,
      totalOutfits: outfitsCount,
      totalFavourites: favCount,
      totalWears: wearsCount,
      totalGenerations: generationsCount
    },
    recentItems,
    mostWornItems,
    leastWornItems,
    upcomingPlans
  };
}
function getStorageInfo() {
  let dbSizeBytes = 0;
  try {
    if (import_node_fs.default.existsSync(DB_PATH)) {
      dbSizeBytes = import_node_fs.default.statSync(DB_PATH).size;
    }
  } catch {
    dbSizeBytes = 0;
  }
  let uploadsCount = 0;
  let uploadsSizeBytes = 0;
  try {
    const files = import_node_fs.default.readdirSync(UPLOADS_DIR);
    for (const file of files) {
      const fullPath = import_node_path.default.join(UPLOADS_DIR, file);
      const stat = import_node_fs.default.statSync(fullPath);
      if (stat.isFile()) {
        uploadsCount += 1;
        uploadsSizeBytes += stat.size;
      }
    }
  } catch {
  }
  return {
    dataDir: DATA_DIR,
    dbPath: DB_PATH,
    dbSizeBytes,
    uploadsCount,
    uploadsSizeBytes,
    hasServerApiKey: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()),
    electronReady: true
  };
}
var STARTER_ASSETS = [
  {
    sourceFile: "wardrobe_ivory_shirt_1794629023317.jpg",
    name: "Ivory Silk Button-Down Shirt",
    category: "tops",
    target_gender: "unisex",
    color: "Ivory",
    secondary_color: "Pearl",
    pattern: "Solid",
    style: "Tailored",
    season: "All-Season",
    notes: "Lightweight crepe-de-chine button-down ideal for layering or office wear."
  },
  {
    sourceFile: "wardrobe_charcoal_trousers_1794629023918.jpg",
    name: "Charcoal Pleated Wool Trousers",
    category: "bottoms",
    target_gender: "unisex",
    color: "Charcoal",
    secondary_color: "",
    pattern: "Solid",
    style: "Minimalist",
    season: "All-Season",
    notes: "High-waisted pleated straight trousers with tailored drape."
  },
  {
    sourceFile: "wardrobe_camel_trench_1794629023997.jpg",
    name: "Camel Belted Wool Trench Coat",
    category: "outerwear",
    target_gender: "unisex",
    color: "Camel",
    secondary_color: "Beige",
    pattern: "Solid",
    style: "Classic",
    season: "Autumn",
    notes: "Double-breasted mid-length trench coat for crisp mornings and travel."
  },
  {
    sourceFile: "wardrobe_rust_dress_1794629024628.jpg",
    name: "Rust Ribbed Knit Midi Dress",
    category: "dresses",
    target_gender: "female",
    color: "Rust",
    secondary_color: "Terracotta",
    pattern: "Ribbed",
    style: "Smart Casual",
    season: "Autumn",
    notes: "Warm terracotta fine-ribbed knit midi with subtle waist definition."
  },
  {
    sourceFile: "wardrobe_leather_loafers_1794629025746.jpg",
    name: "Espresso Calfskin Penny Loafers",
    category: "shoes",
    target_gender: "unisex",
    color: "Espresso",
    secondary_color: "Brown",
    pattern: "Solid",
    style: "Classic",
    season: "All-Season",
    notes: "Hand-stitched dark brown leather loafers for office and weekend wear."
  },
  {
    sourceFile: "wardrobe_cognac_tote_1794629026226.jpg",
    name: "Structured Cognac Leather Tote",
    category: "accessories",
    target_gender: "unisex",
    color: "Cognac",
    secondary_color: "Brass",
    pattern: "Solid",
    style: "Minimalist",
    season: "All-Season",
    notes: "Everyday structured leather carryall sized for laptop and essentials."
  }
];
function loadStarterWardrobe() {
  const profile = getProfile();
  const existingNames = new Set(listClothingItems().map((i) => i.name.toLowerCase()));
  const appDir = process.env.STYLESYNC_APP_DIR ? import_node_path.default.resolve(process.env.STYLESYNC_APP_DIR) : process.cwd();
  const assetsDir = import_node_path.default.resolve(appDir, "src", "assets", "images");
  const created = [];
  for (const item of STARTER_ASSETS) {
    if (profile.gender === "male" && item.target_gender === "female") continue;
    if (existingNames.has(item.name.toLowerCase())) continue;
    const srcPath = import_node_path.default.join(assetsDir, item.sourceFile);
    const destFilename = `starter_${item.sourceFile}`;
    const destPath = import_node_path.default.join(UPLOADS_DIR, destFilename);
    if (import_node_fs.default.existsSync(srcPath) && !import_node_fs.default.existsSync(destPath)) {
      import_node_fs.default.writeFileSync(destPath, import_node_fs.default.readFileSync(srcPath));
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
      image_path: `/uploads/${destFilename}`
    });
    created.push(row);
  }
  return { inserted: created.length, items: listClothingItems() };
}
function hydrateGenerationHistoryRow(row, itemMap) {
  let rawOutfits = [];
  try {
    rawOutfits = JSON.parse(row.outfits_json);
    if (!Array.isArray(rawOutfits)) rawOutfits = [];
  } catch {
    rawOutfits = [];
  }
  const outfits = rawOutfits.map((o, idx) => {
    const items = (Array.isArray(o.itemIds) ? o.itemIds : []).map((id) => itemMap.get(Number(id))).filter((item) => Boolean(item));
    if (items.length === 0) return null;
    return {
      tempId: o.tempId || `hist-${row.id}-${idx}`,
      name: o.name || `${row.occasion} Look ${idx + 1}`,
      occasion: o.occasion || row.occasion,
      reasoning: o.reasoning || "",
      stylingTip: o.stylingTip || "",
      source: o.source === "local-fallback" ? "local-fallback" : "gemma",
      weatherContext: o.weatherContext || row.weather_context || "",
      items
    };
  }).filter((x) => x !== null);
  return {
    id: row.id,
    occasion: row.occasion,
    custom_prompt: row.custom_prompt,
    source: row.source,
    model_used: row.model_used,
    weather_context: row.weather_context,
    outfits,
    created_at: row.created_at
  };
}
function recordGenerationHistory(input) {
  const serialized = input.outfits.map((o) => ({
    tempId: o.tempId,
    name: o.name,
    occasion: o.occasion,
    reasoning: o.reasoning,
    stylingTip: o.stylingTip,
    source: o.source,
    weatherContext: o.weatherContext,
    itemIds: o.items.map((i) => i.id)
  }));
  const info = db.prepare(
    `
      INSERT INTO generation_history (occasion, custom_prompt, source, model_used, weather_context, outfits_json)
      VALUES (?, ?, ?, ?, ?, ?)
      `
  ).run(
    input.occasion,
    input.custom_prompt || "",
    input.source,
    input.model_used || "",
    input.weather_context || "",
    JSON.stringify(serialized)
  );
  db.prepare(
    `
    DELETE FROM generation_history
    WHERE id NOT IN (SELECT id FROM generation_history ORDER BY id DESC LIMIT 40)
    `
  ).run();
  const row = db.prepare("SELECT * FROM generation_history WHERE id = ?").get(Number(info.lastInsertRowid));
  const itemMap = new Map(listClothingItems().map((i) => [i.id, i]));
  return hydrateGenerationHistoryRow(row, itemMap);
}
function listGenerationHistory(limit = 30) {
  const rows = db.prepare("SELECT * FROM generation_history ORDER BY id DESC LIMIT ?").all(limit);
  const itemMap = new Map(listClothingItems().map((i) => [i.id, i]));
  return rows.map((row) => hydrateGenerationHistoryRow(row, itemMap)).filter((entry) => entry.outfits.length > 0);
}
function deleteGenerationHistoryEntry(id) {
  const info = db.prepare("DELETE FROM generation_history WHERE id = ?").run(id);
  return info.changes > 0;
}
function clearGenerationHistory() {
  db.prepare("DELETE FROM generation_history").run();
}

// server/gemma.ts
var import_genai = require("@google/genai");

// server/localMatcher.ts
var NEUTRALS = /* @__PURE__ */ new Set([
  "black",
  "white",
  "ivory",
  "cream",
  "beige",
  "camel",
  "charcoal",
  "grey",
  "gray",
  "navy",
  "espresso",
  "brown",
  "tan",
  "taupe",
  "khaki",
  "cognac",
  "silver",
  "neutral",
  "denim"
]);
var CLASSIC_PAIRINGS = {
  navy: ["camel", "ivory", "cream", "white", "beige", "rust", "sky blue", "grey", "tan"],
  rust: ["ivory", "cream", "denim", "navy", "espresso", "beige", "camel", "black"],
  terracotta: ["ivory", "cream", "beige", "olive", "denim", "espresso", "white"],
  olive: ["cream", "ivory", "beige", "camel", "black", "white", "brown", "denim"],
  sage: ["cream", "white", "beige", "camel", "charcoal", "denim"],
  burgundy: ["charcoal", "black", "ivory", "cream", "grey", "camel", "navy"],
  maroon: ["charcoal", "black", "ivory", "cream", "grey", "camel", "navy"],
  emerald: ["black", "ivory", "cream", "camel", "gold", "charcoal"],
  cobalt: ["white", "ivory", "black", "grey", "camel", "navy"],
  mustard: ["navy", "charcoal", "denim", "black", "cream", "olive"],
  coral: ["white", "ivory", "navy", "beige", "denim"],
  blush: ["ivory", "grey", "charcoal", "navy", "camel", "white"],
  pink: ["white", "ivory", "charcoal", "navy", "denim", "grey"],
  lavender: ["white", "ivory", "grey", "charcoal", "denim"]
};
function tokenizeWords(raw) {
  return (raw || "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
}
function normalizeColorKey(color) {
  return color.trim().toLowerCase();
}
function isNeutral(color) {
  const lower = normalizeColorKey(color);
  return Array.from(NEUTRALS).some((n) => lower.includes(n));
}
function pairColorBonus(aColor, bColor) {
  const a = normalizeColorKey(aColor);
  const b = normalizeColorKey(bColor);
  if (!a || !b) return 0;
  if (a === b) return 2.2;
  if (isNeutral(a) || isNeutral(b)) return 2;
  for (const [key, partners] of Object.entries(CLASSIC_PAIRINGS)) {
    if (a.includes(key) && partners.some((p) => b.includes(p))) return 2.5;
    if (b.includes(key) && partners.some((p) => a.includes(p))) return 2.5;
  }
  return -0.5;
}
function scoreColorCompatibility(items) {
  if (items.length <= 1) return 2;
  let total = 0;
  let pairs = 0;
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      total += pairColorBonus(items[i].color, items[j].color);
      pairs += 1;
    }
  }
  const nonNeutralDistinct = new Set(
    items.filter((i) => !isNeutral(i.color)).map((i) => normalizeColorKey(i.color))
  );
  const clashPenalty = nonNeutralDistinct.size >= 3 ? -3 : 0;
  return (pairs > 0 ? total / pairs * 2 : 0) + clashPenalty;
}
function scorePatternBalance(items) {
  const quietPatterns = /* @__PURE__ */ new Set(["solid", "ribbed", "textured", "plain", ""]);
  const patterned = items.filter((i) => !quietPatterns.has(i.pattern.toLowerCase().trim()));
  if (patterned.length === 0) return 2;
  if (patterned.length === 1) return 2.5;
  return -1.5 * (patterned.length - 1);
}
function getTempCelsius(weather) {
  if (!weather) return 20;
  return weather.current.unit === "F" ? (weather.current.temperature - 32) * 5 / 9 : weather.current.temperature;
}
function scoreWeatherFit(item, weather) {
  if (!weather) return 1;
  const tempC = getTempCelsius(weather);
  const cond = weather.current.condition.toLowerCase();
  const isRainy = cond.includes("rain") || cond.includes("drizzle") || cond.includes("storm");
  const season = item.season.toLowerCase();
  const cat = item.category;
  const hay = `${item.name} ${item.notes} ${item.style}`.toLowerCase();
  let score = 0;
  if (tempC <= 13) {
    if (cat === "outerwear") score += 4;
    if (season.includes("winter") || season.includes("autumn")) score += 2.5;
    else if (season.includes("all")) score += 1.5;
    else if (season.includes("summer")) score -= 2.5;
    if (/\b(sandal|flip-flop|tank|sleeveless|shorts)\b/.test(hay)) score -= 3;
  } else if (tempC <= 20) {
    if (cat === "outerwear") score += 2;
    if (season.includes("spring") || season.includes("autumn") || season.includes("all")) score += 2;
  } else if (tempC >= 25) {
    if (cat === "outerwear") score -= 3;
    if (/\b(wool|puffer|parka|fleece|heavy|turtleneck|cashmere)\b/.test(hay)) score -= 3;
    if (season.includes("summer") || season.includes("spring")) score += 2.5;
    else if (season.includes("all")) score += 1.5;
    else if (season.includes("winter")) score -= 2.5;
  } else {
    score += season.includes("all") || season.includes("spring") || season.includes("autumn") ? 2 : 1;
  }
  if (isRainy) {
    if (cat === "outerwear" && /\b(trench|rain|waterproof|jacket|coat)\b/.test(hay)) score += 2.5;
    if (cat === "shoes" && /\b(suede|sandal|open)\b/.test(hay)) score -= 2;
    if (cat === "shoes" && /\b(boot|leather|loafer|sneaker)\b/.test(hay)) score += 1.5;
  }
  return score;
}
function scoreOccasionFit(item, occasion) {
  const occ = occasion.toLowerCase();
  const hay = `${item.style} ${item.name} ${item.notes}`.toLowerCase();
  if (occ.includes("office") || occ.includes("formal") || occ.includes("work") || occ.includes("business")) {
    let s = 0;
    if (/\b(tailor|formal|classic|minimal|smart|business|blazer|trouser|oxford|loafer|pump|button-down|silk|poplin)\b/.test(hay)) {
      s += 3;
    }
    if (/\b(hoodie|jogger|sweatpant|flip-flop|athletic|gym|distressed)\b/.test(hay)) {
      s -= 3;
    }
    return s;
  }
  if (occ.includes("party") || occ.includes("evening") || occ.includes("date") || occ.includes("dinner")) {
    let s = item.category === "dresses" ? 3 : 0;
    if (/\b(evening|chic|silk|satin|velvet|heel|tailor|statement|blazer|smart)\b/.test(hay)) {
      s += 2.5;
    }
    if (/\b(athleisure|sweatpant|jogger|gym)\b/.test(hay)) s -= 2.5;
    return s;
  }
  if (occ.includes("travel") || occ.includes("college") || occ.includes("casual") || occ.includes("weekend")) {
    let s = 0;
    if (/\b(casual|minimal|relaxed|knit|denim|sneaker|loafer|tote|cotton|linen|comfort|streetwear)\b/.test(hay)) {
      s += 2.5;
    }
    if (/\b(gown|stiletto|tuxedo)\b/.test(hay)) s -= 2.5;
    return s;
  }
  return 1;
}
function scoreProfileAndPrompt(item, profile, customPrompt) {
  let score = 0;
  const itemText = `${item.name} ${item.category} ${item.color} ${item.secondary_color} ${item.pattern} ${item.style} ${item.season} ${item.notes}`.toLowerCase();
  if (profile) {
    const preferredColors = (profile.preferred_colors || "").split(/[,;/]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
    for (const c of preferredColors) {
      if (item.color.toLowerCase().includes(c) || item.secondary_color.toLowerCase().includes(c)) {
        score += 1.5;
        break;
      }
    }
    const avoidColors = (profile.avoid_colors || "").split(/[,;/]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
    for (const c of avoidColors) {
      if (item.color.toLowerCase().includes(c) || item.secondary_color.toLowerCase().includes(c)) {
        score -= 4;
        break;
      }
    }
    const prefStyles = (profile.style_preferences || "").split(/[,;/]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
    for (const st of prefStyles) {
      if (item.style.toLowerCase().includes(st) || item.notes.toLowerCase().includes(st)) {
        score += 1.2;
        break;
      }
    }
  }
  const promptWords = tokenizeWords(customPrompt);
  if (promptWords.length > 0) {
    const stopWords = /* @__PURE__ */ new Set(["with", "for", "and", "the", "look", "outfit", "style", "wear", "today", "highlight", "something", "prefer", "please", "make", "keep"]);
    for (const word of promptWords) {
      if (stopWords.has(word)) continue;
      if (itemText.includes(word)) {
        score += 6;
      }
    }
  }
  return score;
}
function pickBestComplement(candidates, anchors, occasion, weather, profile, customPrompt) {
  if (candidates.length === 0) return null;
  let best = null;
  let bestScore = -Infinity;
  for (const cand of candidates) {
    const withAnchors = [...anchors, cand];
    const score = scoreColorCompatibility(withAnchors) + scorePatternBalance(withAnchors) + scoreOccasionFit(cand, occasion) + scoreWeatherFit(cand, weather) + scoreProfileAndPrompt(cand, profile, customPrompt) - cand.wear_count * 0.15;
    if (score > bestScore) {
      bestScore = score;
      best = cand;
    }
  }
  return best;
}
function generateLocalFallbackOutfits(params) {
  const { wardrobe, occasion, customPrompt, profile, weather, count = 3, excludeSignatures } = params;
  if (wardrobe.length === 0) return [];
  const tops = wardrobe.filter((i) => i.category === "tops");
  const bottoms = wardrobe.filter((i) => i.category === "bottoms");
  const dresses = wardrobe.filter((i) => i.category === "dresses");
  const outerwear = wardrobe.filter((i) => i.category === "outerwear");
  const shoes = wardrobe.filter((i) => i.category === "shoes");
  const accessories = wardrobe.filter((i) => i.category === "accessories");
  const tempC = getTempCelsius(weather);
  const condLower = weather?.current.condition.toLowerCase() ?? "";
  const needsLayer = tempC <= 19 || condLower.includes("rain") || condLower.includes("wind") || /\b(layer|blazer|coat|jacket|cardigan)\b/i.test(customPrompt || "");
  const candidates = [];
  for (const top of tops) {
    for (const bottom of bottoms) {
      const base = [top, bottom];
      const bestShoe = pickBestComplement(shoes, base, occasion, weather, profile, customPrompt);
      if (bestShoe) base.push(bestShoe);
      if (needsLayer && outerwear.length > 0) {
        const bestOuter = pickBestComplement(outerwear, base, occasion, weather, profile, customPrompt);
        if (bestOuter) base.push(bestOuter);
      }
      if (accessories.length > 0) {
        const bestAcc = pickBestComplement(accessories, base, occasion, weather, profile, customPrompt);
        if (bestAcc && scoreColorCompatibility([...base, bestAcc]) >= 0) {
          base.push(bestAcc);
        }
      }
      const wearPenalty = base.reduce((acc, item) => acc + item.wear_count * 0.2, 0);
      const score = scoreColorCompatibility(base) + scorePatternBalance(base) + base.reduce(
        (acc, item) => acc + scoreOccasionFit(item, occasion) + scoreWeatherFit(item, weather) + scoreProfileAndPrompt(item, profile, customPrompt),
        0
      ) - wearPenalty;
      candidates.push({
        items: base,
        anchorIds: [top.id, bottom.id],
        score,
        label: `${top.color} & ${bottom.color} ${occasion} Edit`
      });
    }
  }
  for (const dress of dresses) {
    const base = [dress];
    const bestShoe = pickBestComplement(shoes, base, occasion, weather, profile, customPrompt);
    if (bestShoe) base.push(bestShoe);
    if (needsLayer && outerwear.length > 0) {
      const bestOuter = pickBestComplement(outerwear, base, occasion, weather, profile, customPrompt);
      if (bestOuter) base.push(bestOuter);
    }
    if (accessories.length > 0) {
      const bestAcc = pickBestComplement(accessories, base, occasion, weather, profile, customPrompt);
      if (bestAcc) base.push(bestAcc);
    }
    const wearPenalty = base.reduce((acc, item) => acc + item.wear_count * 0.2, 0);
    const score = scoreColorCompatibility(base) + scorePatternBalance(base) + base.reduce(
      (acc, item) => acc + scoreOccasionFit(item, occasion) + scoreWeatherFit(item, weather) + scoreProfileAndPrompt(item, profile, customPrompt),
      0
    ) - wearPenalty;
    candidates.push({
      items: base,
      anchorIds: [dress.id],
      score,
      label: `${dress.color} ${occasion} Silhouette`
    });
  }
  if (candidates.length === 0) {
    const sorted = [...wardrobe].sort(
      (a, b) => scoreOccasionFit(b, occasion) + scoreWeatherFit(b, weather) + scoreProfileAndPrompt(b, profile, customPrompt) - (scoreOccasionFit(a, occasion) + scoreWeatherFit(a, weather) + scoreProfileAndPrompt(a, profile, customPrompt))
    );
    const chosen = sorted.slice(0, Math.min(4, sorted.length));
    candidates.push({
      items: chosen,
      anchorIds: chosen.slice(0, 2).map((i) => i.id),
      score: 1,
      label: `Curated ${occasion} Selection`
    });
  }
  candidates.sort((a, b) => b.score - a.score);
  const selected = [];
  const seenSignatures = new Set(excludeSignatures ? Array.from(excludeSignatures) : []);
  const usedAnchors = /* @__PURE__ */ new Set();
  for (const cand of candidates) {
    const sig = cand.items.map((i) => i.id).sort((a, b) => a - b).join("-");
    if (seenSignatures.has(sig)) continue;
    if (cand.anchorIds.some((id) => usedAnchors.has(id))) continue;
    seenSignatures.add(sig);
    cand.anchorIds.forEach((id) => usedAnchors.add(id));
    selected.push(cand);
    if (selected.length >= count) break;
  }
  if (selected.length < count) {
    for (const cand of candidates) {
      const sig = cand.items.map((i) => i.id).sort((a, b) => a - b).join("-");
      if (seenSignatures.has(sig)) continue;
      seenSignatures.add(sig);
      selected.push(cand);
      if (selected.length >= count) break;
    }
  }
  if (selected.length < count && outerwear.length > 0 && selected.length > 0) {
    const first = selected[0];
    const hasOuterwear = first.items.some((i) => i.category === "outerwear");
    if (!hasOuterwear) {
      const bestOuter = pickBestComplement(outerwear, first.items, occasion, weather, profile, customPrompt);
      if (bestOuter) {
        const layered = [...first.items, bestOuter];
        const sig = layered.map((i) => i.id).sort((a, b) => a - b).join("-");
        if (!seenSignatures.has(sig)) {
          selected.push({
            items: layered,
            anchorIds: first.anchorIds,
            score: first.score - 0.5,
            label: `Layered ${first.label}`
          });
        }
      }
    }
  }
  const weatherText = weather ? `${weather.city}: ${weather.current.temperature}\xB0${weather.current.unit}, ${weather.current.condition}` : "";
  return selected.map((cand, idx) => {
    const colors = Array.from(new Set(cand.items.map((i) => i.color))).join(", ");
    const anchorNames = cand.items.slice(0, 2).map((i) => i.name).join(" paired with ");
    const leastWorn = [...cand.items].sort((a, b) => a.wear_count - b.wear_count)[0];
    return {
      tempId: `local-${Date.now()}-${idx}`,
      name: cand.label,
      occasion,
      reasoning: `${anchorNames} balances ${colors} tones for ${occasion.toLowerCase()}${weather ? ` in ${weather.current.temperature}\xB0${weather.current.unit} ${weather.current.condition.toLowerCase()} weather` : ""}, while rotating ${leastWorn.name}.`,
      stylingTip: needsLayer ? "Layer thoughtfully for changing temperatures and finish with structured footwear." : "Keep proportions crisp with clean lines and minimal finishing accents.",
      source: "local-fallback",
      weatherContext: weatherText,
      items: cand.items
    };
  });
}

// server/gemma.ts
var ALLOWED_CATEGORIES = [
  "tops",
  "bottoms",
  "dresses",
  "outerwear",
  "shoes",
  "accessories"
];
var ALLOWED_SEASONS = [
  "All-Season",
  "Spring",
  "Summer",
  "Autumn",
  "Winter"
];
var DEFAULT_GEMMA_MODEL = "gemini-4-hydrogen";
var FALLBACK_FAST_MODEL = "gemini-3.1-flash-lite";
var cachedClient = null;
var cachedApiKey;
function resolveModelId(modelId) {
  const cleaned = (modelId || "").trim();
  if (!cleaned || cleaned.toLowerCase().startsWith("gemma")) {
    return DEFAULT_GEMMA_MODEL;
  }
  return cleaned;
}
function getGenAIClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured on the server. Set it in your environment to enable AI styling."
    );
  }
  if (!cachedClient || cachedApiKey !== apiKey) {
    cachedApiKey = apiKey;
    cachedClient = new import_genai.GoogleGenAI({
      apiKey,
      httpOptions: {
        timeout: 15e3,
        retryOptions: {
          attempts: 2
        },
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return cachedClient;
}
function extractJsonFromText(rawText) {
  const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    }
    const firstBracket = cleaned.indexOf("[");
    const lastBracket = cleaned.lastIndexOf("]");
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      return JSON.parse(cleaned.slice(firstBracket, lastBracket + 1));
    }
    throw new Error("AI returned a response that could not be parsed as JSON.");
  }
}
function toTitleCase(value) {
  return value.trim().replace(/\s+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function normalizeCategory(raw, garmentName) {
  const primary = (raw || "").toLowerCase().trim();
  const titleOnly = (garmentName || "").toLowerCase().trim();
  const combined = `${primary} ${titleOnly}`.trim();
  const isDressModifier = /\bdress[- ]?(shirt|shirts|blouse|top|tops|pant|pants|trouser|trousers|slacks|skirt|shoe|shoes|boot|boots|loafer|loafers|heel|heels|belt|sock|socks|watch)\b/.test(
    titleOnly
  );
  if (!isDressModifier && !/\bskirt\b/.test(titleOnly) && (/\b(dress|sundress|gown|jumpsuit|romper|playsuit|kaftan|caftan|saree|sari|anarkali|slip dress|shirt dress|sweater dress|maxi dress|midi dress|mini dress)\b/.test(
    titleOnly
  ) || !primary && /\b(dress|sundress|gown|jumpsuit|romper|playsuit|kaftan|caftan|saree|sari|anarkali)\b/.test(
    combined
  ))) {
    return "dresses";
  }
  if (!/\boxford\s+(shirt|cloth|cotton|button)\b/.test(titleOnly) && !/\bflat\s+(lay|knit|front)\b/.test(titleOnly) && /\b(shoe|shoes|footwear|sneaker|sneakers|trainer|trainers|loafer|loafers|boot|boots|ankle boot|chelsea|heel|heels|pump|pumps|stiletto|wedge|wedges|sandal|sandals|flat|flats|ballet|mule|mules|clog|clogs|oxford|oxfords|derby|brogue|brogues|moccasin|espadrille|slipper|slippers|slide|slides|flip-flop)\b/.test(
    titleOnly || primary
  )) {
    return "shoes";
  }
  if (!/\btie[- ]?(front|neck|waist|back|strap)\b/.test(titleOnly) && !/\bring[- ]spun\b/.test(titleOnly) && /\b(accessor|bag|bags|tote|handbag|purse|clutch|crossbody|satchel|backpack|duffel|wallet|belt|belts|scarf|scarves|shawl|stole|hat|cap|beanie|beret|fedora|sunglass|sunglasses|glasses|eyewear|watch|watches|jewel|jewelry|jewellery|necklace|earring|earrings|bracelet|ring|brooch|tie|necktie|bowtie|gloves|socks)\b/.test(
    titleOnly || primary
  )) {
    return "accessories";
  }
  if (/\b(outerwear|coat|overcoat|trench|jacket|blazer|parka|puffer|anorak|windbreaker|bomber|peacoat|raincoat|cardigan|hoodie|sweatshirt|pullover fleece|overshirt|shacket|gilet|vest|shrug|cape|poncho)\b/.test(
    titleOnly || primary
  )) {
    return "outerwear";
  }
  if (/\b(bottom|bottoms|pant|pants|trouser|trousers|slacks|chino|chinos|jean|jeans|skirt|skort|shorts|boardshorts|bermuda shorts|legging|leggings|jogger|joggers|sweatpant|sweatpants|track pant|track pants|cargo pant|cargo pants|culotte|culottes|palazzo|capri)\b/.test(
    titleOnly || primary
  )) {
    return "bottoms";
  }
  if (ALLOWED_CATEGORIES.includes(primary)) {
    return primary;
  }
  if (/\b(top|tops|shirt|t-shirt|tee|blouse|sweater|jumper|knit|knitwear|pullover|turtleneck|polo|tank|camisole|cami|bodysuit|crop|tunic|kurta|kurti|henley|jersey|peplum|ruffle)\b/.test(
    combined
  )) {
    return "tops";
  }
  return "tops";
}
function normalizeSeason(raw, garmentName) {
  const val = (raw || "").toLowerCase().trim();
  if (ALLOWED_SEASONS.includes(raw?.trim())) {
    return raw.trim();
  }
  if (val.includes("winter") || val.includes("cold") || val.includes("snow") || val.includes("heavy")) {
    return "Winter";
  }
  if (val.includes("autumn") || val.includes("fall")) return "Autumn";
  if (val.includes("summer") || val.includes("warm") || val.includes("hot") || val.includes("beach") || val.includes("resort")) {
    return "Summer";
  }
  if (val.includes("spring") || val.includes("mild") || val.includes("breezy")) return "Spring";
  if (val.includes("all")) return "All-Season";
  const hint = (garmentName || "").toLowerCase();
  if (/\b(puffer|parka|wool coat|overcoat|cashmere|turtleneck|fleece|thermal|winter|beanie|scarf)\b/.test(hint)) {
    return "Winter";
  }
  if (/\b(trench|flannel|corduroy|ankle boot|suede|autumn|fall|cardigan|blazer)\b/.test(hint)) {
    return "Autumn";
  }
  if (/\b(linen|tank|camisole|shorts|sundress|sandal|sleeveless|summer|flip-flop)\b/.test(hint)) {
    return "Summer";
  }
  if (/\b(floral|pastel|chino|loafer|spring)\b/.test(hint)) {
    return "Spring";
  }
  return "All-Season";
}
function normalizeColor(raw) {
  const cleaned = (raw || "").replace(/\([^)]*\)/g, "").replace(/\b(background|studio|backdrop)\b/gi, "").split(/[\/,&]/)[0].trim();
  if (!cleaned) return "Neutral";
  const words = cleaned.split(/\s+/).slice(0, 2).join(" ");
  return toTitleCase(words);
}
function normalizePattern(raw) {
  const val = (raw || "").trim();
  if (!val) return "Solid";
  const lower = val.toLowerCase();
  if (lower === "plain" || lower === "none" || lower === "unpatterned" || lower === "n/a") {
    return "Solid";
  }
  return toTitleCase(val);
}
function normalizeStyle(raw) {
  const val = (raw || "").split(/[\/,]/)[0].trim();
  if (!val) return "Casual";
  return toTitleCase(val);
}
function isTransientAiError(err) {
  const msg = err instanceof Error ? err.message : String(err);
  return /500|502|503|504|429|UNAVAILABLE|INTERNAL|RESOURCE_EXHAUSTED|timeout|fetch failed|ECONNRESET/i.test(
    msg
  );
}
function buildFastConfig(modelId, extras) {
  if (modelId === "gemini-4-hydrogen") {
    return {
      ...extras,
      thinkingConfig: { thinkingLevel: import_genai.ThinkingLevel.LOW }
    };
  }
  return extras;
}
var RECOGNITION_SCHEMA = {
  type: import_genai.Type.OBJECT,
  properties: {
    name: {
      type: import_genai.Type.STRING,
      description: "Specific 2-4 word garment title with color, fabric/cut detail, and item type (e.g. Ivory Silk Button-Down Shirt)"
    },
    category: {
      type: import_genai.Type.STRING,
      description: "Exactly one of: tops, bottoms, dresses, outerwear, shoes, accessories"
    },
    target_gender: {
      type: import_genai.Type.STRING,
      description: "Exactly one of: unisex, female, male"
    },
    color: {
      type: import_genai.Type.STRING,
      description: "Dominant garment color ONLY in 1-2 Title Case words (ignore background, floor, wall, hanger, mannequin, or skin)"
    },
    secondary_color: {
      type: import_genai.Type.STRING,
      description: "Secondary trim, stripe, or print color on the garment, or empty string if none"
    },
    pattern: {
      type: import_genai.Type.STRING,
      description: "Surface pattern or knit texture, e.g. Solid, Striped, Pinstripe, Plaid, Gingham, Floral, Polka Dot, Geometric, Graphic Print, Colorblock, Ribbed, Cable Knit, Quilted, Lace, Embroidered, Herringbone, Houndstooth, Textured"
    },
    style: {
      type: import_genai.Type.STRING,
      description: "Primary fashion aesthetic, e.g. Minimalist, Tailored, Formal, Business Casual, Smart Casual, Casual, Streetwear, Athleisure, Bohemian, Vintage, Evening, Resort"
    },
    season: {
      type: import_genai.Type.STRING,
      description: "Exactly one of: All-Season, Spring, Summer, Autumn, Winter"
    },
    notes: {
      type: import_genai.Type.STRING,
      description: "1 concise sentence describing visible fabric, silhouette, and key construction detail"
    }
  },
  required: ["name", "category", "target_gender", "color", "secondary_color", "pattern", "style", "season", "notes"]
};
var OUTFIT_SCHEMA = {
  type: import_genai.Type.OBJECT,
  properties: {
    outfits: {
      type: import_genai.Type.ARRAY,
      items: {
        type: import_genai.Type.OBJECT,
        properties: {
          name: { type: import_genai.Type.STRING, description: "Short editorial outfit title (3-5 words)" },
          reasoning: {
            type: import_genai.Type.STRING,
            description: "2 concise sentences explaining color, silhouette, occasion, and weather harmony"
          },
          stylingTip: {
            type: import_genai.Type.STRING,
            description: "1 practical styling tip for wearing this exact combination"
          },
          itemIds: {
            type: import_genai.Type.ARRAY,
            items: { type: import_genai.Type.INTEGER },
            description: "Valid integer clothing item IDs from the provided wardrobe list"
          }
        },
        required: ["name", "reasoning", "stylingTip", "itemIds"]
      }
    }
  },
  required: ["outfits"]
};
var CHAT_SCHEMA = {
  type: import_genai.Type.OBJECT,
  properties: {
    reply: {
      type: import_genai.Type.STRING,
      description: "Clear, helpful styling advice referencing exact garment names from the wardrobe"
    },
    referencedItemIds: {
      type: import_genai.Type.ARRAY,
      items: { type: import_genai.Type.INTEGER },
      description: "Integer IDs of wardrobe items explicitly mentioned in the reply"
    }
  },
  required: ["reply", "referencedItemIds"]
};
async function recognizeClothingWithGemma(params) {
  const primaryModel = resolveModelId(params.modelId);
  const ai = getGenAIClient();
  const systemInstruction = "You are an expert fashion merchandiser and garment archivist. Inspect ONLY the foreground garment or accessory in the photo. Completely ignore studio walls, floors, hangers, mannequins, and skin tones when judging garment color. Distinguish outerwear (blazers, jackets, coats, cardigans, hoodies, overshirts), one-pieces (dresses, jumpsuits), tops (shirts, tees, blouses, sweaters, polos), bottoms (trousers, jeans, chinos, skirts, shorts), shoes, and accessories accurately. Inspect surface texture closely for stripes, checks, florals, graphics, ribbing, or quilting before labeling Solid.";
  const prompt = "Identify this garment accurately and populate all JSON schema fields. Use specific fashion colors (e.g. Ivory, Cream, Camel, Rust, Terracotta, Navy, Olive, Charcoal, Denim Blue, Forest Green, Burgundy, Emerald, Sky Blue).";
  const candidateModels = Array.from(/* @__PURE__ */ new Set([primaryModel, FALLBACK_FAST_MODEL]));
  let lastError = null;
  let text;
  let usedModel = primaryModel;
  outer: for (const candidateModel of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model: candidateModel,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: params.mimeType,
                data: params.imageBuffer.toString("base64")
              }
            },
            { text: prompt }
          ]
        },
        config: buildFastConfig(candidateModel, {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: RECOGNITION_SCHEMA
        })
      });
      if (response.text && response.text.trim()) {
        text = response.text;
        usedModel = candidateModel;
        break outer;
      }
      lastError = new Error(`Model ${candidateModel} returned an empty response.`);
    } catch (err) {
      lastError = err;
      if (!isTransientAiError(err)) {
        break;
      }
    }
  }
  if (!text) {
    throw lastError instanceof Error ? lastError : new Error(`Model ${primaryModel} returned an empty response.`);
  }
  const parsed = extractJsonFromText(text);
  const rawTarget = (parsed.target_gender || "unisex").toLowerCase().trim();
  const target_gender = rawTarget === "female" || rawTarget === "male" ? rawTarget : "unisex";
  const resolvedName = toTitleCase((parsed.name || "Recognized Garment").trim());
  return {
    modelUsed: usedModel,
    result: {
      name: resolvedName,
      category: normalizeCategory(parsed.category, resolvedName),
      target_gender,
      color: normalizeColor(parsed.color),
      secondary_color: parsed.secondary_color ? normalizeColor(parsed.secondary_color) : "",
      pattern: normalizePattern(parsed.pattern),
      style: normalizeStyle(parsed.style),
      season: normalizeSeason(parsed.season, resolvedName),
      notes: (parsed.notes || "").trim()
    }
  };
}
function sanitizeOutfitItems(items) {
  const hasDress = items.some((i) => i.category === "dresses");
  const seenCategories = /* @__PURE__ */ new Set();
  const cleaned = [];
  for (const item of items) {
    if (hasDress && (item.category === "bottoms" || item.category === "tops")) {
      continue;
    }
    if ((item.category === "bottoms" || item.category === "dresses" || item.category === "shoes") && seenCategories.has(item.category)) {
      continue;
    }
    seenCategories.add(item.category);
    cleaned.push(item);
  }
  return cleaned.length > 0 ? cleaned : items;
}
async function recommendOutfitsWithGemma(params) {
  const model = resolveModelId(params.modelId);
  const ai = getGenAIClient();
  const itemMap = new Map(params.wardrobe.map((item) => [item.id, item]));
  const compactWardrobe = params.wardrobe.map((item) => ({
    id: item.id,
    name: item.name,
    cat: item.category,
    color: item.color,
    ...item.secondary_color ? { accColor: item.secondary_color } : {},
    pattern: item.pattern,
    style: item.style,
    season: item.season,
    wears: item.wear_count
  }));
  const weatherBlock = params.weather ? `WEATHER (${params.weather.city}): ${params.weather.current.temperature}\xB0${params.weather.current.unit} (feels ${params.weather.current.apparentTemperature}\xB0), ${params.weather.current.condition}, humidity ${params.weather.current.humidity}%, wind ${params.weather.current.windSpeed}.` : "WEATHER: none specified.";
  const systemInstruction = "You are StyleSync, an editorial personal stylist. Build 3 genuinely distinct, cohesive outfits using ONLY valid integer IDs from the provided wardrobe JSON. Never invent IDs. Pair compatible categories (top + bottom, OR dress/one-piece, plus matching shoes and weather-appropriate outerwear/accessories when owned). Never pair two different shoes or dress + trousers unless explicitly requested. Respect occasion, preferred/avoided colors, custom requests, live weather, and rotate under-worn items.";
  const prompt = `OCCASION: ${params.occasion}
${params.customPrompt ? `REQUEST: ${params.customPrompt}` : ""}
PREFERENCES: styles=${params.profile.style_preferences}; preferred=${params.profile.preferred_colors}; avoid=${params.profile.avoid_colors}; fit=${params.profile.fit_preference}
${weatherBlock}
WARDROBE: ${JSON.stringify(compactWardrobe)}`;
  const candidateModels = Array.from(/* @__PURE__ */ new Set([model, FALLBACK_FAST_MODEL]));
  let text;
  let usedModel = model;
  let lastError = null;
  for (const candidateModel of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model: candidateModel,
        contents: prompt,
        config: buildFastConfig(candidateModel, {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: OUTFIT_SCHEMA
        })
      });
      if (response.text && response.text.trim()) {
        text = response.text;
        usedModel = candidateModel;
        break;
      }
    } catch (err) {
      lastError = err;
      if (!isTransientAiError(err)) {
        break;
      }
    }
  }
  if (!text) {
    throw lastError instanceof Error ? lastError : new Error(`Model ${model} returned an empty response.`);
  }
  const parsed = extractJsonFromText(text);
  const weatherContext = params.weather ? `${params.weather.city}: ${params.weather.current.temperature}\xB0${params.weather.current.unit}, ${params.weather.current.condition}` : "";
  const validated = [];
  const seenSignatures = /* @__PURE__ */ new Set();
  for (const [idx, rawOutfit] of (parsed.outfits || []).entries()) {
    const rawIds = Array.isArray(rawOutfit.itemIds) ? rawOutfit.itemIds : [];
    const validIds = Array.from(
      new Set(
        rawIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && itemMap.has(id))
      )
    );
    const rawItems = validIds.map((id) => itemMap.get(id)).filter((i) => Boolean(i));
    if (rawItems.length === 0) continue;
    const items = sanitizeOutfitItems(rawItems);
    const sig = items.map((i) => i.id).sort((a, b) => a - b).join("-");
    if (seenSignatures.has(sig)) continue;
    seenSignatures.add(sig);
    validated.push({
      tempId: `gemma-${Date.now()}-${idx}`,
      name: (rawOutfit.name || `${params.occasion} Look ${idx + 1}`).trim(),
      occasion: params.occasion,
      reasoning: (rawOutfit.reasoning || "Balanced color and silhouette pairing from your wardrobe.").trim(),
      stylingTip: (rawOutfit.stylingTip || "Finish with clean proportions and thoughtful accessories.").trim(),
      source: "gemma",
      weatherContext,
      items
    });
  }
  if (validated.length === 0) {
    throw new Error(
      `Model ${usedModel} did not return any outfits containing valid wardrobe item IDs.`
    );
  }
  if (validated.length < 3 && params.wardrobe.length >= 2) {
    const extras = generateLocalFallbackOutfits({
      wardrobe: params.wardrobe,
      occasion: params.occasion,
      customPrompt: params.customPrompt,
      profile: params.profile,
      weather: params.weather,
      count: 3 - validated.length,
      excludeSignatures: seenSignatures
    });
    for (const extra of extras) {
      validated.push({ ...extra, source: "gemma" });
    }
  }
  return { outfits: validated.slice(0, 3), modelUsed: usedModel };
}
async function chatWithGemmaFashionAssistant(params) {
  const model = resolveModelId(params.modelId);
  const ai = getGenAIClient();
  const itemMap = new Map(params.wardrobe.map((item) => [item.id, item]));
  const wardrobeSummary = params.wardrobe.map((item) => ({
    id: item.id,
    name: item.name,
    cat: item.category,
    color: item.color,
    pattern: item.pattern,
    style: item.style,
    season: item.season,
    wears: item.wear_count
  }));
  const historyText = params.history.slice(-6).map((h) => `${h.role === "user" ? "User" : "StyleSync"}: ${h.content}`).join("\n");
  const weatherText = params.weather ? `Weather in ${params.weather.city}: ${params.weather.current.temperature}\xB0${params.weather.current.unit}, ${params.weather.current.condition}, Humidity ${params.weather.current.humidity}%.` : "Weather data not loaded.";
  const systemInstruction = "You are StyleSync, an editorial personal fashion assistant. Answer concisely and thoughtfully using ONLY garments that exist in the user wardrobe JSON. Never invent items the user does not own; if something is missing, note it honestly while styling owned items.";
  const prompt = `PREFERENCES: name=${params.profile.name}; styles=${params.profile.style_preferences}; preferred=${params.profile.preferred_colors}; avoid=${params.profile.avoid_colors}; fit=${params.profile.fit_preference}; ${weatherText}
WARDROBE: ${JSON.stringify(wardrobeSummary)}
HISTORY: ${historyText || "(New conversation)"}
QUESTION: ${params.message}`;
  const candidateModels = Array.from(/* @__PURE__ */ new Set([model, FALLBACK_FAST_MODEL]));
  let text;
  let usedModel = model;
  let lastError = null;
  for (const candidateModel of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model: candidateModel,
        contents: prompt,
        config: buildFastConfig(candidateModel, {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: CHAT_SCHEMA
        })
      });
      if (response.text && response.text.trim()) {
        text = response.text;
        usedModel = candidateModel;
        break;
      }
    } catch (err) {
      lastError = err;
      if (!isTransientAiError(err)) {
        break;
      }
    }
  }
  if (!text) {
    throw lastError instanceof Error ? lastError : new Error(`Model ${model} returned an empty response.`);
  }
  try {
    const parsed = extractJsonFromText(text);
    const validIds = Array.from(
      new Set(
        (Array.isArray(parsed.referencedItemIds) ? parsed.referencedItemIds : []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && itemMap.has(id))
      )
    );
    return {
      reply: (parsed.reply || text).trim(),
      referencedItemIds: validIds,
      modelUsed: usedModel
    };
  } catch {
    const matchedIds = params.wardrobe.filter((item) => text.toLowerCase().includes(item.name.toLowerCase())).map((item) => item.id);
    return {
      reply: text.trim(),
      referencedItemIds: matchedIds,
      modelUsed: usedModel
    };
  }
}

// server/weather.ts
function mapWmoCode(code) {
  if (code === 0) return "Clear Sky";
  if (code === 1) return "Mainly Clear";
  if (code === 2) return "Partly Cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Foggy";
  if (code === 51 || code === 53 || code === 55) return "Drizzle";
  if (code === 56 || code === 57) return "Freezing Drizzle";
  if (code === 61 || code === 63 || code === 65) return "Rain";
  if (code === 66 || code === 67) return "Freezing Rain";
  if (code === 71 || code === 73 || code === 75) return "Snowfall";
  if (code === 77) return "Snow Grains";
  if (code === 80 || code === 81 || code === 82) return "Rain Showers";
  if (code === 85 || code === 86) return "Snow Showers";
  if (code === 95) return "Thunderstorm";
  if (code === 96 || code === 99) return "Thunderstorm with Hail";
  return "Variable Conditions";
}
var citySearchCache = /* @__PURE__ */ new Map();
var weatherReportCache = /* @__PURE__ */ new Map();
var WEATHER_CACHE_TTL_MS = 5 * 60 * 1e3;
async function searchCities(query) {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const cacheKey = trimmed.toLowerCase();
  const cached = citySearchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.results;
  }
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", trimmed);
  url.searchParams.set("count", "8");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(7e3)
  });
  if (!response.ok) {
    throw new Error(`Open-Meteo geocoding failed (${response.status})`);
  }
  const data = await response.json();
  const results = (data.results || []).map((r) => ({
    id: r.id,
    name: r.name,
    country: r.country || "",
    admin1: r.admin1,
    latitude: r.latitude,
    longitude: r.longitude
  }));
  citySearchCache.set(cacheKey, {
    expiresAt: Date.now() + 30 * 60 * 1e3,
    results
  });
  return results;
}
var cityCountryCache = /* @__PURE__ */ new Map();
function mapWwoToWmo(wwoCode) {
  if (wwoCode === 113) return 0;
  if (wwoCode === 116) return 2;
  if (wwoCode === 119 || wwoCode === 122) return 3;
  if (wwoCode === 143 || wwoCode === 248 || wwoCode === 260) return 45;
  if ([176, 263, 266, 293, 296].includes(wwoCode)) return 51;
  if ([299, 302, 305, 308, 353, 356, 359].includes(wwoCode)) return 61;
  if ([179, 182, 185, 227, 230, 311, 314, 317, 320, 323, 326, 329, 332, 335, 338, 368, 371].includes(wwoCode)) return 71;
  if ([200, 386, 389, 392, 395].includes(wwoCode)) return 95;
  return 2;
}
async function fetchFromOpenMeteo(params) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(params.lat));
  url.searchParams.set("longitude", String(params.lon));
  url.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m"
  );
  url.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,relative_humidity_2m_mean"
  );
  url.searchParams.set("forecast_days", "5");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("cell_selection", "nearest");
  if (params.unit === "F") {
    url.searchParams.set("temperature_unit", "fahrenheit");
    url.searchParams.set("wind_speed_unit", "mph");
  } else {
    url.searchParams.set("wind_speed_unit", "kmh");
  }
  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json", "Cache-Control": "no-cache" },
    signal: AbortSignal.timeout(8e3)
  });
  if (!response.ok) {
    throw new Error(`Open-Meteo weather request failed (${response.status})`);
  }
  const data = await response.json();
  if (!data.current || !data.daily) {
    throw new Error("Open-Meteo returned an incomplete forecast payload.");
  }
  const currentTemp = Math.round(data.current.temperature_2m);
  const currentHumidity = Math.round(data.current.relative_humidity_2m);
  const currentCode = data.current.weather_code;
  const currentCondition = mapWmoCode(currentCode);
  const daily = data.daily.time.map((date, idx) => {
    const code = idx === 0 ? currentCode : data.daily.weather_code[idx] ?? 0;
    const rawMax = Math.round(data.daily.temperature_2m_max[idx] ?? currentTemp);
    const rawMin = Math.round(data.daily.temperature_2m_min[idx] ?? currentTemp);
    const rawHumidity = idx === 0 ? currentHumidity : data.daily.relative_humidity_2m_mean?.[idx] ?? currentHumidity;
    return {
      date,
      weatherCode: code,
      condition: idx === 0 ? currentCondition : mapWmoCode(code),
      tempMax: idx === 0 ? Math.max(rawMax, currentTemp) : rawMax,
      tempMin: idx === 0 ? Math.min(rawMin, currentTemp) : rawMin,
      precipitationProbability: data.daily.precipitation_probability_max?.[idx] ?? 0,
      humidity: Math.round(rawHumidity)
    };
  });
  return {
    city: params.city,
    country: params.country,
    latitude: params.lat,
    longitude: params.lon,
    timezone: data.timezone || "UTC",
    fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
    current: {
      temperature: currentTemp,
      apparentTemperature: Math.round(data.current.apparent_temperature),
      humidity: currentHumidity,
      windSpeed: Math.round(data.current.wind_speed_10m),
      weatherCode: currentCode,
      condition: currentCondition,
      isDay: data.current.is_day === 1,
      unit: params.unit
    },
    daily
  };
}
async function fetchFromWttr(params) {
  const target = params.lat !== null && params.lon !== null ? `${params.lat},${params.lon}` : encodeURIComponent(params.city);
  const response = await fetch(`https://wttr.in/${target}?format=j1`, {
    headers: { "User-Agent": "curl/8.0.1", Accept: "application/json" },
    signal: AbortSignal.timeout(8e3)
  });
  if (!response.ok) {
    throw new Error(`Live weather provider failed (${response.status})`);
  }
  const data = await response.json();
  const curr = data.current_condition?.[0];
  if (!curr) {
    throw new Error("Live weather service returned an empty observation.");
  }
  const area = data.nearest_area?.[0];
  const resolvedCity = params.city && params.city !== "Current Location" ? params.city : area?.areaName?.[0]?.value || params.city || "Current Location";
  const resolvedCountry = params.country || area?.country?.[0]?.value || "";
  const resolvedLat = params.lat ?? (area?.latitude ? Number(area.latitude) : 0);
  const resolvedLon = params.lon ?? (area?.longitude ? Number(area.longitude) : 0);
  const wwoCurr = Number(curr.weatherCode || 116);
  const wmoCurr = mapWwoToWmo(wwoCurr);
  const currentTemp = Math.round(Number(params.unit === "F" ? curr.temp_F : curr.temp_C));
  const currentHumidity = Math.round(Number(curr.humidity || 0));
  const currentCondition = (curr.weatherDesc?.[0]?.value || mapWmoCode(wmoCurr)).trim();
  const daily = (data.weather || []).map((day, idx) => {
    const midSlot = day.hourly?.[Math.floor((day.hourly?.length || 1) / 2)] || day.hourly?.[0];
    const dayWwo = Number(midSlot?.weatherCode || wwoCurr);
    const maxPrecip = Math.max(
      0,
      ...(day.hourly || []).map((h) => Number(h.chanceofrain || 0))
    );
    const hourlyHumidities = (day.hourly || []).map((h) => Number(h.humidity)).filter((v) => Number.isFinite(v));
    const avgHumidity = hourlyHumidities.length > 0 ? hourlyHumidities.reduce((sum, v) => sum + v, 0) / hourlyHumidities.length : currentHumidity;
    const rawMax = Math.round(Number(params.unit === "F" ? day.maxtempF : day.maxtempC));
    const rawMin = Math.round(Number(params.unit === "F" ? day.mintempF : day.mintempC));
    return {
      date: day.date,
      weatherCode: idx === 0 ? wmoCurr : mapWwoToWmo(dayWwo),
      condition: idx === 0 ? currentCondition : (midSlot?.weatherDesc?.[0]?.value || mapWmoCode(mapWwoToWmo(dayWwo))).trim(),
      tempMax: idx === 0 ? Math.max(rawMax, currentTemp) : rawMax,
      tempMin: idx === 0 ? Math.min(rawMin, currentTemp) : rawMin,
      precipitationProbability: Number.isFinite(maxPrecip) ? maxPrecip : 0,
      humidity: idx === 0 ? currentHumidity : Math.round(Number.isFinite(avgHumidity) ? avgHumidity : 0)
    };
  });
  return {
    city: resolvedCity,
    country: resolvedCountry,
    latitude: resolvedLat,
    longitude: resolvedLon,
    timezone: "auto",
    fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
    current: {
      temperature: Math.round(Number(params.unit === "F" ? curr.temp_F : curr.temp_C)),
      apparentTemperature: Math.round(
        Number(params.unit === "F" ? curr.FeelsLikeF : curr.FeelsLikeC)
      ),
      humidity: Math.round(Number(curr.humidity || 0)),
      windSpeed: Math.round(
        Number(params.unit === "F" ? curr.windspeedMiles : curr.windspeedKmph)
      ),
      weatherCode: wmoCurr,
      condition: (curr.weatherDesc?.[0]?.value || mapWmoCode(wmoCurr)).trim(),
      isDay: true,
      unit: params.unit
    },
    daily
  };
}
async function fetchLiveWeather(params) {
  const unit = params.unit === "F" ? "F" : "C";
  const weatherCacheKey = `${params.city.trim().toLowerCase()}|${params.latitude ?? ""}|${params.longitude ?? ""}|${unit}`;
  if (!params.bypassCache) {
    const cached = weatherReportCache.get(weatherCacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.report;
    }
  }
  let lat = params.latitude ?? null;
  let lon = params.longitude ?? null;
  let resolvedCity = params.city;
  let country = "";
  if (params.city) {
    const cacheKey = params.city.trim().toLowerCase();
    if (lat === null || lon === null) {
      try {
        const matches = await searchCities(params.city);
        if (matches.length > 0) {
          lat = matches[0].latitude;
          lon = matches[0].longitude;
          resolvedCity = matches[0].name;
          country = matches[0].country;
          if (country) cityCountryCache.set(cacheKey, country);
        }
      } catch {
      }
    } else if (cityCountryCache.has(cacheKey)) {
      country = cityCountryCache.get(cacheKey) || "";
    } else {
      try {
        const matches = await searchCities(params.city);
        if (matches.length > 0 && matches[0].country) {
          country = matches[0].country;
          cityCountryCache.set(cacheKey, country);
        }
      } catch {
      }
    }
  }
  let report = null;
  if (lat !== null && lon !== null) {
    try {
      report = await fetchFromOpenMeteo({
        lat,
        lon,
        city: resolvedCity,
        country,
        unit
      });
    } catch {
    }
  }
  if (!report) {
    report = await fetchFromWttr({
      lat,
      lon,
      city: resolvedCity,
      country,
      unit
    });
  }
  weatherReportCache.set(weatherCacheKey, {
    expiresAt: Date.now() + WEATHER_CACHE_TTL_MS,
    report
  });
  return report;
}

// server.ts
import_node_dns.default.setDefaultResultOrder("ipv4first");
var ALLOWED_EXTENSIONS = /* @__PURE__ */ new Set([".jpg", ".jpeg", ".png", ".webp"]);
var ALLOWED_MIME_TYPES = /* @__PURE__ */ new Set(["image/jpeg", "image/png", "image/webp", "image/jpg"]);
var storage = import_multer.default.diskStorage({
  destination: (_req, _file, cb) => {
    import_node_fs2.default.mkdirSync(UPLOADS_DIR, { recursive: true });
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = import_node_path2.default.extname(file.originalname).toLowerCase() || ".jpg";
    const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : ".jpg";
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${safeExt}`;
    cb(null, unique);
  }
});
var upload = (0, import_multer.default)({
  storage,
  limits: { fileSize: 12 * 1024 * 1024, files: 12 },
  fileFilter: (_req, file, cb) => {
    const ext = import_node_path2.default.extname(file.originalname).toLowerCase();
    if (ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase()) || ALLOWED_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, JPEG, PNG, and WEBP images are supported."));
    }
  }
});
function validateCategory(value) {
  const valid = [
    "tops",
    "bottoms",
    "dresses",
    "outerwear",
    "shoes",
    "accessories"
  ];
  if (value && valid.includes(value)) {
    return value;
  }
  return "tops";
}
function validateSeason(value) {
  const valid = ["All-Season", "Spring", "Summer", "Autumn", "Winter"];
  if (value && valid.includes(value)) {
    return value;
  }
  return "All-Season";
}
function validateGarmentGender(value) {
  if (value === "female" || value === "male" || value === "unisex") {
    return value;
  }
  return "unisex";
}
function validateGenderOption(value) {
  return value === "male" ? "male" : "female";
}
function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = decodeURIComponent(part.slice(idx + 1).trim());
    out[key] = val;
  }
  return out;
}
function extractAuthToken(req) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith("Bearer ")) {
    return auth.slice(7).trim();
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies.stylesync_session;
}
function setSessionCookie(req, res, token) {
  const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https";
  res.cookie("stylesync_session", token, {
    httpOnly: true,
    sameSite: isHttps ? "none" : "lax",
    secure: isHttps,
    maxAge: 30 * 24 * 60 * 60 * 1e3,
    path: "/"
  });
}
function clearSessionCookie(req, res) {
  const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https";
  res.clearCookie("stylesync_session", {
    httpOnly: true,
    sameSite: isHttps ? "none" : "lax",
    secure: isHttps,
    path: "/"
  });
}
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = process.env.NODE_ENV === "production" ? Number(process.env.PORT) || 3e3 : 3e3;
  app.use(import_express.default.json({ limit: "10mb" }));
  app.use("/uploads", import_express.default.static(UPLOADS_DIR));
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", app: "StyleSync", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  app.get("/api/auth/me", (req, res) => {
    const token = extractAuthToken(req);
    const user = getSessionUser(token);
    if (!user) {
      res.status(401).json({ user: null });
      return;
    }
    res.json({ user });
  });
  app.post("/api/auth/register", (req, res) => {
    try {
      const { user, token } = registerUser({
        name: String(req.body.name || ""),
        email: String(req.body.email || ""),
        password: String(req.body.password || ""),
        gender: validateGenderOption(req.body.gender)
      });
      setSessionCookie(req, res, token);
      res.status(201).json({ user, token });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  app.post("/api/auth/login", (req, res) => {
    try {
      const gender = req.body.gender === "male" || req.body.gender === "female" ? req.body.gender : void 0;
      const { user, token } = loginUser({
        email: String(req.body.email || ""),
        password: String(req.body.password || ""),
        gender
      });
      setSessionCookie(req, res, token);
      res.json({ user, token });
    } catch (error) {
      res.status(401).json({ error: error.message });
    }
  });
  app.post("/api/auth/guest", (req, res) => {
    try {
      const { user, token } = loginGuestUser(validateGenderOption(req.body.gender));
      setSessionCookie(req, res, token);
      res.json({ user, token });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  async function verifyFirebaseIdToken(idToken) {
    const appDir = process.env.STYLESYNC_APP_DIR ? import_node_path2.default.resolve(process.env.STYLESYNC_APP_DIR) : process.cwd();
    const configPath = import_node_path2.default.resolve(appDir, "firebase-applet-config.json");
    if (!import_node_fs2.default.existsSync(configPath)) {
      throw new Error("Firebase configuration file not found on server.");
    }
    const fbConfig = JSON.parse(import_node_fs2.default.readFileSync(configPath, "utf-8"));
    if (!fbConfig.apiKey) {
      throw new Error("Firebase API key is missing in configuration.");
    }
    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(fbConfig.apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
        signal: AbortSignal.timeout(8e3)
      }
    );
    if (!verifyRes.ok) {
      const err = new Error("Invalid or expired Firebase sign-in token.");
      err.status = 401;
      throw err;
    }
    const verifyData = await verifyRes.json();
    const fbAccount = verifyData.users?.[0];
    if (!fbAccount || !fbAccount.email) {
      const err = new Error("Could not verify Google account email.");
      err.status = 401;
      throw err;
    }
    return {
      email: fbAccount.email,
      name: fbAccount.displayName || fbAccount.email.split("@")[0]
    };
  }
  const pendingDesktopGoogleAuth = /* @__PURE__ */ new Map();
  const DESKTOP_AUTH_TTL_MS = 10 * 60 * 1e3;
  function pruneDesktopGoogleAuth() {
    const cutoff = Date.now() - DESKTOP_AUTH_TTL_MS;
    for (const [key, entry] of pendingDesktopGoogleAuth.entries()) {
      if (entry.createdAt < cutoff) {
        pendingDesktopGoogleAuth.delete(key);
      }
    }
  }
  app.post("/api/auth/desktop-google/start", (_req, res) => {
    pruneDesktopGoogleAuth();
    const nonce = import_node_crypto2.default.randomBytes(24).toString("hex");
    pendingDesktopGoogleAuth.set(nonce, {
      status: "pending",
      createdAt: Date.now()
    });
    res.json({ nonce });
  });
  app.post("/api/auth/desktop-google/complete", async (req, res) => {
    try {
      pruneDesktopGoogleAuth();
      const nonce = typeof req.body.nonce === "string" ? req.body.nonce.trim() : "";
      const idToken = typeof req.body.idToken === "string" ? req.body.idToken.trim() : "";
      if (!nonce || !idToken) {
        res.status(400).json({ error: "Sign-in nonce and Firebase ID token are required." });
        return;
      }
      const pending = pendingDesktopGoogleAuth.get(nonce);
      if (!pending) {
        res.status(410).json({ error: "This sign-in link expired. Return to StyleSync and try again." });
        return;
      }
      const fbAccount = await verifyFirebaseIdToken(idToken);
      const gender = req.body.gender === "male" || req.body.gender === "female" ? req.body.gender : void 0;
      const { user, token } = loginFirebaseUser({
        email: fbAccount.email,
        name: fbAccount.name,
        gender
      });
      pendingDesktopGoogleAuth.set(nonce, {
        status: "complete",
        createdAt: pending.createdAt,
        user,
        token,
        googleIdToken: typeof req.body.googleIdToken === "string" ? req.body.googleIdToken : void 0,
        googleAccessToken: typeof req.body.googleAccessToken === "string" ? req.body.googleAccessToken : void 0
      });
      res.json({ ok: true, email: user.email });
    } catch (error) {
      const status = error.status || 500;
      res.status(status).json({ error: error.message });
    }
  });
  app.get("/api/auth/desktop-google/status", (req, res) => {
    pruneDesktopGoogleAuth();
    const nonce = typeof req.query.nonce === "string" ? req.query.nonce.trim() : "";
    if (!nonce) {
      res.status(400).json({ status: "expired", error: "Missing sign-in nonce." });
      return;
    }
    const entry = pendingDesktopGoogleAuth.get(nonce);
    if (!entry) {
      res.json({ status: "expired" });
      return;
    }
    if (entry.status !== "complete" || !entry.user || !entry.token) {
      res.json({ status: "pending" });
      return;
    }
    pendingDesktopGoogleAuth.delete(nonce);
    setSessionCookie(req, res, entry.token);
    res.json({
      status: "complete",
      user: entry.user,
      token: entry.token,
      googleIdToken: entry.googleIdToken,
      googleAccessToken: entry.googleAccessToken
    });
  });
  app.post("/api/auth/firebase", async (req, res) => {
    try {
      const idToken = typeof req.body.idToken === "string" ? req.body.idToken.trim() : "";
      if (!idToken) {
        res.status(400).json({ error: "Firebase ID token is required." });
        return;
      }
      const fbAccount = await verifyFirebaseIdToken(idToken);
      const gender = req.body.gender === "male" || req.body.gender === "female" ? req.body.gender : void 0;
      const { user, token } = loginFirebaseUser({
        email: fbAccount.email,
        name: fbAccount.name,
        gender
      });
      setSessionCookie(req, res, token);
      res.json({ user, token });
    } catch (error) {
      const status = error.status || 500;
      res.status(status).json({ error: error.message });
    }
  });
  app.post("/api/auth/logout", (req, res) => {
    const token = extractAuthToken(req);
    logoutSession(token);
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });
  app.post("/api/auth/change-password", (req, res) => {
    const token = extractAuthToken(req);
    const user = getSessionUser(token);
    if (!user) {
      res.status(401).json({ error: "Authentication required. Please sign in." });
      return;
    }
    try {
      const currentPassword = String(req.body.currentPassword || "");
      const newPassword = String(req.body.newPassword || "");
      changeUserPassword(user.id, currentPassword, newPassword);
      res.json({ ok: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  app.delete("/api/auth/account", (req, res) => {
    const token = extractAuthToken(req);
    const user = getSessionUser(token);
    if (!user) {
      res.status(401).json({ error: "Authentication required. Please sign in." });
      return;
    }
    try {
      deleteUserAccount(user.id);
      clearSessionCookie(req, res);
      res.json({ deleted: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.use("/api", (req, res, next) => {
    if (req.path === "/health" || req.path.startsWith("/auth/")) {
      next();
      return;
    }
    const user = getSessionUser(extractAuthToken(req));
    if (!user) {
      res.status(401).json({ error: "Authentication required. Please sign in." });
      return;
    }
    next();
  });
  app.get("/api/dashboard", (_req, res) => {
    try {
      const data = getDashboardData();
      const wardrobe = listClothingItems();
      const profile = getProfile();
      const dailyList = wardrobe.length > 0 ? generateLocalFallbackOutfits({
        wardrobe,
        occasion: "Casual",
        profile,
        count: 1
      }) : [];
      res.json({
        ...data,
        dailySuggestion: dailyList[0] ?? null
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/wardrobe", (req, res) => {
    try {
      const items = listClothingItems({
        category: req.query.category,
        target_gender: req.query.target_gender,
        search: req.query.search,
        season: req.query.season,
        color: req.query.color,
        sort: req.query.sort
      });
      res.json({ items });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/wardrobe/starter", (_req, res) => {
    try {
      const result = loadStarterWardrobe();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/wardrobe", upload.array("images", 12), (req, res) => {
    try {
      const files = req.files || [];
      const existingImagePath = typeof req.body.image_path === "string" ? req.body.image_path.trim() : "";
      if (files.length === 0 && !existingImagePath) {
        res.status(400).json({ error: "Please upload at least one clothing image (JPG, PNG, or WEBP)." });
        return;
      }
      const createdItems = [];
      if (files.length > 0) {
        for (const file of files) {
          const baseName = import_node_path2.default.basename(file.originalname, import_node_path2.default.extname(file.originalname)).replace(/[-_]+/g, " ").trim();
          const name = files.length === 1 && req.body.name?.trim() ? req.body.name.trim() : baseName || "Wardrobe Garment";
          createdItems.push(
            createClothingItem({
              name,
              category: validateCategory(req.body.category),
              target_gender: validateGarmentGender(req.body.target_gender),
              color: req.body.color || "Neutral",
              secondary_color: req.body.secondary_color || "",
              pattern: req.body.pattern || "Solid",
              style: req.body.style || "Casual",
              season: validateSeason(req.body.season),
              notes: req.body.notes || "",
              image_path: `/uploads/${file.filename}`
            })
          );
        }
      } else {
        if (!req.body.name?.trim()) {
          res.status(400).json({ error: "Garment name is required." });
          return;
        }
        createdItems.push(
          createClothingItem({
            name: req.body.name.trim(),
            category: validateCategory(req.body.category),
            target_gender: validateGarmentGender(req.body.target_gender),
            color: req.body.color || "Neutral",
            secondary_color: req.body.secondary_color || "",
            pattern: req.body.pattern || "Solid",
            style: req.body.style || "Casual",
            season: validateSeason(req.body.season),
            notes: req.body.notes || "",
            image_path: existingImagePath
          })
        );
      }
      res.status(201).json({ items: createdItems });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  app.patch("/api/wardrobe/:id", (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        res.status(400).json({ error: "Invalid clothing item ID." });
        return;
      }
      const updated = updateClothingItem(id, req.body);
      if (!updated) {
        res.status(404).json({ error: "Clothing item not found." });
        return;
      }
      res.json({ item: updated });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  app.delete("/api/wardrobe/all", (_req, res) => {
    try {
      const deletedIds = clearAllWardrobeImages();
      res.json({ deletedCount: deletedIds.length, deletedIds });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.delete("/api/wardrobe/:id", (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        res.status(400).json({ error: "Invalid clothing item ID." });
        return;
      }
      const removed = deleteClothingItem(id);
      if (!removed) {
        res.status(404).json({ error: "Clothing item not found." });
        return;
      }
      res.json({ deleted: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/ai/recognize", upload.single("image"), async (req, res) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "Please select an image file (JPG, PNG, or WEBP) to analyze." });
      return;
    }
    const previewImagePath = `/uploads/${file.filename}`;
    const settings = getSettings();
    try {
      const buffer = import_node_fs2.default.readFileSync(file.path);
      const { result, modelUsed } = await recognizeClothingWithGemma({
        imageBuffer: buffer,
        mimeType: file.mimetype || "image/jpeg",
        modelId: settings.gemma_model
      });
      res.json({
        ok: true,
        modelUsed,
        previewImagePath,
        recognition: result
      });
    } catch (error) {
      res.json({
        ok: false,
        modelAttempted: settings.gemma_model,
        previewImagePath,
        manualFallback: true,
        error: error.message
      });
    }
  });
  app.post("/api/ai/recommend", async (req, res) => {
    try {
      const occasion = String(req.body.occasion || "Casual").trim() || "Casual";
      const customPrompt = typeof req.body.customPrompt === "string" ? req.body.customPrompt.trim() : "";
      const includeWeather = Boolean(req.body.includeWeather);
      const wardrobe = listClothingItems();
      if (wardrobe.length < 2) {
        res.status(400).json({
          error: "Add at least 2 clothing items to your wardrobe before generating outfit recommendations."
        });
        return;
      }
      const settings = getSettings();
      const profile = getProfile();
      let weather = null;
      if (includeWeather && settings.preferred_city) {
        try {
          weather = await fetchLiveWeather({
            city: settings.preferred_city,
            latitude: settings.preferred_lat,
            longitude: settings.preferred_lon,
            unit: settings.temperature_unit
          });
        } catch {
          weather = null;
        }
      }
      const weatherContext = weather ? `${weather.city}: ${weather.current.temperature}\xB0${weather.current.unit}, ${weather.current.condition}` : "";
      try {
        const { outfits, modelUsed } = await recommendOutfitsWithGemma({
          wardrobe,
          occasion,
          customPrompt,
          profile,
          weather,
          modelId: settings.gemma_model
        });
        const historyEntry = recordGenerationHistory({
          occasion,
          custom_prompt: customPrompt,
          source: "gemma",
          model_used: modelUsed,
          weather_context: weatherContext,
          outfits
        });
        res.json({
          source: "gemma",
          modelUsed,
          outfits,
          weather,
          historyEntry
        });
      } catch (gemmaError) {
        const fallbackOutfits = generateLocalFallbackOutfits({
          wardrobe,
          occasion,
          customPrompt,
          profile,
          weather,
          count: 3
        });
        const historyEntry = recordGenerationHistory({
          occasion,
          custom_prompt: customPrompt,
          source: "local-fallback",
          model_used: "Local Style Engine",
          weather_context: weatherContext,
          outfits: fallbackOutfits
        });
        res.json({
          source: "local-fallback",
          modelAttempted: settings.gemma_model,
          fallbackReason: gemmaError.message,
          outfits: fallbackOutfits,
          weather,
          historyEntry
        });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/ai/history", (_req, res) => {
    try {
      res.json({ history: listGenerationHistory(30) });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.delete("/api/ai/history/:id", (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        res.status(400).json({ error: "Invalid history ID." });
        return;
      }
      const deleted = deleteGenerationHistoryEntry(id);
      if (!deleted) {
        res.status(404).json({ error: "History entry not found." });
        return;
      }
      res.json({ deleted: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.delete("/api/ai/history", (_req, res) => {
    try {
      clearGenerationHistory();
      res.json({ cleared: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const message = String(req.body.message || "").trim();
      const history = Array.isArray(req.body.history) ? req.body.history : [];
      if (!message) {
        res.status(400).json({ error: "Please enter a message." });
        return;
      }
      const wardrobe = listClothingItems();
      const profile = getProfile();
      const settings = getSettings();
      let weather = null;
      if (settings.preferred_city) {
        try {
          weather = await fetchLiveWeather({
            city: settings.preferred_city,
            latitude: settings.preferred_lat,
            longitude: settings.preferred_lon,
            unit: settings.temperature_unit
          });
        } catch {
          weather = null;
        }
      }
      const { reply, referencedItemIds, modelUsed } = await chatWithGemmaFashionAssistant({
        message,
        history,
        wardrobe,
        profile,
        weather,
        modelId: settings.gemma_model
      });
      const referencedItems = referencedItemIds.map((id) => getClothingItemById(id)).filter((item) => item !== null);
      res.json({
        reply,
        referencedItems,
        modelUsed
      });
    } catch (error) {
      res.status(502).json({
        error: error.message
      });
    }
  });
  app.get("/api/outfits", (_req, res) => {
    try {
      res.json({ outfits: listOutfits() });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/outfits", (req, res) => {
    try {
      const itemIds = Array.isArray(req.body.item_ids) ? req.body.item_ids.map((id) => Number(id)).filter((n) => Number.isInteger(n)) : [];
      if (itemIds.length === 0) {
        res.status(400).json({ error: "Outfit must contain at least one existing clothing item." });
        return;
      }
      const outfit = createOutfit({
        name: String(req.body.name || "Saved Look"),
        occasion: String(req.body.occasion || "Casual"),
        reasoning: String(req.body.reasoning || ""),
        source: req.body.source === "local-fallback" || req.body.source === "manual" ? req.body.source : "gemma",
        weather_context: String(req.body.weather_context || ""),
        item_ids: itemIds
      });
      res.status(201).json({ outfit });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  app.delete("/api/outfits/:id", (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        res.status(400).json({ error: "Invalid outfit ID." });
        return;
      }
      const ok = deleteOutfit(id);
      if (!ok) {
        res.status(404).json({ error: "Outfit not found." });
        return;
      }
      res.json({ deleted: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/outfits/:id/wear", (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        res.status(400).json({ error: "Invalid outfit ID." });
        return;
      }
      const entries = logWear({
        outfit_id: id,
        worn_date: req.body.worn_date,
        occasion: req.body.occasion,
        notes: req.body.notes
      });
      res.status(201).json({ entries });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  app.get("/api/weather/search", async (req, res) => {
    try {
      const q = String(req.query.q || "").trim();
      if (!q) {
        res.json({ results: [] });
        return;
      }
      const results = await searchCities(q);
      res.json({ results });
    } catch (error) {
      res.status(502).json({ error: error.message });
    }
  });
  app.get("/api/weather/forecast", async (req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      const settings = getSettings();
      const city = String(req.query.city || settings.preferred_city || "New York").trim();
      const lat = req.query.lat !== void 0 ? Number(req.query.lat) : settings.preferred_lat;
      const lon = req.query.lon !== void 0 ? Number(req.query.lon) : settings.preferred_lon;
      const unit = req.query.unit === "F" || req.query.unit === "C" ? req.query.unit : settings.temperature_unit;
      const report = await fetchLiveWeather({
        city,
        latitude: req.query.city && req.query.lat === void 0 ? null : lat,
        longitude: req.query.city && req.query.lon === void 0 ? null : lon,
        unit,
        bypassCache: true
      });
      res.json({ weather: report });
    } catch (error) {
      res.status(502).json({ error: error.message });
    }
  });
  app.post("/api/weather/suggest", async (req, res) => {
    try {
      const settings = getSettings();
      const profile = getProfile();
      const wardrobe = listClothingItems();
      if (wardrobe.length < 2) {
        res.status(400).json({
          error: "Add at least 2 clothing items to your wardrobe to receive weather-matched outfits."
        });
        return;
      }
      const city = String(req.body.city || settings.preferred_city || "New York");
      const lat = req.body.lat !== void 0 ? Number(req.body.lat) : settings.preferred_lat;
      const lon = req.body.lon !== void 0 ? Number(req.body.lon) : settings.preferred_lon;
      const weather = await fetchLiveWeather({
        city,
        latitude: lat,
        longitude: lon,
        unit: settings.temperature_unit
      });
      const occasion = String(req.body.occasion || "Daily Weather-Ready");
      const weatherContext = `${weather.city}: ${weather.current.temperature}\xB0${weather.current.unit}, ${weather.current.condition}`;
      try {
        const { outfits, modelUsed } = await recommendOutfitsWithGemma({
          wardrobe,
          occasion,
          customPrompt: `Prioritize comfort and layering for the live weather in ${weather.city}: ${weather.current.temperature}\xB0${weather.current.unit}, ${weather.current.condition}, humidity ${weather.current.humidity}%.`,
          profile,
          weather,
          modelId: settings.gemma_model
        });
        const historyEntry = recordGenerationHistory({
          occasion,
          custom_prompt: `Weather-matched (${weather.city})`,
          source: "gemma",
          model_used: modelUsed,
          weather_context: weatherContext,
          outfits
        });
        res.json({
          source: "gemma",
          modelUsed,
          weather,
          outfits,
          historyEntry
        });
      } catch (gemmaError) {
        const fallbackOutfits = generateLocalFallbackOutfits({
          wardrobe,
          occasion,
          profile,
          weather,
          count: 3
        });
        const historyEntry = recordGenerationHistory({
          occasion,
          custom_prompt: `Weather-matched (${weather.city})`,
          source: "local-fallback",
          model_used: "Local Style Engine",
          weather_context: weatherContext,
          outfits: fallbackOutfits
        });
        res.json({
          source: "local-fallback",
          modelAttempted: settings.gemma_model,
          fallbackReason: gemmaError.message,
          weather,
          outfits: fallbackOutfits,
          historyEntry
        });
      }
    } catch (error) {
      res.status(502).json({ error: error.message });
    }
  });
  app.get("/api/favourites", (_req, res) => {
    try {
      res.json(listFavourites());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/favourites/toggle", (req, res) => {
    try {
      const itemType = req.body.itemType === "outfit" ? "outfit" : "clothing";
      const targetId = Number(req.body.targetId);
      if (!Number.isInteger(targetId)) {
        res.status(400).json({ error: "Invalid targetId for favourite toggle." });
        return;
      }
      const result = toggleFavourite(itemType, targetId);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  app.get("/api/wear-history", (_req, res) => {
    try {
      const history = listWearHistory(150);
      const mostWorn = listClothingItems({ sort: "most_worn" }).slice(0, 6);
      const leastWorn = listClothingItems({ sort: "least_worn" }).slice(0, 6);
      res.json({ history, mostWorn, leastWorn });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/wear-history", (req, res) => {
    try {
      const outfitId = req.body.outfit_id ? Number(req.body.outfit_id) : null;
      const clothingItemIds = Array.isArray(req.body.clothing_item_ids) ? req.body.clothing_item_ids.map((id) => Number(id)).filter((n) => Number.isInteger(n)) : [];
      if (!outfitId && clothingItemIds.length === 0) {
        res.status(400).json({ error: "Select an outfit or at least one clothing item to mark as worn." });
        return;
      }
      const entries = logWear({
        worn_date: req.body.worn_date,
        outfit_id: outfitId,
        clothing_item_ids: clothingItemIds,
        occasion: req.body.occasion,
        notes: req.body.notes
      });
      res.status(201).json({ entries });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  app.delete("/api/wear-history/:id", (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        res.status(400).json({ error: "Invalid wear history ID." });
        return;
      }
      const ok = deleteWearHistory(id);
      if (!ok) {
        res.status(404).json({ error: "Wear history entry not found." });
        return;
      }
      res.json({ deleted: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/calendar", (req, res) => {
    try {
      const month = typeof req.query.month === "string" ? req.query.month : void 0;
      res.json({ entries: listCalendarEntries(month) });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/calendar", (req, res) => {
    try {
      const plannedDate = String(req.body.planned_date || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(plannedDate)) {
        res.status(400).json({ error: "A valid YYYY-MM-DD planned_date is required." });
        return;
      }
      const entry = createCalendarEntry({
        planned_date: plannedDate,
        outfit_id: req.body.outfit_id ? Number(req.body.outfit_id) : null,
        title: String(req.body.title || "Planned Outfit"),
        occasion: String(req.body.occasion || "Casual"),
        notes: String(req.body.notes || ""),
        item_ids: Array.isArray(req.body.item_ids) ? req.body.item_ids.map((n) => Number(n)).filter((n) => Number.isInteger(n)) : []
      });
      res.status(201).json({ entry });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  app.patch("/api/calendar/:id", (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        res.status(400).json({ error: "Invalid calendar entry ID." });
        return;
      }
      const updated = updateCalendarEntry(id, req.body);
      if (!updated) {
        res.status(404).json({ error: "Calendar entry not found." });
        return;
      }
      res.json({ entry: updated });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  app.delete("/api/calendar/:id", (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        res.status(400).json({ error: "Invalid calendar entry ID." });
        return;
      }
      const ok = deleteCalendarEntry(id);
      if (!ok) {
        res.status(404).json({ error: "Calendar entry not found." });
        return;
      }
      res.json({ deleted: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/settings", (req, res) => {
    try {
      const user = getSessionUser(extractAuthToken(req));
      res.json({
        profile: getProfile(user),
        settings: getSettings(),
        storage: getStorageInfo()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.put("/api/settings", (req, res) => {
    try {
      const user = getSessionUser(extractAuthToken(req));
      if (req.body.settings?.gemma_model) {
        const m = String(req.body.settings.gemma_model).trim();
        if (!m.toLowerCase().startsWith("gemma")) {
          res.status(400).json({
            error: "Model ID must belong to the Google Gemma family (e.g. gemma-4-26b-a4b-it)."
          });
          return;
        }
      }
      const updated = updateProfileAndSettings(
        {
          profile: req.body.profile,
          settings: req.body.settings
        },
        user
      );
      res.json({
        ...updated,
        storage: getStorageInfo()
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  app.use((err, _req, res, _next) => {
    res.status(400).json({ error: err.message || "Request failed." });
  });
  const httpServer = import_node_http.default.createServer(app);
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        ws: { server: httpServer },
        hmr: process.env.DISABLE_HMR !== "true"
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const appDir = process.env.STYLESYNC_APP_DIR ? import_node_path2.default.resolve(process.env.STYLESYNC_APP_DIR) : process.cwd();
    const distDir = import_node_path2.default.join(appDir, "dist");
    app.use(import_express.default.static(distDir));
    app.get("*", (_req, res) => {
      res.sendFile(import_node_path2.default.join(distDir, "index.html"));
    });
  }
  const host = process.env.STYLESYNC_HOST;
  const onListening = () => {
    console.log(`StyleSync server running on http://localhost:${PORT}`);
  };
  if (host === "dual") {
    httpServer.listen(PORT, onListening);
  } else {
    httpServer.listen(PORT, host || "0.0.0.0", onListening);
  }
}
startServer();
