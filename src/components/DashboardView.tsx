import {
  ArrowRight,
  Calendar,
  CloudSun,
  Heart,
  Layers,
  Sparkles,
  Upload,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api';
import type { DashboardData, WeatherReport } from '../types';
import { GarmentImage } from './GarmentImage';

export type NavModule =
  | 'dashboard'
  | 'wardrobe'
  | 'ai-studio'
  | 'weather'
  | 'favourites'
  | 'calendar'
  | 'settings';

interface DashboardViewProps {
  onNavigate: (module: NavModule) => void;
  onNotify: (message: string, type?: 'success' | 'error') => void;
}

export function DashboardView({ onNavigate, onNotify }: DashboardViewProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [weather, setWeather] = useState<WeatherReport | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dailySaving, setDailySaving] = useState(false);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const res = await api.getDashboard();
      setData(res);
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadWeather = async () => {
    try {
      setWeatherError(null);
      const res = await api.getWeatherForecast();
      setWeather(res.weather);
    } catch (err) {
      setWeatherError((err as Error).message);
    }
  };

  useEffect(() => {
    loadDashboard();
    loadWeather();
  }, []);

  const handleWearDaily = async () => {
    if (!data?.dailySuggestion) return;
    setDailySaving(true);
    try {
      const itemIds = data.dailySuggestion.items.map((i) => i.id);
      await api.logWear({
        clothing_item_ids: itemIds,
        occasion: data.dailySuggestion.occasion,
        notes: `Daily look: ${data.dailySuggestion.name}`,
      });
      onNotify('Daily outfit logged to your wear history.', 'success');
      await loadDashboard();
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setDailySaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-28 bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-80 bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl" />
          <div className="h-80 bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl" />
        </div>
      </div>
    );
  }

  const stats = data?.stats || {
    totalClothing: 0,
    totalOutfits: 0,
    totalFavourites: 0,
    totalWears: 0,
    totalGenerations: 0,
  };

  return (
    <div className="space-y-8">
      {/* Real SQLite Statistics Row */}
      <section aria-label="Wardrobe metrics" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl p-5">
          <p className="text-xs font-medium text-[#85817B] tracking-wide mb-2">
            Wardrobe Pieces
          </p>
          <p className="text-3xl font-semibold text-[#292929] font-serif tabular-nums">
            {stats.totalClothing}
          </p>
          <p className="text-xs text-[#85817B] mt-1">Catalogued in SQLite</p>
        </div>

        <div className="bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl p-5">
          <p className="text-xs font-medium text-[#85817B] tracking-wide mb-2">
            Generated History
          </p>
          <p className="text-3xl font-semibold text-[#292929] font-serif tabular-nums">
            {stats.totalGenerations ?? 0}
          </p>
          <p className="text-xs text-[#85817B] mt-1">Recorded outfit runs</p>
        </div>

        <div className="bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl p-5">
          <p className="text-xs font-medium text-[#85817B] tracking-wide mb-2">
            Favourites
          </p>
          <p className="text-3xl font-semibold text-[#B76545] font-serif tabular-nums">
            {stats.totalFavourites}
          </p>
          <p className="text-xs text-[#85817B] mt-1">Pinned pieces & looks</p>
        </div>

        <div className="bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl p-5">
          <p className="text-xs font-medium text-[#85817B] tracking-wide mb-2">
            Logged Wears
          </p>
          <p className="text-3xl font-semibold text-[#292929] font-serif tabular-nums">
            {stats.totalWears}
          </p>
          <p className="text-xs text-[#85817B] mt-1">Recorded outfit entries</p>
        </div>
      </section>

      {/* Main Split: Daily Outfit Suggestion + Weather & Quick Actions */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Daily Outfit Suggestion */}
        <div className="lg:col-span-2 bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-[#E9DFD2]">
            <div>
              <p className="text-xs text-[#85817B] mb-1">Daily Editorial Selection</p>
              <h2 className="text-2xl font-semibold text-[#292929] font-serif">
                Today&apos;s Outfit Suggestion
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('ai-studio')}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#B76545] hover:text-[#292929] transition-colors whitespace-nowrap shrink-0"
            >
              Open Gemma Stylist
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {data?.dailySuggestion ? (
            <div>
              <div className="mb-4">
                <p className="text-xs text-[#85817B] mb-1">
                  {data.dailySuggestion.occasion} · {data.dailySuggestion.items.length} pieces
                </p>
                <h3 className="text-xl font-semibold text-[#292929] font-serif">
                  {data.dailySuggestion.name}
                </h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {data.dailySuggestion.items.map((item) => (
                  <div key={item.id}>
                    <div className="aspect-[3/4] rounded-lg overflow-hidden border border-[#E9DFD2] mb-2">
                      <GarmentImage src={item.image_path} alt={item.name} />
                    </div>
                    <p className="text-xs font-medium text-[#292929] truncate">{item.name}</p>
                    <p className="text-[11px] text-[#85817B] capitalize truncate">
                      {item.category} · {item.color}
                    </p>
                  </div>
                ))}
              </div>

              <p className="text-sm text-[#292929]/85 leading-relaxed mb-4">
                {data.dailySuggestion.reasoning}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-[#E9DFD2]">
                <button
                  type="button"
                  onClick={handleWearDaily}
                  disabled={dailySaving}
                  className="px-4 py-2 rounded-lg text-xs font-medium bg-[#B76545] text-[#FFFEFC] hover:bg-[#B76545]/90 transition-colors whitespace-nowrap shrink-0"
                >
                  Wear Today
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('ai-studio')}
                  className="px-4 py-2 rounded-lg text-xs font-medium border border-[#E9DFD2] text-[#292929] hover:bg-[#F7F3ED] transition-colors whitespace-nowrap shrink-0"
                >
                  Generate with Gemma
                </button>
              </div>
            </div>
          ) : (
            <div className="py-10 text-center">
              <Layers className="w-9 h-9 text-[#85817B] mx-auto mb-3 stroke-[1.5]" />
              <h3 className="text-lg font-semibold text-[#292929] font-serif mb-1">
                Your digital wardrobe is currently empty
              </h3>
              <p className="text-sm text-[#85817B] max-w-md mx-auto mb-6">
                Upload your clothing photos.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate('wardrobe')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-[#B76545] text-[#FFFEFC] hover:bg-[#B76545]/90 transition-colors whitespace-nowrap shrink-0"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload Garments
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Live Weather Summary + Quick Actions */}
        <div className="space-y-6">
          {/* Weather Summary */}
          <div className="bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl p-5">
            <div className="flex items-center justify-between gap-2 mb-4">
              <p className="text-xs font-medium text-[#85817B]">Live Weather</p>
              <button
                type="button"
                onClick={() => onNavigate('weather')}
                className="text-xs font-medium text-[#B76545] hover:text-[#292929] transition-colors whitespace-nowrap shrink-0"
              >
                Weather Stylist
              </button>
            </div>

            {weather ? (
              <div>
                <div className="flex items-baseline justify-between gap-3 mb-2">
                  <div>
                    <h3 className="text-xl font-semibold text-[#292929] font-serif">
                      {weather.city}
                    </h3>
                    <p className="text-xs text-[#85817B]">{weather.current.condition}</p>
                  </div>
                  <p className="text-3xl font-semibold text-[#292929] font-mono tabular-nums">
                    {weather.current.temperature}°{weather.current.unit}
                  </p>
                </div>
                <div className="pt-3 mt-3 border-t border-[#E9DFD2] grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-[#85817B] block">Feels Like</span>
                    <span className="font-medium text-[#292929] tabular-nums">
                      {weather.current.apparentTemperature}°{weather.current.unit}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#85817B] block">Humidity</span>
                    <span className="font-medium text-[#292929] tabular-nums">
                      {weather.current.humidity}%
                    </span>
                  </div>
                  <div>
                    <span className="text-[#85817B] block">Wind</span>
                    <span className="font-medium text-[#292929] tabular-nums">
                      {weather.current.windSpeed} {weather.current.unit === 'F' ? 'mph' : 'km/h'}
                    </span>
                  </div>
                </div>
              </div>
            ) : weatherError ? (
              <div className="text-xs text-[#85817B]">
                <p className="mb-2">Weather unavailable: {weatherError}</p>
                <button
                  type="button"
                  onClick={loadWeather}
                  className="text-[#B76545] font-medium hover:underline"
                >
                  Retry Open-Meteo
                </button>
              </div>
            ) : (
              <p className="text-xs text-[#85817B]">Fetching live Open-Meteo forecast...</p>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl p-5">
            <h3 className="text-base font-semibold text-[#292929] font-serif mb-3">
              Quick Actions
            </h3>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => onNavigate('wardrobe')}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-[#E9DFD2] hover:border-[#B76545] hover:bg-[#F7F3ED]/60 text-left transition-colors"
              >
                <span className="inline-flex items-center gap-2.5 text-sm font-medium text-[#292929]">
                  <Upload className="w-4 h-4 text-[#B76545]" />
                  Add Clothing Items
                </span>
                <ArrowRight className="w-4 h-4 text-[#85817B]" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('ai-studio')}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-[#E9DFD2] hover:border-[#B76545] hover:bg-[#F7F3ED]/60 text-left transition-colors"
              >
                <span className="inline-flex items-center gap-2.5 text-sm font-medium text-[#292929]">
                  <Sparkles className="w-4 h-4 text-[#B76545]" />
                  AI Recognition & Styling
                </span>
                <ArrowRight className="w-4 h-4 text-[#85817B]" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('weather')}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-[#E9DFD2] hover:border-[#B76545] hover:bg-[#F7F3ED]/60 text-left transition-colors"
              >
                <span className="inline-flex items-center gap-2.5 text-sm font-medium text-[#292929]">
                  <CloudSun className="w-4 h-4 text-[#B76545]" />
                  Weather-Based Outfits
                </span>
                <ArrowRight className="w-4 h-4 text-[#85817B]" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('calendar')}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-[#E9DFD2] hover:border-[#B76545] hover:bg-[#F7F3ED]/60 text-left transition-colors"
              >
                <span className="inline-flex items-center gap-2.5 text-sm font-medium text-[#292929]">
                  <Calendar className="w-4 h-4 text-[#B76545]" />
                  Plan Outfit Calendar
                </span>
                <ArrowRight className="w-4 h-4 text-[#85817B]" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Recently Uploaded & Most-Worn Clothes */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recently Uploaded */}
        <div className="bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E9DFD2]">
            <h2 className="text-xl font-semibold text-[#292929] font-serif">
              Recently Uploaded
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('wardrobe')}
              className="text-xs font-medium text-[#B76545] hover:text-[#292929] transition-colors whitespace-nowrap shrink-0"
            >
              View All
            </button>
          </div>

          {data?.recentItems && data.recentItems.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {data.recentItems.map((item) => (
                <div key={item.id} className="group">
                  <div className="aspect-[3/4] rounded-lg overflow-hidden border border-[#E9DFD2] mb-2">
                    <GarmentImage src={item.image_path} alt={item.name} />
                  </div>
                  <p className="text-xs font-semibold text-[#292929] truncate">{item.name}</p>
                  <p className="text-[11px] text-[#85817B] capitalize truncate">
                    {item.category} · {item.color}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#85817B] py-6 text-center">
              No uploaded clothing pieces yet.
            </p>
          )}
        </div>

        {/* Most-Worn Clothes & Upcoming Calendar */}
        <div className="space-y-6">
          <div className="bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl p-6">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E9DFD2]">
              <h2 className="text-xl font-semibold text-[#292929] font-serif">
                Most-Worn Pieces
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('calendar')}
                className="text-xs font-medium text-[#B76545] hover:text-[#292929] transition-colors whitespace-nowrap shrink-0"
              >
                Wear Analytics
              </button>
            </div>

            {data?.mostWornItems && data.mostWornItems.length > 0 ? (
              <div className="divide-y divide-[#E9DFD2]">
                {data.mostWornItems.map((item) => (
                  <div key={item.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-14 rounded-md overflow-hidden border border-[#E9DFD2] shrink-0">
                        <GarmentImage src={item.image_path} alt={item.name} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#292929] truncate">{item.name}</p>
                        <p className="text-xs text-[#85817B] capitalize truncate">
                          {item.category} · {item.color} · {item.season}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-semibold text-[#292929] font-mono tabular-nums">
                        {item.wear_count}
                      </span>
                      <span className="block text-[11px] text-[#85817B]">wears</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#85817B] py-6 text-center">
                Mark garments or outfits as worn to track usage.
              </p>
            )}
          </div>

          {data?.upcomingPlans && data.upcomingPlans.length > 0 && (
            <div className="bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-[#292929] font-serif">
                  Upcoming Planned Looks
                </h3>
                <button
                  type="button"
                  onClick={() => onNavigate('calendar')}
                  className="text-xs font-medium text-[#B76545] hover:text-[#292929]"
                >
                  Open Calendar
                </button>
              </div>
              <div className="divide-y divide-[#E9DFD2]">
                {data.upcomingPlans.map((plan) => (
                  <div key={plan.id} className="py-2 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-medium text-[#292929] truncate">{plan.title}</p>
                      <p className="text-[#85817B] truncate">{plan.occasion}</p>
                    </div>
                    <span className="font-mono tabular-nums text-[#85817B] shrink-0">
                      {plan.planned_date}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
