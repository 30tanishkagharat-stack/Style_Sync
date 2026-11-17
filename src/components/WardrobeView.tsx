import {
  AlertCircle,
  Check,
  Edit3,
  Heart,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Shirt,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { ClothingCategory, ClothingItem, GarmentGender, SeasonTag } from '../types';
import { GarmentImage } from './GarmentImage';
import { detectDominantGarmentColor, optimizeGarmentImage } from '../utils/imageOptimize';

interface UploadDraft {
  id: string;
  file: File;
  previewUrl: string;
  previewImagePath: string;
  status: 'analyzing' | 'ready' | 'fallback';
  errorMessage?: string;
  modelUsed?: string;
  name: string;
  category: ClothingCategory;
  target_gender: GarmentGender;
  color: string;
  secondary_color: string;
  pattern: string;
  style: string;
  season: SeasonTag;
  notes: string;
}

const CATEGORY_DEFAULT_NOUNS: Record<ClothingCategory, string> = {
  tops: 'Top',
  bottoms: 'Trousers',
  dresses: 'Dress',
  outerwear: 'Jacket',
  shoes: 'Shoes',
  accessories: 'Accessory',
};

const CLOTH_TYPE_KEYWORDS: Array<{ pattern: RegExp; noun: string; category?: ClothingCategory }> = [
  { pattern: /\bt-?shirt\b|\btee\b/i, noun: 'T-Shirt', category: 'tops' },
  { pattern: /\bshirt\b|\bbutton[- ]?down\b|\boxford\b/i, noun: 'Shirt', category: 'tops' },
  { pattern: /\bblouse\b/i, noun: 'Blouse', category: 'tops' },
  { pattern: /\bsweater\b|\bpullover\b|\bknit\b|\bjumper\b/i, noun: 'Knit Sweater', category: 'tops' },
  { pattern: /\bhoodie\b|\bsweatshirt\b/i, noun: 'Hoodie', category: 'outerwear' },
  { pattern: /\bblazer\b/i, noun: 'Blazer', category: 'outerwear' },
  { pattern: /\btrench\b/i, noun: 'Trench Coat', category: 'outerwear' },
  { pattern: /\bcoat\b|\bovercoat\b/i, noun: 'Coat', category: 'outerwear' },
  { pattern: /\bcardigan\b/i, noun: 'Cardigan', category: 'outerwear' },
  { pattern: /\bjacket\b|\bbomber\b/i, noun: 'Jacket', category: 'outerwear' },
  { pattern: /\bjeans?\b|\bdenim\b/i, noun: 'Jeans', category: 'bottoms' },
  { pattern: /\bchinos?\b/i, noun: 'Chinos', category: 'bottoms' },
  { pattern: /\bskirt\b/i, noun: 'Skirt', category: 'bottoms' },
  { pattern: /\bshorts\b/i, noun: 'Shorts', category: 'bottoms' },
  { pattern: /\btrousers?\b|\bpants?\b|\bslacks\b/i, noun: 'Trousers', category: 'bottoms' },
  { pattern: /\bjumpsuit\b|\bromper\b/i, noun: 'Jumpsuit', category: 'dresses' },
  { pattern: /\bgown\b/i, noun: 'Evening Gown', category: 'dresses' },
  { pattern: /\bdress\b/i, noun: 'Dress', category: 'dresses' },
  { pattern: /\bsneakers?\b|\btrainers?\b/i, noun: 'Sneakers', category: 'shoes' },
  { pattern: /\bloafers?\b/i, noun: 'Loafers', category: 'shoes' },
  { pattern: /\bboots?\b/i, noun: 'Boots', category: 'shoes' },
  { pattern: /\bheels?\b|\bpumps?\b/i, noun: 'Heels', category: 'shoes' },
  { pattern: /\bsandals?\b/i, noun: 'Sandals', category: 'shoes' },
  { pattern: /\btote\b/i, noun: 'Tote Bag', category: 'accessories' },
  { pattern: /\bbag\b|\bhandbag\b|\bpurse\b/i, noun: 'Bag', category: 'accessories' },
  { pattern: /\bscarf\b/i, noun: 'Scarf', category: 'accessories' },
  { pattern: /\bbelt\b/i, noun: 'Belt', category: 'accessories' },
  { pattern: /\bhat\b|\bcap\b|\bbeanie\b/i, noun: 'Hat', category: 'accessories' },
  { pattern: /\bsunglass/i, noun: 'Sunglasses', category: 'accessories' },
  { pattern: /\bwatch\b/i, noun: 'Watch', category: 'accessories' },
];

function isGenericFilename(filename: string): boolean {
  const base = filename.replace(/\.[^.]+$/, '').trim().toLowerCase();
  if (!base) return true;
  if (
    /^(img|dsc|pxl|mvimg|screenshot|screen\s*shot|whatsapp|image|photo|pic|download|untitled|file|camera)[_\s-]*[\d\s_-]*$/i.test(
      base
    )
  ) {
    return true;
  }
  return /^[0-9a-f-]{8,}$/i.test(base) || /^\d+$/.test(base);
}

function generateSuitableGarmentName(opts: {
  category: ClothingCategory;
  color?: string;
  pattern?: string;
  style?: string;
  notes?: string;
  filename?: string;
  currentName?: string;
}): string {
  const searchPool = [opts.notes, opts.filename, opts.currentName].filter(Boolean).join(' ');
  let noun = CATEGORY_DEFAULT_NOUNS[opts.category] || 'Garment';

  for (const entry of CLOTH_TYPE_KEYWORDS) {
    if (entry.pattern.test(searchPool) && (!entry.category || entry.category === opts.category)) {
      noun = entry.noun;
      break;
    }
  }

  const color = (opts.color || '').trim();
  const pattern = (opts.pattern || '').trim();
  const style = (opts.style || '').trim();

  const parts: string[] = [];
  if (color && !/^neutral$/i.test(color)) {
    parts.push(color.replace(/\b\w/g, (c) => c.toUpperCase()));
  }
  if (pattern && !/^solid$/i.test(pattern)) {
    parts.push(pattern.replace(/\b\w/g, (c) => c.toUpperCase()));
  } else if (style && parts.length === 0) {
    parts.push(style.replace(/\b\w/g, (c) => c.toUpperCase()));
  }
  parts.push(noun);

  return parts.join(' ').trim();
}

function cleanNameFromFile(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
  if (!base) return 'New Garment';
  return base.replace(/\b\w/g, (c) => c.toUpperCase());
}

function inferCategoryFromFilename(filename: string): ClothingCategory {
  const lower = filename.toLowerCase();
  if (/dress|gown|jumpsuit|romper/.test(lower)) return 'dresses';
  if (/pant|trouser|jean|skirt|short|chino|legging|jogger/.test(lower)) return 'bottoms';
  if (/coat|jacket|blazer|trench|cardigan|hoodie|overshirt|parka|puffer|vest/.test(lower)) return 'outerwear';
  if (/shoe|loafer|boot|sneaker|heel|sandal|mule|flat|pump/.test(lower)) return 'shoes';
  if (/bag|tote|belt|scarf|hat|watch|sunglass|cap|beanie/.test(lower)) return 'accessories';
  return 'tops';
}

function inferAttributesFromFilename(filename: string): {
  color: string | null;
  pattern: string;
  style: string;
  season: SeasonTag;
} {
  const lower = filename.toLowerCase();
  const colorList = [
    'navy', 'ivory', 'cream', 'beige', 'camel', 'tan', 'khaki', 'brown', 'espresso',
    'rust', 'terracotta', 'burgundy', 'maroon', 'coral', 'blush', 'pink', 'red',
    'mustard', 'yellow', 'olive', 'sage', 'emerald', 'teal', 'cobalt', 'denim',
    'lavender', 'purple', 'charcoal', 'grey', 'gray', 'black', 'white', 'silver',
  ];
  let matchedColor: string | null = null;
  for (const c of colorList) {
    if (new RegExp(`\\b${c}\\b`, 'i').test(lower)) {
      matchedColor = c === 'gray' ? 'Grey' : c.replace(/\b\w/g, (ch) => ch.toUpperCase());
      break;
    }
  }

  let pattern = 'Solid';
  if (/\bpinstripe\b/.test(lower)) pattern = 'Pinstripe';
  else if (/\bstripe[sd]?\b/.test(lower)) pattern = 'Striped';
  else if (/\bplaid\b|\btartan\b/.test(lower)) pattern = 'Plaid';
  else if (/\bcheck(?:ered)?\b|\bgingham\b/.test(lower)) pattern = 'Checkered';
  else if (/\bfloral\b/.test(lower)) pattern = 'Floral';
  else if (/\bribbed\b/.test(lower)) pattern = 'Ribbed';
  else if (/\bquilt(?:ed)?\b/.test(lower)) pattern = 'Quilted';
  else if (/\bknit\b|\bcable\b/.test(lower)) pattern = 'Cable Knit';
  else if (/\bgraphic\b/.test(lower)) pattern = 'Graphic Print';

  let style = 'Casual';
  if (/\bblazer\b|\btailor|\btrouser|\boxford\b|\bsilk\b/.test(lower)) style = 'Tailored';
  else if (/\bgown\b|\bevening\b|\bcocktail\b/.test(lower)) style = 'Evening';
  else if (/\bhoodie\b|\bsneaker|\bjogger\b/.test(lower)) style = 'Streetwear';
  else if (/\blinen\b|\bminimal\b/.test(lower)) style = 'Minimalist';

  let season: SeasonTag = 'All-Season';
  if (/\bwool\b|\bpuffer\b|\bparka\b|\bfleece\b|\bwinter\b|\bturtleneck\b/.test(lower)) season = 'Winter';
  else if (/\btrench\b|\bcorduroy\b|\bflannel\b|\bautumn\b|\bfall\b/.test(lower)) season = 'Autumn';
  else if (/\blinen\b|\bsundress\b|\bshorts\b|\bsandal\b|\bsummer\b|\btank\b/.test(lower)) season = 'Summer';
  else if (/\bfloral\b|\bspring\b|\bpastel\b/.test(lower)) season = 'Spring';

  return { color: matchedColor, pattern, style, season };
}

interface WardrobeViewProps {
  onNotify: (message: string, type?: 'success' | 'error') => void;
}

const CATEGORIES: Array<{ value: 'all' | ClothingCategory; label: string }> = [
  { value: 'all', label: 'All Pieces' },
  { value: 'tops', label: 'Tops' },
  { value: 'bottoms', label: 'Bottoms' },
  { value: 'dresses', label: 'Dresses' },
  { value: 'outerwear', label: 'Outerwear' },
  { value: 'shoes', label: 'Shoes' },
  { value: 'accessories', label: 'Accessories' },
];

const SEASONS: Array<'all' | SeasonTag> = [
  'all',
  'Spring',
  'Summer',
  'Autumn',
  'Winter',
];

export function WardrobeView({ onNotify }: WardrobeViewProps) {
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<'all' | ClothingCategory>('all');
  const [targetGender, setTargetGender] = useState<'all' | GarmentGender>('all');
  const [season, setSeason] = useState<'all' | SeasonTag>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'newest' | 'most_worn' | 'least_worn' | 'name_asc'>('newest');

  // Upload modal state
  const [showUpload, setShowUpload] = useState(false);
  const [uploadDrafts, setUploadDrafts] = useState<UploadDraft[]>([]);
  const [uploadForm, setUploadForm] = useState({
    name: '',
    category: 'tops' as ClothingCategory,
    target_gender: 'unisex' as GarmentGender,
    color: '',
    secondary_color: '',
    pattern: '',
    style: '',
    season: 'All-Season' as SeasonTag,
    notes: '',
  });
  const [uploading, setUploading] = useState(false);
  const [nameAutoGenerated, setNameAutoGenerated] = useState(true);
  const analysisRunRef = useRef(0);

  // Edit modal state
  const [editingItem, setEditingItem] = useState<ClothingItem | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await api.listWardrobe({
        category,
        target_gender: targetGender,
        season,
        search,
        sort,
      });
      setItems(res.items);
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [category, targetGender, season, sort]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchItems();
  };

  const resetUploadModal = () => {
    analysisRunRef.current += 1;
    for (const draft of uploadDrafts) {
      if (draft.previewUrl) URL.revokeObjectURL(draft.previewUrl);
    }
    setUploadDrafts([]);
    setUploadForm({
      name: '',
      category: 'tops',
      target_gender: 'unisex',
      color: '',
      secondary_color: '',
      pattern: '',
      style: '',
      season: 'All-Season',
      notes: '',
    });
    setNameAutoGenerated(true);
  };

  const closeUploadModal = () => {
    resetUploadModal();
    setShowUpload(false);
  };

  const analyzeDrafts = async (draftsToAnalyze: UploadDraft[], runId: number) => {
    const isSingle = draftsToAnalyze.length === 1;
    const CONCURRENCY = 4;
    let cursor = 0;

    const processDraft = async (draft: UploadDraft) => {
      try {
        const optimizedFile = await optimizeGarmentImage(draft.file);
        if (analysisRunRef.current !== runId) return;

        const res = await api.recognizeClothing(optimizedFile);
        if (analysisRunRef.current !== runId) return;

        if (res.ok && res.recognition) {
          const rec = res.recognition;
          setUploadDrafts((prev) =>
            prev.map((d) =>
              d.id === draft.id
                ? {
                    ...d,
                    previewImagePath: res.previewImagePath,
                    status: 'ready',
                    modelUsed: res.modelUsed || 'StyleSync AI',
                    errorMessage: undefined,
                    name: rec.name,
                    category: rec.category,
                    target_gender: rec.target_gender || 'unisex',
                    color: rec.color,
                    secondary_color: rec.secondary_color || '',
                    pattern: rec.pattern,
                    style: rec.style,
                    season: rec.season,
                    notes: rec.notes || '',
                  }
                : d
            )
          );
          if (isSingle) {
            const resolvedName =
              rec.name && !/^recognized garment$/i.test(rec.name.trim())
                ? rec.name.trim()
                : generateSuitableGarmentName({
                    category: rec.category,
                    color: rec.color,
                    pattern: rec.pattern,
                    style: rec.style,
                    notes: rec.notes,
                    filename: draft.file.name,
                  });
            setUploadForm({
              name: resolvedName,
              category: rec.category,
              target_gender: rec.target_gender || 'unisex',
              color: rec.color,
              secondary_color: rec.secondary_color || '',
              pattern: rec.pattern,
              style: rec.style,
              season: rec.season,
              notes: rec.notes || '',
            });
            setNameAutoGenerated(true);
          }
          return;
        }

        const fallbackCat = inferCategoryFromFilename(draft.file.name);
        const inferred = inferAttributesFromFilename(draft.file.name);
        const detectedColor =
          inferred.color || (await detectDominantGarmentColor(optimizedFile)) || 'Neutral';
        if (analysisRunRef.current !== runId) return;

        const fallbackName = isGenericFilename(draft.file.name)
          ? generateSuitableGarmentName({
              category: fallbackCat,
              color: detectedColor,
              pattern: inferred.pattern,
              style: inferred.style,
              filename: draft.file.name,
            })
          : cleanNameFromFile(draft.file.name);

        setUploadDrafts((prev) =>
          prev.map((d) =>
            d.id === draft.id
              ? {
                  ...d,
                  previewImagePath: res.previewImagePath || d.previewImagePath,
                  status: 'fallback',
                  errorMessage:
                    res.error || 'Auto-identification was unavailable. Review fields manually.',
                  name: fallbackName,
                  category: fallbackCat,
                  color: detectedColor,
                  pattern: inferred.pattern,
                  style: inferred.style,
                  season: inferred.season,
                }
              : d
          )
        );
        if (isSingle) {
          setUploadForm((prev) => ({
            ...prev,
            name: fallbackName,
            category: fallbackCat,
            color: detectedColor,
            pattern: inferred.pattern,
            style: inferred.style,
            season: inferred.season,
          }));
          setNameAutoGenerated(true);
        }
      } catch (err) {
        if (analysisRunRef.current !== runId) return;
        const fallbackCat = inferCategoryFromFilename(draft.file.name);
        const inferred = inferAttributesFromFilename(draft.file.name);
        const detectedColor =
          inferred.color || (await detectDominantGarmentColor(draft.file)) || 'Neutral';
        if (analysisRunRef.current !== runId) return;

        const fallbackName = isGenericFilename(draft.file.name)
          ? generateSuitableGarmentName({
              category: fallbackCat,
              color: detectedColor,
              pattern: inferred.pattern,
              style: inferred.style,
              filename: draft.file.name,
            })
          : cleanNameFromFile(draft.file.name);

        setUploadDrafts((prev) =>
          prev.map((d) =>
            d.id === draft.id
              ? {
                  ...d,
                  status: 'fallback',
                  errorMessage: (err as Error).message,
                  name: fallbackName,
                  category: fallbackCat,
                  color: detectedColor,
                  pattern: inferred.pattern,
                  style: inferred.style,
                  season: inferred.season,
                }
              : d
          )
        );
        if (isSingle) {
          setUploadForm((prev) => ({
            ...prev,
            name: fallbackName,
            category: fallbackCat,
            color: detectedColor,
            pattern: inferred.pattern,
            style: inferred.style,
            season: inferred.season,
          }));
          setNameAutoGenerated(true);
        }
      }
    };

    const workers = Array.from({ length: Math.min(CONCURRENCY, draftsToAnalyze.length) }, async () => {
      while (cursor < draftsToAnalyze.length) {
        const nextIndex = cursor++;
        await processDraft(draftsToAnalyze[nextIndex]);
      }
    });
    await Promise.all(workers);
  };

  const handleUploadFilesSelected = (files: File[]) => {
    for (const draft of uploadDrafts) {
      if (draft.previewUrl) URL.revokeObjectURL(draft.previewUrl);
    }
    const runId = ++analysisRunRef.current;

    if (files.length === 0) {
      setUploadDrafts([]);
      return;
    }

    const newDrafts: UploadDraft[] = files.map((file, idx) => ({
      id: `${Date.now()}-${idx}-${file.name}`,
      file,
      previewUrl: URL.createObjectURL(file),
      previewImagePath: '',
      status: 'analyzing',
      name: '',
      category: 'tops',
      target_gender: 'unisex',
      color: '',
      secondary_color: '',
      pattern: '',
      style: '',
      season: 'All-Season',
      notes: '',
    }));

    setUploadDrafts(newDrafts);
    if (files.length === 1) {
      setUploadForm({
        name: '',
        category: 'tops',
        target_gender: 'unisex',
        color: '',
        secondary_color: '',
        pattern: '',
        style: '',
        season: 'All-Season',
        notes: '',
      });
    }

    void analyzeDrafts(newDrafts, runId);
  };

  const handleReanalyzeSingle = () => {
    if (uploadDrafts.length !== 1) return;
    const draft = uploadDrafts[0];
    const runId = ++analysisRunRef.current;
    const updated = [{ ...draft, status: 'analyzing' as const, errorMessage: undefined }];
    setUploadDrafts(updated);
    void analyzeDrafts(updated, runId);
  };

  const updateDraftField = <K extends keyof UploadDraft>(
    id: string,
    key: K,
    value: UploadDraft[K]
  ) => {
    setUploadDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, [key]: value } : d)));
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadDrafts.length === 0) {
      onNotify('Please choose at least one JPG, PNG, JPEG, or WEBP file.', 'error');
      return;
    }
    if (uploadDrafts.some((d) => d.status === 'analyzing')) {
      onNotify('Please wait while garment details are being identified.', 'error');
      return;
    }

    setUploading(true);
    try {
      let savedCount = 0;

      if (uploadDrafts.length === 1) {
        const draft = uploadDrafts[0];
        const payload = {
          name:
            uploadForm.name.trim() ||
            generateSuitableGarmentName({
              category: uploadForm.category,
              color: uploadForm.color,
              pattern: uploadForm.pattern,
              style: uploadForm.style,
              notes: uploadForm.notes,
              filename: draft.file.name,
            }),
          category: uploadForm.category,
          target_gender: uploadForm.target_gender,
          color: uploadForm.color.trim() || 'Neutral',
          secondary_color: uploadForm.secondary_color.trim(),
          pattern: uploadForm.pattern.trim() || 'Solid',
          style: uploadForm.style.trim() || 'Casual',
          season: uploadForm.season,
          notes: uploadForm.notes.trim(),
        };
        if (draft.previewImagePath) {
          await api.saveRecognizedGarment({
            ...payload,
            image_path: draft.previewImagePath,
          });
        } else {
          await api.uploadWardrobeFiles([draft.file], payload);
        }
        savedCount = 1;
      } else {
        await Promise.all(
          uploadDrafts.map(async (draft) => {
            const payload = {
              name:
                draft.name.trim() ||
                generateSuitableGarmentName({
                  category: draft.category,
                  color: draft.color,
                  pattern: draft.pattern,
                  style: draft.style,
                  filename: draft.file.name,
                }),
              category: draft.category,
              target_gender: draft.target_gender,
              color: draft.color.trim() || 'Neutral',
              secondary_color: draft.secondary_color.trim(),
              pattern: draft.pattern.trim() || 'Solid',
              style: draft.style.trim() || 'Casual',
              season: draft.season,
              notes: draft.notes.trim(),
            };
            if (draft.previewImagePath) {
              await api.saveRecognizedGarment({
                ...payload,
                image_path: draft.previewImagePath,
              });
            } else {
              const optimized = await optimizeGarmentImage(draft.file);
              await api.uploadWardrobeFiles([optimized], payload);
            }
          })
        );
        savedCount = uploadDrafts.length;
      }

      onNotify(`Added ${savedCount} item(s) to your wardrobe.`, 'success');
      closeUploadModal();
      await fetchItems();
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleToggleFav = async (item: ClothingItem) => {
    try {
      const res = await api.toggleFavourite('clothing', item.id);
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_favourite: res.isFavourite } : i))
      );
      onNotify(
        res.isFavourite ? `${item.name} added to Favourites.` : `${item.name} removed from Favourites.`,
        'success'
      );
    } catch (err) {
      onNotify((err as Error).message, 'error');
    }
  };

  const handleMarkWorn = async (item: ClothingItem) => {
    try {
      await api.logWear({
        clothing_item_ids: [item.id],
        occasion: 'Daily',
      });
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, wear_count: i.wear_count + 1 } : i))
      );
      onNotify(`Logged a wear for ${item.name}.`, 'success');
    } catch (err) {
      onNotify((err as Error).message, 'error');
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setSavingEdit(true);
    try {
      const res = await api.updateClothingItem(editingItem.id, {
        name: editingItem.name,
        category: editingItem.category,
        target_gender: editingItem.target_gender,
        color: editingItem.color,
        secondary_color: editingItem.secondary_color,
        pattern: editingItem.pattern,
        style: editingItem.style,
        season: editingItem.season,
        notes: editingItem.notes,
      });
      setItems((prev) => prev.map((i) => (i.id === editingItem.id ? res.item : i)));
      setEditingItem(null);
      onNotify('Garment details updated.', 'success');
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deleteClothingItem(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      setDeletingId(null);
      onNotify('Garment removed from wardrobe.', 'success');
    } catch (err) {
      onNotify((err as Error).message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Category Segmented Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setCategory(cat.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  category === cat.value
                    ? 'bg-[#292929] text-[#FFFEFC]'
                    : 'bg-[#F7F3ED] text-[#292929] hover:bg-[#E9DFD2]/70'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {items.length > 0 && (
            <button
              type="button"
              onClick={() => setShowUpload(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-[#B76545] text-[#FFFEFC] hover:bg-[#B76545]/90 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Clothes
            </button>
          )}
        </div>

        {/* Search, Season, Sort */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-[#E9DFD2]">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-[#85817B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by garment name, colour, pattern, style..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-[#F7F3ED] border border-[#E9DFD2] rounded-lg text-[#292929] placeholder:text-[#85817B] focus:outline-none focus:border-[#B76545]"
            />
          </form>

          <select
            value={targetGender}
            onChange={(e) => setTargetGender(e.target.value as 'all' | GarmentGender)}
            aria-label="Filter by styling section"
            className="px-3 py-2 text-xs font-medium bg-[#F7F3ED] border border-[#E9DFD2] rounded-lg text-[#292929] focus:outline-none focus:border-[#B76545]"
          >
            <option value="all">All Sections</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="unisex">Unisex</option>
          </select>

          <select
            value={season}
            onChange={(e) => setSeason(e.target.value as 'all' | SeasonTag)}
            aria-label="Filter by season"
            className="px-3 py-2 text-xs font-medium bg-[#F7F3ED] border border-[#E9DFD2] rounded-lg text-[#292929] focus:outline-none focus:border-[#B76545]"
          >
            {SEASONS.map((s) => (
              <option key={s} value={s}>
                {s === 'all' ? 'All Seasons' : s}
              </option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(e) =>
              setSort(e.target.value as 'newest' | 'most_worn' | 'least_worn' | 'name_asc')
            }
            aria-label="Sort garments"
            className="px-3 py-2 text-xs font-medium bg-[#F7F3ED] border border-[#E9DFD2] rounded-lg text-[#292929] focus:outline-none focus:border-[#B76545]"
          >
            <option value="newest">Newest First</option>
            <option value="most_worn">Most Worn</option>
            <option value="least_worn">Least Worn</option>
            <option value="name_asc">Name A–Z</option>
          </select>
        </div>
      </div>

      {/* Wardrobe Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-96 bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl p-12 text-center">
          <Shirt className="w-10 h-10 text-[#85817B] mx-auto mb-3 stroke-[1.5]" />
          <h3 className="text-xl font-semibold text-[#292929] font-serif mb-1">
            No matching clothing pieces found
          </h3>
          <p className="text-sm text-[#85817B] max-w-md mx-auto mb-6">
            Upload single or multiple clothing images (JPG, PNG, JPEG, WEBP).
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setShowUpload(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-[#B76545] text-[#FFFEFC] hover:bg-[#B76545]/90 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload Garments
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {items.map((item) => (
            <article
              key={item.id}
              className="bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl overflow-hidden flex flex-col transition-transform duration-150 hover:-translate-y-0.5"
            >
              <div className="aspect-[3/4] relative overflow-hidden bg-[#F7F3ED]">
                <GarmentImage src={item.image_path} alt={item.name} />
                <button
                  type="button"
                  onClick={() => handleToggleFav(item)}
                  aria-label={item.is_favourite ? 'Remove from favourites' : 'Add to favourites'}
                  className="absolute top-3 right-3 p-2 rounded-lg bg-[#FFFEFC]/90 border border-[#E9DFD2] text-[#292929] hover:border-[#B76545] transition-colors"
                >
                  <Heart
                    className={`w-4 h-4 ${
                      item.is_favourite ? 'fill-[#B76545] text-[#B76545]' : 'text-[#85817B]'
                    }`}
                  />
                </button>
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-semibold text-[#292929] leading-snug mb-1 truncate">
                    {item.name}
                  </h3>
                  <p className="text-xs text-[#85817B] capitalize truncate mb-2">
                    {item.category} · {item.color} · {item.pattern}
                    {item.target_gender && item.target_gender !== 'unisex'
                      ? ` · ${item.target_gender}`
                      : ''}
                  </p>
                  <p className="text-xs text-[#85817B] truncate">
                    {item.style} · {item.season} ·{' '}
                    <span className="tabular-nums font-medium text-[#292929]">
                      {item.wear_count}
                    </span>{' '}
                    wears
                  </p>
                </div>

                <div className="pt-3 mt-3 border-t border-[#E9DFD2] flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleMarkWorn(item)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-[#F7F3ED] text-[#292929] hover:bg-[#E9DFD2] transition-colors whitespace-nowrap shrink-0"
                  >
                    <Check className="w-3.5 h-3.5 text-[#B76545]" />
                    Mark Worn
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingItem(item)}
                      aria-label={`Edit ${item.name}`}
                      className="p-1.5 rounded-md text-[#85817B] hover:text-[#292929] hover:bg-[#F7F3ED] transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    {deletingId === item.id ? (
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="px-2 py-1 rounded-md text-[11px] font-medium bg-red-700 text-white"
                      >
                        Confirm
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeletingId(item.id)}
                        aria-label={`Delete ${item.name}`}
                        className="p-1.5 rounded-md text-[#85817B] hover:text-red-700 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 bg-[#292929]/50 flex items-center justify-center p-4">
          <div className="bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#E9DFD2]">
              <div>
                <h2 className="text-xl font-semibold text-[#292929] font-serif">
                  Upload Clothing Items
                </h2>
                <p className="text-xs text-[#85817B]">
                  Photos are automatically scanned to identify garment name, category, primary colour, pattern, and style.
                </p>
              </div>
              <button
                type="button"
                onClick={closeUploadModal}
                className="p-1 rounded-lg text-[#85817B] hover:text-[#292929]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#292929] mb-1.5">
                  Clothing Images (JPG, PNG, JPEG, WEBP — single or multiple)
                </label>
                <input
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  onChange={(e) => handleUploadFilesSelected(Array.from(e.target.files || []))}
                  className="w-full text-xs text-[#292929] file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-[#292929] file:text-[#FFFEFC] hover:file:bg-[#292929]/90 bg-[#F7F3ED] border border-[#E9DFD2] rounded-lg p-2"
                />
              </div>

              {/* Single photo preview + auto-identification status */}
              {uploadDrafts.length === 1 && (
                <div className="p-3 rounded-lg border border-[#E9DFD2] bg-[#F7F3ED]/60 flex items-center gap-3.5">
                  <img
                    src={uploadDrafts[0].previewUrl}
                    alt={uploadDrafts[0].file.name}
                    className="w-16 h-20 object-cover rounded-lg border border-[#E9DFD2] shrink-0 bg-[#FFFEFC]"
                  />
                  <div className="min-w-0 flex-1">
                    {uploadDrafts[0].status === 'analyzing' ? (
                      <div className="flex items-center gap-2 text-xs font-medium text-[#292929]">
                        <Loader2 className="w-4 h-4 animate-spin text-[#B76545] shrink-0" />
                        <span>
                          Identifying garment name, category, primary colour, pattern & style...
                        </span>
                      </div>
                    ) : uploadDrafts[0].status === 'ready' ? (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#292929]">
                            <Sparkles className="w-3.5 h-3.5 text-[#B76545]" />
                            Garment details identified automatically
                          </span>
                          <button
                            type="button"
                            onClick={handleReanalyzeSingle}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#85817B] hover:text-[#292929]"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Re-scan
                          </button>
                        </div>
                        <p className="text-[11px] text-[#85817B]">
                          Review or adjust any field below before saving.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#292929]">
                            <AlertCircle className="w-3.5 h-3.5 text-[#B76545]" />
                            {uploadDrafts[0].errorMessage?.includes('GEMINI_API_KEY')
                              ? 'Local colour scan applied (AI key not configured)'
                              : 'Local colour scan applied (AI scan unavailable)'}
                          </span>
                          <button
                            type="button"
                            onClick={handleReanalyzeSingle}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#B76545] hover:underline"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Retry Scan
                          </button>
                        </div>
                        <p className="text-[11px] text-[#85817B]">
                          Please verify garment name, category, colour, pattern, and style below.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Multi-photo identified cards */}
              {uploadDrafts.length > 1 ? (
                <div className="space-y-3 max-h-[46vh] overflow-y-auto pr-1">
                  {uploadDrafts.map((draft, index) => (
                    <div
                      key={draft.id}
                      className="p-3.5 rounded-xl border border-[#E9DFD2] bg-[#F7F3ED]/50 space-y-3"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={draft.previewUrl}
                          alt={draft.file.name}
                          className="w-14 h-18 object-cover rounded-lg border border-[#E9DFD2] shrink-0 bg-[#FFFEFC]"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-medium text-[#292929] truncate">
                              Photo {index + 1}: {draft.file.name}
                            </p>
                            {draft.status === 'analyzing' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-[#B76545] shrink-0">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Identifying...
                              </span>
                            ) : draft.status === 'ready' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-[#292929] shrink-0">
                                <Sparkles className="w-3 h-3 text-[#B76545]" />
                                Identified
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] text-[#85817B] shrink-0">
                                <AlertCircle className="w-3 h-3 text-[#B76545]" />
                                Verify
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-medium text-[#292929] mb-1">
                            Garment Name
                          </label>
                          <input
                            type="text"
                            value={draft.name}
                            disabled={draft.status === 'analyzing'}
                            onChange={(e) => updateDraftField(draft.id, 'name', e.target.value)}
                            placeholder={
                              draft.status === 'analyzing'
                                ? 'Identifying garment name...'
                                : 'e.g. Tailored Linen Blazer'
                            }
                            className="w-full px-2.5 py-1.5 text-xs bg-[#FFFEFC] border border-[#E9DFD2] rounded-lg text-[#292929]"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-[#292929] mb-1">
                            Category
                          </label>
                          <select
                            value={draft.category}
                            disabled={draft.status === 'analyzing'}
                            onChange={(e) =>
                              updateDraftField(
                                draft.id,
                                'category',
                                e.target.value as ClothingCategory
                              )
                            }
                            className="w-full px-2.5 py-1.5 text-xs bg-[#FFFEFC] border border-[#E9DFD2] rounded-lg text-[#292929]"
                          >
                            <option value="tops">Tops</option>
                            <option value="bottoms">Bottoms</option>
                            <option value="dresses">Dresses</option>
                            <option value="outerwear">Outerwear</option>
                            <option value="shoes">Shoes</option>
                            <option value="accessories">Accessories</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-[#292929] mb-1">
                            Primary Colour
                          </label>
                          <input
                            type="text"
                            value={draft.color}
                            disabled={draft.status === 'analyzing'}
                            onChange={(e) => updateDraftField(draft.id, 'color', e.target.value)}
                            placeholder={draft.status === 'analyzing' ? 'Detecting...' : 'e.g. Navy'}
                            className="w-full px-2.5 py-1.5 text-xs bg-[#FFFEFC] border border-[#E9DFD2] rounded-lg text-[#292929]"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-[#292929] mb-1">
                            Pattern
                          </label>
                          <input
                            type="text"
                            value={draft.pattern}
                            disabled={draft.status === 'analyzing'}
                            onChange={(e) => updateDraftField(draft.id, 'pattern', e.target.value)}
                            placeholder={draft.status === 'analyzing' ? 'Detecting...' : 'e.g. Solid'}
                            className="w-full px-2.5 py-1.5 text-xs bg-[#FFFEFC] border border-[#E9DFD2] rounded-lg text-[#292929]"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-[#292929] mb-1">
                            Style
                          </label>
                          <input
                            type="text"
                            value={draft.style}
                            disabled={draft.status === 'analyzing'}
                            onChange={(e) => updateDraftField(draft.id, 'style', e.target.value)}
                            placeholder={
                              draft.status === 'analyzing' ? 'Detecting...' : 'e.g. Smart Casual'
                            }
                            className="w-full px-2.5 py-1.5 text-xs bg-[#FFFEFC] border border-[#E9DFD2] rounded-lg text-[#292929]"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-[#292929] mb-1">
                      Garment Name
                    </label>
                    <input
                      type="text"
                      value={uploadForm.name}
                      disabled={uploadDrafts[0]?.status === 'analyzing'}
                      onChange={(e) => {
                        setNameAutoGenerated(false);
                        setUploadForm({ ...uploadForm, name: e.target.value });
                      }}
                      placeholder={
                        uploadDrafts[0]?.status === 'analyzing'
                          ? 'Identifying garment name...'
                          : generateSuitableGarmentName({
                              category: uploadForm.category,
                              color: uploadForm.color,
                              pattern: uploadForm.pattern,
                              style: uploadForm.style,
                            })
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F7F3ED] border border-[#E9DFD2] rounded-lg text-[#292929]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[#292929] mb-1">
                        Category
                      </label>
                      <select
                        value={uploadForm.category}
                        disabled={uploadDrafts[0]?.status === 'analyzing'}
                        onChange={(e) => {
                          const nextCategory = e.target.value as ClothingCategory;
                          setUploadForm((prev) => {
                            const shouldUpdateName = nameAutoGenerated || !prev.name.trim();
                            return {
                              ...prev,
                              category: nextCategory,
                              name: shouldUpdateName
                                ? generateSuitableGarmentName({
                                    category: nextCategory,
                                    color: prev.color,
                                    pattern: prev.pattern,
                                    style: prev.style,
                                    notes: prev.notes,
                                    filename: uploadDrafts[0]?.file.name,
                                  })
                                : prev.name,
                            };
                          });
                        }}
                        className="w-full px-3 py-2 text-sm bg-[#F7F3ED] border border-[#E9DFD2] rounded-lg text-[#292929]"
                      >
                        <option value="tops">Tops</option>
                        <option value="bottoms">Bottoms</option>
                        <option value="dresses">Dresses</option>
                        <option value="outerwear">Outerwear</option>
                        <option value="shoes">Shoes</option>
                        <option value="accessories">Accessories</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#292929] mb-1">
                        Season
                      </label>
                      <select
                        value={uploadForm.season}
                        disabled={uploadDrafts[0]?.status === 'analyzing'}
                        onChange={(e) =>
                          setUploadForm({ ...uploadForm, season: e.target.value as SeasonTag })
                        }
                        className="w-full px-3 py-2 text-sm bg-[#F7F3ED] border border-[#E9DFD2] rounded-lg text-[#292929]"
                      >
                        <option value="All-Season">All-Season</option>
                        <option value="Spring">Spring</option>
                        <option value="Summer">Summer</option>
                        <option value="Autumn">Autumn</option>
                        <option value="Winter">Winter</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[#292929] mb-1">
                        Primary Colour
                      </label>
                      <input
                        type="text"
                        value={uploadForm.color}
                        disabled={uploadDrafts[0]?.status === 'analyzing'}
                        onChange={(e) => setUploadForm({ ...uploadForm, color: e.target.value })}
                        placeholder={
                          uploadDrafts[0]?.status === 'analyzing' ? 'Detecting...' : 'e.g. Ivory'
                        }
                        className="w-full px-3 py-2 text-sm bg-[#F7F3ED] border border-[#E9DFD2] rounded-lg text-[#292929]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#292929] mb-1">
                        Pattern
                      </label>
                      <input
                        type="text"
                        value={uploadForm.pattern}
                        disabled={uploadDrafts[0]?.status === 'analyzing'}
                        onChange={(e) => setUploadForm({ ...uploadForm, pattern: e.target.value })}
                        placeholder={
                          uploadDrafts[0]?.status === 'analyzing' ? 'Detecting...' : 'e.g. Solid'
                        }
                        className="w-full px-3 py-2 text-sm bg-[#F7F3ED] border border-[#E9DFD2] rounded-lg text-[#292929]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#292929] mb-1">
                      Style
                    </label>
                    <input
                      type="text"
                      value={uploadForm.style}
                      disabled={uploadDrafts[0]?.status === 'analyzing'}
                      onChange={(e) => setUploadForm({ ...uploadForm, style: e.target.value })}
                      placeholder={
                        uploadDrafts[0]?.status === 'analyzing'
                          ? 'Detecting...'
                          : 'Minimalist, Smart Casual, Tailored...'
                      }
                      className="w-full px-3 py-2 text-sm bg-[#F7F3ED] border border-[#E9DFD2] rounded-lg text-[#292929]"
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E9DFD2]">
                <button
                  type="button"
                  onClick={closeUploadModal}
                  className="px-4 py-2 rounded-lg text-xs font-medium border border-[#E9DFD2] text-[#292929]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    uploading ||
                    uploadDrafts.length === 0 ||
                    uploadDrafts.some((d) => d.status === 'analyzing')
                  }
                  className="px-4 py-2 rounded-lg text-xs font-medium bg-[#B76545] text-[#FFFEFC] hover:bg-[#B76545]/90 disabled:opacity-50"
                >
                  {uploadDrafts.some((d) => d.status === 'analyzing')
                    ? 'Identifying Garments...'
                    : uploading
                      ? 'Saving Locally...'
                      : 'Save to Wardrobe'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-[#292929]/50 flex items-center justify-center p-4">
          <div className="bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#E9DFD2]">
              <h2 className="text-xl font-semibold text-[#292929] font-serif">
                Edit Garment Details
              </h2>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="p-1 rounded-lg text-[#85817B] hover:text-[#292929]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#292929] mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={editingItem.name}
                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-[#F7F3ED] border border-[#E9DFD2] rounded-lg text-[#292929]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#292929] mb-1">
                    Category
                  </label>
                  <select
                    value={editingItem.category}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        category: e.target.value as ClothingCategory,
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-[#F7F3ED] border border-[#E9DFD2] rounded-lg text-[#292929]"
                  >
                    <option value="tops">Tops</option>
                    <option value="bottoms">Bottoms</option>
                    <option value="dresses">Dresses</option>
                    <option value="outerwear">Outerwear</option>
                    <option value="shoes">Shoes</option>
                    <option value="accessories">Accessories</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#292929] mb-1">
                    Season
                  </label>
                  <select
                    value={editingItem.season}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        season: e.target.value as SeasonTag,
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-[#F7F3ED] border border-[#E9DFD2] rounded-lg text-[#292929]"
                  >
                    <option value="All-Season">All-Season</option>
                    <option value="Spring">Spring</option>
                    <option value="Summer">Summer</option>
                    <option value="Autumn">Autumn</option>
                    <option value="Winter">Winter</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#292929] mb-1">
                    Primary Colour
                  </label>
                  <input
                    type="text"
                    value={editingItem.color}
                    onChange={(e) => setEditingItem({ ...editingItem, color: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-[#F7F3ED] border border-[#E9DFD2] rounded-lg text-[#292929]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#292929] mb-1">
                    Secondary Colour
                  </label>
                  <input
                    type="text"
                    value={editingItem.secondary_color}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, secondary_color: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm bg-[#F7F3ED] border border-[#E9DFD2] rounded-lg text-[#292929]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#292929] mb-1">Pattern</label>
                  <input
                    type="text"
                    value={editingItem.pattern}
                    onChange={(e) => setEditingItem({ ...editingItem, pattern: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-[#F7F3ED] border border-[#E9DFD2] rounded-lg text-[#292929]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#292929] mb-1">Style</label>
                  <input
                    type="text"
                    value={editingItem.style}
                    onChange={(e) => setEditingItem({ ...editingItem, style: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-[#F7F3ED] border border-[#E9DFD2] rounded-lg text-[#292929]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E9DFD2]">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 rounded-lg text-xs font-medium border border-[#E9DFD2] text-[#292929]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 rounded-lg text-xs font-medium bg-[#292929] text-[#FFFEFC]"
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
