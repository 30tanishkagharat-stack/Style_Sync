import {
  AlertCircle,
  Cloud,
  CloudRain,
  CloudSun,
  Droplets,
  History,
  MapPin,
  RefreshCw,
  Search,
  Sparkles,
  Sun,
  Trash2,
  Wind,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api';
import type {
  CitySearchResult,
  GenerationHistoryEntry,
  OutfitSuggestionDraft,
  WeatherReport,
} from '../types';
import { OutfitCard, draftToOutfitProps } from './OutfitCard';

interface WeatherAssistantViewProps {
  onNotify: (message: string, type?: 'success' | 'error') => void;
}

function formatForecastDate(dateStr: string, index: number): string {
  if (index === 0) return 'Today';
  if (index === 1) return 'Tomorrow';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function ForecastConditionIcon({ condition }: { condition: string }) {
  const lower = condition.toLowerCase();
  if (lower.includes('rain') || lower.includes('drizzle') || lower.includes('shower') || lower.includes('thunder')) {
    return <CloudRain className="w-4 h-4 text-[#B76545] shrink-0" />;
  }
  if (lower.includes('clear') || lower.includes('sunny')) {
    return <Sun className="w-4 h-4 text-[#B76545] shrink-0" />;
  }
  if (lower.includes('overcast') || lower.includes('cloud') || lower.includes('fog')) {
    return <Cloud className="w-4 h-4 text-[#85817B] shrink-0" />;
  }
  return <CloudSun className="w-4 h-4 text-[#B76545] shrink-0" />;
}

export function WeatherAssistantView({ onNotify }: WeatherAssistantViewProps) {
  const [cityQuery, setCityQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CitySearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [weather, setWeather] = useState<WeatherReport | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  const [occasion, setOccasion] = useState('Daily Weather-Ready');
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [outfits, setOutfits] = useState<OutfitSuggestionDraft[]>([]);
  const [busyCard, setBusyCard] = useState<string | null>(null);
  const [weatherHistory, setWeatherHistory] = useState<GenerationHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const loadWeatherHistory = async () => {
    try {
      const res = await api.listGenerationHistory();
      setWeatherHistory(
        res.history.filter((entry) => entry.custom_prompt.startsWith('Weather-matched'))
      );
    } catch {
      // ignore non-fatal history load error
    }
  };

  const loadForecast = async (
    params?: { city?: string; lat?: number; lon?: number },
    silent = false
  ) => {
    if (!silent) {
      setWeatherLoading(true);
    }
    setWeatherError(null);
    try {
      const res = await api.getWeatherForecast(params);
      setWeather(res.weather);
    } catch (err) {
      if (!silent) {
        setWeatherError((err as Error).message);
      }
    } finally {
      if (!silent) {
        setWeatherLoading(false);
      }
    }
  };

  useEffect(() => {
    loadForecast();
    void loadWeatherHistory();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!document.hidden) {
        void loadForecast(
          weather
            ? { city: weather.city, lat: weather.latitude, lon: weather.longitude }
            : undefined,
          true
        );
      }
    }, 5 * 60 * 1000);

    const handleVisibility = () => {
      if (!document.hidden && weather) {
        const ageMs = Date.now() - new Date(weather.fetchedAt).getTime();
        if (ageMs > 2 * 60 * 1000) {
          void loadForecast(
            { city: weather.city, lat: weather.latitude, lon: weather.longitude },
            true
          );
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [weather?.city, weather?.latitude, weather?.longitude, weather?.fetchedAt]);

  const handleSearchCity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cityQuery.trim()) return;
    setSearching(true);
    try {
      const res = await api.searchCities(cityQuery);
      if (res.results.length === 0) {
        setSearchResults([]);
        onNotify(`No cities matched "${cityQuery}".`, 'error');
      } else if (res.results.length === 1) {
        await handleSelectAndSaveCity(res.results[0]);
      } else {
        setSearchResults(res.results);
      }
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectAndSaveCity = async (city: CitySearchResult) => {
    setSearchResults([]);
    setCityQuery('');
    try {
      await api.updateSettings({
        settings: {
          preferred_city: city.name,
          preferred_lat: city.latitude,
          preferred_lon: city.longitude,
        },
      });
      onNotify(`Saved ${city.name}, ${city.country} as your preferred city.`, 'success');
      await loadForecast({ city: city.name, lat: city.latitude, lon: city.longitude });
    } catch (err) {
      onNotify((err as Error).message, 'error');
    }
  };

  const handleSuggestOutfits = async () => {
    setSuggestLoading(true);
    try {
      const res = await api.suggestWeatherOutfits({
        city: weather?.city,
        lat: weather?.latitude,
        lon: weather?.longitude,
        occasion,
      });
      setWeather(res.weather);
      setOutfits(res.outfits);
      if (res.historyEntry) {
        setWeatherHistory((prev) => [res.historyEntry!, ...prev].slice(0, 20));
      } else {
        void loadWeatherHistory();
      }
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setSuggestLoading(false);
    }
  };

  const ensureOutfitMaterialized = async (draft: OutfitSuggestionDraft) => {
    if (draft.savedOutfitId) return draft.savedOutfitId;
    const res = await api.saveOutfit({
      name: draft.name,
      occasion: draft.occasion,
      reasoning: draft.reasoning,
      source: draft.source,
      weather_context: draft.weatherContext || '',
      item_ids: draft.items.map((i) => i.id),
    });
    setOutfits((prev) =>
      prev.map((o) => (o.tempId === draft.tempId ? { ...o, savedOutfitId: res.outfit.id } : o))
    );
    setWeatherHistory((prev) =>
      prev.map((entry) => ({
        ...entry,
        outfits: entry.outfits.map((o) =>
          o.tempId === draft.tempId ? { ...o, savedOutfitId: res.outfit.id } : o
        ),
      }))
    );
    return res.outfit.id;
  };

  const handleFavourite = async (draft: OutfitSuggestionDraft) => {
    setBusyCard(draft.tempId);
    try {
      const id = await ensureOutfitMaterialized(draft);
      const fav = await api.toggleFavourite('outfit', id);
      setOutfits((prev) =>
        prev.map((o) => (o.tempId === draft.tempId ? { ...o, isFavourite: fav.isFavourite } : o))
      );
      setWeatherHistory((prev) =>
        prev.map((entry) => ({
          ...entry,
          outfits: entry.outfits.map((o) =>
            o.tempId === draft.tempId ? { ...o, isFavourite: fav.isFavourite } : o
          ),
        }))
      );
      onNotify(fav.isFavourite ? 'Added to Favourites.' : 'Removed from Favourites.', 'success');
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setBusyCard(null);
    }
  };

  const handleWear = async (draft: OutfitSuggestionDraft) => {
    setBusyCard(draft.tempId);
    try {
      const id = await ensureOutfitMaterialized(draft);
      await api.markOutfitWorn(id, {
        occasion: draft.occasion,
        notes: draft.weatherContext || '',
      });
      onNotify(`Marked "${draft.name}" as worn today.`, 'success');
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setBusyCard(null);
    }
  };

  const handleDeleteHistory = async (id: number) => {
    try {
      await api.deleteGenerationHistory(id);
      setWeatherHistory((prev) => prev.filter((e) => e.id !== id));
      onNotify('Deleted history entry.', 'success');
    } catch (err) {
      onNotify((err as Error).message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* City Search Bar */}
      <div className="bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl p-5">
        <form onSubmit={handleSearchCity} className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-[#85817B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={cityQuery}
              onChange={(e) => setCityQuery(e.target.value)}
              placeholder="Search and save city (e.g. Tokyo, London, Paris, Mumbai)..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-[#F7F3ED] border border-[#E9DFD2] rounded-lg text-[#292929]"
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-[#292929] text-[#FFFEFC] hover:bg-[#292929]/90 whitespace-nowrap shrink-0"
          >
            {searching ? 'Searching...' : 'Find City'}
          </button>
        </form>

        {searchResults.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[#E9DFD2] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {searchResults.map((city) => (
              <button
                key={city.id}
                type="button"
                onClick={() => handleSelectAndSaveCity(city)}
                className="text-left p-2.5 rounded-lg border border-[#E9DFD2] hover:border-[#B76545] hover:bg-[#F7F3ED] transition-colors"
              >
                <p className="text-xs font-semibold text-[#292929] flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#B76545] shrink-0" />
                  <span className="truncate">{city.name}</span>
                </p>
                <p className="text-[11px] text-[#85817B] truncate pl-5">
                  {[city.admin1, city.country].filter(Boolean).join(', ')}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Live Weather + Forecast */}
      {weatherLoading ? (
        <div className="h-56 bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl animate-pulse" />
      ) : weatherError ? (
        <div className="bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl p-8 text-center">
          <AlertCircle className="w-8 h-8 text-[#B76545] mx-auto mb-2" />
          <p className="text-sm font-medium text-[#292929] mb-1">
            Live weather could not be loaded
          </p>
          <p className="text-xs text-[#85817B] mb-4">{weatherError}</p>
          <button
            type="button"
            onClick={() => loadForecast()}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-[#292929] text-[#FFFEFC]"
          >
            Retry
          </button>
        </div>
      ) : weather ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-xs text-[#85817B]">
                  Live Weather · Updated{' '}
                  {new Date(weather.fetchedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    loadForecast({
                      city: weather.city,
                      lat: weather.latitude,
                      lon: weather.longitude,
                    })
                  }
                  aria-label="Refresh live weather"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#85817B] hover:text-[#292929]"
                >
                  <RefreshCw className="w-3 h-3" />
                  Refresh
                </button>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-semibold text-[#292929] font-serif">
                    {weather.city}
                    {weather.country ? (
                      <span className="text-base font-sans font-normal text-[#85817B] ml-2">
                        {weather.country}
                      </span>
                    ) : null}
                  </h2>
                  <p className="text-sm text-[#85817B]">{weather.current.condition}</p>
                </div>
                <p className="text-5xl font-semibold text-[#292929] font-mono tabular-nums">
                  {weather.current.temperature}°{weather.current.unit}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-5 mt-5 border-t border-[#E9DFD2] text-xs">
              <div>
                <span className="text-[#85817B] flex items-center gap-1 mb-1">
                  <CloudSun className="w-3.5 h-3.5 text-[#B76545]" /> Feels Like
                </span>
                <span className="text-base font-semibold text-[#292929] font-mono tabular-nums">
                  {weather.current.apparentTemperature}°{weather.current.unit}
                </span>
              </div>
              <div>
                <span className="text-[#85817B] flex items-center gap-1 mb-1">
                  <Droplets className="w-3.5 h-3.5 text-[#B76545]" /> Humidity
                </span>
                <span className="text-base font-semibold text-[#292929] font-mono tabular-nums">
                  {weather.current.humidity}%
                </span>
              </div>
              <div>
                <span className="text-[#85817B] flex items-center gap-1 mb-1">
                  <Wind className="w-3.5 h-3.5 text-[#B76545]" /> Wind
                </span>
                <span className="text-base font-semibold text-[#292929] font-mono tabular-nums">
                  {weather.current.windSpeed} {weather.current.unit === 'F' ? 'mph' : 'km/h'}
                </span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className="text-lg font-semibold text-[#292929] font-serif">
                {weather.daily.length > 0
                  ? `${weather.daily.length}-Day Forecast`
                  : 'Multi-Day Forecast'}
              </h3>
              <span className="text-[11px] text-[#85817B]">
                Humidity · Low / High ({weather.current.unit === 'F' ? '°F' : '°C'})
              </span>
            </div>

            {weather.daily.length > 0 ? (
              <div className="divide-y divide-[#E9DFD2]">
                {weather.daily.map((day, idx) => (
                  <div
                    key={day.date}
                    className="py-2.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="font-medium text-[#292929] w-28 shrink-0">
                      {formatForecastDate(day.date, idx)}
                    </span>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <ForecastConditionIcon condition={day.condition} />
                      <span className="text-[#292929] truncate">{day.condition}</span>
                    </div>
                    <span
                      title="Average Humidity"
                      className="text-[#85817B] inline-flex items-center gap-1 tabular-nums shrink-0"
                    >
                      <Droplets className="w-3 h-3 text-[#B76545]" />
                      {day.humidity ?? day.precipitationProbability}%
                    </span>
                    <span className="font-mono tabular-nums font-medium text-[#292929] w-24 text-right shrink-0">
                      {day.tempMin}° / {day.tempMax}°{weather.current.unit}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#85817B] py-6 text-center">
                Multi-day forecast data is currently unavailable for this location.
              </p>
            )}
          </div>
        </div>
      ) : null}

      {/* Weather-Matched Outfit Generator */}
      <div className="bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-[#292929] font-serif">
              Weather Outfit Suggestions
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={occasion}
              onChange={(e) => setOccasion(e.target.value)}
              className="px-3 py-2 text-xs font-medium bg-[#F7F3ED] border border-[#E9DFD2] rounded-lg text-[#292929]"
            >
              <option value="Daily Weather-Ready">Daily Weather-Ready</option>
              <option value="Office">Office</option>
              <option value="Casual">Casual</option>
              <option value="College">College</option>
              <option value="Travel">Travel</option>
            </select>

            <button
              type="button"
              onClick={handleSuggestOutfits}
              disabled={suggestLoading || !weather}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-[#B76545] text-[#FFFEFC] hover:bg-[#B76545]/90 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {suggestLoading ? 'Styling for Weather...' : 'Suggest Weather Outfits'}
            </button>

            {weatherHistory.length > 0 && (
              <button
                type="button"
                onClick={() => setShowHistory((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-[#E9DFD2] text-[#292929] hover:bg-[#F7F3ED] whitespace-nowrap shrink-0"
              >
                <History className="w-3.5 h-3.5 text-[#B76545]" />
                {showHistory ? 'Hide History' : `History (${weatherHistory.length})`}
              </button>
            )}
          </div>
        </div>
      </div>

      {outfits.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {outfits.map((draft) => (
            <OutfitCard
              key={draft.tempId}
              {...draftToOutfitProps(draft)}
              compact
              busy={busyCard === draft.tempId}
              onFavourite={() => handleFavourite(draft)}
              onMarkWorn={() => handleWear(draft)}
              onRegenerate={handleSuggestOutfits}
            />
          ))}
        </div>
      )}

      {showHistory && weatherHistory.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-[#292929] font-serif">
            Weather Generation History
          </h3>
          {weatherHistory.map((entry) => (
            <section
              key={entry.id}
              className="bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E9DFD2]">
                <p className="text-xs text-[#85817B]">
                  <span className="font-medium text-[#292929]">{entry.occasion}</span>
                  {entry.weather_context ? ` · ${entry.weather_context}` : ''}
                  {' · '}
                  {new Date(entry.created_at).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                <button
                  type="button"
                  onClick={() => handleDeleteHistory(entry.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-[#85817B] hover:text-red-700 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {entry.outfits.map((draft) => (
                  <OutfitCard
                    key={draft.tempId}
                    {...draftToOutfitProps(draft)}
                    compact
                    busy={busyCard === draft.tempId}
                    onFavourite={() => handleFavourite(draft)}
                    onMarkWorn={() => handleWear(draft)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
