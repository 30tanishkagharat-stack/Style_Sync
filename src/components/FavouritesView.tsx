import { Check, Heart, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api';
import type { ClothingCategory, ClothingItem, Outfit } from '../types';
import { GarmentImage } from './GarmentImage';
import { OutfitCard, savedToOutfitProps } from './OutfitCard';

interface FavouritesViewProps {
  onNotify: (message: string, type?: 'success' | 'error') => void;
}

const SIMPLE_CATEGORY_LABEL: Record<ClothingCategory, string> = {
  tops: 'Top / Shirt',
  bottoms: 'Pants / Skirt',
  dresses: 'Dress',
  outerwear: 'Coat / Jacket',
  shoes: 'Shoes',
  accessories: 'Bag / Extra',
};

const OCCASIONS = ['Casual', 'Office', 'College', 'Party', 'Travel'];

export function FavouritesView({ onNotify }: FavouritesViewProps) {
  const [clothing, setClothing] = useState<ClothingItem[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [filter, setFilter] = useState<'all' | 'clothing' | 'outfits'>('all');
  const [loading, setLoading] = useState(true);

  // Add Favourite Outfit modal state
  const [showAddOutfit, setShowAddOutfit] = useState(false);
  const [modalTab, setModalTab] = useState<'build' | 'saved'>('build');
  const [modalLoading, setModalLoading] = useState(false);
  const [wardrobeItems, setWardrobeItems] = useState<ClothingItem[]>([]);
  const [savedOutfits, setSavedOutfits] = useState<Outfit[]>([]);
  const [savingOutfit, setSavingOutfit] = useState(false);
  const [outfitForm, setOutfitForm] = useState({
    name: '',
    occasion: 'Casual',
    reasoning: '',
    item_ids: [] as number[],
  });

  const loadFavourites = async () => {
    setLoading(true);
    try {
      const res = await api.listFavourites();
      setClothing(res.clothing);
      setOutfits(res.outfits);
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFavourites();
  }, []);

  const openAddOutfitModal = async () => {
    setShowAddOutfit(true);
    setModalTab('build');
    setOutfitForm({
      name: '',
      occasion: 'Casual',
      reasoning: '',
      item_ids: [],
    });
    setModalLoading(true);
    try {
      const [wardRes, outfitRes] = await Promise.all([api.listWardrobe(), api.listOutfits()]);
      setWardrobeItems(wardRes.items);
      setSavedOutfits(outfitRes.outfits.filter((o) => !o.is_favourite));
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const togglePickedPiece = (id: number) => {
    setOutfitForm((prev) => ({
      ...prev,
      item_ids: prev.item_ids.includes(id)
        ? prev.item_ids.filter((x) => x !== id)
        : [...prev.item_ids, id],
    }));
  };

  const handleSaveFavouriteOutfit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outfitForm.name.trim()) {
      onNotify('Please give your outfit a name.', 'error');
      return;
    }
    if (outfitForm.item_ids.length === 0) {
      onNotify('Pick at least one piece from your wardrobe to form the outfit.', 'error');
      return;
    }

    setSavingOutfit(true);
    try {
      const created = await api.saveOutfit({
        name: outfitForm.name.trim(),
        occasion: outfitForm.occasion,
        reasoning: outfitForm.reasoning.trim(),
        source: 'manual',
        item_ids: outfitForm.item_ids,
      });
      await api.toggleFavourite('outfit', created.outfit.id);
      setShowAddOutfit(false);
      onNotify(`Added "${created.outfit.name}" to Favourite Outfits.`, 'success');
      await loadFavourites();
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setSavingOutfit(false);
    }
  };

  const handleFavouriteSavedOutfit = async (saved: Outfit) => {
    setSavingOutfit(true);
    try {
      await api.toggleFavourite('outfit', saved.id);
      setSavedOutfits((prev) => prev.filter((o) => o.id !== saved.id));
      onNotify(`Added "${saved.name}" to Favourite Outfits.`, 'success');
      await loadFavourites();
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setSavingOutfit(false);
    }
  };

  const handleRemoveClothingFav = async (item: ClothingItem) => {
    try {
      await api.toggleFavourite('clothing', item.id);
      setClothing((prev) => prev.filter((c) => c.id !== item.id));
      onNotify(`Removed "${item.name}" from Favourites.`, 'success');
    } catch (err) {
      onNotify((err as Error).message, 'error');
    }
  };

  const handleRemoveOutfitFav = async (outfit: Outfit) => {
    try {
      await api.toggleFavourite('outfit', outfit.id);
      setOutfits((prev) => prev.filter((o) => o.id !== outfit.id));
      onNotify(`Removed "${outfit.name}" from Favourites.`, 'success');
    } catch (err) {
      onNotify((err as Error).message, 'error');
    }
  };

  const handleMarkItemWorn = async (item: ClothingItem) => {
    try {
      await api.logWear({ clothing_item_ids: [item.id], occasion: 'Daily' });
      setClothing((prev) =>
        prev.map((c) => (c.id === item.id ? { ...c, wear_count: c.wear_count + 1 } : c))
      );
      onNotify(`Logged wear for "${item.name}".`, 'success');
    } catch (err) {
      onNotify((err as Error).message, 'error');
    }
  };

  const handleMarkOutfitWorn = async (outfit: Outfit) => {
    try {
      await api.markOutfitWorn(outfit.id, { occasion: outfit.occasion });
      onNotify(`Logged "${outfit.name}" as worn today.`, 'success');
    } catch (err) {
      onNotify((err as Error).message, 'error');
    }
  };

  const totalCount = clothing.length + outfits.length;

  return (
    <div className="space-y-6">
      <div className="bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {[
            { id: 'all', label: `All (${totalCount})` },
            { id: 'clothing', label: `Clothing (${clothing.length})` },
            { id: 'outfits', label: `Outfits (${outfits.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id as 'all' | 'clothing' | 'outfits')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                filter === tab.id
                  ? 'bg-[#292929] text-[#FFFEFC]'
                  : 'bg-[#F7F3ED] text-[#292929] hover:bg-[#E9DFD2]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-80 bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : totalCount === 0 ? (
        <div className="bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl p-12 text-center">
          <Heart className="w-9 h-9 text-[#85817B] mx-auto mb-3 stroke-[1.5]" />
          <h3 className="text-xl font-semibold text-[#292929] font-serif mb-1">
            No favourites saved yet
          </h3>
          <p className="text-sm text-[#85817B] max-w-md mx-auto mb-5">
            Combine pieces from your wardrobe into a complete favourite outfit, or heart items in My Wardrobe and AI Studio.
          </p>
          <button
            type="button"
            onClick={openAddOutfitModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-[#B76545] text-[#FFFEFC] hover:bg-[#B76545]/90"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Favourite Outfit
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {(filter === 'all' || filter === 'outfits') && outfits.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-[#292929] font-serif">
                Favourite Outfits
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {outfits.map((outfit) => (
                  <OutfitCard
                    key={outfit.id}
                    {...savedToOutfitProps(outfit)}
                    onFavourite={() => handleRemoveOutfitFav(outfit)}
                    onMarkWorn={() => handleMarkOutfitWorn(outfit)}
                  />
                ))}
              </div>
            </section>
          )}

          {(filter === 'all' || filter === 'clothing') && clothing.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-[#292929] font-serif">
                Favourite Pieces
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {clothing.map((item) => (
                  <article
                    key={item.id}
                    className="bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl overflow-hidden flex flex-col"
                  >
                    <div className="aspect-[3/4] relative bg-[#F7F3ED]">
                      <GarmentImage src={item.image_path} alt={item.name} />
                      <button
                        type="button"
                        onClick={() => handleRemoveClothingFav(item)}
                        aria-label={`Remove ${item.name} from favourites`}
                        className="absolute top-3 right-3 p-2 rounded-lg bg-[#FFFEFC]/95 border border-[#B76545] text-[#B76545]"
                      >
                        <Heart className="w-4 h-4 fill-[#B76545]" />
                      </button>
                    </div>
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-[#292929] truncate mb-1">
                          {item.name}
                        </h3>
                        <p className="text-xs text-[#85817B] capitalize truncate">
                          {item.category} · {item.color} · {item.season}
                        </p>
                      </div>
                      <div className="pt-3 mt-3 border-t border-[#E9DFD2] flex items-center justify-between">
                        <span className="text-xs text-[#85817B] tabular-nums">
                          {item.wear_count} wears
                        </span>
                        <button
                          type="button"
                          onClick={() => handleMarkItemWorn(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-[#F7F3ED] text-[#292929] hover:bg-[#E9DFD2]"
                        >
                          <Check className="w-3.5 h-3.5 text-[#B76545]" />
                          Mark Worn
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Add Favourite Whole Outfit Modal */}
      {showAddOutfit && (
        <div className="fixed inset-0 z-50 bg-[#292929]/50 flex items-center justify-center p-4">
          <div className="bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#E9DFD2]">
              <div>
                <h2 className="text-xl font-semibold text-[#292929] font-serif">
                  Add Favourite Outfit
                </h2>
                <p className="text-xs text-[#85817B]">
                  Save a complete outfit (top, bottom, shoes, outerwear, accessories) directly to Favourites.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddOutfit(false)}
                className="p-1 rounded-lg text-[#85817B] hover:text-[#292929]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {savedOutfits.length > 0 && (
              <div className="inline-flex p-1 rounded-lg bg-[#F7F3ED] border border-[#E9DFD2] mb-5">
                <button
                  type="button"
                  onClick={() => setModalTab('build')}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    modalTab === 'build'
                      ? 'bg-[#292929] text-[#FFFEFC]'
                      : 'text-[#292929] hover:text-[#B76545]'
                  }`}
                >
                  Create New Outfit
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab('saved')}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    modalTab === 'saved'
                      ? 'bg-[#292929] text-[#FFFEFC]'
                      : 'text-[#292929] hover:text-[#B76545]'
                  }`}
                >
                  From Saved Outfits ({savedOutfits.length})
                </button>
              </div>
            )}

            {modalLoading ? (
              <div className="py-12 text-center text-xs text-[#85817B]">
                Loading your wardrobe...
              </div>
            ) : modalTab === 'saved' && savedOutfits.length > 0 ? (
              <div className="space-y-3">
                {savedOutfits.map((saved) => (
                  <div
                    key={saved.id}
                    className="p-4 rounded-xl border border-[#E9DFD2] bg-[#F7F3ED]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-[#85817B]">
                        {saved.occasion} · {saved.items.length} pieces
                      </p>
                      <h3 className="text-base font-semibold text-[#292929] font-serif truncate">
                        {saved.name}
                      </h3>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {saved.items.map((item) => (
                          <div
                            key={item.id}
                            className="w-10 h-13 rounded overflow-hidden border border-[#E9DFD2]"
                            title={item.name}
                          >
                            <GarmentImage src={item.image_path} alt={item.name} />
                          </div>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={savingOutfit}
                      onClick={() => handleFavouriteSavedOutfit(saved)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-[#B76545] text-[#FFFEFC] hover:bg-[#B76545]/90 whitespace-nowrap shrink-0"
                    >
                      <Heart className="w-3.5 h-3.5" />
                      Add to Favourites
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <form onSubmit={handleSaveFavouriteOutfit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#292929] mb-1">
                      Outfit Name
                    </label>
                    <input
                      type="text"
                      required
                      value={outfitForm.name}
                      onChange={(e) => setOutfitForm({ ...outfitForm, name: e.target.value })}
                      placeholder="e.g. Everyday Smart Casual"
                      className="w-full px-3 py-2 text-sm bg-[#F7F3ED] border border-[#E9DFD2] rounded-lg text-[#292929]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#292929] mb-1">
                      Occasion
                    </label>
                    <select
                      value={outfitForm.occasion}
                      onChange={(e) => setOutfitForm({ ...outfitForm, occasion: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-[#F7F3ED] border border-[#E9DFD2] rounded-lg text-[#292929]"
                    >
                      {OCCASIONS.map((occ) => (
                        <option key={occ} value={occ}>
                          {occ}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-[#292929]">
                      Pick clothes for this whole outfit
                    </label>
                    <span className="text-xs text-[#85817B] tabular-nums">
                      {outfitForm.item_ids.length} selected
                    </span>
                  </div>

                  {wardrobeItems.length === 0 ? (
                    <div className="p-6 text-center rounded-lg border border-[#E9DFD2] bg-[#F7F3ED]/50 text-xs text-[#85817B]">
                      Your wardrobe is empty. Add garments in My Wardrobe first to combine them into an outfit.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto p-2 rounded-lg border border-[#E9DFD2] bg-[#F7F3ED]/50">
                      {wardrobeItems.map((item) => {
                        const selected = outfitForm.item_ids.includes(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => togglePickedPiece(item.id)}
                            className={`text-left p-2 rounded-lg border transition-colors flex items-center gap-2.5 ${
                              selected
                                ? 'border-[#B76545] bg-[#FFFEFC]'
                                : 'border-[#E9DFD2] bg-[#FFFEFC]/70 hover:border-[#292929]/30'
                            }`}
                          >
                            <div className="w-10 h-13 rounded overflow-hidden border border-[#E9DFD2] shrink-0 bg-[#F7F3ED]">
                              <GarmentImage src={item.image_path} alt={item.name} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-[#292929] truncate">
                                {item.name}
                              </p>
                              <p className="text-[11px] text-[#85817B] truncate">
                                {SIMPLE_CATEGORY_LABEL[item.category] || item.category}
                              </p>
                            </div>
                            <div
                              className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                                selected
                                  ? 'bg-[#B76545] border-[#B76545] text-[#FFFEFC]'
                                  : 'border-[#E9DFD2] bg-[#F7F3ED]'
                              }`}
                            >
                              {selected && <Check className="w-3 h-3" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#292929] mb-1">
                    Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={outfitForm.reasoning}
                    onChange={(e) => setOutfitForm({ ...outfitForm, reasoning: e.target.value })}
                    placeholder="e.g. Clean neutral layering for cool mornings"
                    className="w-full px-3 py-2 text-sm bg-[#F7F3ED] border border-[#E9DFD2] rounded-lg text-[#292929]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-[#E9DFD2]">
                  <button
                    type="button"
                    onClick={() => setShowAddOutfit(false)}
                    className="px-4 py-2 rounded-lg text-xs font-medium border border-[#E9DFD2] text-[#292929]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingOutfit || wardrobeItems.length === 0}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-[#B76545] text-[#FFFEFC] hover:bg-[#B76545]/90 disabled:opacity-50"
                  >
                    <Heart className="w-3.5 h-3.5" />
                    {savingOutfit ? 'Saving...' : 'Save to Favourites'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
