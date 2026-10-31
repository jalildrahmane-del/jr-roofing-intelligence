// Project-address weather lookup. Never use the user's live GPS location.
// Public, keyless services: postcodes.io for UK postcode coordinates; Open-Meteo for forecasts.
// Forecasts are advisory only: they do not authorise work at height or lifting.
type Fetcher = typeof fetch;
const cache = new Map<string, { until: number; value: unknown }>();
const TTL_MS = 15 * 60 * 1000;
export function ukPostcode(address: string): string | null {
  const match = address.toUpperCase().match(/\b(GIR\s?0AA|(?:[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}))\b/);
  return match ? match[1].replace(/\s/g, "") : null;
}
export function forecastRisk(gustMph: number | null, rainMm: number | null) {
  // Planning prompts only; NOT engineering wind limits or site stop-work thresholds.
  const notes: string[] = [];
  if (gustMph !== null && gustMph >= 25) notes.push("Wind gusts warrant a site-specific assessment of roof access, lifting, materials and temporary works.");
  if (rainMm !== null && rainMm > 0) notes.push("Rain is forecast: reassess slip risks, roof conditions and electrical/hot-work controls.");
  return notes;
}
async function getJson(url: string, fetcher: Fetcher): Promise<any> {
  const response = await fetcher(url, { signal: AbortSignal.timeout(7000), headers: { Accept: "application/json" } });
  if (!response.ok) throw Error("Weather data service is temporarily unavailable");
  return response.json();
}
function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
export async function projectWeather(address: string, fetcher: Fetcher = fetch, now = Date.now()) {
  const postcode = ukPostcode(address);
  if (!postcode) throw Error("Add a valid UK postcode to the project's saved address to show a site-specific forecast");
  const cached = cache.get(postcode);
  if (cached && cached.until > now) return cached.value;
  const lookup = await getJson("https://api.postcodes.io/postcodes/" + encodeURIComponent(postcode), fetcher);
  const lat = finite(lookup?.result?.latitude), lon = finite(lookup?.result?.longitude);
  if (lookup?.status !== 200 || lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180)
    throw Error("Project postcode could not be located");
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("timezone", "Europe/London");
  url.searchParams.set("forecast_days", "2");
  url.searchParams.set("wind_speed_unit", "mph");
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,weather_code");
  url.searchParams.set("hourly", "temperature_2m,precipitation_probability,precipitation,wind_speed_10m,wind_gusts_10m");
  const raw = await getJson(url.toString(), fetcher);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now));
  const days: string[] = raw?.daily?.time || [];
  const index = days.indexOf(date);
  if (index < 0) throw Error("Today's site forecast is not yet available");
  const daily = raw.daily;
  const hourTimes: string[] = raw?.hourly?.time || [];
  const hourly = hourTimes.flatMap((time, i) => {
    if (!time.startsWith(date + "T")) return [];
    const hour = Number(time.slice(11, 13));
    if (hour < 6 || hour > 19) return [];
    return [{ time, temperatureC: finite(raw.hourly.temperature_2m?.[i]), rainProbabilityPercent: finite(raw.hourly.precipitation_probability?.[i]), rainMm: finite(raw.hourly.precipitation?.[i]), windMph: finite(raw.hourly.wind_speed_10m?.[i]), gustMph: finite(raw.hourly.wind_gusts_10m?.[i]) }];
  });
  const result = {
    postcode, date, timezone: "Europe/London", updatedAt: new Date(now).toISOString(),
    source: "Open-Meteo (forecast); postcodes.io (postcode coordinates)",
    temperatureMaxC: finite(daily.temperature_2m_max?.[index]),
    temperatureMinC: finite(daily.temperature_2m_min?.[index]),
    rainMm: finite(daily.precipitation_sum?.[index]),
    rainProbabilityPercent: finite(daily.precipitation_probability_max?.[index]),
    windMaxMph: finite(daily.wind_speed_10m_max?.[index]),
    gustMaxMph: finite(daily.wind_gusts_10m_max?.[index]),
    weatherCode: finite(daily.weather_code?.[index]),
    hourly,
    advisory: forecastRisk(finite(daily.wind_gusts_10m_max?.[index]), finite(daily.precipitation_sum?.[index])),
    notice: "Forecast only. Check Met Office warnings and actual site conditions. Site-specific RAMS, manufacturer wind limits and the supervisor's assessment govern work.",
  };
  cache.set(postcode, { until: now + TTL_MS, value: result });
  if (cache.size > 100) cache.delete(cache.keys().next().value!);
  return result;
}
