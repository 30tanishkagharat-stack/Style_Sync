import { Check, Heart, RefreshCw, Trash2 } from 'lucide-react';
import type { ClothingItem, Outfit, OutfitSuggestionDraft } from '../types';
import { GarmentImage } from './GarmentImage';

interface OutfitCardProps {
  title: string;
  occasion: string;
  reasoning: string;
  stylingTip?: string;
  source: 'gemma' | 'local-fallback' | 'manual';
  weatherContext?: string;
  items: ClothingItem[];
  isFavourite?: boolean;
  busy?: boolean;
  compact?: boolean;
  onFavourite?: () => void;
  onMarkWorn?: () => void;
  onRegenerate?: () => void;
  onDelete?: () => void;
}

export function OutfitCard({
  title,
  occasion,
  reasoning,
  stylingTip,
  source,
  weatherContext,
  items,
  isFavourite,
  busy,
  compact = false,
  onFavourite,
  onMarkWorn,
  onRegenerate,
  onDelete,
}: OutfitCardProps) {
  const sourceLabel =
    source === 'gemma'
      ? 'Gemma AI'
      : source === 'local-fallback'
        ? 'Local Style Engine'
        : 'Curated Look';

  return (
    <article className="bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl p-5 flex flex-col justify-between transition-transform duration-150 hover:-translate-y-0.5">
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            {!compact && (
              <p className="text-xs text-[#85817B] tracking-wide mb-1">
                <span>{occasion}</span>
                <span aria-hidden="true" className="mx-1.5">·</span>
                <span>{sourceLabel}</span>
                {weatherContext ? (
                  <>
                    <span aria-hidden="true" className="mx-1.5">·</span>
                    <span>{weatherContext}</span>
                  </>
                ) : null}
              </p>
            )}
            <h3 className="text-xl font-semibold text-[#292929] font-serif leading-snug">
              {title}
            </h3>
          </div>

          {onFavourite && (
            <button
              type="button"
              onClick={onFavourite}
              disabled={busy}
              aria-label={isFavourite ? 'Remove outfit from favourites' : 'Add outfit to favourites'}
              className={`p-2 rounded-lg border transition-colors shrink-0 ${
                isFavourite
                  ? 'border-[#B76545] bg-[#B76545]/10 text-[#B76545]'
                  : 'border-[#E9DFD2] text-[#85817B] hover:text-[#292929] hover:border-[#292929]/30'
              }`}
            >
              <Heart className={`w-4 h-4 ${isFavourite ? 'fill-[#B76545]' : ''}`} />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          {items.map((item) => (
            <div key={item.id} className="group">
              <div className="aspect-[3/4] rounded-lg overflow-hidden border border-[#E9DFD2] mb-1.5 bg-[#F7F3ED]">
                <GarmentImage src={item.image_path} alt={item.name} />
              </div>
              <p className="text-xs font-medium text-[#292929] truncate">{item.name}</p>
              {!compact && (
                <p className="text-[11px] text-[#85817B] truncate capitalize">
                  {item.category} · {item.color}
                </p>
              )}
            </div>
          ))}
        </div>

        {!compact && reasoning && (
          <p className="text-sm text-[#292929]/85 leading-relaxed mb-2">{reasoning}</p>
        )}
        {!compact && stylingTip && (
          <p className="text-xs text-[#85817B] leading-relaxed mb-4">
            Styling note: {stylingTip}
          </p>
        )}
      </div>

      <div className="pt-3 border-t border-[#E9DFD2] flex flex-wrap items-center gap-2">
        {onMarkWorn && (
          <button
            type="button"
            onClick={onMarkWorn}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#B76545] text-[#FFFEFC] hover:bg-[#B76545]/90 transition-colors whitespace-nowrap shrink-0"
          >
            <Check className="w-3.5 h-3.5" />
            Mark as Worn
          </button>
        )}

        {onRegenerate && (
          <button
            type="button"
            onClick={onRegenerate}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#E9DFD2] text-[#292929] hover:bg-[#F7F3ED] transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Regenerate
          </button>
        )}

        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="ml-auto inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#85817B] hover:text-red-700 hover:bg-red-50 transition-colors whitespace-nowrap shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Remove
          </button>
        )}
      </div>
    </article>
  );
}

export function draftToOutfitProps(draft: OutfitSuggestionDraft) {
  return {
    title: draft.name,
    occasion: draft.occasion,
    reasoning: draft.reasoning,
    stylingTip: draft.stylingTip,
    source: draft.source,
    weatherContext: draft.weatherContext,
    items: draft.items,
    isFavourite: Boolean(draft.isFavourite),
  };
}

export function savedToOutfitProps(outfit: Outfit) {
  return {
    title: outfit.name,
    occasion: outfit.occasion,
    reasoning: outfit.reasoning,
    source: outfit.source,
    weatherContext: outfit.weather_context,
    items: outfit.items,
    isFavourite: Boolean(outfit.is_favourite),
  };
}
