const MAX_DIMENSION = 1024;
const SKIP_RESIZE_BYTES = 220 * 1024;
const WEBP_QUALITY = 0.86;
const JPEG_QUALITY = 0.86;

const NAMED_PALETTE: Array<{ name: string; r: number; g: number; b: number }> = [
  { name: 'Black', r: 28, g: 28, b: 30 },
  { name: 'Charcoal', r: 64, g: 66, b: 70 },
  { name: 'Grey', r: 135, g: 138, b: 142 },
  { name: 'Silver', r: 192, g: 196, b: 200 },
  { name: 'White', r: 245, g: 245, b: 243 },
  { name: 'Ivory', r: 242, g: 235, b: 222 },
  { name: 'Cream', r: 236, g: 224, b: 200 },
  { name: 'Beige', r: 214, g: 195, b: 168 },
  { name: 'Camel', r: 186, g: 142, b: 96 },
  { name: 'Tan', r: 196, g: 158, b: 118 },
  { name: 'Khaki', r: 170, g: 156, b: 116 },
  { name: 'Brown', r: 112, g: 74, b: 48 },
  { name: 'Espresso', r: 66, g: 44, b: 34 },
  { name: 'Rust', r: 172, g: 82, b: 48 },
  { name: 'Terracotta', r: 192, g: 102, b: 72 },
  { name: 'Burgundy', r: 114, g: 34, b: 48 },
  { name: 'Red', r: 186, g: 44, b: 46 },
  { name: 'Coral', r: 224, g: 108, b: 88 },
  { name: 'Pink', r: 222, g: 148, b: 168 },
  { name: 'Blush', r: 232, g: 192, b: 188 },
  { name: 'Mustard', r: 202, g: 158, b: 54 },
  { name: 'Yellow', r: 232, g: 198, b: 68 },
  { name: 'Olive', r: 104, g: 114, b: 66 },
  { name: 'Sage', r: 148, g: 168, b: 142 },
  { name: 'Forest Green', r: 42, g: 86, b: 56 },
  { name: 'Emerald', r: 34, g: 126, b: 84 },
  { name: 'Teal', r: 44, g: 120, b: 126 },
  { name: 'Sky Blue', r: 132, g: 176, b: 214 },
  { name: 'Denim Blue', r: 74, g: 108, b: 152 },
  { name: 'Cobalt', r: 42, g: 82, b: 176 },
  { name: 'Navy', r: 32, g: 46, b: 82 },
  { name: 'Lavender', r: 172, g: 152, b: 204 },
  { name: 'Purple', r: 114, g: 64, b: 144 },
];

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

export async function optimizeGarmentImage(file: File): Promise<File> {
  try {
    const img = await loadImageElement(file);
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;

    if (!width || !height) return file;

    const longest = Math.max(width, height);
    if (longest <= MAX_DIMENSION && file.size <= SKIP_RESIZE_BYTES) {
      return file;
    }

    const scale = longest > MAX_DIMENSION ? MAX_DIMENSION / longest : 1;
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const preferWebp = file.type === 'image/png' || file.type === 'image/webp';
    const targetMime = preferWebp ? 'image/webp' : 'image/jpeg';
    const quality = preferWebp ? WEBP_QUALITY : JPEG_QUALITY;

    let blob = await canvasToBlob(canvas, targetMime, quality);
    if (!blob && targetMime !== 'image/jpeg') {
      blob = await canvasToBlob(canvas, 'image/jpeg', JPEG_QUALITY);
    }
    if (!blob || (blob.size >= file.size && longest <= MAX_DIMENSION)) {
      return file;
    }

    const ext = blob.type === 'image/webp' ? '.webp' : '.jpg';
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'garment';
    return new File([blob], `${baseName}${ext}`, {
      type: blob.type,
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}

const NEUTRAL_PALETTE_NAMES = new Set([
  'Black',
  'Charcoal',
  'Grey',
  'Silver',
  'White',
  'Ivory',
  'Cream',
]);

function classifyPixelColor(r: number, g: number, b: number): string {
  let bestName = 'Neutral';
  let bestDist = Infinity;
  for (const p of NAMED_PALETTE) {
    const dr = r - p.r;
    const dg = g - p.g;
    const db = b - p.b;
    // Perceptually weighted RGB distance
    const dist = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
    if (dist < bestDist) {
      bestDist = dist;
      bestName = p.name;
    }
  }
  return bestName;
}

export async function detectDominantGarmentColor(file: File): Promise<string | null> {
  try {
    const img = await loadImageElement(file);
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    // 1. Sample outer 3px ring to detect studio/solid background color
    const borderBuckets = new Map<string, { count: number; sumR: number; sumG: number; sumB: number }>();
    let borderValid = 0;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (x >= 3 && x < size - 3 && y >= 3 && y < size - 3) continue;
        const idx = (y * size + x) * 4;
        const a = data[idx + 3];
        if (a < 180) continue;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const key = `${Math.round(r / 16)}-${Math.round(g / 16)}-${Math.round(b / 16)}`;
        const curr = borderBuckets.get(key) || { count: 0, sumR: 0, sumG: 0, sumB: 0 };
        curr.count += 1;
        curr.sumR += r;
        curr.sumG += g;
        curr.sumB += b;
        borderBuckets.set(key, curr);
        borderValid += 1;
      }
    }

    let bgR = 250;
    let bgG = 250;
    let bgB = 250;
    let hasUniformBackdrop = false;

    if (borderValid > 0) {
      let bestBucket = { count: 0, sumR: 0, sumG: 0, sumB: 0 };
      for (const bucket of borderBuckets.values()) {
        if (bucket.count > bestBucket.count) bestBucket = bucket;
      }
      if (bestBucket.count > 0) {
        bgR = bestBucket.sumR / bestBucket.count;
        bgG = bestBucket.sumG / bestBucket.count;
        bgB = bestBucket.sumB / bestBucket.count;
        hasUniformBackdrop = bestBucket.count / borderValid >= 0.35;
      }
    }

    const isLightBackdrop =
      hasUniformBackdrop &&
      (bgR + bgG + bgB) / 3 >= 200 &&
      Math.max(bgR, bgG, bgB) - Math.min(bgR, bgG, bgB) <= 28;

    // 2. Sample foreground garment area (center 72%) while subtracting detected backdrop
    const minCoord = Math.floor(size * 0.14);
    const maxCoord = Math.ceil(size * 0.86);

    const allCounts = new Map<string, number>();
    const chromaticCounts = new Map<string, number>();
    let foregroundTotal = 0;
    let chromaticTotal = 0;

    for (let y = minCoord; y < maxCoord; y++) {
      for (let x = minCoord; x < maxCoord; x++) {
        const idx = (y * size + x) * 4;
        const a = data[idx + 3];
        if (a < 180) continue;

        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        if (hasUniformBackdrop) {
          const dr = r - bgR;
          const dg = g - bgG;
          const db = b - bgB;
          if (dr * dr + dg * dg + db * db < 46 * 46) continue;
        }

        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        const chroma = maxC - minC;

        // Skip soft off-white shadows on light studio backdrops
        if (isLightBackdrop && minC > 205 && chroma < 22) continue;

        const colorName = classifyPixelColor(r, g, b);
        allCounts.set(colorName, (allCounts.get(colorName) || 0) + 1);
        foregroundTotal += 1;

        if (chroma >= 24 && maxC >= 40 && !NEUTRAL_PALETTE_NAMES.has(colorName)) {
          chromaticCounts.set(colorName, (chromaticCounts.get(colorName) || 0) + 1);
          chromaticTotal += 1;
        }
      }
    }

    if (foregroundTotal === 0) return 'White';

    const targetCounts =
      chromaticTotal >= Math.max(18, Math.floor(foregroundTotal * 0.1))
        ? chromaticCounts
        : allCounts;

    let topColor = 'Neutral';
    let topCount = -1;
    for (const [name, count] of targetCounts.entries()) {
      if (count > topCount) {
        topCount = count;
        topColor = name;
      }
    }
    return topColor;
  } catch {
    return null;
  }
}
