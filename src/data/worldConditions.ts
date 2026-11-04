/** Small opt-in conditions snapshot. Never fetch from a scene/render loop. */
export type ConditionMode = 'observed' | 'predicted' | 'forecast' | 'computed';
export type ConditionState = ConditionMode | 'stale' | 'unavailable';
export interface ConditionChannel<T> {
  sourceId: string;
  mode: ConditionMode;
  state: ConditionState;
  value: T | null;
  units: string;
  sourceUrl: string;
  sourceTime: string | null;
  fetchedAt: string | null;
  validFrom: string | null;
  validUntil: string | null;
  ageSeconds: number | null;
  qualityFlags: string[];
  reason: string | null;
  spatialSupport: string;
}
export interface ObservedTide {
  heightMetres: number;
  datum: 'MLLW';
  quality: 'preliminary' | 'verified' | 'unknown';
  sigmaMetres: number | null;
}
export interface TideEvent { time: string; heightMetres: number; type: 'H' | 'L' }
export interface PredictedTides { datum: 'MLLW'; nextHigh: TideEvent | null; nextLow: TideEvent | null }
export interface WeatherConditions {
  summary: string;
  temperatureC: number | null;
  windSpeedMps: [number, number] | null;
  /** Meteorological direction FROM which the wind blows; never a scene movement vector. */
  windDirection: string | null;
  precipitationPercent: number | null;
}
export interface DaylightConditions {
  localDate: string;
  timeZone: 'America/Los_Angeles';
  sunrise: string | null;
  sunset: string | null;
  isDaylight: boolean | null;
}
export interface WorldConditionsSnapshot {
  schemaVersion: 1;
  generatedAt: string;
  lastRequestedAt: string | null;
  nextRefreshAt: string | null;
  observedTide: ConditionChannel<ObservedTide>;
  predictedTides: ConditionChannel<PredictedTides>;
  weather: ConditionChannel<WeatherConditions>;
  daylight: ConditionChannel<DaylightConditions>;
}
export interface WorldConditionsOptions {
  fetch?: typeof globalThis.fetch;
  now?: () => number;
  timeoutMs?: number;
  minRefreshMs?: number;
}
export const WORLD_CONDITIONS = {
  station: '9413450',
  anchor: [-121.901918, 36.618084] as const,
  timeZone: 'America/Los_Angeles' as const,
  pointUrl: 'https://api.weather.gov/points/36.6181,-121.9019',
  application: 'MontereyBayCozyMapStudy (https://github.com/matthewbcool/Monterey-Bay-Cozy)',
  observationStaleMs: 30 * 60_000,
  forecastStaleMs: 6 * 60 * 60_000,
  minRefreshMs: 60_000,
};
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const iso = (time: number) => new Date(time).toISOString();
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
const numeric = (value: unknown): number | null => {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
};
const timestamp = (value: unknown): string | null => {
  if (typeof value !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? iso(time) : null;
};
const noaaTime = (value: unknown): string | null => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value)) return null;
  const result = timestamp(`${value.replace(' ', 'T')}:00Z`);
  return result?.slice(0, 16).replace('T', ' ') === value ? result : null;
};
const age = (time: string | null, now: number) => time === null ? null : Math.max(0, Math.floor((now - Date.parse(time)) / 1000));

function empty<T>(sourceId: string, mode: ConditionMode, units: string, sourceUrl: string, spatialSupport: string): ConditionChannel<T> {
  return { sourceId, mode, state: 'unavailable', value: null, units, sourceUrl, sourceTime: null, fetchedAt: null,
    validFrom: null, validUntil: null, ageSeconds: null, qualityFlags: [], reason: 'Select Refresh to request this source.', spatialSupport };
}
const tideSupport = 'NOAA Monterey station 9413450 (36.60889 N, 121.89139 W); a nearby tidal reference, not surveyed water height throughout the map.';
function observedEmpty() { return empty<ObservedTide>('noaa-monterey-water-level', 'observed', 'm above MLLW',
  'https://tidesandcurrents.noaa.gov/waterlevels.html?id=9413450', tideSupport); }
function predictedEmpty() { return empty<PredictedTides>('noaa-monterey-tide-predictions', 'predicted', 'm above MLLW; UTC event times',
  'https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=9413450', tideSupport); }
function weatherEmpty() { return empty<WeatherConditions>('nws-monterey-weather', 'forecast', '°C; m/s; %',
  WORLD_CONDITIONS.pointUrl, 'NWS forecast grid discovered for the Aquarium query point; regional forecast, not an observation at the park or a camera.'); }

/** NOAA's published fractional-year approximation, independently expressed here.
 * https://gml.noaa.gov/grad/solcalc/solareqns.PDF
 * This is approximate computed daylight, not measured sunlight/cloud/fog. No moon calculation is claimed.
 */
export function computeLocalDaylight(now: number): ConditionChannel<DaylightConditions> {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: WORLD_CONDITIONS.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find(item => item.type === type)!.value;
  const localDate = `${part('year')}-${part('month')}-${part('day')}`;
  const dayStart = Date.parse(`${localDate}T00:00:00Z`);
  const year = new Date(dayStart).getUTCFullYear();
  const daysInYear = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / DAY;
  const dayOfYear = (dayStart - Date.UTC(year, 0, 1)) / DAY + 1;
  const gamma = 2 * Math.PI / daysInYear * (dayOfYear - 1);
  const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const decl = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  const lat = WORLD_CONDITIONS.anchor[1] * Math.PI / 180;
  const angleCos = Math.cos(90.833 * Math.PI / 180) / (Math.cos(lat) * Math.cos(decl)) - Math.tan(lat) * Math.tan(decl);
  const hourAngle = Math.abs(angleCos) <= 1 ? Math.acos(angleCos) * 180 / Math.PI : null;
  const noonMinutes = 720 - 4 * WORLD_CONDITIONS.anchor[0] - eqTime;
  const sunrise = hourAngle === null ? null : iso(dayStart + (noonMinutes - 4 * hourAngle) * 60_000);
  const sunset = hourAngle === null ? null : iso(dayStart + (noonMinutes + 4 * hourAngle) * 60_000);
  return { sourceId: 'local-sky-clock', mode: 'computed', state: 'computed', units: 'UTC times; displayed in America/Los_Angeles',
    sourceUrl: 'https://gml.noaa.gov/grad/solcalc/solareqns.PDF', sourceTime: iso(now), fetchedAt: null,
    validFrom: sunrise, validUntil: sunset, ageSeconds: 0, reason: 'Approximate astronomical daylight; clouds, fog and local terrain are not included. Moon not implemented.',
    qualityFlags: ['computed approximation; not an observation'], spatialSupport: 'Aquarium query point: 36.618084 N, 121.901918 W.',
    value: { localDate, timeZone: WORLD_CONDITIONS.timeZone, sunrise, sunset,
      isDaylight: sunrise && sunset ? now >= Date.parse(sunrise) && now < Date.parse(sunset) : null } };
}

export function parseObservedTide(raw: unknown, fetchedAt: number): ConditionChannel<ObservedTide> {
  const data = object(raw);
  if (object(data.metadata).id !== WORLD_CONDITIONS.station) throw new Error('NOAA station metadata does not match Monterey 9413450.');
  if (!Array.isArray(data.data)) throw new Error('NOAA did not return an observation.');
  const records = data.data.map(object).map(row => ({ row, time: noaaTime(row.t), height: numeric(row.v) }))
    .filter(row => row.time !== null && row.height !== null).sort((a, b) => a.time!.localeCompare(b.time!));
  const latest = records.at(-1);
  if (!latest) throw new Error('NOAA observation is missing a valid height or UTC timestamp.');
  if (Date.parse(latest.time!) > fetchedAt + 5 * 60_000) throw new Error('NOAA observation timestamp is unexpectedly in the future.');
  const quality = latest.row.q === 'p' ? 'preliminary' : latest.row.q === 'v' ? 'verified' : 'unknown';
  const flags = typeof latest.row.f === 'string' ? [`NOAA f=${latest.row.f}`, `NOAA q=${String(latest.row.q ?? 'missing')}`] : ['NOAA flags missing', `NOAA q=${String(latest.row.q ?? 'missing')}`];
  const sigma = numeric(latest.row.s);
  return { ...observedEmpty(), state: 'observed', value: { heightMetres: latest.height!, datum: 'MLLW', quality, sigmaMetres: sigma !== null && sigma >= 0 ? sigma : null },
    sourceTime: latest.time, fetchedAt: iso(fetchedAt), validFrom: latest.time, ageSeconds: age(latest.time, fetchedAt), qualityFlags: flags, reason: null };
}
export function parseTideEvents(raw: unknown): TideEvent[] {
  const data = object(raw);
  if (!Array.isArray(data.predictions)) throw new Error('NOAA did not return tide predictions.');
  const events: TideEvent[] = [];
  for (const item of data.predictions.slice(0, 500)) {
    const row = object(item), time = noaaTime(row.t), heightMetres = numeric(row.v);
    if (time && heightMetres !== null && (row.type === 'H' || row.type === 'L')) events.push({ time, heightMetres, type: row.type });
  }
  if (!events.length) throw new Error('NOAA predictions have no valid high/low events.');
  return events.sort((a, b) => a.time.localeCompare(b.time));
}
export function parseWindSpeed(value: unknown): [number, number] | null {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)(?:\s+to\s+(\d+(?:\.\d+)?))?\s+(mph|km\/h|m\/s|knots)$/i);
  if (!match) return null;
  const factor = ({ mph: .44704, 'km/h': 1 / 3.6, 'm/s': 1, knots: .514444 })[match[3].toLowerCase()]!;
  const low = Number(match[1]) * factor, high = Number(match[2] ?? match[1]) * factor;
  return high >= low ? [low, high] : null;
}
interface ForecastPeriod { start: string; end: string; value: WeatherConditions }
export function parseWeatherForecast(raw: unknown): { sourceTime: string; periods: ForecastPeriod[] } {
  const properties = object(object(raw).properties);
  const sourceTime = timestamp(properties.updateTime);
  if (!sourceTime || !Array.isArray(properties.periods)) throw new Error('NWS forecast is missing its issue time or periods.');
  const periods: ForecastPeriod[] = [];
  for (const item of properties.periods.slice(0, 200)) {
    const row = object(item), start = timestamp(row.startTime), end = timestamp(row.endTime);
    if (!start || !end || end <= start) continue;
    const temperature = numeric(row.temperature);
    const precipitation = numeric(object(row.probabilityOfPrecipitation).value);
    const temperatureC = temperature === null ? null : row.temperatureUnit === 'C' ? temperature : row.temperatureUnit === 'F' ? (temperature - 32) * 5 / 9 : null;
    periods.push({ start, end, value: { summary: typeof row.shortForecast === 'string' ? row.shortForecast.slice(0, 240) : 'Forecast description unavailable',
      temperatureC, windSpeedMps: parseWindSpeed(row.windSpeed), windDirection: typeof row.windDirection === 'string' ? row.windDirection.slice(0, 20) : null,
      precipitationPercent: object(row.probabilityOfPrecipitation).unitCode === 'wmoUnit:percent' && precipitation !== null && precipitation >= 0 && precipitation <= 100 ? precipitation : null } });
  }
  if (!periods.length) throw new Error('NWS forecast has no valid time periods.');
  return { sourceTime, periods: periods.sort((a, b) => a.start.localeCompare(b.start)) };
}

/** The browser controls User-Agent; Origin/Referer remain browser-owned. A future shared
 * game-service adapter must set this application User-Agent itself, as required by NWS.
 */
export function createWorldConditionsService(options: WorldConditionsOptions = {}) {
  const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
  const now = options.now ?? Date.now;
  const timeoutMs = Math.max(1, options.timeoutMs ?? 12_000);
  const minRefreshMs = Math.max(0, options.minRefreshMs ?? WORLD_CONDITIONS.minRefreshMs);
  let observed = observedEmpty(), predicted = predictedEmpty(), weather = weatherEmpty();
  let events: TideEvent[] = [], periods: ForecastPeriod[] = [];
  let observedUntil = 0, predictedUntil = 0, weatherUntil = 0, pointUntil = 0;
  let forecastUrl: string | null = null;
  let lastRequestedAt: number | null = null;
  let requestBeforeRefresh: number | null = null;
  let retryNotBefore = 0;
  let pending: Promise<WorldConditionsSnapshot> | null = null;
  let controller: AbortController | null = null;
  let disposed = false;

  function getSnapshot(): WorldConditionsSnapshot {
    const time = now();
    const obs = { ...observed, ageSeconds: age(observed.sourceTime, time), qualityFlags: [...observed.qualityFlags] };
    if (obs.value && obs.state !== 'stale' && (obs.ageSeconds ?? Infinity) * 1000 > WORLD_CONDITIONS.observationStaleMs) {
      obs.state = 'stale'; obs.reason = 'Observation is older than the 30-minute prototype freshness limit.';
    }
    const nextHigh = events.find(event => event.type === 'H' && Date.parse(event.time) > time) ?? null;
    const nextLow = events.find(event => event.type === 'L' && Date.parse(event.time) > time) ?? null;
    const pred = { ...predicted, ageSeconds: age(predicted.fetchedAt, time), qualityFlags: [...predicted.qualityFlags] };
    if (pred.value) {
      pred.value = { datum: 'MLLW', nextHigh, nextLow };
      if (!nextHigh || !nextLow || (pred.ageSeconds ?? Infinity) * 1000 > DAY) {
        pred.state = 'stale'; pred.reason ??= 'Prediction coverage has expired or the cached prediction is over 24 hours old.';
      }
    }
    const forecast = { ...weather, ageSeconds: age(weather.sourceTime, time), qualityFlags: [...weather.qualityFlags] };
    if (forecast.value) {
      const current = periods.find(period => Date.parse(period.start) <= time && Date.parse(period.end) > time);
      if (current) { forecast.value = { ...current.value }; forecast.validFrom = current.start; forecast.validUntil = current.end; }
      if (!current || (forecast.ageSeconds ?? Infinity) * 1000 > WORLD_CONDITIONS.forecastStaleMs) {
        forecast.state = 'stale'; forecast.reason ??= 'Forecast has no current valid period or its issue time is over six hours old.';
      }
    }
    // Consumers may format/change their local view without mutating cached source values.
    return structuredClone({ schemaVersion: 1, generatedAt: iso(time), lastRequestedAt: lastRequestedAt === null ? null : iso(lastRequestedAt),
      nextRefreshAt: lastRequestedAt === null ? null : iso(Math.max(lastRequestedAt + minRefreshMs, retryNotBefore)),
      observedTide: obs, predictedTides: pred, weather: forecast, daylight: computeLocalDaylight(time) });
  }
  function fail<T>(channel: ConditionChannel<T>, error: unknown): ConditionChannel<T> {
    return { ...channel, state: channel.value ? 'stale' : 'unavailable', reason: error instanceof Error ? error.message : 'Source request failed.' };
  }
  async function request(url: string, signal: AbortSignal, nws = false, revalidate = false): Promise<{ data: unknown; cacheMs: number }> {
    const child = new AbortController();
    const onAbort = () => child.abort(new Error('Refresh canceled.'));
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) onAbort();
    const timeout = setTimeout(() => child.abort(new Error('Source request timed out.')), timeoutMs);
    let rejectAbort: (reason: unknown) => void = () => {};
    const aborted = new Promise<never>((_, reject) => { rejectAbort = reject; });
    const rejectOnAbort = () => rejectAbort(child.signal.reason);
    child.signal.addEventListener('abort', rejectOnAbort, { once: true });
    if (child.signal.aborted) rejectOnAbort();
    try {
      const work = (async () => {
        const response = await fetcher(url, { signal: child.signal, cache: revalidate ? 'no-cache' : 'default', credentials: 'omit',
          headers: nws ? { Accept: 'application/geo+json', 'User-Agent': WORLD_CONDITIONS.application } : { Accept: 'application/json' } });
        if (!response.ok) {
          const retryAfter = response.headers.get('retry-after');
          if (retryAfter) {
            const seconds = /^\d+$/.test(retryAfter) ? Number(retryAfter) : null;
            const deadline = seconds === null ? Date.parse(retryAfter) : now() + seconds * 1000;
            if (Number.isFinite(deadline)) retryNotBefore = Math.max(retryNotBefore, deadline);
          }
          throw new Error(`Source returned HTTP ${response.status}.`);
        }
        const raw = await response.text();
        if (raw.length > 1_000_000) throw new Error('Source response exceeded the prototype size limit.');
        const maxAge = response.headers.get('cache-control')?.match(/(?:^|,)\s*max-age=(\d+)/i)?.[1];
        return { data: JSON.parse(raw) as unknown, cacheMs: maxAge ? Math.min(DAY, Number(maxAge) * 1000) : 0 };
      })();
      return await Promise.race([work, aborted]);
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener('abort', onAbort);
      child.signal.removeEventListener('abort', rejectOnAbort);
    }
  }
  function noaaUrl(product: 'water_level' | 'predictions', time: number) {
    const query = new URLSearchParams({ station: WORLD_CONDITIONS.station, product, datum: 'MLLW', units: 'metric', time_zone: 'gmt', format: 'json', application: 'MontereyBayCozyMapStudy' });
    if (product === 'water_level') query.set('date', 'latest');
    else { query.set('begin_date', iso(time).slice(0, 10).replaceAll('-', '')); query.set('range', '72'); query.set('interval', 'hilo'); }
    return `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?${query}`;
  }
  async function refreshObserved(signal: AbortSignal, time: number, stale: boolean) {
    if (time < observedUntil && !stale) return;
    try {
      const result = await request(noaaUrl('water_level', time), signal, false, stale);
      const next = parseObservedTide(result.data, now());
      if (signal.aborted) return;
      observed = next; observedUntil = now() + Math.max(6 * 60_000, Math.min(30 * 60_000, result.cacheMs));
    } catch (error) { if (!disposed && !signal.aborted) observed = fail(observed, error); }
  }
  async function refreshPredicted(signal: AbortSignal, time: number, stale: boolean) {
    if (time < predictedUntil && !stale) return;
    try {
      const result = await request(noaaUrl('predictions', time), signal, false, stale);
      const nextEvents = parseTideEvents(result.data), fetched = now();
      const nextHigh = nextEvents.find(event => event.type === 'H' && Date.parse(event.time) > fetched) ?? null;
      const nextLow = nextEvents.find(event => event.type === 'L' && Date.parse(event.time) > fetched) ?? null;
      if (!nextHigh || !nextLow) throw new Error('NOAA predictions do not cover both a future high and low tide.');
      if (signal.aborted) return;
      events = nextEvents;
      predicted = { ...predictedEmpty(), state: 'predicted', value: { datum: 'MLLW', nextHigh, nextLow }, sourceTime: null,
        fetchedAt: iso(fetched), validFrom: events[0].time, validUntil: events.at(-1)!.time, ageSeconds: 0, reason: null,
        qualityFlags: ['Astronomical prediction; weather-driven anomalies excluded', 'Provider issue time not supplied; age is since fetch'] };
      predictedUntil = fetched + Math.max(6 * HOUR, result.cacheMs);
    } catch (error) { if (!disposed && !signal.aborted) predicted = fail(predicted, error); }
  }
  async function refreshWeather(signal: AbortSignal, time: number, stale: boolean) {
    if (time < weatherUntil && !stale) return;
    try {
      if (!forecastUrl || time >= pointUntil) {
        const discovered = await request(WORLD_CONDITIONS.pointUrl, signal, true);
        const candidate = object(object(discovered.data).properties).forecastHourly;
        if (typeof candidate !== 'string') throw new Error('NWS point lookup has no hourly forecast.');
        const url = new URL(candidate);
        if (url.origin !== 'https://api.weather.gov' || !/^\/gridpoints\/[A-Z]+\/\d+,\d+\/forecast\/hourly$/.test(url.pathname)) throw new Error('NWS discovery returned an unexpected forecast endpoint.');
        url.searchParams.set('units', 'si');
        forecastUrl = url.href; pointUntil = now() + DAY;
      }
      const result = await request(forecastUrl, signal, true, stale), parsed = parseWeatherForecast(result.data), fetched = now();
      const current = parsed.periods.find(period => Date.parse(period.start) <= fetched && Date.parse(period.end) > fetched);
      if (!current) throw new Error('NWS forecast has no period valid at the current time.');
      if (Date.parse(parsed.sourceTime) > fetched + 5 * 60_000) throw new Error('NWS forecast issue time is unexpectedly in the future.');
      if (signal.aborted) return;
      periods = parsed.periods;
      weather = { ...weatherEmpty(), state: 'forecast', value: current.value, sourceUrl: forecastUrl, sourceTime: parsed.sourceTime,
        fetchedAt: iso(fetched), validFrom: current.start, validUntil: current.end, ageSeconds: age(parsed.sourceTime, fetched), reason: null,
        qualityFlags: ['Forecast, not a measurement', 'Wind direction is where wind comes from'] };
      weatherUntil = fetched + Math.max(15 * 60_000, Math.min(HOUR, result.cacheMs));
    } catch (error) { if (!disposed && !signal.aborted) weather = fail(weather, error); }
  }
  function refresh(): Promise<WorldConditionsSnapshot> {
    if (disposed) return Promise.reject(new Error('Conditions service has been disposed.'));
    if (pending) return pending;
    const time = now();
    if (time < retryNotBefore || (lastRequestedAt !== null && time - lastRequestedAt < minRefreshMs)) return Promise.resolve(getSnapshot());
    const snapshot = getSnapshot();
    requestBeforeRefresh = lastRequestedAt;
    lastRequestedAt = time;
    controller = new AbortController();
    const signal = controller.signal;
    pending = Promise.all([refreshObserved(signal, time, snapshot.observedTide.state === 'stale'),
      refreshPredicted(signal, time, snapshot.predictedTides.state === 'stale'), refreshWeather(signal, time, snapshot.weather.state === 'stale')])
      .then(() => getSnapshot()).finally(() => { pending = null; controller = null; });
    return pending;
  }
  return { getSnapshot, refresh, get isRefreshing() { return pending !== null; },
    cancel() {
      if (!controller) return;
      controller.abort();
      // Navigation is not a provider failure, and an interrupted first load should
      // be retryable immediately. A provider Retry-After remains respected.
      lastRequestedAt = requestBeforeRefresh;
    }, dispose() { disposed = true; controller?.abort(); } };
}
