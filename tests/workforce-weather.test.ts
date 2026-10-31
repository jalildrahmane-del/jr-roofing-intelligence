import test from "node:test";
import assert from "node:assert/strict";
import { ukPostcode, projectWeather, forecastRisk } from "../server/weather.ts";

test("UK project postcode extraction does not guess a location", () => {
  assert.equal(ukPostcode("Unit 5, President Way, Luton LU2 9NY"), "LU29NY");
  assert.equal(ukPostcode("No known postcode"), null);
  assert.equal(ukPostcode("39 Leighton Road, LU5 6AL"), "LU56AL");
});
test("weather is project-specific, bounded, cached and includes site planning prompts", async () => {
  const calls: string[] = [];
  const fetcher = (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    if (url.startsWith("https://api.postcodes.io/"))
      return { ok: true, json: async () => ({ status: 200, result: { latitude: 51.87, longitude: -0.36 } }) } as Response;
    if (url.startsWith("https://api.open-meteo.com/"))
      return { ok: true, json: async () => ({
        daily: { time: ["2026-10-31"], temperature_2m_max: [13], temperature_2m_min: [6], precipitation_sum: [4], precipitation_probability_max: [75], wind_speed_10m_max: [19], wind_gusts_10m_max: [32], weather_code: [61] },
        hourly: { time: ["2026-10-31T05:00", "2026-10-31T08:00", "2026-10-31T20:00"], temperature_2m: [6, 8, 9], precipitation_probability: [30, 60, 70], precipitation: [0, 1, 1], wind_speed_10m: [9, 12, 15], wind_gusts_10m: [15, 25, 30] }
      }) } as Response;
    throw Error("Unexpected external host");
  }) as typeof fetch;
  const now = Date.parse("2026-10-31T10:00:00Z");
  const forecast: any = await projectWeather("Luton LU2 9NY", fetcher, now);
  assert.equal(forecast.postcode, "LU29NY");
  assert.equal(forecast.date, "2026-10-31");
  assert.equal(forecast.gustMaxMph, 32);
  assert.equal(forecast.hourly.length, 1);
  assert.equal(forecast.hourly[0].time, "2026-10-31T08:00");
  assert.equal(forecast.advisory.length, 2);
  assert.equal(calls.length, 2);
  assert.match(calls[1], /wind_speed_unit=mph/);
  await projectWeather("Another site, LU2 9NY", fetcher, now + 1000);
  assert.equal(calls.length, 2, "cache prevents repeated external requests");
  assert.equal(forecastRisk(null, null).length, 0);
});
test("missing postcode and invalid external location fail closed", async () => {
  await assert.rejects(projectWeather("Somewhere without a postcode"), /valid UK postcode/);
  const invalid = (async () => ({ ok: true, json: async () => ({ status: 404, result: null }) })) as typeof fetch;
  await assert.rejects(projectWeather("Test LU1 1AA", invalid), /could not be located/);
});
