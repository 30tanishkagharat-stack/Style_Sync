import {
  AlertCircle,
  History,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api';
import type {
  ChatMessage,
  GenerationHistoryEntry,
  OccasionType,
  OutfitSuggestionDraft,
} from '../types';
import { GarmentImage } from './GarmentImage';
import { OutfitCard, draftToOutfitProps } from './OutfitCard';

interface AiStudioViewProps {
  onNotify: (message: string, type?: 'success' | 'error') => void;
}

type StudioTab = 'outfits' | 'history' | 'chat';

const OCCASIONS: OccasionType[] = ['College', 'Casual', 'Office', 'Party', 'Travel', 'Custom'];

export function AiStudioView({ onNotify }: AiStudioViewProps) {
  const [activeTab, setActiveTab] = useState<StudioTab>('outfits');

  // --- Tab 2: Outfit Recommendation ---
  const [occasion, setOccasion] = useState<OccasionType>('Office');
  const [customOccasion, setCustomOccasion] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [includeWeather, setIncludeWeather] = useState(true);
  const [recOutfitsLoading, setRecOutfitsLoading] = useState(false);
  const [outfitsSource, setOutfitsSource] = useState<'gemma' | 'local-fallback' | null>(null);
  const [outfitsModelUsed, setOutfitsModelUsed] = useState<string>('');
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [suggestedOutfits, setSuggestedOutfits] = useState<OutfitSuggestionDraft[]>([]);
  const [outfitActionBusy, setOutfitActionBusy] = useState<string | null>(null);
  const [historyEntries, setHistoryEntries] = useState<GenerationHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyBusy, setHistoryBusy] = useState(false);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await api.listGenerationHistory();
      setHistoryEntries(res.history);
    } catch {
      // ignore initial history load error if unauthenticated/transient
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    void loadHistory();
  }, []);

  const handleGenerateOutfits = async () => {
    const resolvedOccasion =
      occasion === 'Custom' ? customOccasion.trim() || 'Custom Occasion' : occasion;
    setRecOutfitsLoading(true);
    setFallbackNotice(null);
    try {
      const res = await api.recommendOutfits({
        occasion: resolvedOccasion,
        customPrompt,
        includeWeather,
      });
      setSuggestedOutfits(res.outfits);
      setOutfitsSource(res.source);
      setOutfitsModelUsed(res.modelUsed || res.modelAttempted || '');
      if (res.historyEntry) {
        setHistoryEntries((prev) => [res.historyEntry!, ...prev].slice(0, 30));
      } else {
        void loadHistory();
      }
      if (res.source === 'local-fallback' && res.fallbackReason) {
        setFallbackNotice(
          `Gemma (${res.modelAttempted}) unavailable: ${res.fallbackReason}. Using deterministic local style matching over your real wardrobe.`
        );
      }
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setRecOutfitsLoading(false);
    }
  };

  const ensureOutfitMaterialized = async (draft: OutfitSuggestionDraft): Promise<number> => {
    if (draft.savedOutfitId) return draft.savedOutfitId;
    const res = await api.saveOutfit({
      name: draft.name,
      occasion: draft.occasion,
      reasoning: draft.reasoning,
      source: draft.source,
      weather_context: draft.weatherContext || '',
      item_ids: draft.items.map((i) => i.id),
    });
    setSuggestedOutfits((prev) =>
      prev.map((o) => (o.tempId === draft.tempId ? { ...o, savedOutfitId: res.outfit.id } : o))
    );
    setHistoryEntries((prev) =>
      prev.map((entry) => ({
        ...entry,
        outfits: entry.outfits.map((o) =>
          o.tempId === draft.tempId ? { ...o, savedOutfitId: res.outfit.id } : o
        ),
      }))
    );
    return res.outfit.id;
  };

  const handleFavouriteDraft = async (draft: OutfitSuggestionDraft) => {
    setOutfitActionBusy(draft.tempId);
    try {
      const outfitId = await ensureOutfitMaterialized(draft);
      const favRes = await api.toggleFavourite('outfit', outfitId);
      setSuggestedOutfits((prev) =>
        prev.map((o) =>
          o.tempId === draft.tempId ? { ...o, isFavourite: favRes.isFavourite } : o
        )
      );
      setHistoryEntries((prev) =>
        prev.map((entry) => ({
          ...entry,
          outfits: entry.outfits.map((o) =>
            o.tempId === draft.tempId ? { ...o, isFavourite: favRes.isFavourite } : o
          ),
        }))
      );
      onNotify(
        favRes.isFavourite ? `"${draft.name}" added to Favourites.` : 'Removed from Favourites.',
        'success'
      );
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setOutfitActionBusy(null);
    }
  };

  const handleMarkDraftWorn = async (draft: OutfitSuggestionDraft) => {
    setOutfitActionBusy(draft.tempId);
    try {
      const outfitId = await ensureOutfitMaterialized(draft);
      await api.markOutfitWorn(outfitId, {
        occasion: draft.occasion,
        notes: `Styled via ${draft.source === 'gemma' ? 'Gemma AI' : 'Local Style Engine'}`,
      });
      onNotify(`Logged "${draft.name}" as worn today.`, 'success');
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setOutfitActionBusy(null);
    }
  };

  const handleLoadHistoryEntry = (entry: GenerationHistoryEntry) => {
    setSuggestedOutfits(entry.outfits);
    setOutfitsSource(entry.source);
    setOutfitsModelUsed(entry.model_used);
    setFallbackNotice(null);
    if (OCCASIONS.includes(entry.occasion as OccasionType)) {
      setOccasion(entry.occasion as OccasionType);
      setCustomOccasion('');
    } else {
      setOccasion('Custom');
      setCustomOccasion(entry.occasion);
    }
    setActiveTab('outfits');
    onNotify(`Loaded ${entry.occasion} outfits from history.`, 'success');
  };

  const handleDeleteHistoryEntry = async (id: number) => {
    setHistoryBusy(true);
    try {
      await api.deleteGenerationHistory(id);
      setHistoryEntries((prev) => prev.filter((e) => e.id !== id));
      onNotify('Removed generation history entry.', 'success');
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setHistoryBusy(false);
    }
  };

  const handleClearHistory = async () => {
    setHistoryBusy(true);
    try {
      await api.clearGenerationHistory();
      setHistoryEntries([]);
      onNotify('Cleared outfit generation history.', 'success');
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setHistoryBusy(false);
    }
  };

  // --- Tab 3: Fashion Chat ---
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const sendChat = async (promptText?: string) => {
    const text = (promptText ?? chatInput).trim();
    if (!text) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextHistory = [...chatMessages, userMsg];
    setChatMessages(nextHistory);
    if (!promptText) setChatInput('');
    setChatLoading(true);
    setChatError(null);

    try {
      const res = await api.sendFashionChat({
        message: text,
        history: nextHistory.map((m) => ({ role: m.role, content: m.content })),
      });
      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        referencedItems: res.referencedItems,
        modelUsed: res.modelUsed,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setChatError((err as Error).message);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Combined Module Navigation Bar */}
      <div className="bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl p-2 inline-flex flex-wrap gap-1.5">

        <button
          type="button"
          onClick={() => setActiveTab('outfits')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'outfits'
              ? 'bg-[#292929] text-[#FFFEFC]'
              : 'text-[#292929] hover:bg-[#F7F3ED]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Outfit Recommendation
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'history'
              ? 'bg-[#292929] text-[#FFFEFC]'
              : 'text-[#292929] hover:bg-[#F7F3ED]'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          History ({historyEntries.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'chat'
              ? 'bg-[#292929] text-[#FFFEFC]'
              : 'text-[#292929] hover:bg-[#F7F3ED]'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Fashion Chat
        </button>
      </div>

      {/* OUTFIT RECOMMENDATION */}
      {activeTab === 'outfits' && (
        <div className="space-y-6">
          <div className="bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-[#292929] font-serif">
                  Outfit Recommendation Studio
                </h2>
              </div>
              {outfitsSource && (
                <span className="text-xs font-medium text-[#85817B]">
                  Source:{' '}
                  <strong className="text-[#292929]">
                    {outfitsSource === 'gemma' ? outfitsModelUsed : 'Local Style Engine'}
                  </strong>
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {OCCASIONS.map((occ) => (
                <button
                  key={occ}
                  type="button"
                  onClick={() => setOccasion(occ)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    occasion === occ
                      ? 'bg-[#292929] text-[#FFFEFC]'
                      : 'bg-[#F7F3ED] text-[#292929] hover:bg-[#E9DFD2]'
                  }`}
                >
                  {occ}
                </button>
              ))}
            </div>

            {occasion === 'Custom' && (
              <input
                type="text"
                value={customOccasion}
                onChange={(e) => setCustomOccasion(e.target.value)}
                placeholder="Enter custom occasion (e.g. Gallery Opening, Weekend Brunch)..."
                className="w-full px-3 py-2 text-sm bg-[#F7F3ED] border border-[#E9DFD2] rounded-lg text-[#292929]"
              />
            )}

            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Optional styling preference (e.g. relaxed layering, highlight my rust dress)..."
                className="flex-1 min-w-[240px] px-3 py-2 text-sm bg-[#F7F3ED] border border-[#E9DFD2] rounded-lg text-[#292929]"
              />

              <label className="inline-flex items-center gap-2 text-xs text-[#292929] cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={includeWeather}
                  onChange={(e) => setIncludeWeather(e.target.checked)}
                  className="accent-[#B76545] rounded"
                />
                Factor live local weather
              </label>

              <button
                type="button"
                onClick={handleGenerateOutfits}
                disabled={recOutfitsLoading}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-medium bg-[#B76545] text-[#FFFEFC] hover:bg-[#B76545]/90 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {recOutfitsLoading ? 'Composing Outfits...' : 'Generate Outfits'}
              </button>
            </div>

            {fallbackNotice && (
              <div className="p-3.5 rounded-lg bg-[#F7F3ED] border border-[#B76545]/40 text-xs text-[#292929] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-[#B76545] shrink-0 mt-0.5" />
                <span>{fallbackNotice}</span>
              </div>
            )}
          </div>

          {recOutfitsLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-96 bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : suggestedOutfits.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {suggestedOutfits.map((draft) => (
                <OutfitCard
                  key={draft.tempId}
                  {...draftToOutfitProps(draft)}
                  compact
                  busy={outfitActionBusy === draft.tempId}
                  onFavourite={() => handleFavouriteDraft(draft)}
                  onMarkWorn={() => handleMarkDraftWorn(draft)}
                />
              ))}
            </div>
          ) : (
            <div className="bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl p-12 text-center">
              <Sparkles className="w-9 h-9 text-[#85817B] mx-auto mb-3 stroke-[1.5]" />
              <h3 className="text-lg font-semibold text-[#292929] font-serif mb-1">
                Ready to compose from your wardrobe
              </h3>
              <p className="text-sm text-[#85817B] max-w-md mx-auto">
                Select an occasion above and click Generate Outfits. Every recommendation uses only existing pieces in your database.
              </p>
              {historyEntries.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium border border-[#E9DFD2] text-[#292929] hover:bg-[#F7F3ED] transition-colors"
                >
                  <History className="w-3.5 h-3.5 text-[#B76545]" />
                  View Generation History ({historyEntries.length})
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* GENERATION HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          <div className="bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl p-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold text-[#292929] font-serif">
                Outfit Generation History
              </h2>
              <p className="text-xs text-[#85817B] mt-0.5">
                Every outfit generation run from AI Studio and Weather Stylist is automatically recorded here.
              </p>
            </div>

            {historyEntries.length > 0 && (
              <button
                type="button"
                onClick={handleClearHistory}
                disabled={historyBusy}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border border-[#E9DFD2] text-[#85817B] hover:text-red-700 hover:bg-red-50 transition-colors whitespace-nowrap shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear History
              </button>
            )}
          </div>

          {historyLoading ? (
            <div className="space-y-4">
              {[1, 2].map((n) => (
                <div key={n} className="h-56 bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : historyEntries.length === 0 ? (
            <div className="bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl p-12 text-center">
              <History className="w-9 h-9 text-[#85817B] mx-auto mb-3 stroke-[1.5]" />
              <h3 className="text-lg font-semibold text-[#292929] font-serif mb-1">
                No outfit generations yet
              </h3>
              <p className="text-sm text-[#85817B] max-w-md mx-auto">
                Generate outfits in the studio or weather stylist and your past runs will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {historyEntries.map((entry) => (
                <section
                  key={entry.id}
                  className="bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl p-5 space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[#E9DFD2]">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#85817B] mb-1">
                        <span className="font-medium text-[#292929]">{entry.occasion}</span>
                      </div>
                      {entry.custom_prompt && (
                        <p className="text-xs text-[#85817B]">Prompt: &ldquo;{entry.custom_prompt}&rdquo;</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleLoadHistoryEntry(entry)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#292929] text-[#FFFEFC] hover:bg-[#292929]/90 transition-colors whitespace-nowrap shrink-0"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Load in Studio
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteHistoryEntry(entry.id)}
                        disabled={historyBusy}
                        aria-label="Delete history entry"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#85817B] hover:text-red-700 hover:bg-red-50 transition-colors whitespace-nowrap shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {entry.outfits.map((draft) => (
                      <OutfitCard
                        key={draft.tempId}
                        {...draftToOutfitProps(draft)}
                        compact
                        busy={outfitActionBusy === draft.tempId}
                        onFavourite={() => handleFavouriteDraft(draft)}
                        onMarkWorn={() => handleMarkDraftWorn(draft)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: FASHION CHAT */}
      {activeTab === 'chat' && (
        <div className="bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl flex flex-col h-[620px]">
          <div className="p-5 border-b border-[#E9DFD2] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-[#292929] font-serif">
                Gemma Personal Stylist
              </h2>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                'What should I wear to the office today?',
                'Which pieces have I worn the least?',
                'Style my rust dress for autumn',
              ].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendChat(q)}
                  disabled={chatLoading}
                  className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-[#F7F3ED] text-[#292929] hover:bg-[#E9DFD2] transition-colors whitespace-nowrap"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {chatMessages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
                <MessageSquare className="w-9 h-9 text-[#85817B] mb-3 stroke-[1.5]" />
                <h3 className="text-lg font-semibold text-[#292929] font-serif mb-1">
                  Ask about your wardrobe
                </h3>
                <p className="text-sm text-[#85817B]">
                  Ask Gemma how to pair specific garments, build a packing list, or dress for today&apos;s weather using only the clothes you own.
                </p>
              </div>
            )}

            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-2xl rounded-xl p-4 ${
                    msg.role === 'user'
                      ? 'bg-[#292929] text-[#FFFEFC]'
                      : 'bg-[#F7F3ED] border border-[#E9DFD2] text-[#292929]'
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>

                  {msg.referencedItems && msg.referencedItems.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[#E9DFD2] grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {msg.referencedItems.map((item) => (
                        <div
                          key={item.id}
                          className="bg-[#FFFEFC] border border-[#E9DFD2] rounded-lg p-2"
                        >
                          <div className="aspect-[3/4] rounded overflow-hidden mb-1.5">
                            <GarmentImage src={item.image_path} alt={item.name} />
                          </div>
                          <p className="text-[11px] font-medium text-[#292929] truncate">
                            {item.name}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <p
                    className={`text-[11px] mt-2 ${
                      msg.role === 'user' ? 'text-[#FFFEFC]/70' : 'text-[#85817B]'
                    }`}
                  >
                    {msg.timestamp}
                    {msg.modelUsed ? ` · ${msg.modelUsed}` : ''}
                  </p>
                </div>
              </div>
            ))}

            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-[#F7F3ED] border border-[#E9DFD2] rounded-xl px-4 py-3 text-xs text-[#85817B] inline-flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#B76545]" />
                  Consulting your wardrobe with Gemma...
                </div>
              </div>
            )}

            {chatError && (
              <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Gemma chat unavailable</p>
                  <p className="mt-0.5">{chatError}</p>
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendChat();
            }}
            className="p-4 border-t border-[#E9DFD2] flex items-center gap-2"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask your Gemma stylist about outfits from your wardrobe..."
              className="flex-1 px-3.5 py-2.5 text-sm bg-[#F7F3ED] border border-[#E9DFD2] rounded-lg text-[#292929] placeholder:text-[#85817B] focus:outline-none focus:border-[#B76545]"
            />
            <button
              type="submit"
              disabled={chatLoading || !chatInput.trim()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium bg-[#B76545] text-[#FFFEFC] hover:bg-[#B76545]/90 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
