import test from 'node:test';
import assert from 'node:assert/strict';
import { createGymWeatherClient, GYM_WEATHER } from '../src/data/gymWeather';
const NOW = Date.parse('2026-10-23T16:30:00Z');
const q = (value: number | null, unitCode: string) => ({ value, unitCode: `wmoUnit:${unitCode}` });
const series = (value: number | null, uom: string, validTime = '2026-10-23T16:00:00+00:00/PT3H') => ({ uom: `wmoUnit:${uom}`, values: [{ value, validTime }] });
const point = { properties: { forecastHourly: 'https://api.weather.gov/gridpoints/MTR/90,50/forecast/hourly', forecastGridData: 'https://api.weather.gov/gridpoints/MTR/90,50', observationStations: 'https://api.weather.gov/gridpoints/MTR/90,50/stations' } };
function fixture() {
  const urls: string[] = [];
  const observation = { properties: { timestamp: '2026-10-23T16:15:00Z', textDescription: 'Light Rain and Fog',
    temperature: q(14, 'degC'), windSpeed: q(18, 'km_h-1'), windDirection: q(270, 'degree_(angle)'), visibility: q(800, 'm'),
    precipitationLastHour: q(.0012, 'm'), cloudLayers: [{ amount: 'BKN' }] } };
  const hourly = { properties: { updateTime: '2026-10-23T15:00:00Z', periods: [{ startTime: '2026-10-23T16:00:00Z', endTime: '2026-10-23T17:00:00Z',
    shortForecast: 'Rain Likely', probabilityOfPrecipitation: q(85, 'percent'), windSpeed: '10 km/h', windDirection: 'WNW', temperature: 15, temperatureUnit: 'C' }] } };
  const grid = { properties: { updateTime: '2026-10-23T15:00:00Z', skyCover: series(80, 'percent'), visibility: series(2000, 'm'), windSpeed: series(21.6, 'km_h-1'),
    windDirection: series(292.5, 'degree_(angle)'), temperature: series(15, 'degC'), probabilityOfPrecipitation: series(85, 'percent'), quantitativePrecipitation: series(6, 'mm') } };
  let offline = false;
  const fetcher: typeof fetch = async (input, options) => {
    const url = String(input); urls.push(url);
    if (options?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (offline) throw new Error('Offline');
    if (url.includes('/points/')) return Response.json(point);
    if (url.endsWith('/stations')) return Response.json({ features: [{ id: 'https://api.weather.gov/stations/KMRY', geometry: { coordinates: [-121.85, 36.59] }, properties: { stationIdentifier: 'KMRY', name: 'Monterey Airport' } }] });
    if (url.endsWith('/observations/latest')) return Response.json(observation);
    if (url.includes('/forecast/hourly')) return Response.json(hourly);
    return Response.json(grid);
  };
  return { fetcher, urls, observation, hourly, grid, offline() { offline = true; } };
}
test('NWS location discovery, observed SI values, per-field forecast fallback and coalesced cache', async () => {
  const f = fixture(); let now = NOW;
  const client = createGymWeatherClient({ fetch: f.fetcher, now: () => now });
  assert.equal(client.snapshot().cloudCover01.value, null); assert.equal(f.urls.length, 0);
  const pending = client.refresh(); assert.equal(client.refresh(), pending);
  const s = await pending;
  assert.equal(s.refreshing, false); assert.equal(s.summary, 'Light Rain and Fog');
  assert.equal(s.cloudCover01.value, .75); assert.equal(s.cloudCover01.source, 'observation');
  assert.equal(s.rainMmHour.value, 1.2); assert.equal(s.windSpeedMps.value, 5); assert.equal(s.visibilityMetres.value, 800);
  assert.equal(s.precipitationProbability01.value, .85); assert.equal(s.precipitationProbability01.source, 'forecast');
  assert.equal(s.station?.id, 'KMRY'); assert.ok(s.station!.distanceKm! > 1);
  assert.equal(s.cloudCover01.time, '2026-10-23T16:15:00.000Z'); assert.equal(f.urls[0], GYM_WEATHER.pointUrl);
  assert.equal(f.urls.length, 5); await client.refresh(); assert.equal(f.urls.length, 5);
  now += 15 * 60_000; await client.refresh(); assert.equal(f.urls.length, 8, 'Discovery is cached for a day');
  client.dispose();
});
test('Missing observations preserve forecast cloud and QPF interval average; probability cannot cause rain', async () => {
  const f = fixture(); f.observation.properties.precipitationLastHour.value = null; f.observation.properties.cloudLayers = [];
  const client = createGymWeatherClient({ fetch: f.fetcher, now: () => NOW });
  const s = await client.refresh();
  assert.equal(s.cloudCover01.value, .8); assert.equal(s.cloudCover01.source, 'forecast');
  assert.equal(s.rainMmHour.value, 2, '6 mm in 3 hours is a 2 mm/hour average'); assert.equal(s.rainMmHour.source, 'forecast');
  f.grid.properties.quantitativePrecipitation.values[0].value = null;
  const missing = await client.refresh({ force: true });
  assert.equal(missing.rainMmHour.value, null); assert.equal(missing.rainMmHour.state, 'unavailable'); assert.equal(missing.precipitationProbability01.value, .85);
  f.observation.properties.windSpeed.value = null; f.grid.properties.windSpeed.values[0].value = null;
  const wind = await client.refresh({ force: true }); assert.ok(Math.abs(wind.windSpeedMps.value! - 10 / 3.6) < 1e-8);
  client.dispose();
});
test('Offline retains dated last-good observations, marks age stale, and expires forecast intervals', async () => {
  const f = fixture(); let now = NOW;
  const client = createGymWeatherClient({ fetch: f.fetcher, now: () => now });
  await client.refresh(); f.offline(); now += 2 * 3_600_000;
  const stale = await client.refresh(); assert.ok(stale.errors.length > 0);
  assert.equal(stale.cloudCover01.source, 'forecast', 'Fresh valid forecast supersedes stale observation');
  assert.equal(stale.cloudCover01.state, 'current');
  now += 7 * 3_600_000; const expired = client.snapshot();
  assert.equal(expired.cloudCover01.source, 'observation'); assert.equal(expired.cloudCover01.state, 'stale');
  assert.equal(expired.precipitationProbability01.value, null); assert.equal(expired.fetchedAt, new Date(NOW).toISOString());
  const blank = createGymWeatherClient({ fetch: f.fetcher, now: () => now });
  const absent = await blank.refresh(); assert.equal(absent.rainMmHour.value, null); assert.equal(absent.cloudCover01.state, 'unavailable');
  client.dispose(); blank.dispose();
});
test('Navigation cancellation aborts requests and dispose never starts new requests', async () => {
  let calls = 0, lastSignal: AbortSignal | null = null;
  const fetcher: typeof fetch = async (_input, options) => new Promise<Response>((_resolve, reject) => {
    calls++; lastSignal = options!.signal as AbortSignal;
    lastSignal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  });
  const client = createGymWeatherClient({ fetch: fetcher, now: () => NOW });
  const pending = client.refresh(); client.cancel(); await pending;
  assert.equal((lastSignal as AbortSignal | null)?.aborted, true);
  const external = new AbortController(); const again = client.refresh({ force: true, signal: external.signal }); external.abort(); await again;
  assert.equal(calls, 2); client.dispose(); await client.refresh({ force: true }); assert.equal(calls, 2);
});

test('Same-turn cancellation retries immediately and an old abort cannot clear the new request', async () => {
  const f = fixture(); let calls = 0;
  let release: (() => void) | undefined;
  const fetcher: typeof fetch = async (input, options) => {
    calls++;
    if (calls === 1) return new Promise<Response>((_resolve, reject) => {
      options!.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    });
    if (calls === 2) await new Promise<void>(resolve => { release = resolve; });
    return f.fetcher(input, options);
  };
  const client = createGymWeatherClient({ fetch: fetcher, now: () => NOW });
  const cancelled = client.refresh(); client.cancel();
  const replacement = client.refresh();
  assert.notEqual(replacement, cancelled); assert.equal(calls, 2);
  await cancelled;
  assert.equal(client.isRefreshing, true, 'Old request completion must preserve the replacement handle');
  assert.equal(client.refresh(), replacement); assert.deepEqual(client.snapshot().errors, []);
  release!(); const done = await replacement;
  assert.equal(done.cloudCover01.value, .75); assert.deepEqual(done.errors, []);
  assert.equal(done.refreshing, false); client.dispose();
});
test('Timeout and HTTP 429 remain failures with a cooldown; intentional external abort is quiet', async () => {
  let calls = 0;
  const waiting: typeof fetch = async (_input, options) => new Promise<Response>((_resolve, reject) => {
    calls++; options!.signal!.addEventListener('abort', () => reject(options!.signal!.reason), { once: true });
  });
  const timed = createGymWeatherClient({ fetch: waiting, now: () => NOW, timeoutMs: 5 });
  const timeout = await timed.refresh(); assert.match(timeout.errors.join(' '), /timed out/);
  await timed.refresh(); assert.equal(calls, 1); timed.dispose();
  const limited = createGymWeatherClient({ fetch: async () => { calls++; return new Response(null, { status: 429, headers: { 'Retry-After': '60' } }); }, now: () => NOW });
  assert.match((await limited.refresh()).errors.join(' '), /HTTP 429/); await limited.refresh(); assert.equal(calls, 2); limited.dispose();
  const external = createGymWeatherClient({ fetch: waiting, now: () => NOW });
  const controller = new AbortController(), pending = external.refresh({ signal: controller.signal });
  controller.abort(); const cancelled = await pending;
  assert.deepEqual(cancelled.errors, []); assert.equal(cancelled.nextRefreshAt, null); external.dispose();
});
