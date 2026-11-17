import type {
  ClothingItem,
  OutfitSuggestionDraft,
  UserProfile,
  WeatherReport,
} from '../src/types.ts';

const NEUTRALS = new Set([
  'black',
  'white',
  'ivory',
  'cream',
  'beige',
  'camel',
  'charcoal',
  'grey',
  'gray',
  'navy',
  'espresso',
  'brown',
  'tan',
  'taupe',
  'khaki',
  'cognac',
  'silver',
  'neutral',
  'denim',
]);

const CLASSIC_PAIRINGS: Record<string, string[]> = {
  navy: ['camel', 'ivory', 'cream', 'white', 'beige', 'rust', 'sky blue', 'grey', 'tan'],
  rust: ['ivory', 'cream', 'denim', 'navy', 'espresso', 'beige', 'camel', 'black'],
  terracotta: ['ivory', 'cream', 'beige', 'olive', 'denim', 'espresso', 'white'],
  olive: ['cream', 'ivory', 'beige', 'camel', 'black', 'white', 'brown', 'denim'],
  sage: ['cream', 'white', 'beige', 'camel', 'charcoal', 'denim'],
  burgundy: ['charcoal', 'black', 'ivory', 'cream', 'grey', 'camel', 'navy'],
  maroon: ['charcoal', 'black', 'ivory', 'cream', 'grey', 'camel', 'navy'],
  emerald: ['black', 'ivory', 'cream', 'camel', 'gold', 'charcoal'],
  cobalt: ['white', 'ivory', 'black', 'grey', 'camel', 'navy'],
  mustard: ['navy', 'charcoal', 'denim', 'black', 'cream', 'olive'],
  coral: ['white', 'ivory', 'navy', 'beige', 'denim'],
  blush: ['ivory', 'grey', 'charcoal', 'navy', 'camel', 'white'],
  pink: ['white', 'ivory', 'charcoal', 'navy', 'denim', 'grey'],
  lavender: ['white', 'ivory', 'grey', 'charcoal', 'denim'],
};

function tokenizeWords(raw: string | undefined): string[] {
  return (raw || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3);
}

function normalizeColorKey(color: string): string {
  return color.trim().toLowerCase();
}

function isNeutral(color: string): boolean {
  const lower = normalizeColorKey(color);
  return Array.from(NEUTRALS).some((n) => lower.includes(n));
}

function pairColorBonus(aColor: string, bColor: string): number {
  const a = normalizeColorKey(aColor);
  const b = normalizeColorKey(bColor);
  if (!a || !b) return 0;
  if (a === b) return 2.2;
  if (isNeutral(a) || isNeutral(b)) return 2.0;

  for (const [key, partners] of Object.entries(CLASSIC_PAIRINGS)) {
    if (a.includes(key) && partners.some((p) => b.includes(p))) return 2.5;
    if (b.includes(key) && partners.some((p) => a.includes(p))) return 2.5;
  }
  return -0.5;
}

function scoreColorCompatibility(items: ClothingItem[]): number {
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
  return (pairs > 0 ? (total / pairs) * 2 : 0) + clashPenalty;
}

function scorePatternBalance(items: ClothingItem[]): number {
  const quietPatterns = new Set(['solid', 'ribbed', 'textured', 'plain', '']);
  const patterned = items.filter((i) => !quietPatterns.has(i.pattern.toLowerCase().trim()));
  if (patterned.length === 0) return 2;
  if (patterned.length === 1) return 2.5;
  return -1.5 * (patterned.length - 1);
}

function getTempCelsius(weather?: WeatherReport | null): number {
  if (!weather) return 20;
  return weather.current.unit === 'F'
    ? ((weather.current.temperature - 32) * 5) / 9
    : weather.current.temperature;
}

function scoreWeatherFit(item: ClothingItem, weather?: WeatherReport | null): number {
  if (!weather) return 1;
  const tempC = getTempCelsius(weather);
  const cond = weather.current.condition.toLowerCase();
  const isRainy = cond.includes('rain') || cond.includes('drizzle') || cond.includes('storm');
  const season = item.season.toLowerCase();
  const cat = item.category;
  const hay = `${item.name} ${item.notes} ${item.style}`.toLowerCase();

  let score = 0;
  if (tempC <= 13) {
    if (cat === 'outerwear') score += 4;
    if (season.includes('winter') || season.includes('autumn')) score += 2.5;
    else if (season.includes('all')) score += 1.5;
    else if (season.includes('summer')) score -= 2.5;
    if (/\b(sandal|flip-flop|tank|sleeveless|shorts)\b/.test(hay)) score -= 3;
  } else if (tempC <= 20) {
    if (cat === 'outerwear') score += 2;
    if (season.includes('spring') || season.includes('autumn') || season.includes('all')) score += 2;
  } else if (tempC >= 25) {
    if (cat === 'outerwear') score -= 3;
    if (/\b(wool|puffer|parka|fleece|heavy|turtleneck|cashmere)\b/.test(hay)) score -= 3;
    if (season.includes('summer') || season.includes('spring')) score += 2.5;
    else if (season.includes('all')) score += 1.5;
    else if (season.includes('winter')) score -= 2.5;
  } else {
    score += season.includes('all') || season.includes('spring') || season.includes('autumn') ? 2 : 1;
  }

  if (isRainy) {
    if (cat === 'outerwear' && /\b(trench|rain|waterproof|jacket|coat)\b/.test(hay)) score += 2.5;
    if (cat === 'shoes' && /\b(suede|sandal|open)\b/.test(hay)) score -= 2;
    if (cat === 'shoes' && /\b(boot|leather|loafer|sneaker)\b/.test(hay)) score += 1.5;
  }

  return score;
}

function scoreOccasionFit(item: ClothingItem, occasion: string): number {
  const occ = occasion.toLowerCase();
  const hay = `${item.style} ${item.name} ${item.notes}`.toLowerCase();

  if (occ.includes('office') || occ.includes('formal') || occ.includes('work') || occ.includes('business')) {
    let s = 0;
    if (/\b(tailor|formal|classic|minimal|smart|business|blazer|trouser|oxford|loafer|pump|button-down|silk|poplin)\b/.test(hay)) {
      s += 3;
    }
    if (/\b(hoodie|jogger|sweatpant|flip-flop|athletic|gym|distressed)\b/.test(hay)) {
      s -= 3;
    }
    return s;
  }
  if (occ.includes('party') || occ.includes('evening') || occ.includes('date') || occ.includes('dinner')) {
    let s = item.category === 'dresses' ? 3 : 0;
    if (/\b(evening|chic|silk|satin|velvet|heel|tailor|statement|blazer|smart)\b/.test(hay)) {
      s += 2.5;
    }
    if (/\b(athleisure|sweatpant|jogger|gym)\b/.test(hay)) s -= 2.5;
    return s;
  }
  if (occ.includes('travel') || occ.includes('college') || occ.includes('casual') || occ.includes('weekend')) {
    let s = 0;
    if (/\b(casual|minimal|relaxed|knit|denim|sneaker|loafer|tote|cotton|linen|comfort|streetwear)\b/.test(hay)) {
      s += 2.5;
    }
    if (/\b(gown|stiletto|tuxedo)\b/.test(hay)) s -= 2.5;
    return s;
  }
  return 1;
}

function scoreProfileAndPrompt(
  item: ClothingItem,
  profile?: UserProfile,
  customPrompt?: string
): number {
  let score = 0;
  const itemText = `${item.name} ${item.category} ${item.color} ${item.secondary_color} ${item.pattern} ${item.style} ${item.season} ${item.notes}`.toLowerCase();

  if (profile) {
    const preferredColors = (profile.preferred_colors || '')
      .split(/[,;/]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    for (const c of preferredColors) {
      if (item.color.toLowerCase().includes(c) || item.secondary_color.toLowerCase().includes(c)) {
        score += 1.5;
        break;
      }
    }

    const avoidColors = (profile.avoid_colors || '')
      .split(/[,;/]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    for (const c of avoidColors) {
      if (item.color.toLowerCase().includes(c) || item.secondary_color.toLowerCase().includes(c)) {
        score -= 4;
        break;
      }
    }

    const prefStyles = (profile.style_preferences || '')
      .split(/[,;/]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    for (const st of prefStyles) {
      if (item.style.toLowerCase().includes(st) || item.notes.toLowerCase().includes(st)) {
        score += 1.2;
        break;
      }
    }
  }

  const promptWords = tokenizeWords(customPrompt);
  if (promptWords.length > 0) {
    const stopWords = new Set(['with', 'for', 'and', 'the', 'look', 'outfit', 'style', 'wear', 'today', 'highlight', 'something', 'prefer', 'please', 'make', 'keep']);
    for (const word of promptWords) {
      if (stopWords.has(word)) continue;
      if (itemText.includes(word)) {
        score += 6;
      }
    }
  }

  return score;
}

function pickBestComplement(
  candidates: ClothingItem[],
  anchors: ClothingItem[],
  occasion: string,
  weather?: WeatherReport | null,
  profile?: UserProfile,
  customPrompt?: string
): ClothingItem | null {
  if (candidates.length === 0) return null;
  let best: ClothingItem | null = null;
  let bestScore = -Infinity;

  for (const cand of candidates) {
    const withAnchors = [...anchors, cand];
    const score =
      scoreColorCompatibility(withAnchors) +
      scorePatternBalance(withAnchors) +
      scoreOccasionFit(cand, occasion) +
      scoreWeatherFit(cand, weather) +
      scoreProfileAndPrompt(cand, profile, customPrompt) -
      cand.wear_count * 0.15;

    if (score > bestScore) {
      bestScore = score;
      best = cand;
    }
  }
  return best;
}

export function generateLocalFallbackOutfits(params: {
  wardrobe: ClothingItem[];
  occasion: string;
  customPrompt?: string;
  profile?: UserProfile;
  weather?: WeatherReport | null;
  count?: number;
  excludeSignatures?: Set<string>;
}): OutfitSuggestionDraft[] {
  const { wardrobe, occasion, customPrompt, profile, weather, count = 3, excludeSignatures } = params;
  if (wardrobe.length === 0) return [];

  const tops = wardrobe.filter((i) => i.category === 'tops');
  const bottoms = wardrobe.filter((i) => i.category === 'bottoms');
  const dresses = wardrobe.filter((i) => i.category === 'dresses');
  const outerwear = wardrobe.filter((i) => i.category === 'outerwear');
  const shoes = wardrobe.filter((i) => i.category === 'shoes');
  const accessories = wardrobe.filter((i) => i.category === 'accessories');

  const tempC = getTempCelsius(weather);
  const condLower = weather?.current.condition.toLowerCase() ?? '';
  const needsLayer =
    tempC <= 19 ||
    condLower.includes('rain') ||
    condLower.includes('wind') ||
    /\b(layer|blazer|coat|jacket|cardigan)\b/i.test(customPrompt || '');

  const candidates: Array<{
    items: ClothingItem[];
    anchorIds: number[];
    score: number;
    label: string;
  }> = [];

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
      const score =
        scoreColorCompatibility(base) +
        scorePatternBalance(base) +
        base.reduce(
          (acc, item) =>
            acc +
            scoreOccasionFit(item, occasion) +
            scoreWeatherFit(item, weather) +
            scoreProfileAndPrompt(item, profile, customPrompt),
          0
        ) -
        wearPenalty;

      candidates.push({
        items: base,
        anchorIds: [top.id, bottom.id],
        score,
        label: `${top.color} & ${bottom.color} ${occasion} Edit`,
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
    const score =
      scoreColorCompatibility(base) +
      scorePatternBalance(base) +
      base.reduce(
        (acc, item) =>
          acc +
          scoreOccasionFit(item, occasion) +
          scoreWeatherFit(item, weather) +
          scoreProfileAndPrompt(item, profile, customPrompt),
        0
      ) -
      wearPenalty;

    candidates.push({
      items: base,
      anchorIds: [dress.id],
      score,
      label: `${dress.color} ${occasion} Silhouette`,
    });
  }

  if (candidates.length === 0) {
    const sorted = [...wardrobe].sort(
      (a, b) =>
        scoreOccasionFit(b, occasion) +
        scoreWeatherFit(b, weather) +
        scoreProfileAndPrompt(b, profile, customPrompt) -
        (scoreOccasionFit(a, occasion) +
          scoreWeatherFit(a, weather) +
          scoreProfileAndPrompt(a, profile, customPrompt))
    );
    const chosen = sorted.slice(0, Math.min(4, sorted.length));
    candidates.push({
      items: chosen,
      anchorIds: chosen.slice(0, 2).map((i) => i.id),
      score: 1,
      label: `Curated ${occasion} Selection`,
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  const selected: typeof candidates = [];
  const seenSignatures = new Set<string>(excludeSignatures ? Array.from(excludeSignatures) : []);
  const usedAnchors = new Set<number>();

  // Pass 1: maximize outfit variety by preferring unseen anchor garments
  for (const cand of candidates) {
    const sig = cand.items
      .map((i) => i.id)
      .sort((a, b) => a - b)
      .join('-');
    if (seenSignatures.has(sig)) continue;
    if (cand.anchorIds.some((id) => usedAnchors.has(id))) continue;
    seenSignatures.add(sig);
    cand.anchorIds.forEach((id) => usedAnchors.add(id));
    selected.push(cand);
    if (selected.length >= count) break;
  }

  // Pass 2: fill remaining slots if wardrobe has limited anchors
  if (selected.length < count) {
    for (const cand of candidates) {
      const sig = cand.items
        .map((i) => i.id)
        .sort((a, b) => a - b)
        .join('-');
      if (seenSignatures.has(sig)) continue;
      seenSignatures.add(sig);
      selected.push(cand);
      if (selected.length >= count) break;
    }
  }

  // Pass 3: add an outerwear-layered variation if still short of count
  if (selected.length < count && outerwear.length > 0 && selected.length > 0) {
    const first = selected[0];
    const hasOuterwear = first.items.some((i) => i.category === 'outerwear');
    if (!hasOuterwear) {
      const bestOuter = pickBestComplement(outerwear, first.items, occasion, weather, profile, customPrompt);
      if (bestOuter) {
        const layered = [...first.items, bestOuter];
        const sig = layered
          .map((i) => i.id)
          .sort((a, b) => a - b)
          .join('-');
        if (!seenSignatures.has(sig)) {
          selected.push({
            items: layered,
            anchorIds: first.anchorIds,
            score: first.score - 0.5,
            label: `Layered ${first.label}`,
          });
        }
      }
    }
  }

  const weatherText = weather
    ? `${weather.city}: ${weather.current.temperature}°${weather.current.unit}, ${weather.current.condition}`
    : '';

  return selected.map((cand, idx) => {
    const colors = Array.from(new Set(cand.items.map((i) => i.color))).join(', ');
    const anchorNames = cand.items
      .slice(0, 2)
      .map((i) => i.name)
      .join(' paired with ');
    const leastWorn = [...cand.items].sort((a, b) => a.wear_count - b.wear_count)[0];
    return {
      tempId: `local-${Date.now()}-${idx}`,
      name: cand.label,
      occasion,
      reasoning: `${anchorNames} balances ${colors} tones for ${occasion.toLowerCase()}${
        weather ? ` in ${weather.current.temperature}°${weather.current.unit} ${weather.current.condition.toLowerCase()} weather` : ''
      }, while rotating ${leastWorn.name}.`,
      stylingTip: needsLayer
        ? 'Layer thoughtfully for changing temperatures and finish with structured footwear.'
        : 'Keep proportions crisp with clean lines and minimal finishing accents.',
      source: 'local-fallback',
      weatherContext: weatherText,
      items: cand.items,
    };
  });
}
