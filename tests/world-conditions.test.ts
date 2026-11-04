import test from 'node:test';
import assert from 'node:assert/strict';
import { computeLocalDaylight, createWorldConditionsService, parseObservedTide, parseTideEvents, parseWeatherForecast, parseWindSpeed, WORLD_CONDITIONS } from '../src/data/worldConditions';

// Fixed provider-shaped fixtures: never presented as live conditions by the UI.
const START = Date.parse('2026-10-23T04:18:00Z');
const observed = (value: unknown = '1.689') => ({ metadata: { id: '9413450' }, data: [{ t: '2026-10-23 04:12', v: value, s: '0.023', f: '2,0,1,0', q: 'p' }] });
const predictions = { predictions: [
  { t: '2026-10-23 03:38', v: '1.344', type: 'H' }, { t: '2026-10-23 09:44', v: '0.297', type: 'L' },
  { t: '2026-10-23 16:05', v: '1.565', type: 'H' }, { t: '2026-10-23 22:28', v: '0.299', type: 'L' },
  { t: '2026-10-24 04:29', v: '1.346', type: 'H' }, { t: '2026-10-24 10:14', v: '-0.05', type: 'L' },
] };
const forecast = () => ({ properties: { updateTime: '2026-10-23T03:22:17+00:00', periods: [
  { startTime: '2026-10-22T21:00:00-07:00', endTime: '2026-10-22T22:00:00-07:00', temperature: 16, temperatureUnit: 'C',
    probabilityOfPrecipitation: { unitCode: 'wmoUnit:percent', value: 31 }, windSpeed: '22 km/h', windDirection: 'WNW', shortForecast: 'Chance Light Rain' },
  { startTime: '2026-10-22T22:00:00-07:00', endTime: '2026-10-22T23:00:00-07:00', temperature: null, temperatureUnit: 'C',
    probabilityOfPrecipitation: { unitCode: 'wmoUnit:percent', value: null }, windSpeed: 'unknown', windDirection: null, shortForecast: 'Rain' },
] } });
function fixtureFetch() {
  const urls: string[] = [];
  const fetcher: typeof fetch = async input => {
    const url = String(input); urls.push(url);
    if (url.includes('product=water_level')) return Response.json(observed());
    if (url.includes('product=predictions')) return Response.json(predictions);
    if (url.includes('/points/')) return Response.json({ properties: { forecastHourly: 'https://api.weather.gov/gridpoints/MTR/92,51/forecast/hourly' } });
    if (url.includes('/forecast/hourly')) return Response.json(forecast());
    throw new Error(`Unexpected request ${url}`);
  };
  return { fetcher, urls };
}

test('Conditions are explicitly requested; NOAA datum/UTC/flags and discovered NWS SI forecast stay distinct', async () => {
  const fixture = fixtureFetch();
  const service = createWorldConditionsService({ fetch: fixture.fetcher, now: () => START });
  const before = service.getSnapshot();
  assert.equal(fixture.urls.length, 0);
  assert.equal(before.observedTide.state, 'unavailable');
  assert.equal(before.daylight.state, 'computed');
  assert.equal(before.daylight.fetchedAt, null);
  const snapshot = await service.refresh();
  assert.equal(fixture.urls.length, 4);
  assert.equal(snapshot.observedTide.state, 'observed');
  assert.equal(snapshot.observedTide.value?.heightMetres, 1.689);
  assert.equal(snapshot.observedTide.value?.datum, 'MLLW');
  assert.equal(snapshot.observedTide.value?.quality, 'preliminary');
  assert.equal(snapshot.observedTide.value?.sigmaMetres, .023);
  assert.equal(snapshot.observedTide.sourceTime, '2026-10-23T04:12:00.000Z');
  assert.equal(snapshot.observedTide.ageSeconds, 360);
  assert.deepEqual(snapshot.observedTide.qualityFlags, ['NOAA f=2,0,1,0', 'NOAA q=p']);
  assert.equal(snapshot.predictedTides.state, 'predicted');
  assert.equal(snapshot.predictedTides.sourceTime, null, 'Do not manufacture a provider prediction issue time');
  assert.equal(snapshot.predictedTides.value?.nextHigh?.time, '2026-10-23T16:05:00.000Z');
  assert.equal(snapshot.predictedTides.value?.nextLow?.time, '2026-10-23T09:44:00.000Z');
  assert.equal(snapshot.weather.state, 'forecast');
  assert.equal(snapshot.weather.value?.temperatureC, 16);
  assert.equal(snapshot.weather.value?.precipitationPercent, 31);
  assert.ok(Math.abs(snapshot.weather.value!.windSpeedMps![0] - 22 / 3.6) < 1e-8);
  assert.match(snapshot.weather.sourceUrl, /units=si/);
  assert.ok(fixture.urls.some(url => url === WORLD_CONDITIONS.pointUrl));
  const predictionUrl = new URL(fixture.urls.find(url => url.includes('product=predictions'))!);
  assert.equal(predictionUrl.searchParams.get('interval'), 'hilo');
  assert.equal(predictionUrl.searchParams.get('range'), '72');
  assert.equal(predictionUrl.searchParams.get('time_zone'), 'gmt');
  assert.equal(predictionUrl.searchParams.get('datum'), 'MLLW');
  service.dispose();
});

test('Provider missing values never silently become zero, invalid dates/stations fail, negative tide remains valid', () => {
  for (const value of [null, '', ' ', 'MM', 'NaN', false, {}, Infinity]) assert.throws(() => parseObservedTide(observed(value), START));
  assert.equal(parseObservedTide(observed('0'), START).value?.heightMetres, 0);
  assert.equal(parseObservedTide(observed('-.05'), START).value?.heightMetres, -.05);
  assert.throws(() => parseObservedTide({ ...observed(), metadata: { id: '9414290' } }, START), /station/);
  assert.throws(() => parseObservedTide({ ...observed(), data: [{ t: '2026-02-31 04:12', v: '1.5' }] }, START));
  assert.throws(() => parseObservedTide(observed(), START - 30 * 60_000), /future/);
  assert.throws(() => parseTideEvents({ predictions: [{ t: '2026-10-23 09:44', v: '', type: 'L' }] }));
  assert.equal(parseTideEvents(predictions).at(-1)!.heightMetres, -.05);
  assert.equal(parseWeatherForecast(forecast()).periods[1].value.temperatureC, null);
  assert.equal(parseWeatherForecast(forecast()).periods[1].value.precipitationPercent, null);
  assert.equal(parseWeatherForecast(forecast()).periods[1].value.windSpeedMps, null);
  assert.deepEqual(parseWindSpeed('5 to 10 mph'), [2.2352, 4.4704]);
  assert.deepEqual(parseWindSpeed('0 m/s'), [0, 0]);
  assert.equal(parseWindSpeed('10 to 5 mph'), null);
  assert.equal(parseWindSpeed('20 furlongs'), null);
});

test('Single refresh is coalesced, minimum refresh interval and per-source caches bound traffic', async () => {
  const fixture = fixtureFetch(); let clock = START;
  const service = createWorldConditionsService({ fetch: fixture.fetcher, now: () => clock });
  const first = service.refresh();
  assert.equal(service.refresh(), first);
  assert.equal(service.isRefreshing, true);
  await first;
  assert.equal(service.isRefreshing, false);
  await service.refresh();
  assert.equal(fixture.urls.length, 4);
  clock += 61_000; await service.refresh();
  assert.equal(fixture.urls.length, 4, 'Each source cache also survives the global minute throttle');
  clock += 6 * 60_000; await service.refresh();
  assert.equal(fixture.urls.length, 5, 'Only the six-minute observation is due');
  clock += 9 * 60_000; await service.refresh();
  assert.equal(fixture.urls.length, 7, 'Observation and weather refresh; prediction and discovered point stay cached');
  service.dispose();
});

test('A failed channel preserves its prior reading as stale without making other sources stale', async () => {
  const fixture = fixtureFetch(); let clock = START, failTide = false;
  const service = createWorldConditionsService({ now: () => clock, fetch: async (input, init) => {
    if (failTide && String(input).includes('product=water_level')) return new Response('busy', { status: 503 });
    return fixture.fetcher(input, init);
  } });
  const first = await service.refresh();
  failTide = true; clock += 7 * 60_000;
  const snapshot = await service.refresh();
  assert.equal(snapshot.observedTide.state, 'stale');
  assert.match(snapshot.observedTide.reason!, /503/);
  assert.equal(snapshot.observedTide.value?.heightMetres, first.observedTide.value?.heightMetres);
  assert.equal(snapshot.observedTide.fetchedAt, first.observedTide.fetchedAt);
  assert.equal(snapshot.observedTide.sourceTime, first.observedTide.sourceTime);
  assert.equal(snapshot.predictedTides.state, 'predicted');
  assert.equal(snapshot.weather.state, 'forecast');
  service.dispose();
});

test('Provider Retry-After delays manual retries, and snapshots cannot mutate cached source data', async () => {
  const fixture = fixtureFetch(); let clock = START, requests = 0;
  const throttled = createWorldConditionsService({ now: () => clock, fetch: async () => {
    requests += 1;
    return new Response('slow down', { status: 429, headers: { 'Retry-After': '120' } });
  } });
  const failed = await throttled.refresh();
  assert.equal(failed.nextRefreshAt, new Date(START + 120_000).toISOString());
  clock += 61_000; await throttled.refresh();
  assert.equal(requests, 3);
  clock += 60_000; await throttled.refresh();
  assert.equal(requests, 6);
  throttled.dispose();

  const service = createWorldConditionsService({ fetch: fixture.fetcher, now: () => START });
  const snapshot = await service.refresh();
  snapshot.observedTide.value!.heightMetres = 99;
  snapshot.predictedTides.value!.nextHigh!.heightMetres = 99;
  snapshot.weather.value!.windSpeedMps![0] = 99;
  const next = service.getSnapshot();
  assert.equal(next.observedTide.value?.heightMetres, 1.689);
  assert.equal(next.predictedTides.value?.nextHigh?.heightMetres, 1.565);
  assert.ok(next.weather.value!.windSpeedMps![0] < 10);
  service.dispose();
});

test('Freshness ages without networking; cached forecast periods and next tidal events advance with time', async () => {
  const fixture = fixtureFetch(); let clock = START;
  const service = createWorldConditionsService({ fetch: fixture.fetcher, now: () => clock });
  await service.refresh();
  clock = Date.parse('2026-10-23T05:15:00Z');
  let snapshot = service.getSnapshot();
  assert.equal(snapshot.observedTide.state, 'stale');
  assert.equal(snapshot.weather.state, 'forecast');
  assert.equal(snapshot.weather.validFrom, '2026-10-23T05:00:00.000Z');
  assert.equal(snapshot.weather.value?.summary, 'Rain');
  assert.equal(snapshot.weather.value?.temperatureC, null);
  clock = Date.parse('2026-10-23T10:00:00Z');
  snapshot = service.getSnapshot();
  assert.equal(snapshot.weather.state, 'stale');
  assert.equal(snapshot.predictedTides.value?.nextLow?.time, '2026-10-23T22:28:00.000Z');
  assert.equal(snapshot.predictedTides.state, 'predicted');
  clock += 2 * 24 * 3_600_000;
  assert.equal(service.getSnapshot().predictedTides.state, 'stale');
  assert.equal(service.getSnapshot().predictedTides.value?.nextHigh, null);
  assert.equal(fixture.urls.length, 4, 'No clock, ageing or snapshot read starts a request');
  service.dispose();
});

test('Unavailable endpoints, unexpected discovery hosts and expired forecasts are explicit', async () => {
  const service = createWorldConditionsService({ now: () => START, fetch: async input => {
    if (String(input).includes('/points/')) return Response.json({ properties: { forecastHourly: 'https://example.com/collect' } });
    return Response.json({ error: { message: 'No data available' } });
  } });
  const snapshot = await service.refresh();
  assert.equal(snapshot.observedTide.state, 'unavailable');
  assert.equal(snapshot.observedTide.value, null);
  assert.equal(snapshot.predictedTides.state, 'unavailable');
  assert.equal(snapshot.weather.state, 'unavailable');
  assert.match(snapshot.weather.reason!, /unexpected forecast endpoint/);
  service.dispose();
});

test('Request timeouts and explicit cancel settle even when a fetch implementation ignores abort', async () => {
  const never: typeof fetch = () => new Promise(() => {});
  const timeout = createWorldConditionsService({ fetch: never, now: () => START, timeoutMs: 5 });
  const snapshot = await timeout.refresh();
  assert.equal(snapshot.observedTide.state, 'unavailable');
  assert.match(snapshot.observedTide.reason!, /timed out/);
  assert.equal(timeout.isRefreshing, false);
  timeout.dispose();
  const canceled = createWorldConditionsService({ fetch: never, now: () => START });
  const pending = canceled.refresh();
  canceled.cancel();
  const result = await pending;
  assert.equal(result.weather.reason, 'Select Refresh to request this source.');
  assert.equal(result.lastRequestedAt, null);
  assert.equal(canceled.isRefreshing, false);
  canceled.dispose();
  await assert.rejects(canceled.refresh(), /disposed/);
});

test('Navigation cancel preserves valid values and permits immediate retry, including an interrupted first load', async () => {
  const fixture = fixtureFetch(); let clock = START, pause = true, requests = 0;
  const service = createWorldConditionsService({ now: () => clock, fetch: (input, init) => {
    requests += 1;
    return pause ? new Promise<Response>(() => {}) : fixture.fetcher(input, init);
  } });
  const firstLoad = service.refresh(); service.cancel();
  assert.equal((await firstLoad).nextRefreshAt, null);
  pause = false;
  const loaded = await service.refresh();
  assert.equal(loaded.observedTide.state, 'observed');
  assert.equal(requests, 7, 'Canceled first load can retry immediately without waiting 60 seconds');

  clock += 7 * 60_000; pause = true;
  const pending = service.refresh(); service.cancel();
  const canceled = await pending;
  assert.equal(canceled.observedTide.state, 'observed');
  assert.equal(canceled.observedTide.reason, null);
  assert.deepEqual(canceled.observedTide.value, loaded.observedTide.value);
  assert.equal(canceled.observedTide.fetchedAt, loaded.observedTide.fetchedAt);
  assert.equal(canceled.lastRequestedAt, loaded.lastRequestedAt);
  pause = false;
  const priorRequests = requests;
  await service.refresh();
  assert.equal(requests, priorRequests + 1, 'Canceled observation refresh can also retry immediately');
  service.dispose();
});

test('Source-age staleness bypasses a longer transport cache once the manual refresh throttle permits it', async () => {
  const fixture = fixtureFetch(); let clock = START, observations = 0;
  const service = createWorldConditionsService({ now: () => clock, fetch: async (input, init) => {
    if (String(input).includes('product=water_level')) {
      observations += 1;
      assert.equal(init?.cache, observations === 1 ? 'default' : 'no-cache', 'Stale values require browser HTTP cache revalidation too');
      const response = observed(); response.data[0].t = '2026-10-23 03:54';
      return Response.json(response, { headers: { 'Cache-Control': 'max-age=1800' } });
    }
    return fixture.fetcher(input, init);
  } });
  assert.equal((await service.refresh()).observedTide.state, 'observed');
  clock += 7 * 60_000;
  assert.equal(service.getSnapshot().observedTide.state, 'stale');
  await service.refresh();
  assert.equal(observations, 2, 'An aged observation is refreshed even while its 30-minute HTTP cache interval remains');
  service.dispose();
});

test('Late provider success cannot publish values after disposal', async () => {
  let resolve!: (response: Response) => void;
  const service = createWorldConditionsService({ now: () => START, fetch: () => new Promise<Response>(done => { resolve = done; }) });
  const pending = service.refresh();
  service.dispose();
  resolve(Response.json(observed()));
  const snapshot = await pending;
  assert.equal(snapshot.observedTide.value, null);
  assert.equal(snapshot.weather.value, null);
  assert.equal(service.isRefreshing, false);
});

test('Daylight uses Pacific calendar date across UTC midnight and DST, with plausible NOAA-derived seasons', () => {
  const autumn = computeLocalDaylight(START).value!;
  assert.equal(autumn.localDate, '2026-10-22', 'UTC October 23 is still October 22 at the Aquarium');
  assert.equal(autumn.timeZone, 'America/Los_Angeles');
  assert.equal(autumn.isDaylight, false);
  const nextDay = computeLocalDaylight(Date.parse('2026-10-23T18:00:00Z')).value!;
  // NWS /points astronomicalData fetched 2026-10-23: sunrise 14:22:40Z, sunset 01:21:05Z (Oct 24).
  assert.ok(Math.abs(Date.parse(nextDay.sunrise!) - Date.parse('2026-10-23T14:22:40Z')) < 5 * 60_000);
  assert.ok(Math.abs(Date.parse(nextDay.sunset!) - Date.parse('2026-10-24T01:21:05Z')) < 5 * 60_000);
  const summer = computeLocalDaylight(Date.parse('2026-06-21T20:00:00Z')).value!;
  const winter = computeLocalDaylight(Date.parse('2026-12-21T20:00:00Z')).value!;
  assert.ok(Date.parse(summer.sunset!) - Date.parse(summer.sunrise!) > 14 * 3_600_000);
  assert.ok(Date.parse(winter.sunset!) - Date.parse(winter.sunrise!) < 10 * 3_600_000);
  const dst = computeLocalDaylight(Date.parse('2026-11-01T08:30:00Z')).value!;
  assert.equal(dst.localDate, '2026-11-01');
  assert.equal(computeLocalDaylight(Date.parse('2026-03-08T08:30:00Z')).value!.localDate, '2026-03-08');
});
