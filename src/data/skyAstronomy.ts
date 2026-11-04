/**
 * Compact solar/lunar ephemeris adapted from SunCalc 1.9.0.
 * https://github.com/mourner/suncalc/tree/v1.9.0
 * Local additions: scene axes, lunar topocentric parallax, public UTC contract.
 * Approximate recreational sky; see docs/weather-sources.md for precision limits.
 *
 * Copyright (c) 2014, Vladimir Agafonkin
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are
 * permitted provided that the following conditions are met:
 *
 *    1. Redistributions of source code must retain the above copyright notice, this list of
 *       conditions and the following disclaimer.
 *
 *    2. Redistributions in binary form must reproduce the above copyright notice, this list
 *       of conditions and the following disclaimer in the documentation and/or other materials
 *       provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
 * COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
 * HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
 * TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
export type SkyDirection = readonly [number, number, number];
export interface SkyBody {
  /** Unit direction in world axes: east +X, up +Y, south +Z. */
  direction: SkyDirection;
  /** Apparent elevation above horizon and azimuth clockwise from north, radians. */
  altitude: number;
  azimuth: number;
}
export interface SkyAstronomy {
  time: string;
  latitude: number;
  longitude: number;
  sun: SkyBody;
  moon: SkyBody & {
    illumination: number;
    /** 0 new, .25 first quarter, .5 full, .75 last quarter. */
    phase: number;
    waxing: boolean;
    /** Celestial north to illuminated limb, and celestial north to local zenith, radians. */
    brightLimbAngle: number;
    parallacticAngle: number;
    distanceKm: number;
  };
  /** Local sidereal angle in radians; use equatorialToWorld for star positions. */
  localSiderealTime: number;
}
const RAD = Math.PI / 180;
const TAU = Math.PI * 2;
const { sin, cos, tan, asin, acos, atan2, hypot } = Math;
const clamp = (n: number) => Math.max(-1, Math.min(1, n));
const wrap = (n: number) => ((n % TAU) + TAU) % TAU;
const obliquity = 23.4397 * RAD;
const rightAscension = (l: number, b: number) => atan2(sin(l) * cos(obliquity) - tan(b) * sin(obliquity), cos(l));
const declination = (l: number, b: number) => asin(clamp(sin(b) * cos(obliquity) + cos(b) * sin(obliquity) * sin(l)));

/** RA/declination and sidereal time in radians; latitude in degrees. */
export function equatorialToWorld(rightAscension: number, declination: number, localSiderealTime: number, latitude = 36.6265): SkyDirection {
  const h = localSiderealTime - rightAscension, phi = latitude * RAD;
  return [-cos(declination) * sin(h), sin(phi) * sin(declination) + cos(phi) * cos(declination) * cos(h),
    sin(phi) * cos(declination) * cos(h) - cos(phi) * sin(declination)];
}
function apparentBody(direction: SkyDirection, distanceKm?: number): SkyBody {
  let [x, y, z] = direction;
  // Observer at Earth's surface. This ~1 degree horizon correction matters for the Moon.
  if (distanceKm) y -= 6371.0088 / distanceKm;
  let altitude = atan2(y, hypot(x, z));
  const azimuth = wrap(atan2(x, -z));
  // Standard atmosphere approximation; do not lift bodies far below the horizon.
  if (altitude > -RAD) {
    const h = Math.max(0, altitude);
    altitude += 0.0002967 / tan(h + 0.00312536 / (h + 0.08901179));
  }
  return { altitude, azimuth, direction: [sin(azimuth) * cos(altitude), sin(altitude), -cos(azimuth) * cos(altitude)] };
}
export function computeSkyAstronomy(now: number | Date, latitude = 36.6265, longitude = -121.9166): SkyAstronomy {
  const time = +now;
  if (!Number.isFinite(time) || Math.abs(time) > 8.64e15 || !Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
    throw new RangeError('Sky astronomy needs a valid UTC instant and latitude/longitude in degrees.');
  }
  const d = time / 86400000 + 2440587.5 - 2451545;
  const anomaly = RAD * (357.5291 + .98560028 * d);
  const solarLongitude = anomaly + RAD * (1.9148 * sin(anomaly) + .02 * sin(2 * anomaly) + .0003 * sin(3 * anomaly) + 102.9372) + Math.PI;
  const sunRA = rightAscension(solarLongitude, 0), sunDec = declination(solarLongitude, 0);
  const moonMean = RAD * (218.316 + 13.176396 * d), moonAnomaly = RAD * (134.963 + 13.064993 * d);
  const moonLongitude = moonMean + RAD * 6.289 * sin(moonAnomaly);
  const moonLatitude = RAD * 5.128 * sin(RAD * (93.272 + 13.229350 * d));
  const moonRA = rightAscension(moonLongitude, moonLatitude), moonDec = declination(moonLongitude, moonLatitude);
  const distanceKm = 385001 - 20905 * cos(moonAnomaly);
  const localSiderealTime = wrap(RAD * (280.16 + 360.9856235 * d + longitude));
  const sun = apparentBody(equatorialToWorld(sunRA, sunDec, localSiderealTime, latitude));
  const moon = apparentBody(equatorialToWorld(moonRA, moonDec, localSiderealTime, latitude), distanceKm);
  const separation = acos(clamp(sin(sunDec) * sin(moonDec) + cos(sunDec) * cos(moonDec) * cos(sunRA - moonRA)));
  const incidence = atan2(149598000 * sin(separation), distanceKm - 149598000 * cos(separation));
  const brightLimbAngle = atan2(cos(sunDec) * sin(sunRA - moonRA), sin(sunDec) * cos(moonDec) - cos(sunDec) * sin(moonDec) * cos(sunRA - moonRA));
  const phase = .5 + .5 * incidence * (brightLimbAngle < 0 ? -1 : 1) / Math.PI;
  const h = localSiderealTime - moonRA;
  return { time: new Date(time).toISOString(), latitude, longitude, sun, localSiderealTime,
    moon: { ...moon, distanceKm, illumination: (1 + cos(incidence)) / 2, phase, waxing: phase < .5, brightLimbAngle,
      parallacticAngle: atan2(sin(h), tan(latitude * RAD) * cos(moonDec) - sin(moonDec) * cos(h)) } };
}
