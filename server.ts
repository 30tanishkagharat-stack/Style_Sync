import 'dotenv/config';
import crypto from 'node:crypto';
import dns from 'node:dns';
import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import multer from 'multer';

dns.setDefaultResultOrder('ipv4first');
import {
  UPLOADS_DIR,
  changeUserPassword,
  clearAllWardrobeImages,
  clearGenerationHistory,
  createCalendarEntry,
  createClothingItem,
  createOutfit,
  deleteCalendarEntry,
  deleteClothingItem,
  deleteGenerationHistoryEntry,
  deleteOutfit,
  deleteUserAccount,
  deleteWearHistory,
  getClothingItemById,
  getDashboardData,
  getProfile,
  getSessionUser,
  getSettings,
  getStorageInfo,
  listCalendarEntries,
  listClothingItems,
  listFavourites,
  listGenerationHistory,
  listOutfits,
  listWearHistory,
  loadStarterWardrobe,
  logWear,
  loginFirebaseUser,
  loginGuestUser,
  loginUser,
  logoutSession,
  recordGenerationHistory,
  registerUser,
  toggleFavourite,
  updateCalendarEntry,
  updateClothingItem,
  updateProfileAndSettings,
} from './server/db.ts';
import {
  chatWithGemmaFashionAssistant,
  recognizeClothingWithGemma,
  recommendOutfitsWithGemma,
} from './server/gemma.ts';
import { generateLocalFallbackOutfits } from './server/localMatcher.ts';
import { fetchLiveWeather, searchCities } from './server/weather.ts';
import type { ClothingCategory, GarmentGender, GenderOption, SeasonTag } from './src/types.ts';

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/jpg']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : '.jpg';
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${safeExt}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024, files: 12 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase()) || ALLOWED_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, JPEG, PNG, and WEBP images are supported.'));
    }
  },
});

function validateCategory(value: string | undefined): ClothingCategory {
  const valid: ClothingCategory[] = [
    'tops',
    'bottoms',
    'dresses',
    'outerwear',
    'shoes',
    'accessories',
  ];
  if (value && valid.includes(value as ClothingCategory)) {
    return value as ClothingCategory;
  }
  return 'tops';
}

function validateSeason(value: string | undefined): SeasonTag {
  const valid: SeasonTag[] = ['All-Season', 'Spring', 'Summer', 'Autumn', 'Winter'];
  if (value && valid.includes(value as SeasonTag)) {
    return value as SeasonTag;
  }
  return 'All-Season';
}

function validateGarmentGender(value: string | undefined): GarmentGender {
  if (value === 'female' || value === 'male' || value === 'unisex') {
    return value;
  }
  return 'unisex';
}

function validateGenderOption(value: unknown): GenderOption {
  return value === 'male' ? 'male' : 'female';
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = decodeURIComponent(part.slice(idx + 1).trim());
    out[key] = val;
  }
  return out;
}

function extractAuthToken(req: express.Request): string | undefined {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies.stylesync_session;
}

function setSessionCookie(req: express.Request, res: express.Response, token: string): void {
  const isHttps =
    req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.cookie('stylesync_session', token, {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function clearSessionCookie(req: express.Request, res: express.Response): void {
  const isHttps =
    req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.clearCookie('stylesync_session', {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    path: '/',
  });
}

async function startServer() {
  const app = express();
  const PORT =
    process.env.NODE_ENV === 'production'
      ? Number(process.env.PORT) || 3000
      : 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use('/uploads', express.static(UPLOADS_DIR));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', app: 'StyleSync', timestamp: new Date().toISOString() });
  });

  // Authentication endpoints
  app.get('/api/auth/me', (req, res) => {
    const token = extractAuthToken(req);
    const user = getSessionUser(token);
    if (!user) {
      res.status(401).json({ user: null });
      return;
    }
    res.json({ user });
  });

  app.post('/api/auth/register', (req, res) => {
    try {
      const { user, token } = registerUser({
        name: String(req.body.name || ''),
        email: String(req.body.email || ''),
        password: String(req.body.password || ''),
        gender: validateGenderOption(req.body.gender),
      });
      setSessionCookie(req, res, token);
      res.status(201).json({ user, token });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.post('/api/auth/login', (req, res) => {
    try {
      const gender =
        req.body.gender === 'male' || req.body.gender === 'female'
          ? (req.body.gender as GenderOption)
          : undefined;
      const { user, token } = loginUser({
        email: String(req.body.email || ''),
        password: String(req.body.password || ''),
        gender,
      });
      setSessionCookie(req, res, token);
      res.json({ user, token });
    } catch (error) {
      res.status(401).json({ error: (error as Error).message });
    }
  });

  app.post('/api/auth/guest', (req, res) => {
    try {
      const { user, token } = loginGuestUser(validateGenderOption(req.body.gender));
      setSessionCookie(req, res, token);
      res.json({ user, token });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  async function verifyFirebaseIdToken(idToken: string): Promise<{
    email: string;
    name: string;
  }> {
    const appDir = process.env.STYLESYNC_APP_DIR
      ? path.resolve(process.env.STYLESYNC_APP_DIR)
      : process.cwd();
    const configPath = path.resolve(appDir, 'firebase-applet-config.json');
    if (!fs.existsSync(configPath)) {
      throw new Error('Firebase configuration file not found on server.');
    }
    const fbConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as { apiKey?: string };
    if (!fbConfig.apiKey) {
      throw new Error('Firebase API key is missing in configuration.');
    }

    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(fbConfig.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!verifyRes.ok) {
      const err = new Error('Invalid or expired Firebase sign-in token.') as Error & {
        status?: number;
      };
      err.status = 401;
      throw err;
    }

    const verifyData = (await verifyRes.json()) as {
      users?: Array<{
        localId: string;
        email?: string;
        emailVerified?: boolean;
        displayName?: string;
      }>;
    };
    const fbAccount = verifyData.users?.[0];
    if (!fbAccount || !fbAccount.email) {
      const err = new Error('Could not verify Google account email.') as Error & {
        status?: number;
      };
      err.status = 401;
      throw err;
    }

    return {
      email: fbAccount.email,
      name: fbAccount.displayName || fbAccount.email.split('@')[0],
    };
  }

  interface PendingDesktopGoogleAuth {
    status: 'pending' | 'complete';
    createdAt: number;
    user?: ReturnType<typeof loginFirebaseUser>['user'];
    token?: string;
    googleIdToken?: string;
    googleAccessToken?: string;
  }

  const pendingDesktopGoogleAuth = new Map<string, PendingDesktopGoogleAuth>();
  const DESKTOP_AUTH_TTL_MS = 10 * 60 * 1000;

  function pruneDesktopGoogleAuth(): void {
    const cutoff = Date.now() - DESKTOP_AUTH_TTL_MS;
    for (const [key, entry] of pendingDesktopGoogleAuth.entries()) {
      if (entry.createdAt < cutoff) {
        pendingDesktopGoogleAuth.delete(key);
      }
    }
  }

  app.post('/api/auth/desktop-google/start', (_req, res) => {
    pruneDesktopGoogleAuth();
    const nonce = crypto.randomBytes(24).toString('hex');
    pendingDesktopGoogleAuth.set(nonce, {
      status: 'pending',
      createdAt: Date.now(),
    });
    res.json({ nonce });
  });

  app.post('/api/auth/desktop-google/complete', async (req, res) => {
    try {
      pruneDesktopGoogleAuth();
      const nonce = typeof req.body.nonce === 'string' ? req.body.nonce.trim() : '';
      const idToken = typeof req.body.idToken === 'string' ? req.body.idToken.trim() : '';
      if (!nonce || !idToken) {
        res.status(400).json({ error: 'Sign-in nonce and Firebase ID token are required.' });
        return;
      }

      const pending = pendingDesktopGoogleAuth.get(nonce);
      if (!pending) {
        res.status(410).json({ error: 'This sign-in link expired. Return to StyleSync and try again.' });
        return;
      }

      const fbAccount = await verifyFirebaseIdToken(idToken);
      const gender =
        req.body.gender === 'male' || req.body.gender === 'female'
          ? (req.body.gender as GenderOption)
          : undefined;

      const { user, token } = loginFirebaseUser({
        email: fbAccount.email,
        name: fbAccount.name,
        gender,
      });

      pendingDesktopGoogleAuth.set(nonce, {
        status: 'complete',
        createdAt: pending.createdAt,
        user,
        token,
        googleIdToken:
          typeof req.body.googleIdToken === 'string' ? req.body.googleIdToken : undefined,
        googleAccessToken:
          typeof req.body.googleAccessToken === 'string' ? req.body.googleAccessToken : undefined,
      });

      res.json({ ok: true, email: user.email });
    } catch (error) {
      const status = (error as { status?: number }).status || 500;
      res.status(status).json({ error: (error as Error).message });
    }
  });

  app.get('/api/auth/desktop-google/status', (req, res) => {
    pruneDesktopGoogleAuth();
    const nonce = typeof req.query.nonce === 'string' ? req.query.nonce.trim() : '';
    if (!nonce) {
      res.status(400).json({ status: 'expired', error: 'Missing sign-in nonce.' });
      return;
    }

    const entry = pendingDesktopGoogleAuth.get(nonce);
    if (!entry) {
      res.json({ status: 'expired' });
      return;
    }

    if (entry.status !== 'complete' || !entry.user || !entry.token) {
      res.json({ status: 'pending' });
      return;
    }

    pendingDesktopGoogleAuth.delete(nonce);
    setSessionCookie(req, res, entry.token);
    res.json({
      status: 'complete',
      user: entry.user,
      token: entry.token,
      googleIdToken: entry.googleIdToken,
      googleAccessToken: entry.googleAccessToken,
    });
  });

  app.post('/api/auth/firebase', async (req, res) => {
    try {
      const idToken = typeof req.body.idToken === 'string' ? req.body.idToken.trim() : '';
      if (!idToken) {
        res.status(400).json({ error: 'Firebase ID token is required.' });
        return;
      }

      const fbAccount = await verifyFirebaseIdToken(idToken);

      const gender =
        req.body.gender === 'male' || req.body.gender === 'female'
          ? (req.body.gender as GenderOption)
          : undefined;

      const { user, token } = loginFirebaseUser({
        email: fbAccount.email,
        name: fbAccount.name,
        gender,
      });

      setSessionCookie(req, res, token);
      res.json({ user, token });
    } catch (error) {
      const status = (error as { status?: number }).status || 500;
      res.status(status).json({ error: (error as Error).message });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = extractAuthToken(req);
    logoutSession(token);
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  app.post('/api/auth/change-password', (req, res) => {
    const token = extractAuthToken(req);
    const user = getSessionUser(token);
    if (!user) {
      res.status(401).json({ error: 'Authentication required. Please sign in.' });
      return;
    }
    try {
      const currentPassword = String(req.body.currentPassword || '');
      const newPassword = String(req.body.newPassword || '');
      changeUserPassword(user.id, currentPassword, newPassword);
      res.json({ ok: true });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.delete('/api/auth/account', (req, res) => {
    const token = extractAuthToken(req);
    const user = getSessionUser(token);
    if (!user) {
      res.status(401).json({ error: 'Authentication required. Please sign in.' });
      return;
    }
    try {
      deleteUserAccount(user.id);
      clearSessionCookie(req, res);
      res.json({ deleted: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Protect all application API routes behind active session
  app.use('/api', (req, res, next) => {
    if (req.path === '/health' || req.path.startsWith('/auth/')) {
      next();
      return;
    }
    const user = getSessionUser(extractAuthToken(req));
    if (!user) {
      res.status(401).json({ error: 'Authentication required. Please sign in.' });
      return;
    }
    next();
  });

  // 1. Dashboard
  app.get('/api/dashboard', (_req, res) => {
    try {
      const data = getDashboardData();
      const wardrobe = listClothingItems();
      const profile = getProfile();
      const dailyList =
        wardrobe.length > 0
          ? generateLocalFallbackOutfits({
              wardrobe,
              occasion: 'Casual',
              profile,
              count: 1,
            })
          : [];
      res.json({
        ...data,
        dailySuggestion: dailyList[0] ?? null,
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // 2. My Wardrobe
  app.get('/api/wardrobe', (req, res) => {
    try {
      const items = listClothingItems({
        category: req.query.category as string | undefined,
        target_gender: req.query.target_gender as string | undefined,
        search: req.query.search as string | undefined,
        season: req.query.season as string | undefined,
        color: req.query.color as string | undefined,
        sort: req.query.sort as string | undefined,
      });
      res.json({ items });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/wardrobe/starter', (_req, res) => {
    try {
      const result = loadStarterWardrobe();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/wardrobe', upload.array('images', 12), (req, res) => {
    try {
      const files = (req.files as Express.Multer.File[]) || [];
      const existingImagePath =
        typeof req.body.image_path === 'string' ? req.body.image_path.trim() : '';

      if (files.length === 0 && !existingImagePath) {
        res.status(400).json({ error: 'Please upload at least one clothing image (JPG, PNG, or WEBP).' });
        return;
      }

      const createdItems = [];
      if (files.length > 0) {
        for (const file of files) {
          const baseName = path
            .basename(file.originalname, path.extname(file.originalname))
            .replace(/[-_]+/g, ' ')
            .trim();
          const name =
            files.length === 1 && req.body.name?.trim()
              ? req.body.name.trim()
              : baseName || 'Wardrobe Garment';

          createdItems.push(
            createClothingItem({
              name,
              category: validateCategory(req.body.category),
              target_gender: validateGarmentGender(req.body.target_gender),
              color: req.body.color || 'Neutral',
              secondary_color: req.body.secondary_color || '',
              pattern: req.body.pattern || 'Solid',
              style: req.body.style || 'Casual',
              season: validateSeason(req.body.season),
              notes: req.body.notes || '',
              image_path: `/uploads/${file.filename}`,
            })
          );
        }
      } else {
        if (!req.body.name?.trim()) {
          res.status(400).json({ error: 'Garment name is required.' });
          return;
        }
        createdItems.push(
          createClothingItem({
            name: req.body.name.trim(),
            category: validateCategory(req.body.category),
            target_gender: validateGarmentGender(req.body.target_gender),
            color: req.body.color || 'Neutral',
            secondary_color: req.body.secondary_color || '',
            pattern: req.body.pattern || 'Solid',
            style: req.body.style || 'Casual',
            season: validateSeason(req.body.season),
            notes: req.body.notes || '',
            image_path: existingImagePath,
          })
        );
      }

      res.status(201).json({ items: createdItems });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.patch('/api/wardrobe/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        res.status(400).json({ error: 'Invalid clothing item ID.' });
        return;
      }
      const updated = updateClothingItem(id, req.body);
      if (!updated) {
        res.status(404).json({ error: 'Clothing item not found.' });
        return;
      }
      res.json({ item: updated });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.delete('/api/wardrobe/all', (_req, res) => {
    try {
      const deletedIds = clearAllWardrobeImages();
      res.json({ deletedCount: deletedIds.length, deletedIds });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.delete('/api/wardrobe/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        res.status(400).json({ error: 'Invalid clothing item ID.' });
        return;
      }
      const removed = deleteClothingItem(id);
      if (!removed) {
        res.status(404).json({ error: 'Clothing item not found.' });
        return;
      }
      res.json({ deleted: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // 3. AI Studio (Recognition + Outfit Recommendation + Fashion Chat)
  app.post('/api/ai/recognize', upload.single('image'), async (req, res) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'Please select an image file (JPG, PNG, or WEBP) to analyze.' });
      return;
    }

    const previewImagePath = `/uploads/${file.filename}`;
    const settings = getSettings();

    try {
      const buffer = fs.readFileSync(file.path);
      const { result, modelUsed } = await recognizeClothingWithGemma({
        imageBuffer: buffer,
        mimeType: file.mimetype || 'image/jpeg',
        modelId: settings.gemma_model,
      });

      res.json({
        ok: true,
        modelUsed,
        previewImagePath,
        recognition: result,
      });
    } catch (error) {
      res.json({
        ok: false,
        modelAttempted: settings.gemma_model,
        previewImagePath,
        manualFallback: true,
        error: (error as Error).message,
      });
    }
  });

  app.post('/api/ai/recommend', async (req, res) => {
    try {
      const occasion = String(req.body.occasion || 'Casual').trim() || 'Casual';
      const customPrompt = typeof req.body.customPrompt === 'string' ? req.body.customPrompt.trim() : '';
      const includeWeather = Boolean(req.body.includeWeather);

      const wardrobe = listClothingItems();
      if (wardrobe.length < 2) {
        res.status(400).json({
          error: 'Add at least 2 clothing items to your wardrobe before generating outfit recommendations.',
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
            unit: settings.temperature_unit,
          });
        } catch {
          weather = null;
        }
      }

      const weatherContext = weather
        ? `${weather.city}: ${weather.current.temperature}°${weather.current.unit}, ${weather.current.condition}`
        : '';

      try {
        const { outfits, modelUsed } = await recommendOutfitsWithGemma({
          wardrobe,
          occasion,
          customPrompt,
          profile,
          weather,
          modelId: settings.gemma_model,
        });
        const historyEntry = recordGenerationHistory({
          occasion,
          custom_prompt: customPrompt,
          source: 'gemma',
          model_used: modelUsed,
          weather_context: weatherContext,
          outfits,
        });
        res.json({
          source: 'gemma',
          modelUsed,
          outfits,
          weather,
          historyEntry,
        });
      } catch (gemmaError) {
        const fallbackOutfits = generateLocalFallbackOutfits({
          wardrobe,
          occasion,
          customPrompt,
          profile,
          weather,
          count: 3,
        });
        const historyEntry = recordGenerationHistory({
          occasion,
          custom_prompt: customPrompt,
          source: 'local-fallback',
          model_used: 'Local Style Engine',
          weather_context: weatherContext,
          outfits: fallbackOutfits,
        });
        res.json({
          source: 'local-fallback',
          modelAttempted: settings.gemma_model,
          fallbackReason: (gemmaError as Error).message,
          outfits: fallbackOutfits,
          weather,
          historyEntry,
        });
      }
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get('/api/ai/history', (_req, res) => {
    try {
      res.json({ history: listGenerationHistory(30) });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.delete('/api/ai/history/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        res.status(400).json({ error: 'Invalid history ID.' });
        return;
      }
      const deleted = deleteGenerationHistoryEntry(id);
      if (!deleted) {
        res.status(404).json({ error: 'History entry not found.' });
        return;
      }
      res.json({ deleted: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.delete('/api/ai/history', (_req, res) => {
    try {
      clearGenerationHistory();
      res.json({ cleared: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/ai/chat', async (req, res) => {
    try {
      const message = String(req.body.message || '').trim();
      const history = Array.isArray(req.body.history) ? req.body.history : [];
      if (!message) {
        res.status(400).json({ error: 'Please enter a message.' });
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
            unit: settings.temperature_unit,
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
        modelId: settings.gemma_model,
      });

      const referencedItems = referencedItemIds
        .map((id) => getClothingItemById(id))
        .filter((item) => item !== null);

      res.json({
        reply,
        referencedItems,
        modelUsed,
      });
    } catch (error) {
      res.status(502).json({
        error: (error as Error).message,
      });
    }
  });

  // Outfits CRUD & Wear
  app.get('/api/outfits', (_req, res) => {
    try {
      res.json({ outfits: listOutfits() });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/outfits', (req, res) => {
    try {
      const itemIds = Array.isArray(req.body.item_ids)
        ? req.body.item_ids.map((id: unknown) => Number(id)).filter((n: number) => Number.isInteger(n))
        : [];
      if (itemIds.length === 0) {
        res.status(400).json({ error: 'Outfit must contain at least one existing clothing item.' });
        return;
      }
      const outfit = createOutfit({
        name: String(req.body.name || 'Saved Look'),
        occasion: String(req.body.occasion || 'Casual'),
        reasoning: String(req.body.reasoning || ''),
        source:
          req.body.source === 'local-fallback' || req.body.source === 'manual'
            ? req.body.source
            : 'gemma',
        weather_context: String(req.body.weather_context || ''),
        item_ids: itemIds,
      });
      res.status(201).json({ outfit });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.delete('/api/outfits/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        res.status(400).json({ error: 'Invalid outfit ID.' });
        return;
      }
      const ok = deleteOutfit(id);
      if (!ok) {
        res.status(404).json({ error: 'Outfit not found.' });
        return;
      }
      res.json({ deleted: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/outfits/:id/wear', (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        res.status(400).json({ error: 'Invalid outfit ID.' });
        return;
      }
      const entries = logWear({
        outfit_id: id,
        worn_date: req.body.worn_date,
        occasion: req.body.occasion,
        notes: req.body.notes,
      });
      res.status(201).json({ entries });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // 4. Weather Assistant
  app.get('/api/weather/search', async (req, res) => {
    try {
      const q = String(req.query.q || '').trim();
      if (!q) {
        res.json({ results: [] });
        return;
      }
      const results = await searchCities(q);
      res.json({ results });
    } catch (error) {
      res.status(502).json({ error: (error as Error).message });
    }
  });

  app.get('/api/weather/forecast', async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      const settings = getSettings();
      const city = String(req.query.city || settings.preferred_city || 'New York').trim();
      const lat = req.query.lat !== undefined ? Number(req.query.lat) : settings.preferred_lat;
      const lon = req.query.lon !== undefined ? Number(req.query.lon) : settings.preferred_lon;
      const unit = req.query.unit === 'F' || req.query.unit === 'C' ? req.query.unit : settings.temperature_unit;

      const report = await fetchLiveWeather({
        city,
        latitude: req.query.city && req.query.lat === undefined ? null : lat,
        longitude: req.query.city && req.query.lon === undefined ? null : lon,
        unit,
        bypassCache: true,
      });
      res.json({ weather: report });
    } catch (error) {
      res.status(502).json({ error: (error as Error).message });
    }
  });

  app.post('/api/weather/suggest', async (req, res) => {
    try {
      const settings = getSettings();
      const profile = getProfile();
      const wardrobe = listClothingItems();
      if (wardrobe.length < 2) {
        res.status(400).json({
          error: 'Add at least 2 clothing items to your wardrobe to receive weather-matched outfits.',
        });
        return;
      }

      const city = String(req.body.city || settings.preferred_city || 'New York');
      const lat = req.body.lat !== undefined ? Number(req.body.lat) : settings.preferred_lat;
      const lon = req.body.lon !== undefined ? Number(req.body.lon) : settings.preferred_lon;

      const weather = await fetchLiveWeather({
        city,
        latitude: lat,
        longitude: lon,
        unit: settings.temperature_unit,
      });

      const occasion = String(req.body.occasion || 'Daily Weather-Ready');

      const weatherContext = `${weather.city}: ${weather.current.temperature}°${weather.current.unit}, ${weather.current.condition}`;

      try {
        const { outfits, modelUsed } = await recommendOutfitsWithGemma({
          wardrobe,
          occasion,
          customPrompt: `Prioritize comfort and layering for the live weather in ${weather.city}: ${weather.current.temperature}°${weather.current.unit}, ${weather.current.condition}, humidity ${weather.current.humidity}%.`,
          profile,
          weather,
          modelId: settings.gemma_model,
        });
        const historyEntry = recordGenerationHistory({
          occasion,
          custom_prompt: `Weather-matched (${weather.city})`,
          source: 'gemma',
          model_used: modelUsed,
          weather_context: weatherContext,
          outfits,
        });
        res.json({
          source: 'gemma',
          modelUsed,
          weather,
          outfits,
          historyEntry,
        });
      } catch (gemmaError) {
        const fallbackOutfits = generateLocalFallbackOutfits({
          wardrobe,
          occasion,
          profile,
          weather,
          count: 3,
        });
        const historyEntry = recordGenerationHistory({
          occasion,
          custom_prompt: `Weather-matched (${weather.city})`,
          source: 'local-fallback',
          model_used: 'Local Style Engine',
          weather_context: weatherContext,
          outfits: fallbackOutfits,
        });
        res.json({
          source: 'local-fallback',
          modelAttempted: settings.gemma_model,
          fallbackReason: (gemmaError as Error).message,
          weather,
          outfits: fallbackOutfits,
          historyEntry,
        });
      }
    } catch (error) {
      res.status(502).json({ error: (error as Error).message });
    }
  });

  // 5. Favourites
  app.get('/api/favourites', (_req, res) => {
    try {
      res.json(listFavourites());
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/favourites/toggle', (req, res) => {
    try {
      const itemType = req.body.itemType === 'outfit' ? 'outfit' : 'clothing';
      const targetId = Number(req.body.targetId);
      if (!Number.isInteger(targetId)) {
        res.status(400).json({ error: 'Invalid targetId for favourite toggle.' });
        return;
      }
      const result = toggleFavourite(itemType, targetId);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // 6. Wear History & Calendar
  app.get('/api/wear-history', (_req, res) => {
    try {
      const history = listWearHistory(150);
      const mostWorn = listClothingItems({ sort: 'most_worn' }).slice(0, 6);
      const leastWorn = listClothingItems({ sort: 'least_worn' }).slice(0, 6);
      res.json({ history, mostWorn, leastWorn });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/wear-history', (req, res) => {
    try {
      const outfitId = req.body.outfit_id ? Number(req.body.outfit_id) : null;
      const clothingItemIds = Array.isArray(req.body.clothing_item_ids)
        ? req.body.clothing_item_ids
            .map((id: unknown) => Number(id))
            .filter((n: number) => Number.isInteger(n))
        : [];

      if (!outfitId && clothingItemIds.length === 0) {
        res.status(400).json({ error: 'Select an outfit or at least one clothing item to mark as worn.' });
        return;
      }

      const entries = logWear({
        worn_date: req.body.worn_date,
        outfit_id: outfitId,
        clothing_item_ids: clothingItemIds,
        occasion: req.body.occasion,
        notes: req.body.notes,
      });
      res.status(201).json({ entries });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.delete('/api/wear-history/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        res.status(400).json({ error: 'Invalid wear history ID.' });
        return;
      }
      const ok = deleteWearHistory(id);
      if (!ok) {
        res.status(404).json({ error: 'Wear history entry not found.' });
        return;
      }
      res.json({ deleted: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get('/api/calendar', (req, res) => {
    try {
      const month = typeof req.query.month === 'string' ? req.query.month : undefined;
      res.json({ entries: listCalendarEntries(month) });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/calendar', (req, res) => {
    try {
      const plannedDate = String(req.body.planned_date || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(plannedDate)) {
        res.status(400).json({ error: 'A valid YYYY-MM-DD planned_date is required.' });
        return;
      }
      const entry = createCalendarEntry({
        planned_date: plannedDate,
        outfit_id: req.body.outfit_id ? Number(req.body.outfit_id) : null,
        title: String(req.body.title || 'Planned Outfit'),
        occasion: String(req.body.occasion || 'Casual'),
        notes: String(req.body.notes || ''),
        item_ids: Array.isArray(req.body.item_ids)
          ? req.body.item_ids.map((n: unknown) => Number(n)).filter((n: number) => Number.isInteger(n))
          : [],
      });
      res.status(201).json({ entry });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.patch('/api/calendar/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        res.status(400).json({ error: 'Invalid calendar entry ID.' });
        return;
      }
      const updated = updateCalendarEntry(id, req.body);
      if (!updated) {
        res.status(404).json({ error: 'Calendar entry not found.' });
        return;
      }
      res.json({ entry: updated });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.delete('/api/calendar/:id', (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        res.status(400).json({ error: 'Invalid calendar entry ID.' });
        return;
      }
      const ok = deleteCalendarEntry(id);
      if (!ok) {
        res.status(404).json({ error: 'Calendar entry not found.' });
        return;
      }
      res.json({ deleted: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // 7. Settings & Profile
  app.get('/api/settings', (req, res) => {
    try {
      const user = getSessionUser(extractAuthToken(req));
      res.json({
        profile: getProfile(user),
        settings: getSettings(),
        storage: getStorageInfo(),
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.put('/api/settings', (req, res) => {
    try {
      const user = getSessionUser(extractAuthToken(req));
      if (req.body.settings?.gemma_model) {
        const m = String(req.body.settings.gemma_model).trim();
        if (!m.toLowerCase().startsWith('gemma')) {
          res.status(400).json({
            error: 'Model ID must belong to the Google Gemma family (e.g. gemma-4-26b-a4b-it).',
          });
          return;
        }
      }

      const updated = updateProfileAndSettings(
        {
          profile: req.body.profile,
          settings: req.body.settings,
        },
        user
      );

      res.json({
        ...updated,
        storage: getStorageInfo(),
      });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Multer & API error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(400).json({ error: err.message || 'Request failed.' });
  });

  const httpServer = http.createServer(app);

  // Vite dev middleware or production static assets
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        ws: { server: httpServer },
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const appDir = process.env.STYLESYNC_APP_DIR
      ? path.resolve(process.env.STYLESYNC_APP_DIR)
      : process.cwd();
    const distDir = path.join(appDir, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const host = process.env.STYLESYNC_HOST;
  const onListening = () => {
    console.log(`StyleSync server running on http://localhost:${PORT}`);
  };
  if (host === 'dual') {
    httpServer.listen(PORT, onListening);
  } else {
    httpServer.listen(PORT, host || '0.0.0.0', onListening);
  }
}

startServer();
