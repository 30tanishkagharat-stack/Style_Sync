import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Heart,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api';
import type { CalendarEntry, ClothingItem, Outfit, WearHistoryEntry } from '../types';
import { GarmentImage } from './GarmentImage';

interface WearCalendarViewProps {
  onNotify: (message: string, type?: 'success' | 'error') => void;
}

export function WearCalendarView({ onNotify }: WearCalendarViewProps) {
  const [history, setHistory] = useState<WearHistoryEntry[]>([]);
  const [mostWorn, setMostWorn] = useState<ClothingItem[]>([]);
  const [leastWorn, setLeastWorn] = useState<ClothingItem[]>([]);
  const [wardrobe, setWardrobe] = useState<ClothingItem[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [calendarEntries, setCalendarEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingDateFav, setTogglingDateFav] = useState<string | null>(null);

  const getLocalToday = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };
  const todayStr = getLocalToday();

  // Calendar month navigation
  const [currentMonth, setCurrentMonth] = useState(() => todayStr.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(() => todayStr);

  // Plan modal state
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<CalendarEntry | null>(null);
  const [planForm, setPlanForm] = useState({
    planned_date: todayStr,
    title: '',
    occasion: 'Office',
    outfit_id: '' as string,
    item_ids: [] as number[],
    notes: '',
  });
  const [savingPlan, setSavingPlan] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [wearRes, calRes, wardRes, outfitRes] = await Promise.all([
        api.getWearHistory(),
        api.listCalendar(currentMonth),
        api.listWardrobe(),
        api.listOutfits(),
      ]);
      setHistory(wearRes.history);
      setMostWorn(wearRes.mostWorn);
      setLeastWorn(wearRes.leastWorn);
      setCalendarEntries(calRes.entries);
      setWardrobe(wardRes.items);
      setOutfits(outfitRes.outfits);
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [currentMonth]);

  const shiftMonth = (delta: number) => {
    const [y, m] = currentMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const openNewPlanModal = (dateStr: string) => {
    const validDate = dateStr < todayStr ? todayStr : dateStr;
    setEditingPlan(null);
    setPlanForm({
      planned_date: validDate,
      title: '',
      occasion: 'Office',
      outfit_id: '',
      item_ids: [],
      notes: '',
    });
    setPlanModalOpen(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (planForm.planned_date < todayStr) {
      onNotify('You can only plan a look for today or upcoming days.', 'error');
      return;
    }
    if (!planForm.title.trim()) {
      onNotify('Enter a title for this planned outfit.', 'error');
      return;
    }
    setSavingPlan(true);
    try {
      const payload = {
        planned_date: planForm.planned_date,
        title: planForm.title,
        occasion: planForm.occasion,
        outfit_id: planForm.outfit_id ? Number(planForm.outfit_id) : null,
        item_ids: planForm.item_ids,
        notes: planForm.notes,
      };
      if (editingPlan) {
        await api.updateCalendarEntry(editingPlan.id, payload);
        onNotify('Updated planned outfit.', 'success');
      } else {
        await api.createCalendarEntry(payload);
        onNotify(`Planned outfit for ${planForm.planned_date}.`, 'success');
      }
      setPlanModalOpen(false);
      await loadAll();
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setSavingPlan(false);
    }
  };

  const handleDeleteWear = async (id: number) => {
    try {
      await api.deleteWearHistory(id);
      onNotify('Removed wear history entry.', 'success');
      await loadAll();
    } catch (err) {
      onNotify((err as Error).message, 'error');
    }
  };

  // Calendar Grid Computation
  const [yearNum, monthNum] = currentMonth.split('-').map(Number);
  const firstDay = new Date(yearNum, monthNum - 1, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
  const monthLabel = firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const datePlansMap = new Map<string, CalendarEntry[]>();
  for (const entry of calendarEntries) {
    const arr = datePlansMap.get(entry.planned_date) || [];
    arr.push(entry);
    datePlansMap.set(entry.planned_date, arr);
  }

  const dateWornMap = new Map<string, WearHistoryEntry[]>();
  for (const h of history) {
    const arr = dateWornMap.get(h.worn_date) || [];
    arr.push(h);
    dateWornMap.set(h.worn_date, arr);
  }

  const getWornOutfitInfoForDate = (dateStr: string) => {
    const worn = dateWornMap.get(dateStr) || [];
    if (worn.length === 0) return null;

    const linkedOutfitId = worn.find((w) => w.outfit_id !== null)?.outfit_id ?? null;
    const itemIds = Array.from(
      new Set(
        worn
          .map((w) => w.clothing_item_id)
          .filter((id): id is number => id !== null)
      )
    );

    let matchedOutfit: Outfit | undefined;
    if (linkedOutfitId !== null) {
      matchedOutfit = outfits.find((o) => o.id === linkedOutfitId);
    }

    const sortedWornKey = [...itemIds].sort((a, b) => a - b).join(',');
    if (!matchedOutfit && sortedWornKey) {
      matchedOutfit = outfits.find((o) => {
        const key = o.items
          .map((i) => i.id)
          .sort((a, b) => a - b)
          .join(',');
        return key === sortedWornKey;
      });
    }

    const wardrobeById = new Map(wardrobe.map((item) => [item.id, item]));
    const pieces =
      itemIds.length > 0
        ? itemIds
            .map((id) => {
              const fromWardrobe = wardrobeById.get(id);
              if (fromWardrobe) return fromWardrobe;
              const entry = worn.find((w) => w.clothing_item_id === id);
              if (!entry) return null;
              return {
                id,
                name: entry.clothing_name || 'Garment',
                image_path: entry.clothing_image_path || '',
              };
            })
            .filter((p): p is { id: number; name: string; image_path: string } => p !== null)
        : (matchedOutfit?.items || []).map((i) => ({
            id: i.id,
            name: i.name,
            image_path: i.image_path,
          }));

    const occasion = worn[0]?.occasion || matchedOutfit?.occasion || 'Daily';
    const isFavourite = Boolean(matchedOutfit?.is_favourite);

    return {
      dateStr,
      worn,
      itemIds,
      pieces,
      occasion,
      matchedOutfit,
      isFavourite,
    };
  };

  const handleToggleDayOutfitFavourite = async (dateStr: string) => {
    const info = getWornOutfitInfoForDate(dateStr);
    if (!info) return;

    setTogglingDateFav(dateStr);
    try {
      let targetOutfit = info.matchedOutfit;

      if (!targetOutfit) {
        if (info.itemIds.length === 0) {
          onNotify('No wardrobe items found on this day to save as a whole outfit.', 'error');
          return;
        }
        const [y, m, d] = dateStr.split('-').map(Number);
        const prettyDate = new Date(y, m - 1, d).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        const created = await api.saveOutfit({
          name: `${info.occasion} Look (${prettyDate})`,
          occasion: info.occasion,
          reasoning: `Whole outfit worn on ${prettyDate}.`,
          source: 'manual',
          item_ids: info.itemIds,
        });
        targetOutfit = created.outfit;
      }

      const res = await api.toggleFavourite('outfit', targetOutfit.id);
      const refreshedOutfits = await api.listOutfits();
      setOutfits(refreshedOutfits.outfits);

      onNotify(
        res.isFavourite
          ? `Added "${targetOutfit.name}" to Favourite Outfits.`
          : `Removed "${targetOutfit.name}" from Favourite Outfits.`,
        'success'
      );
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setTogglingDateFav(null);
    }
  };

  const selectedWornInfo = getWornOutfitInfoForDate(selectedDate);

  return (
    <div className="space-y-6">
      {/* Top Analytics: Most Worn & Least Worn */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl p-5">
          <h2 className="text-lg font-semibold text-[#292929] font-serif mb-3 pb-2 border-b border-[#E9DFD2]">
            Most-Worn Pieces
          </h2>
          {mostWorn.length === 0 ? (
            <p className="text-xs text-[#85817B] py-4">No garments in wardrobe yet.</p>
          ) : (
            <div className="divide-y divide-[#E9DFD2]">
              {mostWorn.slice(0, 4).map((item) => (
                <div key={item.id} className="py-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-11 rounded overflow-hidden border border-[#E9DFD2] shrink-0">
                      <GarmentImage src={item.image_path} alt={item.name} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[#292929] truncate">{item.name}</p>
                      <p className="text-[11px] text-[#85817B] capitalize truncate">
                        {item.category} · {item.color}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono tabular-nums font-semibold text-[#292929] shrink-0">
                    {item.wear_count} wears
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl p-5">
          <h2 className="text-lg font-semibold text-[#292929] font-serif mb-3 pb-2 border-b border-[#E9DFD2]">
            Least-Worn Pieces
          </h2>
          {leastWorn.length === 0 ? (
            <p className="text-xs text-[#85817B] py-4">No garments in wardrobe yet.</p>
          ) : (
            <div className="divide-y divide-[#E9DFD2]">
              {leastWorn.slice(0, 4).map((item) => (
                <div key={item.id} className="py-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-11 rounded overflow-hidden border border-[#E9DFD2] shrink-0">
                      <GarmentImage src={item.image_path} alt={item.name} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[#292929] truncate">{item.name}</p>
                      <p className="text-[11px] text-[#85817B] capitalize truncate">
                        {item.category} · {item.color}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-[#B76545] font-medium shrink-0">
                    {item.wear_count} wears
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Interactive Outfit Calendar */}
      <section>
        <div className="bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E9DFD2]">
            <h2 className="text-xl font-semibold text-[#292929] font-serif">{monthLabel}</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                aria-label="Previous month"
                className="p-1.5 rounded-lg border border-[#E9DFD2] hover:bg-[#F7F3ED]"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                aria-label="Next month"
                className="p-1.5 rounded-lg border border-[#E9DFD2] hover:bg-[#F7F3ED]"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => openNewPlanModal(selectedDate)}
                className="ml-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#B76545] text-[#FFFEFC] hover:bg-[#B76545]/90 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                Plan Look
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-[#85817B] mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: startWeekday }).map((_, i) => (
              <div key={`empty-${i}`} className="h-16 rounded-lg bg-[#F7F3ED]/40" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
              const plans = datePlansMap.get(dateStr) || [];
              const worn = dateWornMap.get(dateStr) || [];
              const wornInfo = worn.length > 0 ? getWornOutfitInfoForDate(dateStr) : null;
              const isPast = dateStr < todayStr;
              const canSelect = !isPast || worn.length > 0;
              const isSelected = selectedDate === dateStr && canSelect;
              return (
                <div
                  key={dateStr}
                  role="button"
                  tabIndex={canSelect ? 0 : -1}
                  aria-disabled={!canSelect}
                  onClick={() => {
                    if (canSelect) setSelectedDate(dateStr);
                  }}
                  onKeyDown={(e) => {
                    if (canSelect && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      setSelectedDate(dateStr);
                    }
                  }}
                  className={`h-16 rounded-lg border p-1.5 text-left flex flex-col justify-between transition-colors ${
                    !canSelect
                      ? 'border-[#E9DFD2]/70 bg-[#F7F3ED]/60 opacity-55 cursor-not-allowed'
                      : isSelected
                        ? 'border-[#B76545] bg-[#B76545]/10 cursor-pointer'
                        : isPast
                          ? 'border-[#E9DFD2] bg-[#F7F3ED]/70 hover:bg-[#F7F3ED] cursor-pointer'
                          : 'border-[#E9DFD2] bg-[#FFFEFC] hover:bg-[#F7F3ED] cursor-pointer'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`text-xs font-mono tabular-nums font-medium ${
                        isPast ? 'text-[#85817B]' : 'text-[#292929]'
                      }`}
                    >
                      {day}
                    </span>
                    {wornInfo && (
                      <button
                        type="button"
                        disabled={togglingDateFav === dateStr}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDate(dateStr);
                          void handleToggleDayOutfitFavourite(dateStr);
                        }}
                        aria-label={
                          wornInfo.isFavourite
                            ? `Remove whole outfit worn on ${dateStr} from favourites`
                            : `Favourite whole outfit worn on ${dateStr}`
                        }
                        title={
                          wornInfo.isFavourite
                            ? 'Whole outfit favourited (click to remove)'
                            : 'Favourite whole outfit worn on this day'
                        }
                        className="p-0.5 rounded hover:bg-[#E9DFD2]/60 transition-colors"
                      >
                        <Heart
                          className={`w-3.5 h-3.5 ${
                            wornInfo.isFavourite
                              ? 'fill-[#B76545] text-[#B76545]'
                              : 'text-[#85817B] hover:text-[#B76545]'
                          }`}
                        />
                      </button>
                    )}
                  </div>
                  <div className="text-[10px] leading-tight truncate">
                    {plans.length > 0 && (
                      <span className="block text-[#B76545] font-medium truncate">
                        {plans.length} planned
                      </span>
                    )}
                    {worn.length > 0 && (
                      <span className="block text-[#85817B] truncate">{worn.length} worn</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {selectedWornInfo && (
            <div className="mt-4 pt-4 border-t border-[#E9DFD2] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-semibold text-[#292929]">
                    Outfit worn on{' '}
                    <span className="font-mono tabular-nums">{selectedWornInfo.dateStr}</span>
                  </p>
                  <span className="text-xs text-[#85817B]">
                    · {selectedWornInfo.occasion} · {selectedWornInfo.pieces.length} piece
                    {selectedWornInfo.pieces.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedWornInfo.pieces.map((piece) => (
                    <div
                      key={piece.id}
                      className="inline-flex items-center gap-2 pr-2.5 py-1 pl-1 rounded-lg bg-[#F7F3ED] border border-[#E9DFD2]"
                    >
                      <div className="w-7 h-9 rounded overflow-hidden border border-[#E9DFD2] shrink-0">
                        <GarmentImage src={piece.image_path} alt={piece.name} />
                      </div>
                      <span className="text-xs text-[#292929] font-medium max-w-[140px] truncate">
                        {piece.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                disabled={togglingDateFav === selectedWornInfo.dateStr}
                onClick={() => handleToggleDayOutfitFavourite(selectedWornInfo.dateStr)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  selectedWornInfo.isFavourite
                    ? 'bg-[#292929] text-[#FFFEFC] hover:bg-[#292929]/90'
                    : 'bg-[#B76545] text-[#FFFEFC] hover:bg-[#B76545]/90'
                } disabled:opacity-50`}
              >
                <Heart
                  className={`w-3.5 h-3.5 ${selectedWornInfo.isFavourite ? 'fill-[#FFFEFC]' : ''}`}
                />
                {togglingDateFav === selectedWornInfo.dateStr
                  ? 'Updating...'
                  : selectedWornInfo.isFavourite
                    ? 'Favourited Whole Outfit'
                    : 'Favourite Whole Outfit'}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Full Chronological Wear History Log */}
      <section className="bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-[#E9DFD2]">
          <div>
            <h2 className="text-xl font-semibold text-[#292929] font-serif">
              Wear History
            </h2>
          </div>
        </div>

        {loading ? (
          <p className="text-xs text-[#85817B]">Loading wear history...</p>
        ) : history.length === 0 ? (
          <div className="py-8 text-center">
            <CalendarIcon className="w-8 h-8 text-[#85817B] mx-auto mb-2 stroke-[1.5]" />
            <p className="text-sm text-[#85817B]">
              No wear history recorded yet. Mark an outfit or garment as worn to start tracking.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E9DFD2] text-[#85817B]">
                  <th className="py-2.5 pr-4 font-medium">Date</th>
                  <th className="py-2.5 pr-4 font-medium">Garment / Outfit</th>
                  <th className="py-2.5 pr-4 font-medium">Occasion</th>
                  <th className="py-2.5 pr-4 font-medium">Notes</th>
                  <th className="py-2.5 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E9DFD2]">
                {history.map((entry) => (
                  <tr key={entry.id} className="hover:bg-[#F7F3ED]/60">
                    <td className="py-2.5 pr-4 font-mono tabular-nums text-[#292929] whitespace-nowrap">
                      {entry.worn_date}
                    </td>
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2.5">
                        {entry.clothing_image_path && (
                          <div className="w-7 h-9 rounded overflow-hidden border border-[#E9DFD2] shrink-0">
                            <GarmentImage
                              src={entry.clothing_image_path}
                              alt={entry.clothing_name || 'Garment'}
                            />
                          </div>
                        )}
                        <span className="font-medium text-[#292929]">
                          {entry.clothing_name || entry.outfit_name || 'Outfit'}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-[#85817B]">{entry.occasion}</td>
                    <td className="py-2.5 pr-4 text-[#85817B]">{entry.notes || '—'}</td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteWear(entry.id)}
                        className="p-1 text-[#85817B] hover:text-red-700"
                        aria-label="Delete wear entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Plan / Edit Calendar Outfit Modal */}
      {planModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#292929]/50 flex items-center justify-center p-4">
          <div className="bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#E9DFD2]">
              <h2 className="text-xl font-semibold text-[#292929] font-serif">
                {editingPlan ? 'Edit Planned Outfit' : 'Plan Future Outfit'}
              </h2>
              <button
                type="button"
                onClick={() => setPlanModalOpen(false)}
                className="p-1 text-[#85817B] hover:text-[#292929]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#292929] mb-1">Date</label>
                  <input
                    type="date"
                    required
                    min={todayStr}
                    value={planForm.planned_date}
                    onChange={(e) => setPlanForm({ ...planForm, planned_date: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-[#F7F3ED] border border-[#E9DFD2] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#292929] mb-1">Occasion</label>
                  <input
                    type="text"
                    value={planForm.occasion}
                    onChange={(e) => setPlanForm({ ...planForm, occasion: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-[#F7F3ED] border border-[#E9DFD2] rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#292929] mb-1">Look Title</label>
                <input
                  type="text"
                  required
                  value={planForm.title}
                  onChange={(e) => setPlanForm({ ...planForm, title: e.target.value })}
                  placeholder="e.g. Client Presentation Look"
                  className="w-full px-3 py-2 text-sm bg-[#F7F3ED] border border-[#E9DFD2] rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#292929] mb-1.5">
                  Pick clothes to wear
                </label>
                <div className="max-h-44 overflow-y-auto border border-[#E9DFD2] rounded-lg p-2 space-y-1 bg-[#F7F3ED]/50">
                  {wardrobe.length === 0 ? (
                    <p className="text-xs text-[#85817B] p-2">
                      You have no clothes added yet. Go to My Wardrobe to add your items first.
                    </p>
                  ) : (
                    wardrobe.map((item) => {
                      const checked = planForm.item_ids.includes(item.id);
                      const simpleType =
                        item.category === 'tops'
                          ? 'Top / Shirt'
                          : item.category === 'bottoms'
                            ? 'Pants / Skirt'
                            : item.category === 'outerwear'
                              ? 'Coat / Jacket'
                              : item.category === 'dresses'
                                ? 'Dress'
                                : item.category === 'shoes'
                                  ? 'Shoes'
                                  : 'Bag / Extra';
                      return (
                        <label
                          key={item.id}
                          className="flex items-center gap-2.5 p-1.5 rounded hover:bg-[#FFFEFC] cursor-pointer text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setPlanForm({
                                ...planForm,
                                item_ids: checked
                                  ? planForm.item_ids.filter((id) => id !== item.id)
                                  : [...planForm.item_ids, item.id],
                              })
                            }
                            className="accent-[#B76545]"
                          />
                          <span className="font-medium text-[#292929]">{item.name}</span>
                          <span className="text-[#85817B]">({simpleType})</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#292929] mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={planForm.notes}
                  onChange={(e) => setPlanForm({ ...planForm, notes: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-[#F7F3ED] border border-[#E9DFD2] rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E9DFD2]">
                <button
                  type="button"
                  onClick={() => setPlanModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium border border-[#E9DFD2]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPlan}
                  className="px-4 py-2 rounded-lg text-xs font-medium bg-[#B76545] text-[#FFFEFC]"
                >
                  {savingPlan ? 'Saving...' : 'Save Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
