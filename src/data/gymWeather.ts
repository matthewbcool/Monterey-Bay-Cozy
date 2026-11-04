/** NWS observations + grid forecasts for Lovers Point. Never fetch from a frame loop. */
export type WeatherSource = 'observation' | 'forecast' | 'unavailable';
export interface WeatherValue<T> {
  value: T | null;
  source: WeatherSource;
  state: 'current' | 'stale' | 'unavailable';
  time: string | null;
  sourceUrl: string | null;
  units: string;
  validFrom: string | null;
  validUntil: string | null;
}
export interface GymWeatherSnapshot {
  fetchedAt: string | null;
  nextRefreshAt: string | null;
  refreshing: boolean;
  errors: string[];
  /** A regional observation is never represented as a sensor at the park. */
  station: { id: string; name: string; distanceKm: number | null } | null;
  cloudCover01: WeatherValue<number>;
  /** Last-hour observed average, or grid interval forecast average; never probability. */
  rainMmHour: WeatherValue<number>;
  visibilityMetres: WeatherValue<number>;
  windSpeedMps: WeatherValue<number>;
  /** Meteorological FROM bearing, clockwise from north. */
  windFromDegrees: WeatherValue<number>;
  temperatureC: WeatherValue<number>;
  precipitationProbability01: WeatherValue<number>;
  summary: string | null;
  summarySource: WeatherValue<string>;
}
export interface GymWeatherOptions {
  fetch?: typeof globalThis.fetch;
  now?: () => number;
  timeoutMs?: number;
  refreshMs?: number;
}
export const GYM_WEATHER = {
  latitude: 36.6265, longitude: -121.9166,
  pointUrl: 'https://api.weather.gov/points/36.6265,-121.9166',
  refreshMs: 10 * 60_000,
  observationStaleMs: 90 * 60_000,
  forecastStaleMs: 6 * 3_600_000,
  mappingRefreshMs: 24 * 3_600_000,
} as const;
type RecordValue = Record<string, unknown>;
type FieldName = 'cloudCover01' | 'rainMmHour' | 'visibilityMetres' | 'windSpeedMps' | 'windFromDegrees' | 'temperatureC' | 'precipitationProbability01';
const FIELD_UNITS: Record<FieldName, string> = { cloudCover01: 'fraction', rainMmHour: 'mm/h', visibilityMetres: 'm', windSpeedMps: 'm/s', windFromDegrees: 'degrees from north', temperatureC: '°C', precipitationProbability01: 'fraction' };
const obj = (x: unknown): RecordValue => x !== null && typeof x === 'object' ? x as RecordValue : {};
const num = (x: unknown): number | null => typeof x === 'number' && Number.isFinite(x) ? x : null;
const text = (x: unknown): string | null => typeof x === 'string' && x.trim() ? x : null;
const array = (x: unknown): unknown[] => Array.isArray(x) ? x : [];
const date = (x: unknown): string | null => typeof x === 'string' && /(Z|[+-]\d\d:\d\d)$/.test(x) && Number.isFinite(Date.parse(x)) ? new Date(x).toISOString() : null;
const bounded = (x: number | null, min: number, max = Infinity) => x !== null && x >= min && x <= max ? x : null;
const nwsUrl = (x: unknown): string | null => {
  if (typeof x !== 'string') return null;
  try { const url = new URL(x); return url.protocol === 'https:' && url.hostname === 'api.weather.gov' ? url.href : null; } catch { return null; }
};
function missing<T>(units: string): WeatherValue<T> { return { value: null, source: 'unavailable', state: 'unavailable', time: null, sourceUrl: null, units, validFrom: null, validUntil: null }; }
function quantity(x: unknown, dimension: 'length' | 'speed' | 'temperature' | 'percent' | 'angle'): number | null {
  const q = obj(x), v = num(q.value), unit = text(q.unitCode)?.split(':').at(-1);
  if (v === null) return null;
  if (dimension === 'length') return unit === 'm' ? v : unit === 'mm' ? v / 1000 : unit === 'km' ? v * 1000 : null;
  if (dimension === 'speed') return unit === 'm_s-1' ? v : unit === 'km_h-1' ? v / 3.6 : unit === 'kn' ? v * .514444 : unit === 'mi_h-1' ? v * .44704 : null;
  if (dimension === 'temperature') return unit === 'degC' ? v : unit === 'degF' ? (v - 32) / 1.8 : null;
  if (dimension === 'percent') return unit === 'percent' ? bounded(v / 100, 0, 1) : null;
  return unit === 'degree_(angle)' ? bounded(v, 0, 360) : null;
}
function interval(value: unknown): [number, number] | null {
  if (typeof value !== 'string') return null;
  const [start, length] = value.split('/'), from = Date.parse(start);
  if (!Number.isFinite(from)) return null;
  const parts = /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(length ?? '');
  const until = parts ? from + ((Number(parts[1] ?? 0) * 24 + Number(parts[2] ?? 0)) * 3600 + Number(parts[3] ?? 0) * 60 + Number(parts[4] ?? 0)) * 1000 : Date.parse(length);
  return Number.isFinite(until) && until > from ? [from, until] : null;
}
interface Payload { data: RecordValue; url: string }
interface Mapping { hourly: string | null; grid: string | null; stations: string | null; at: number }
interface Observation extends Payload { station: NonNullable<GymWeatherSnapshot['station']> }
function sourceValue<T>(value: T | null, source: Exclude<WeatherSource, 'unavailable'>, time: string | null, url: string, units: string, now: number, valid?: [number, number]): WeatherValue<T> {
  if (value === null || time === null) return missing(units);
  const staleMs = source === 'observation' ? GYM_WEATHER.observationStaleMs : GYM_WEATHER.forecastStaleMs;
  const stale = now - Date.parse(time) > staleMs || Date.parse(time) - now > 5 * 60_000 || (valid !== undefined && (now < valid[0] || now >= valid[1]));
  return { value, source, time, sourceUrl: url, units, state: stale ? 'stale' : 'current', validFrom: valid ? new Date(valid[0]).toISOString() : null, validUntil: valid ? new Date(valid[1]).toISOString() : null };
}
function gridValue(payload: Payload | null, key: string, dimension: Parameters<typeof quantity>[1], units: string, now: number, multiply = 1, averagePerHour = false): WeatherValue<number> {
  if (!payload) return missing(units);
  const props = obj(payload.data.properties), series = obj(props[key]);
  const entry = array(series.values).map(obj).map(v => ({ v, period: interval(v.validTime) })).find(({ period }) => period && period[0] <= now && now < period[1]);
  if (!entry?.period) return missing(units);
  const value = quantity({ value: entry.v.value, unitCode: series.uom }, dimension);
  return sourceValue(value === null ? null : value * multiply / (averagePerHour ? (entry.period[1] - entry.period[0]) / 3_600_000 : 1), 'forecast', date(props.updateTime), payload.url, units, now, entry.period);
}
const bearings: Record<string, number> = Object.fromEntries(['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'].map((x, i) => [x, i * 22.5]));
function hourlyWind(value: unknown): number | null {
  if (typeof value !== 'string') return quantity(value, 'speed');
  const m = /^(\d+(?:\.\d+)?)(?: to (\d+(?:\.\d+)?))? (mph|km\/h|m\/s|knots)$/.exec(value);
  return m ? (Number(m[1]) + Number(m[2] ?? m[1])) / 2 * ({ mph: .44704, 'km/h': 1 / 3.6, 'm/s': 1, knots: .514444 }[m[3]] ?? 1) : null;
}
function distanceKm(coordinates: unknown): number | null {
  const [lon, lat] = array(coordinates).map(num);
  if (lon === null || lat === null || lon === undefined || lat === undefined) return null;
  const rad = Math.PI / 180, dLat = (lat - GYM_WEATHER.latitude) * rad, dLon = (lon - GYM_WEATHER.longitude) * rad;
  return 12742.0176 * Math.asin(Math.sqrt(Math.min(1, Math.sin(dLat / 2) ** 2 + Math.cos(lat * rad) * Math.cos(GYM_WEATHER.latitude * rad) * Math.sin(dLon / 2) ** 2)));
}

export function createGymWeatherClient(options: GymWeatherOptions = {}) {
  const fetcher = options.fetch ?? globalThis.fetch, clock = options.now ?? Date.now;
  const refreshMs = Math.max(60_000, options.refreshMs ?? GYM_WEATHER.refreshMs);
  let mapping: Mapping | null = null, hourly: Payload | null = null, grid: Payload | null = null;
  let observation: Observation | null = null, fetchedAt: string | null = null, attemptedAt: number | null = null;
  let stations: Array<{ url: string; station: Observation['station'] }> = [];
  type RequestContext = { controller: AbortController; cancelled: boolean };
  let errors: string[] = [], disposed = false, active: Promise<GymWeatherSnapshot> | null = null, currentRequest: RequestContext | null = null;
  function snapshot(now: number | Date = clock()): GymWeatherSnapshot {
    const time = +now;
    const result = { fetchedAt, nextRefreshAt: attemptedAt === null ? null : new Date(attemptedAt + refreshMs).toISOString(), refreshing: active !== null,
      errors: [...errors], station: observation?.station ?? null, summary: null, summarySource: missing<string>('description') } as GymWeatherSnapshot;
    for (const key of Object.keys(FIELD_UNITS) as FieldName[]) result[key] = missing(FIELD_UNITS[key]);
    const gridFields: Array<[FieldName, string, Parameters<typeof quantity>[1], number?, boolean?]> = [
      ['cloudCover01', 'skyCover', 'percent'], ['visibilityMetres', 'visibility', 'length'], ['windSpeedMps', 'windSpeed', 'speed'],
      ['windFromDegrees', 'windDirection', 'angle'], ['temperatureC', 'temperature', 'temperature'],
      ['precipitationProbability01', 'probabilityOfPrecipitation', 'percent'], ['rainMmHour', 'quantitativePrecipitation', 'length', 1000, true],
    ];
    for (const [key, series, dimension, scale, average] of gridFields) {
      result[key] = gridValue(grid, series, dimension, FIELD_UNITS[key], time, scale, average);
      if (['rainMmHour', 'visibilityMetres', 'windSpeedMps'].includes(key) && result[key].value !== null && result[key].value! < 0) result[key] = missing(FIELD_UNITS[key]);
    }
    if (hourly) {
      const p = obj(hourly.data.properties), period = array(p.periods).map(obj).find(p => Date.parse(String(p.startTime)) <= time && time < Date.parse(String(p.endTime)));
      if (period) {
        const valid: [number, number] = [Date.parse(String(period.startTime)), Date.parse(String(period.endTime))];
        const issue = date(p.updateTime) ?? date(p.generatedAt);
        result.summarySource = sourceValue(text(period.shortForecast), 'forecast', issue, hourly.url, 'description', time, valid);
        const fallback = (key: FieldName, value: number | null) => {
          if (result[key].state !== 'current') {
            const next = sourceValue(value, 'forecast', issue, hourly!.url, FIELD_UNITS[key], time, valid);
            if (next.value !== null) result[key] = next;
          }
        };
        fallback('windSpeedMps', bounded(hourlyWind(period.windSpeed), 0));
        fallback('windFromDegrees', bearings[String(period.windDirection)] ?? null);
        fallback('temperatureC', quantity({ value: period.temperature, unitCode: `wmoUnit:deg${period.temperatureUnit}` }, 'temperature'));
        fallback('precipitationProbability01', quantity(period.probabilityOfPrecipitation, 'percent'));
        // QPF is liquid equivalent. Do not turn a snow/ice forecast into rain particles.
        if (/snow|sleet|ice pellets|freezing/i.test(String(period.shortForecast))) result.rainMmHour = missing('mm/h');
      }
    }
    if (observation) {
      const p = obj(observation.data.properties), issue = date(p.timestamp);
      const values: Partial<Record<FieldName, number | null>> = {
        temperatureC: quantity(p.temperature, 'temperature'), windSpeedMps: bounded(quantity(p.windSpeed, 'speed'), 0),
        windFromDegrees: quantity(p.windDirection, 'angle'), visibilityMetres: bounded(quantity(p.visibility, 'length'), 0),
        rainMmHour: /snow|sleet|freezing/i.test(String(p.textDescription)) ? null : (() => { const metres = quantity(p.precipitationLastHour, 'length'); return metres === null ? null : bounded(metres * 1000, 0); })(),
      };
      const layerAmounts = array(p.cloudLayers).map(layer => ({ CLR: 0, SKC: 0, FEW: .2, SCT: .4, BKN: .75, OVC: 1, VV: 1 }[String(obj(layer).amount)]));
      // Empty/missing layers are unknown, not automatically clear sky.
      if (layerAmounts.length && layerAmounts.every(x => x !== undefined)) values.cloudCover01 = Math.max(...layerAmounts as number[]);
      for (const [key, value] of Object.entries(values) as [FieldName, number | null][]) {
        const observed = sourceValue(value, 'observation', issue, observation.url, FIELD_UNITS[key], time);
        if (observed.state === 'current' || result[key].value === null && observed.value !== null) result[key] = observed;
      }
      const summary = sourceValue(text(p.textDescription), 'observation', issue, observation.url, 'description', time);
      if (summary.state === 'current' || result.summarySource.value === null && summary.value !== null) result.summarySource = summary;
    }
    result.summary = result.summarySource.value;
    return result;
  }
  async function request(url: string, signal: AbortSignal): Promise<Payload> {
    signal.throwIfAborted();
    const response = await fetcher(url, { signal, headers: { Accept: 'application/geo+json' } });
    if (!response.ok) throw new Error(`NWS returned HTTP ${response.status}`);
    const data = obj(await response.json());
    signal.throwIfAborted();
    if (!data.properties && !data.features) throw new Error('NWS returned an invalid payload');
    return { data, url };
  }
  function cancelRequest(context: RequestContext | null) {
    if (!context) return;
    context.cancelled = true;
    context.controller.abort();
    if (currentRequest === context) {
      currentRequest = null;
      active = null;
      // Navigation did not complete a refresh. Re-entry may retry immediately, including
      // in this same turn before the old abort rejection finishes unwinding.
      attemptedAt = null;
    }
  }
  async function run(now: number, context: RequestContext, signal?: AbortSignal): Promise<GymWeatherSnapshot> {
    errors = [];
    const runErrors: string[] = [], abort = context.controller;
    const cancel = () => cancelRequest(context);
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) cancel();
    // Timeout remains a provider failure and keeps the normal retry cooldown.
    const timer = setTimeout(() => abort.abort(new Error('NWS request timed out')), options.timeoutMs ?? 12_000);
    const attempt = async <T>(label: string, task: () => Promise<T>): Promise<T | null> => {
      try { return await task(); } catch (error) {
        if (!disposed && !context.cancelled) runErrors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
        return null;
      }
    };
    try {
      if (!mapping || now - mapping.at >= GYM_WEATHER.mappingRefreshMs) {
        const point = await attempt('Location lookup', () => request(GYM_WEATHER.pointUrl, abort.signal));
        if (point && currentRequest === context && !context.cancelled) { const p = obj(point.data.properties); mapping = { hourly: nwsUrl(p.forecastHourly), grid: nwsUrl(p.forecastGridData), stations: nwsUrl(p.observationStations), at: now }; stations = []; }
      }
      if (disposed || abort.signal.aborted) return snapshot();
      if (!mapping) return snapshot();
      const endpoints = mapping;
      const [newHourly, newGrid, newObservation] = await Promise.all([
        endpoints.hourly ? attempt('Hourly forecast', () => request(`${endpoints.hourly}${endpoints.hourly!.includes('?') ? '&' : '?'}units=si`, abort.signal)) : Promise.resolve(null),
        endpoints.grid ? attempt('Grid forecast', () => request(endpoints.grid!, abort.signal)) : Promise.resolve(null),
        (async () => {
          if (!stations.length && endpoints.stations) {
            const list = await attempt('Observation stations', () => request(endpoints.stations!, abort.signal));
            if (list && currentRequest === context && !context.cancelled) stations = array(list.data.features).slice(0, 3).flatMap(feature => {
              const f = obj(feature), p = obj(f.properties), id = text(p.stationIdentifier), url = nwsUrl(f.id) ?? (id && /^[A-Za-z0-9_-]+$/.test(id) ? `https://api.weather.gov/stations/${id}` : null);
              return url ? [{ url: `${url}/observations/latest`, station: { id: id ?? url.split('/').at(-1)!, name: text(p.name) ?? id ?? 'Nearby station', distanceKm: distanceKm(obj(f.geometry).coordinates) } }] : [];
            });
          }
          // Nearest usable fresh station, then nearest stale station if no fresh response.
          const observations = await Promise.all(stations.map(async item => {
            const response = await attempt(`Observation ${item.station.id}`, () => request(item.url, abort.signal));
            const timestamp = response && date(obj(response.data.properties).timestamp);
            return response && timestamp ? { ...response, station: item.station } : null;
          }));
          const valid = observations.filter((o): o is Observation => o !== null);
          return valid.find(o => { const stamp = Date.parse(String(obj(o.data.properties).timestamp)); return now - stamp <= GYM_WEATHER.observationStaleMs && stamp - now <= 5 * 60_000; }) ?? valid[0] ?? null;
        })(),
      ]);
      if (!disposed && !context.cancelled && currentRequest === context) {
        if (newHourly) hourly = newHourly;
        if (newGrid) grid = newGrid;
        if (newObservation) observation = newObservation;
        if (newHourly || newGrid || newObservation) fetchedAt = new Date(clock()).toISOString();
      }
      return snapshot();
    } finally {
      clearTimeout(timer); signal?.removeEventListener('abort', cancel);
      if (currentRequest === context) { errors = runErrors; currentRequest = null; }
    }
  }
  function refresh(requestOptions: { force?: boolean; signal?: AbortSignal } = {}): Promise<GymWeatherSnapshot> {
    if (active) return active;
    const now = clock();
    if (disposed || requestOptions.signal?.aborted || !requestOptions.force && attemptedAt !== null && now - attemptedAt < refreshMs) return Promise.resolve(snapshot());
    attemptedAt = now;
    const context: RequestContext = { controller: new AbortController(), cancelled: false };
    currentRequest = context;
    const pending = run(now, context, requestOptions.signal).finally(() => {
      // An older cancelled request cannot clear the new request's coalescing handle.
      if (active === pending) active = null;
    }).then(() => snapshot());
    active = pending;
    return pending;
  }
  return { refresh, snapshot, cancel() { cancelRequest(currentRequest); }, dispose() { disposed = true; cancelRequest(currentRequest); }, get isRefreshing() { return active !== null; } };
}
