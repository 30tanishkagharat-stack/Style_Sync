import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  ClothingCategory,
  ClothingItem,
  OutfitSuggestionDraft,
  RecognitionResult,
  SeasonTag,
  UserProfile,
  WeatherReport,
} from '../src/types.ts';
import { generateLocalFallbackOutfits } from './localMatcher.ts';

const ALLOWED_CATEGORIES: ClothingCategory[] = [
  'tops',
  'bottoms',
  'dresses',
  'outerwear',
  'shoes',
  'accessories',
];

const ALLOWED_SEASONS: SeasonTag[] = [
  'All-Season',
  'Spring',
  'Summer',
  'Autumn',
  'Winter',
];

export const DEFAULT_GEMMA_MODEL = 'gemini-4-hydrogen';
const FALLBACK_FAST_MODEL = 'gemini-3.1-flash-lite';

let cachedClient: GoogleGenAI | null = null;
let cachedApiKey: string | undefined;

function resolveModelId(modelId?: string): string {
  const cleaned = (modelId || '').trim();
  if (!cleaned || cleaned.toLowerCase().startsWith('gemma')) {
    return DEFAULT_GEMMA_MODEL;
  }
  return cleaned;
}

function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured on the server. Set it in your environment to enable AI styling.'
    );
  }
  if (!cachedClient || cachedApiKey !== apiKey) {
    cachedApiKey = apiKey;
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        timeout: 15000,
        retryOptions: {
          attempts: 2,
        },
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedClient;
}

function extractJsonFromText<T>(rawText: string): T {
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as T;
    }
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      return JSON.parse(cleaned.slice(firstBracket, lastBracket + 1)) as T;
    }
    throw new Error('AI returned a response that could not be parsed as JSON.');
  }
}

function toTitleCase(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeCategory(raw: string | undefined, garmentName?: string): ClothingCategory {
  const primary = (raw || '').toLowerCase().trim();
  const titleOnly = (garmentName || '').toLowerCase().trim();
  const combined = `${primary} ${titleOnly}`.trim();
  const isDressModifier =
    /\bdress[- ]?(shirt|shirts|blouse|top|tops|pant|pants|trouser|trousers|slacks|skirt|shoe|shoes|boot|boots|loafer|loafers|heel|heels|belt|sock|socks|watch)\b/.test(
      titleOnly
    );

  // 1. Dresses / one-pieces first (excluding "dress shirt", "dress pants", "dress shoes", skirts)
  if (
    !isDressModifier &&
    !/\bskirt\b/.test(titleOnly) &&
    (/\b(dress|sundress|gown|jumpsuit|romper|playsuit|kaftan|caftan|saree|sari|anarkali|slip dress|shirt dress|sweater dress|maxi dress|midi dress|mini dress)\b/.test(
      titleOnly
    ) ||
      (!primary &&
        /\b(dress|sundress|gown|jumpsuit|romper|playsuit|kaftan|caftan|saree|sari|anarkali)\b/.test(
          combined
        )))
  ) {
    return 'dresses';
  }

  // 2. Footwear (exclude "oxford shirt/cloth" and "flat knit/lay")
  if (
    !/\boxford\s+(shirt|cloth|cotton|button)\b/.test(titleOnly) &&
    !/\bflat\s+(lay|knit|front)\b/.test(titleOnly) &&
    /\b(shoe|shoes|footwear|sneaker|sneakers|trainer|trainers|loafer|loafers|boot|boots|ankle boot|chelsea|heel|heels|pump|pumps|stiletto|wedge|wedges|sandal|sandals|flat|flats|ballet|mule|mules|clog|clogs|oxford|oxfords|derby|brogue|brogues|moccasin|espadrille|slipper|slippers|slide|slides|flip-flop)\b/.test(
      titleOnly || primary
    )
  ) {
    return 'shoes';
  }

  // 3. Accessories (exclude "tie-front blouse", "ring-spun cotton")
  if (
    !/\btie[- ]?(front|neck|waist|back|strap)\b/.test(titleOnly) &&
    !/\bring[- ]spun\b/.test(titleOnly) &&
    /\b(accessor|bag|bags|tote|handbag|purse|clutch|crossbody|satchel|backpack|duffel|wallet|belt|belts|scarf|scarves|shawl|stole|hat|cap|beanie|beret|fedora|sunglass|sunglasses|glasses|eyewear|watch|watches|jewel|jewelry|jewellery|necklace|earring|earrings|bracelet|ring|brooch|tie|necktie|bowtie|gloves|socks)\b/.test(
      titleOnly || primary
    )
  ) {
    return 'accessories';
  }

  // 4. Outerwear (including overshirts, shackets, cardigans, hoodies)
  if (
    /\b(outerwear|coat|overcoat|trench|jacket|blazer|parka|puffer|anorak|windbreaker|bomber|peacoat|raincoat|cardigan|hoodie|sweatshirt|pullover fleece|overshirt|shacket|gilet|vest|shrug|cape|poncho)\b/.test(
      titleOnly || primary
    )
  ) {
    return 'outerwear';
  }

  // 5. Bottoms (match plural "shorts" / "cargo pants", never "short-sleeve" or bare "denim")
  if (
    /\b(bottom|bottoms|pant|pants|trouser|trousers|slacks|chino|chinos|jean|jeans|skirt|skort|shorts|boardshorts|bermuda shorts|legging|leggings|jogger|joggers|sweatpant|sweatpants|track pant|track pants|cargo pant|cargo pants|culotte|culottes|palazzo|capri)\b/.test(
      titleOnly || primary
    )
  ) {
    return 'bottoms';
  }

  if (ALLOWED_CATEGORIES.includes(primary as ClothingCategory)) {
    return primary as ClothingCategory;
  }

  // 6. Tops
  if (
    /\b(top|tops|shirt|t-shirt|tee|blouse|sweater|jumper|knit|knitwear|pullover|turtleneck|polo|tank|camisole|cami|bodysuit|crop|tunic|kurta|kurti|henley|jersey|peplum|ruffle)\b/.test(
      combined
    )
  ) {
    return 'tops';
  }

  return 'tops';
}

function normalizeSeason(raw: string | undefined, garmentName?: string): SeasonTag {
  const val = (raw || '').toLowerCase().trim();
  if (ALLOWED_SEASONS.includes(raw?.trim() as SeasonTag)) {
    return raw!.trim() as SeasonTag;
  }
  if (val.includes('winter') || val.includes('cold') || val.includes('snow') || val.includes('heavy')) {
    return 'Winter';
  }
  if (val.includes('autumn') || val.includes('fall')) return 'Autumn';
  if (val.includes('summer') || val.includes('warm') || val.includes('hot') || val.includes('beach') || val.includes('resort')) {
    return 'Summer';
  }
  if (val.includes('spring') || val.includes('mild') || val.includes('breezy')) return 'Spring';
  if (val.includes('all')) return 'All-Season';

  const hint = (garmentName || '').toLowerCase();
  if (/\b(puffer|parka|wool coat|overcoat|cashmere|turtleneck|fleece|thermal|winter|beanie|scarf)\b/.test(hint)) {
    return 'Winter';
  }
  if (/\b(trench|flannel|corduroy|ankle boot|suede|autumn|fall|cardigan|blazer)\b/.test(hint)) {
    return 'Autumn';
  }
  if (/\b(linen|tank|camisole|shorts|sundress|sandal|sleeveless|summer|flip-flop)\b/.test(hint)) {
    return 'Summer';
  }
  if (/\b(floral|pastel|chino|loafer|spring)\b/.test(hint)) {
    return 'Spring';
  }
  return 'All-Season';
}

function normalizeColor(raw: string | undefined): string {
  const cleaned = (raw || '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\b(background|studio|backdrop)\b/gi, '')
    .split(/[\/,&]/)[0]
    .trim();
  if (!cleaned) return 'Neutral';
  const words = cleaned.split(/\s+/).slice(0, 2).join(' ');
  return toTitleCase(words);
}

function normalizePattern(raw: string | undefined): string {
  const val = (raw || '').trim();
  if (!val) return 'Solid';
  const lower = val.toLowerCase();
  if (lower === 'plain' || lower === 'none' || lower === 'unpatterned' || lower === 'n/a') {
    return 'Solid';
  }
  return toTitleCase(val);
}

function normalizeStyle(raw: string | undefined): string {
  const val = (raw || '').split(/[\/,]/)[0].trim();
  if (!val) return 'Casual';
  return toTitleCase(val);
}

function isTransientAiError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /500|502|503|504|429|UNAVAILABLE|INTERNAL|RESOURCE_EXHAUSTED|timeout|fetch failed|ECONNRESET/i.test(
    msg
  );
}

function buildFastConfig(modelId: string, extras: Record<string, unknown>) {
  if (modelId === 'gemini-4-hydrogen') {
    return {
      ...extras,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    };
  }
  return extras;
}

const RECOGNITION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    name: {
      type: Type.STRING,
      description:
        'Specific 2-4 word garment title with color, fabric/cut detail, and item type (e.g. Ivory Silk Button-Down Shirt)',
    },
    category: {
      type: Type.STRING,
      description: 'Exactly one of: tops, bottoms, dresses, outerwear, shoes, accessories',
    },
    target_gender: {
      type: Type.STRING,
      description: 'Exactly one of: unisex, female, male',
    },
    color: {
      type: Type.STRING,
      description:
        'Dominant garment color ONLY in 1-2 Title Case words (ignore background, floor, wall, hanger, mannequin, or skin)',
    },
    secondary_color: {
      type: Type.STRING,
      description: 'Secondary trim, stripe, or print color on the garment, or empty string if none',
    },
    pattern: {
      type: Type.STRING,
      description:
        'Surface pattern or knit texture, e.g. Solid, Striped, Pinstripe, Plaid, Gingham, Floral, Polka Dot, Geometric, Graphic Print, Colorblock, Ribbed, Cable Knit, Quilted, Lace, Embroidered, Herringbone, Houndstooth, Textured',
    },
    style: {
      type: Type.STRING,
      description:
        'Primary fashion aesthetic, e.g. Minimalist, Tailored, Formal, Business Casual, Smart Casual, Casual, Streetwear, Athleisure, Bohemian, Vintage, Evening, Resort',
    },
    season: {
      type: Type.STRING,
      description: 'Exactly one of: All-Season, Spring, Summer, Autumn, Winter',
    },
    notes: {
      type: Type.STRING,
      description: '1 concise sentence describing visible fabric, silhouette, and key construction detail',
    },
  },
  required: ['name', 'category', 'target_gender', 'color', 'secondary_color', 'pattern', 'style', 'season', 'notes'],
};

const OUTFIT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    outfits: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: 'Short editorial outfit title (3-5 words)' },
          reasoning: {
            type: Type.STRING,
            description: '2 concise sentences explaining color, silhouette, occasion, and weather harmony',
          },
          stylingTip: {
            type: Type.STRING,
            description: '1 practical styling tip for wearing this exact combination',
          },
          itemIds: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER },
            description: 'Valid integer clothing item IDs from the provided wardrobe list',
          },
        },
        required: ['name', 'reasoning', 'stylingTip', 'itemIds'],
      },
    },
  },
  required: ['outfits'],
};

const CHAT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    reply: {
      type: Type.STRING,
      description: 'Clear, helpful styling advice referencing exact garment names from the wardrobe',
    },
    referencedItemIds: {
      type: Type.ARRAY,
      items: { type: Type.INTEGER },
      description: 'Integer IDs of wardrobe items explicitly mentioned in the reply',
    },
  },
  required: ['reply', 'referencedItemIds'],
};

export async function recognizeClothingWithGemma(params: {
  imageBuffer: Buffer;
  mimeType: string;
  modelId: string;
  originalName?: string;
}): Promise<{ result: RecognitionResult; modelUsed: string }> {
  const primaryModel = resolveModelId(params.modelId);
  const ai = getGenAIClient();

  const systemInstruction =
    'You are an expert fashion merchandiser and garment archivist. Inspect ONLY the foreground garment or accessory in the photo. Completely ignore studio walls, floors, hangers, mannequins, and skin tones when judging garment color. Distinguish outerwear (blazers, jackets, coats, cardigans, hoodies, overshirts), one-pieces (dresses, jumpsuits), tops (shirts, tees, blouses, sweaters, polos), bottoms (trousers, jeans, chinos, skirts, shorts), shoes, and accessories accurately. Inspect surface texture closely for stripes, checks, florals, graphics, ribbing, or quilting before labeling Solid.';

  const prompt =
    'Identify this garment accurately and populate all JSON schema fields. Use specific fashion colors (e.g. Ivory, Cream, Camel, Rust, Terracotta, Navy, Olive, Charcoal, Denim Blue, Forest Green, Burgundy, Emerald, Sky Blue).';

  const candidateModels = Array.from(new Set([primaryModel, FALLBACK_FAST_MODEL]));

  let lastError: unknown = null;
  let text: string | undefined;
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
                data: params.imageBuffer.toString('base64'),
              },
            },
            { text: prompt },
          ],
        },
        config: buildFastConfig(candidateModel, {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: RECOGNITION_SCHEMA,
        }),
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
    throw lastError instanceof Error
      ? lastError
      : new Error(`Model ${primaryModel} returned an empty response.`);
  }

  const parsed = extractJsonFromText<Partial<RecognitionResult>>(text);
  const rawTarget = (parsed.target_gender || 'unisex').toLowerCase().trim();
  const target_gender =
    rawTarget === 'female' || rawTarget === 'male' ? rawTarget : 'unisex';

  const resolvedName = toTitleCase((parsed.name || 'Recognized Garment').trim());

  return {
    modelUsed: usedModel,
    result: {
      name: resolvedName,
      category: normalizeCategory(parsed.category, resolvedName),
      target_gender,
      color: normalizeColor(parsed.color),
      secondary_color: parsed.secondary_color ? normalizeColor(parsed.secondary_color) : '',
      pattern: normalizePattern(parsed.pattern),
      style: normalizeStyle(parsed.style),
      season: normalizeSeason(parsed.season, resolvedName),
      notes: (parsed.notes || '').trim(),
    },
  };
}

function sanitizeOutfitItems(items: ClothingItem[]): ClothingItem[] {
  const hasDress = items.some((i) => i.category === 'dresses');
  const seenCategories = new Set<string>();
  const cleaned: ClothingItem[] = [];

  for (const item of items) {
    // Avoid combining a dress/jumpsuit with separate bottoms or duplicate footwear/bottoms
    if (hasDress && (item.category === 'bottoms' || item.category === 'tops')) {
      continue;
    }
    if (
      (item.category === 'bottoms' || item.category === 'dresses' || item.category === 'shoes') &&
      seenCategories.has(item.category)
    ) {
      continue;
    }
    seenCategories.add(item.category);
    cleaned.push(item);
  }

  return cleaned.length > 0 ? cleaned : items;
}

export async function recommendOutfitsWithGemma(params: {
  wardrobe: ClothingItem[];
  occasion: string;
  customPrompt?: string;
  profile: UserProfile;
  weather?: WeatherReport | null;
  modelId: string;
}): Promise<{ outfits: OutfitSuggestionDraft[]; modelUsed: string }> {
  const model = resolveModelId(params.modelId);
  const ai = getGenAIClient();

  const itemMap = new Map<number, ClothingItem>(params.wardrobe.map((item) => [item.id, item]));
  const compactWardrobe = params.wardrobe.map((item) => ({
    id: item.id,
    name: item.name,
    cat: item.category,
    color: item.color,
    ...(item.secondary_color ? { accColor: item.secondary_color } : {}),
    pattern: item.pattern,
    style: item.style,
    season: item.season,
    wears: item.wear_count,
  }));

  const weatherBlock = params.weather
    ? `WEATHER (${params.weather.city}): ${params.weather.current.temperature}°${params.weather.current.unit} (feels ${params.weather.current.apparentTemperature}°), ${params.weather.current.condition}, humidity ${params.weather.current.humidity}%, wind ${params.weather.current.windSpeed}.`
    : 'WEATHER: none specified.';

  const systemInstruction =
    'You are StyleSync, an editorial personal stylist. Build 3 genuinely distinct, cohesive outfits using ONLY valid integer IDs from the provided wardrobe JSON. Never invent IDs. Pair compatible categories (top + bottom, OR dress/one-piece, plus matching shoes and weather-appropriate outerwear/accessories when owned). Never pair two different shoes or dress + trousers unless explicitly requested. Respect occasion, preferred/avoided colors, custom requests, live weather, and rotate under-worn items.';

  const prompt = `OCCASION: ${params.occasion}
${params.customPrompt ? `REQUEST: ${params.customPrompt}` : ''}
PREFERENCES: styles=${params.profile.style_preferences}; preferred=${params.profile.preferred_colors}; avoid=${params.profile.avoid_colors}; fit=${params.profile.fit_preference}
${weatherBlock}
WARDROBE: ${JSON.stringify(compactWardrobe)}`;

  const candidateModels = Array.from(new Set([model, FALLBACK_FAST_MODEL]));
  let text: string | undefined;
  let usedModel = model;
  let lastError: unknown = null;

  for (const candidateModel of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model: candidateModel,
        contents: prompt,
        config: buildFastConfig(candidateModel, {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: OUTFIT_SCHEMA,
        }),
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
    throw lastError instanceof Error
      ? lastError
      : new Error(`Model ${model} returned an empty response.`);
  }

  const parsed = extractJsonFromText<{
    outfits?: Array<{
      name?: string;
      reasoning?: string;
      stylingTip?: string;
      itemIds?: unknown[];
    }>;
  }>(text);

  const weatherContext = params.weather
    ? `${params.weather.city}: ${params.weather.current.temperature}°${params.weather.current.unit}, ${params.weather.current.condition}`
    : '';

  const validated: OutfitSuggestionDraft[] = [];
  const seenSignatures = new Set<string>();

  for (const [idx, rawOutfit] of (parsed.outfits || []).entries()) {
    const rawIds = Array.isArray(rawOutfit.itemIds) ? rawOutfit.itemIds : [];
    const validIds = Array.from(
      new Set(
        rawIds
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && itemMap.has(id))
      )
    );
    const rawItems = validIds
      .map((id) => itemMap.get(id))
      .filter((i): i is ClothingItem => Boolean(i));

    if (rawItems.length === 0) continue;

    const items = sanitizeOutfitItems(rawItems);
    const sig = items
      .map((i) => i.id)
      .sort((a, b) => a - b)
      .join('-');
    if (seenSignatures.has(sig)) continue;
    seenSignatures.add(sig);

    validated.push({
      tempId: `gemma-${Date.now()}-${idx}`,
      name: (rawOutfit.name || `${params.occasion} Look ${idx + 1}`).trim(),
      occasion: params.occasion,
      reasoning: (rawOutfit.reasoning || 'Balanced color and silhouette pairing from your wardrobe.').trim(),
      stylingTip: (rawOutfit.stylingTip || 'Finish with clean proportions and thoughtful accessories.').trim(),
      source: 'gemma',
      weatherContext,
      items,
    });
  }

  if (validated.length === 0) {
    throw new Error(
      `Model ${usedModel} did not return any outfits containing valid wardrobe item IDs.`
    );
  }

  // Top up to 3 varied outfits if the model returned fewer than 3 distinct combinations
  if (validated.length < 3 && params.wardrobe.length >= 2) {
    const extras = generateLocalFallbackOutfits({
      wardrobe: params.wardrobe,
      occasion: params.occasion,
      customPrompt: params.customPrompt,
      profile: params.profile,
      weather: params.weather,
      count: 3 - validated.length,
      excludeSignatures: seenSignatures,
    });
    for (const extra of extras) {
      validated.push({ ...extra, source: 'gemma' });
    }
  }

  return { outfits: validated.slice(0, 3), modelUsed: usedModel };
}

export async function chatWithGemmaFashionAssistant(params: {
  message: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  wardrobe: ClothingItem[];
  profile: UserProfile;
  weather?: WeatherReport | null;
  modelId: string;
}): Promise<{ reply: string; referencedItemIds: number[]; modelUsed: string }> {
  const model = resolveModelId(params.modelId);
  const ai = getGenAIClient();

  const itemMap = new Map<number, ClothingItem>(params.wardrobe.map((item) => [item.id, item]));
  const wardrobeSummary = params.wardrobe.map((item) => ({
    id: item.id,
    name: item.name,
    cat: item.category,
    color: item.color,
    pattern: item.pattern,
    style: item.style,
    season: item.season,
    wears: item.wear_count,
  }));

  const historyText = params.history
    .slice(-6)
    .map((h) => `${h.role === 'user' ? 'User' : 'StyleSync'}: ${h.content}`)
    .join('\n');

  const weatherText = params.weather
    ? `Weather in ${params.weather.city}: ${params.weather.current.temperature}°${params.weather.current.unit}, ${params.weather.current.condition}, Humidity ${params.weather.current.humidity}%.`
    : 'Weather data not loaded.';

  const systemInstruction =
    'You are StyleSync, an editorial personal fashion assistant. Answer concisely and thoughtfully using ONLY garments that exist in the user wardrobe JSON. Never invent items the user does not own; if something is missing, note it honestly while styling owned items.';

  const prompt = `PREFERENCES: name=${params.profile.name}; styles=${params.profile.style_preferences}; preferred=${params.profile.preferred_colors}; avoid=${params.profile.avoid_colors}; fit=${params.profile.fit_preference}; ${weatherText}
WARDROBE: ${JSON.stringify(wardrobeSummary)}
HISTORY: ${historyText || '(New conversation)'}
QUESTION: ${params.message}`;

  const candidateModels = Array.from(new Set([model, FALLBACK_FAST_MODEL]));
  let text: string | undefined;
  let usedModel = model;
  let lastError: unknown = null;

  for (const candidateModel of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model: candidateModel,
        contents: prompt,
        config: buildFastConfig(candidateModel, {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: CHAT_SCHEMA,
        }),
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
    throw lastError instanceof Error
      ? lastError
      : new Error(`Model ${model} returned an empty response.`);
  }

  try {
    const parsed = extractJsonFromText<{
      reply?: string;
      referencedItemIds?: unknown[];
    }>(text);

    const validIds = Array.from(
      new Set(
        (Array.isArray(parsed.referencedItemIds) ? parsed.referencedItemIds : [])
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && itemMap.has(id))
      )
    );

    return {
      reply: (parsed.reply || text).trim(),
      referencedItemIds: validIds,
      modelUsed: usedModel,
    };
  } catch {
    const matchedIds = params.wardrobe
      .filter((item) => text.toLowerCase().includes(item.name.toLowerCase()))
      .map((item) => item.id);
    return {
      reply: text.trim(),
      referencedItemIds: matchedIds,
      modelUsed: usedModel,
    };
  }
}
