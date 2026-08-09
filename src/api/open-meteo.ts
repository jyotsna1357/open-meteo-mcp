import { z } from "zod";

import { fetchJson } from "./client.js";
import { WeatherError } from "./errors.js";

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

/** Units are fixed metric — see the Limitations section of the README. */
const CURRENT_FIELDS = [
  "temperature_2m",
  "apparent_temperature",
  "relative_humidity_2m",
  "precipitation",
  "weather_code",
  "wind_speed_10m",
  "wind_direction_10m",
  "is_day",
] as const;

const DAILY_FIELDS = [
  "weather_code",
  "temperature_2m_max",
  "temperature_2m_min",
  "precipitation_sum",
  "precipitation_probability_max",
  "wind_speed_10m_max",
] as const;

// --- Wire schemas -----------------------------------------------------------
// These describe what Open-Meteo actually sends. They are deliberately kept
// separate from the domain types below so a change upstream fails loudly in one
// place instead of leaking half-parsed data through the server.

const geocodingResponseSchema = z.object({
  // Absent entirely (not an empty array) when nothing matches.
  results: z
    .array(
      z.object({
        name: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        country: z.string().optional(),
        admin1: z.string().optional(),
        timezone: z.string().optional(),
      }),
    )
    .optional(),
});

const currentResponseSchema = z.object({
  timezone: z.string(),
  current: z.object({
    time: z.string(),
    temperature_2m: z.number(),
    apparent_temperature: z.number(),
    relative_humidity_2m: z.number(),
    precipitation: z.number(),
    weather_code: z.number(),
    wind_speed_10m: z.number(),
    wind_direction_10m: z.number(),
    is_day: z.number(),
  }),
});

// Daily values arrive as parallel arrays. Individual entries can be null when a
// station has no data for that day, so every measurement is nullable.
const nullableNumbers = z.array(z.number().nullable());

const forecastResponseSchema = z.object({
  timezone: z.string(),
  daily: z.object({
    time: z.array(z.string()),
    weather_code: nullableNumbers,
    temperature_2m_max: nullableNumbers,
    temperature_2m_min: nullableNumbers,
    precipitation_sum: nullableNumbers,
    precipitation_probability_max: nullableNumbers,
    wind_speed_10m_max: nullableNumbers,
  }),
});

// --- Domain types -----------------------------------------------------------

export interface Place {
  name: string;
  country: string | undefined;
  region: string | undefined;
  latitude: number;
  longitude: number;
}

export interface CurrentConditions {
  /** Local wall-clock time at the location, ISO-8601 without an offset. */
  observedAt: string;
  timezone: string;
  temperatureC: number;
  feelsLikeC: number;
  humidityPercent: number;
  precipitationMm: number;
  weatherCode: number;
  windSpeedKmh: number;
  windDirectionDegrees: number;
  isDay: boolean;
}

export interface ForecastDay {
  /** `YYYY-MM-DD` in the location's own timezone. */
  date: string;
  weatherCode: number | null;
  highC: number | null;
  lowC: number | null;
  precipitationMm: number | null;
  precipitationChancePercent: number | null;
  maxWindKmh: number | null;
}

export interface Forecast {
  timezone: string;
  days: ForecastDay[];
}

// --- Requests ---------------------------------------------------------------

/**
 * Resolves a free-text city name to coordinates.
 *
 * Open-Meteo's geocoder omits `results` rather than returning an empty array
 * when nothing matches, which is the "unknown city" case.
 */
export async function geocodeCity(city: string): Promise<Place> {
  const url = new URL(GEOCODING_URL);
  url.searchParams.set("name", city);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const body = await fetchJson(url, geocodingResponseSchema, "geocode");
  const match = body.results?.[0];

  if (!match) {
    throw new WeatherError(
      `No place named "${city}" was found. Check the spelling, or try adding a country — for example "Springfield, United States".`,
    );
  }

  return {
    name: match.name,
    country: match.country,
    region: match.admin1,
    latitude: match.latitude,
    longitude: match.longitude,
  };
}

export async function fetchCurrentConditions(place: Place): Promise<CurrentConditions> {
  const url = buildForecastUrl(place, { current: CURRENT_FIELDS });
  const { timezone, current } = await fetchJson(url, currentResponseSchema, "current");

  return {
    observedAt: current.time,
    timezone,
    temperatureC: current.temperature_2m,
    feelsLikeC: current.apparent_temperature,
    humidityPercent: current.relative_humidity_2m,
    precipitationMm: current.precipitation,
    weatherCode: current.weather_code,
    windSpeedKmh: current.wind_speed_10m,
    windDirectionDegrees: current.wind_direction_10m,
    isDay: current.is_day === 1,
  };
}

export async function fetchForecast(place: Place, days: number): Promise<Forecast> {
  const url = buildForecastUrl(place, { daily: DAILY_FIELDS });
  url.searchParams.set("forecast_days", String(days));

  const { timezone, daily } = await fetchJson(url, forecastResponseSchema, "forecast");

  // Zip the parallel arrays into one record per day. `time` is the spine: a
  // shorter measurement array means the response is inconsistent, not that the
  // day is missing, so treat that as malformed rather than silently truncating.
  const zipped = daily.time.map((date, index): ForecastDay => {
    const at = (values: (number | null)[]): number | null => {
      if (index >= values.length) {
        throw new WeatherError(
          "The weather service returned an incomplete forecast. Try again in a moment.",
        );
      }
      return values[index] ?? null;
    };

    return {
      date,
      weatherCode: at(daily.weather_code),
      highC: at(daily.temperature_2m_max),
      lowC: at(daily.temperature_2m_min),
      precipitationMm: at(daily.precipitation_sum),
      precipitationChancePercent: at(daily.precipitation_probability_max),
      maxWindKmh: at(daily.wind_speed_10m_max),
    };
  });

  if (zipped.length === 0) {
    throw new WeatherError("The weather service returned no forecast days for this location.");
  }

  return { timezone, days: zipped };
}

function buildForecastUrl(
  place: Place,
  fields: { current: readonly string[] } | { daily: readonly string[] },
): URL {
  const url = new URL(FORECAST_URL);
  url.searchParams.set("latitude", String(place.latitude));
  url.searchParams.set("longitude", String(place.longitude));
  // `auto` makes every timestamp local to the requested coordinates.
  url.searchParams.set("timezone", "auto");

  if ("current" in fields) {
    url.searchParams.set("current", fields.current.join(","));
  } else {
    url.searchParams.set("daily", fields.daily.join(","));
  }

  return url;
}
