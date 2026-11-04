import test from 'node:test';
import assert from 'node:assert/strict';
import { computeSkyAstronomy, equatorialToWorld } from '../src/data/skyAstronomy';
const degrees = (x: number) => x * 180 / Math.PI;
const near = (actual: number, expected: number, tolerance: number) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} expected ${expected} ±${tolerance}`);
// USNO public tables retrieved 2026-10-23; full source URLs in docs/weather-sources.md.
test('Lovers Point apparent sun and moon agree with independent USNO position samples', () => {
  for (const [hour, altitude, azimuth] of [[15, 6.5, 109.5], [20, 41.7, 182.6]]) {
    const sky = computeSkyAstronomy(Date.parse(`2026-10-23T${hour}:00:00Z`));
    near(degrees(sky.sun.altitude), altitude, .35); near(degrees(sky.sun.azimuth), azimuth, .35);
  }
  for (const [hour, altitude, azimuth] of [['01', 17.4, 107.5], ['05', 50.8, 169.0], ['09', 29.0, 244.2]] as const) {
    const sky = computeSkyAstronomy(Date.parse(`2026-10-23T${hour}:00:00Z`));
    near(degrees(sky.moon.altitude), altitude, 2); near(degrees(sky.moon.azimuth), azimuth, 2);
  }
});
test('USNO dated new, quarter, full and last-quarter Moon produce appropriate phases', () => {
  for (const [time, fraction, phase] of [
    ['2026-10-10T15:50:00Z', 0, 0], ['2026-10-18T16:12:00Z', .5, .25],
    ['2026-10-26T04:12:00Z', 1, .5], ['2026-11-01T20:28:00Z', .5, .75],
  ] as const) {
    const moon = computeSkyAstronomy(Date.parse(time)).moon;
    near(moon.illumination, fraction, .025); near(Math.min(Math.abs(moon.phase - phase), 1 - Math.abs(moon.phase - phase)), 0, .02);
  }
  assert.equal(computeSkyAstronomy(Date.parse('2026-10-18T16:12:00Z')).moon.waxing, true);
  assert.equal(computeSkyAstronomy(Date.parse('2026-11-01T20:28:00Z')).moon.waxing, false);
});
test('World directions use east/up/south, stars rotate on sidereal time, and UTC is host-timezone independent', () => {
  const morning = computeSkyAstronomy(new Date('2026-10-23T15:00:00Z'));
  const evening = computeSkyAstronomy(new Date('2026-10-24T01:00:00Z'));
  assert.ok(morning.sun.direction[0] > 0); assert.ok(evening.sun.direction[0] < 0);
  assert.ok(morning.sun.direction[2] > 0);
  for (const month of [0, 3, 6, 9]) for (const latitude of [-90, 0, 36.6265, 90]) {
    const sky = computeSkyAstronomy(Date.UTC(2026, month, 12), latitude);
    for (const body of [sky.sun, sky.moon]) { near(Math.hypot(...body.direction), 1, 1e-10); assert.ok(body.direction.every(Number.isFinite)); }
  }
  const pole = equatorialToWorld(0, Math.PI / 2, 1.2);
  near(degrees(Math.asin(pole[1])), 36.6265, 1e-8); assert.ok(pole[2] < 0, 'North celestial pole points north');
  const after = computeSkyAstronomy(+new Date(morning.time) + 86164.09 * 1000);
  near(after.localSiderealTime, morning.localSiderealTime, .00001);
  assert.deepEqual(computeSkyAstronomy(Date.parse('2026-10-23T08:00:00-07:00')), morning);
  assert.throws(() => computeSkyAstronomy(NaN), RangeError);
  assert.throws(() => computeSkyAstronomy(Date.now(), 91), RangeError);
});
