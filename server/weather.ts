import type { CitySearchResult, WeatherForecastDay, WeatherReport } from '../src/types.ts';

function mapWmoCode(code: number): string {
  if (code === 0) return 'Clear Sky';
  if (code === 1) return 'Mainly Clear';
  if (code === 2) return 'Partly Cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Foggy';
  if (code === 51 || code === 53 || code === 55) return 'Drizzle';
  if (code === 56 || code === 57) return 'Freezing Drizzle';
  if (code === 61 || code === 63 || code === 65) return 'Rain';
  if (code === 66 || code === 67) return 'Freezing Rain';
  if (code === 71 || code === 73 || code === 75) return 'Snowfall';
  if (code === 77) return 'Snow Grains';
  if (code === 80 || code === 81 || code === 82) return 'Rain Showers';
  if (code === 85 || code === 86) return 'Snow Showers';
  if (code === 95) return 'Thunderstorm';
  if (code === 96 || code === 99) return 'Thunderstorm with Hail';
  return 'Variable Conditions';
}

const citySearchCache = new Map<string, { expiresAt: number; results: CitySearchResult[] }>();
const weatherReportCache = new Map<string, { expiresAt: number; report: WeatherReport }>();
const WEATHER_CACHE_TTL_MS = 5 * 60 * 1000;

export async function searchCities(query: string): Promise<CitySearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const cacheKey = trimmed.toLowerCase();
  const cached = citySearchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.results;
  }

  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', trimmed);
  url.searchParams.set('count', '8');
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(7000),
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo geocoding failed (${response.status})`);
  }

  const data = (await response.json()) as {
    results?: Array<{
      id: number;
      name: string;
      country?: string;
      admin1?: string;
      latitude: number;
      longitude: number;
    }>;
  };

  const results = (data.results || []).map((r) => ({
    id: r.id,
    name: r.name,
    country: r.country || '',
    admin1: r.admin1,
    latitude: r.latitude,
    longitude: r.longitude,
  }));

  citySearchCache.set(cacheKey, {
    expiresAt: Date.now() + 30 * 60 * 1000,
    results,
  });

  return results;
}

const cityCountryCache = new Map<string, string>();

function mapWwoToWmo(wwoCode: number): number {
  if (wwoCode === 113) return 0;
  if (wwoCode === 116) return 2;
  if (wwoCode === 119 || wwoCode === 122) return 3;
  if (wwoCode === 143 || wwoCode === 248 || wwoCode === 260) return 45;
  if ([176, 263, 266, 293, 296].includes(wwoCode)) return 51;
  if ([299, 302, 305, 308, 353, 356, 359].includes(wwoCode)) return 61;
  if ([179, 182, 185, 227, 230, 311, 314, 317, 320, 323, 326, 329, 332, 335, 338, 368, 371].includes(wwoCode)) return 71;
  if ([200, 386, 389, 392, 395].includes(wwoCode)) return 95;
  return 2;
}

async function fetchFromOpenMeteo(params: {
  lat: number;
  lon: number;
  city: string;
  country: string;
  unit: 'C' | 'F';
}): Promise<WeatherReport> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(params.lat));
  url.searchParams.set('longitude', String(params.lon));
  url.searchParams.set(
    'current',
    'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m'
  );
  url.searchParams.set(
    'daily',
    'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,relative_humidity_2m_mean'
  );
  url.searchParams.set('forecast_days', '5');
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('cell_selection', 'nearest');
  if (params.unit === 'F') {
    url.searchParams.set('temperature_unit', 'fahrenheit');
    url.searchParams.set('wind_speed_unit', 'mph');
  } else {
    url.searchParams.set('wind_speed_unit', 'kmh');
  }

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo weather request failed (${response.status})`);
  }

  const data = (await response.json()) as {
    timezone?: string;
    current?: {
      temperature_2m: number;
      apparent_temperature: number;
      relative_humidity_2m: number;
      wind_speed_10m: number;
      weather_code: number;
      is_day: number;
    };
    daily?: {
      time: string[];
      weather_code: number[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      precipitation_probability_max: number[];
      relative_humidity_2m_mean?: number[];
    };
  };

  if (!data.current || !data.daily) {
    throw new Error('Open-Meteo returned an incomplete forecast payload.');
  }

  const currentTemp = Math.round(data.current.temperature_2m);
  const currentHumidity = Math.round(data.current.relative_humidity_2m);
  const currentCode = data.current.weather_code;
  const currentCondition = mapWmoCode(currentCode);

  const daily: WeatherForecastDay[] = data.daily.time.map((date, idx) => {
    const code = idx === 0 ? currentCode : (data.daily!.weather_code[idx] ?? 0);
    const rawMax = Math.round(data.daily!.temperature_2m_max[idx] ?? currentTemp);
    const rawMin = Math.round(data.daily!.temperature_2m_min[idx] ?? currentTemp);
    const rawHumidity =
      idx === 0
        ? currentHumidity
        : (data.daily!.relative_humidity_2m_mean?.[idx] ?? currentHumidity);
    return {
      date,
      weatherCode: code,
      condition: idx === 0 ? currentCondition : mapWmoCode(code),
      tempMax: idx === 0 ? Math.max(rawMax, currentTemp) : rawMax,
      tempMin: idx === 0 ? Math.min(rawMin, currentTemp) : rawMin,
      precipitationProbability: data.daily!.precipitation_probability_max?.[idx] ?? 0,
      humidity: Math.round(rawHumidity),
    };
  });

  return {
    city: params.city,
    country: params.country,
    latitude: params.lat,
    longitude: params.lon,
    timezone: data.timezone || 'UTC',
    fetchedAt: new Date().toISOString(),
    current: {
      temperature: currentTemp,
      apparentTemperature: Math.round(data.current.apparent_temperature),
      humidity: currentHumidity,
      windSpeed: Math.round(data.current.wind_speed_10m),
      weatherCode: currentCode,
      condition: currentCondition,
      isDay: data.current.is_day === 1,
      unit: params.unit,
    },
    daily,
  };
}

async function fetchFromWttr(params: {
  lat: number | null;
  lon: number | null;
  city: string;
  country: string;
  unit: 'C' | 'F';
}): Promise<WeatherReport> {
  const target =
    params.lat !== null && params.lon !== null
      ? `${params.lat},${params.lon}`
      : encodeURIComponent(params.city);

  const response = await fetch(`https://wttr.in/${target}?format=j1`, {
    headers: { 'User-Agent': 'curl/8.0.1', Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`Live weather provider failed (${response.status})`);
  }

  const data = (await response.json()) as {
    nearest_area?: Array<{
      areaName?: Array<{ value: string }>;
      country?: Array<{ value: string }>;
      latitude?: string;
      longitude?: string;
    }>;
    current_condition?: Array<{
      temp_C: string;
      temp_F: string;
      FeelsLikeC: string;
      FeelsLikeF: string;
      humidity: string;
      windspeedKmph: string;
      windspeedMiles: string;
      weatherCode: string;
      weatherDesc?: Array<{ value: string }>;
    }>;
    weather?: Array<{
      date: string;
      maxtempC: string;
      maxtempF: string;
      mintempC: string;
      mintempF: string;
      hourly?: Array<{
        time: string;
        weatherCode: string;
        weatherDesc?: Array<{ value: string }>;
        chanceofrain?: string;
        humidity?: string;
      }>;
    }>;
  };

  const curr = data.current_condition?.[0];
  if (!curr) {
    throw new Error('Live weather service returned an empty observation.');
  }

  const area = data.nearest_area?.[0];
  const resolvedCity =
    params.city && params.city !== 'Current Location'
      ? params.city
      : area?.areaName?.[0]?.value || params.city || 'Current Location';
  const resolvedCountry = params.country || area?.country?.[0]?.value || '';
  const resolvedLat = params.lat ?? (area?.latitude ? Number(area.latitude) : 0);
  const resolvedLon = params.lon ?? (area?.longitude ? Number(area.longitude) : 0);

  const wwoCurr = Number(curr.weatherCode || 116);
  const wmoCurr = mapWwoToWmo(wwoCurr);

  const currentTemp = Math.round(Number(params.unit === 'F' ? curr.temp_F : curr.temp_C));
  const currentHumidity = Math.round(Number(curr.humidity || 0));
  const currentCondition = (curr.weatherDesc?.[0]?.value || mapWmoCode(wmoCurr)).trim();

  const daily: WeatherForecastDay[] = (data.weather || []).map((day, idx) => {
    const midSlot = day.hourly?.[Math.floor((day.hourly?.length || 1) / 2)] || day.hourly?.[0];
    const dayWwo = Number(midSlot?.weatherCode || wwoCurr);
    const maxPrecip = Math.max(
      0,
      ...(day.hourly || []).map((h) => Number(h.chanceofrain || 0))
    );
    const hourlyHumidities = (day.hourly || [])
      .map((h) => Number(h.humidity))
      .filter((v) => Number.isFinite(v));
    const avgHumidity =
      hourlyHumidities.length > 0
        ? hourlyHumidities.reduce((sum, v) => sum + v, 0) / hourlyHumidities.length
        : currentHumidity;

    const rawMax = Math.round(Number(params.unit === 'F' ? day.maxtempF : day.maxtempC));
    const rawMin = Math.round(Number(params.unit === 'F' ? day.mintempF : day.mintempC));

    return {
      date: day.date,
      weatherCode: idx === 0 ? wmoCurr : mapWwoToWmo(dayWwo),
      condition:
        idx === 0
          ? currentCondition
          : (midSlot?.weatherDesc?.[0]?.value || mapWmoCode(mapWwoToWmo(dayWwo))).trim(),
      tempMax: idx === 0 ? Math.max(rawMax, currentTemp) : rawMax,
      tempMin: idx === 0 ? Math.min(rawMin, currentTemp) : rawMin,
      precipitationProbability: Number.isFinite(maxPrecip) ? maxPrecip : 0,
      humidity: idx === 0 ? currentHumidity : Math.round(Number.isFinite(avgHumidity) ? avgHumidity : 0),
    };
  });

  return {
    city: resolvedCity,
    country: resolvedCountry,
    latitude: resolvedLat,
    longitude: resolvedLon,
    timezone: 'auto',
    fetchedAt: new Date().toISOString(),
    current: {
      temperature: Math.round(Number(params.unit === 'F' ? curr.temp_F : curr.temp_C)),
      apparentTemperature: Math.round(
        Number(params.unit === 'F' ? curr.FeelsLikeF : curr.FeelsLikeC)
      ),
      humidity: Math.round(Number(curr.humidity || 0)),
      windSpeed: Math.round(
        Number(params.unit === 'F' ? curr.windspeedMiles : curr.windspeedKmph)
      ),
      weatherCode: wmoCurr,
      condition: (curr.weatherDesc?.[0]?.value || mapWmoCode(wmoCurr)).trim(),
      isDay: true,
      unit: params.unit,
    },
    daily,
  };
}

export async function fetchLiveWeather(params: {
  city: string;
  latitude?: number | null;
  longitude?: number | null;
  unit?: 'C' | 'F';
  bypassCache?: boolean;
}): Promise<WeatherReport> {
  const unit = params.unit === 'F' ? 'F' : 'C';
  const weatherCacheKey = `${params.city.trim().toLowerCase()}|${params.latitude ?? ''}|${params.longitude ?? ''}|${unit}`;
  if (!params.bypassCache) {
    const cached = weatherReportCache.get(weatherCacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.report;
    }
  }

  let lat = params.latitude ?? null;
  let lon = params.longitude ?? null;
  let resolvedCity = params.city;
  let country = '';

  if (params.city) {
    const cacheKey = params.city.trim().toLowerCase();
    if (lat === null || lon === null) {
      try {
        const matches = await searchCities(params.city);
        if (matches.length > 0) {
          lat = matches[0].latitude;
          lon = matches[0].longitude;
          resolvedCity = matches[0].name;
          country = matches[0].country;
          if (country) cityCountryCache.set(cacheKey, country);
        }
      } catch {
        // Fall through to wttr city lookup
      }
    } else if (cityCountryCache.has(cacheKey)) {
      country = cityCountryCache.get(cacheKey) || '';
    } else {
      try {
        const matches = await searchCities(params.city);
        if (matches.length > 0 && matches[0].country) {
          country = matches[0].country;
          cityCountryCache.set(cacheKey, country);
        }
      } catch {
        // Country display is optional
      }
    }
  }

  let report: WeatherReport | null = null;
  if (lat !== null && lon !== null) {
    try {
      report = await fetchFromOpenMeteo({
        lat,
        lon,
        city: resolvedCity,
        country,
        unit,
      });
    } catch {
      // Fall back to wttr.in only when Open-Meteo is unreachable
    }
  }

  if (!report) {
    report = await fetchFromWttr({
      lat,
      lon,
      city: resolvedCity,
      country,
      unit,
    });
  }

  weatherReportCache.set(weatherCacheKey, {
    expiresAt: Date.now() + WEATHER_CACHE_TTL_MS,
    report,
  });

  return report;
}
