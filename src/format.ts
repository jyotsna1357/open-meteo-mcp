import type { CurrentConditions, Forecast, ForecastDay, Place } from "./api/open-meteo.js";

/**
 * WMO 4677 weather interpretation codes, the vocabulary Open-Meteo reports
 * conditions in. Phrasing is kept short so it reads well inline in a sentence.
 */
const WEATHER_DESCRIPTIONS = new Map<number, string>([
  [0, "Clear sky"],
  [1, "Mainly clear"],
  [2, "Partly cloudy"],
  [3, "Overcast"],
  [45, "Fog"],
  [48, "Freezing fog"],
  [51, "Light drizzle"],
  [53, "Moderate drizzle"],
  [55, "Dense drizzle"],
  [56, "Light freezing drizzle"],
  [57, "Dense freezing drizzle"],
  [61, "Light rain"],
  [63, "Moderate rain"],
  [65, "Heavy rain"],
  [66, "Light freezing rain"],
  [67, "Heavy freezing rain"],
  [71, "Light snow"],
  [73, "Moderate snow"],
  [75, "Heavy snow"],
  [77, "Snow grains"],
  [80, "Light rain showers"],
  [81, "Moderate rain showers"],
  [82, "Violent rain showers"],
  [85, "Light snow showers"],
  [86, "Heavy snow showers"],
  [95, "Thunderstorm"],
  [96, "Thunderstorm with light hail"],
  [99, "Thunderstorm with heavy hail"],
]);

const COMPASS_POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

export function describeWeatherCode(code: number | null): string {
  if (code === null) return "Unknown conditions";
  return WEATHER_DESCRIPTIONS.get(code) ?? `Unknown conditions (WMO code ${code})`;
}

/** Turns a wind bearing into the compass point the wind is blowing *from*. */
function describeWindDirection(degrees: number): string {
  const index = Math.round(degrees / 45) % COMPASS_POINTS.length;
  return COMPASS_POINTS[index] ?? "N";
}

/** "Tokyo, Tokyo, Japan" — skips the parts Open-Meteo did not provide. */
export function describePlace(place: Place): string {
  return [place.name, place.region, place.country].filter(Boolean).join(", ");
}

/**
 * Open-Meteo returns local wall-clock times with no offset (`2026-08-09T15:30`).
 * Reading them as UTC and formatting in UTC keeps the numbers exactly as sent —
 * parsing them naively would re-interpret them in the host's timezone and shift
 * the date.
 */
function formatAsUtc(isoWithoutOffset: string, options: Intl.DateTimeFormatOptions): string {
  const date = new Date(`${isoWithoutOffset}Z`);
  if (Number.isNaN(date.getTime())) return isoWithoutOffset;
  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(date);
}

/** Renders a measurement, or an explicit gap marker when the station had none. */
function value(measurement: number | null, unit: string, digits = 0): string {
  if (measurement === null) return "n/a";
  return `${measurement.toFixed(digits)}${unit}`;
}

export function formatCurrentConditions(place: Place, current: CurrentConditions): string {
  const observed = formatAsUtc(current.observedAt, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return [
    `Current conditions in ${describePlace(place)}`,
    `As of ${observed} local time (${current.timezone})`,
    "",
    `${describeWeatherCode(current.weatherCode)}, ${value(current.temperatureC, "°C", 1)}`,
    `Feels like:    ${value(current.feelsLikeC, "°C", 1)}`,
    `Humidity:      ${value(current.humidityPercent, "%")}`,
    `Wind:          ${value(current.windSpeedKmh, " km/h", 1)} from the ${describeWindDirection(current.windDirectionDegrees)}`,
    `Precipitation: ${value(current.precipitationMm, " mm", 1)} in the last hour`,
    `Daylight:      ${current.isDay ? "yes" : "no"}`,
  ].join("\n");
}

export function formatForecast(place: Place, forecast: Forecast): string {
  const dayCount = forecast.days.length;
  const heading = `${dayCount}-day forecast for ${describePlace(place)} (times in ${forecast.timezone})`;

  return [heading, "", ...forecast.days.map(formatForecastDay)].join("\n").trimEnd();
}

function formatForecastDay(day: ForecastDay): string {
  const label = formatAsUtc(`${day.date}T00:00:00`, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  const details = [
    `High ${value(day.highC, "°C", 1)} / Low ${value(day.lowC, "°C", 1)}`,
    `Rain ${value(day.precipitationChancePercent, "%")} chance, ${value(day.precipitationMm, " mm", 1)}`,
    `Wind up to ${value(day.maxWindKmh, " km/h", 1)}`,
  ].join(" · ");

  return [`${label} — ${describeWeatherCode(day.weatherCode)}`, `  ${details}`].join("\n");
}
