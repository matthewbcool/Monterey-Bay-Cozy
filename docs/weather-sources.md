# Testing Gym weather and sky sources

The sky clock uses the actual UTC instant at Lovers Point, **36.6265° N, 121.9166° W**, in the scene's east/up/south coordinate frame. This query point is inside the modeled park; the geometry origin remains the separately documented −121.91685°, 36.6256°. The display timezone is America/Los_Angeles. Local daylight-saving rules affect labels, not the astronomy calculation.

## Weather evidence

[`src/data/gymWeather.ts`](../src/data/gymWeather.ts) discovers the current [NWS grid from the park coordinates](https://api.weather.gov/points/36.6265,-121.9166), then requests hourly forecasts, raw grid forecasts and observations from up to three nearby stations. The discovery response on October 23, 2026 resolved to MTR/92,51. It is rediscovered after 24 hours because the mapping may change. See the [NWS API documentation](https://www.weather.gov/documentation/services-web-api).

Each field retains its source URL, source time, observed/forecast status, validity interval and current/stale/unavailable state. Fresh observations take priority; a valid forecast fills missing or stale observation fields. The weather summary can have a different source from cloud cover or rain, so it is not evidence that every field is observed. Stations are regional references: an end-to-end request on October 23 returned Monterey Regional Airport (KMRY), approximately 7.26 km from the park. It is not a sensor at Lovers Point, and local coastal fog can differ considerably.

Cloud coverage maps station sky-layer categories to representative fractions (clear 0, few .2, scattered .4, broken .75, overcast/vertical visibility 1). These fractions are rendering estimates from reported categories. An empty layer list stays unknown. Grid sky cover is a forecast percentage. Wind is in metres per second, with its meteorological bearing describing where the wind comes **from**. Visibility is in metres and temperature is in °C.

Rain uses observed last-hour precipitation or forecast quantitative precipitation divided by the forecast interval duration. Both represent averages over their source period, not an instantaneous rain gauge. Probability of precipitation stays a separate field and never becomes rain intensity. Snow/sleet/freezing summaries prevent liquid-equivalent precipitation from silently becoming rain. Missing provider values remain null, including an unavailable rain amount. The NWS documents possible observation delays and precipitation reporting limitations; a rain shader remains a visual interpretation of available evidence.

Requests are coalesced, timeout after 12 seconds, and normally refresh no more than once per ten minutes. The viewer controls whether the Gym is active/visible before requesting. Call `cancel()` on navigation to stop pending requests while preserving cached data and permit an immediate re-entry retry; intentional cancellation is not a provider failure; `dispose()` permanently shuts the client down. Failed refreshes retain dated last-good values. Observations become stale after 90 minutes; forecasts become stale after six hours or outside their valid interval. Expired forecast intervals are omitted. A manual forced refresh can retry before the regular interval. Timeouts and HTTP errors, including 429 rate limits, remain failures with the normal ten-minute client cooldown; the client does not currently interpret the provider’s `Retry-After` header. No API key, user location lookup, backend, or new dependency is required.

## Astronomical calculation

[`src/data/skyAstronomy.ts`](../src/data/skyAstronomy.ts) adapts the compact solar and lunar position/illumination equations from [SunCalc 1.9.0](https://github.com/mourner/suncalc/tree/v1.9.0), with lunar topocentric parallax, standard atmospheric refraction near the visible horizon, and explicit scene coordinate conversion. Directions point from the observer toward the body. Azimuth is clockwise from true north, altitude is above the horizon, and all public angles are radians. Moon phase depends on the full date and time, not just season: 0 is new, .25 first quarter, .5 full, .75 last quarter. Bright-limb and parallactic angles support the illuminated side's orientation; the sun's world direction also supports physically oriented shading. Local sidereal time and `equatorialToWorld` support rotating a stellar field with Earth's rotation. Procedurally scattered stars are artistic points, not a surveyed star catalogue.

This is a compact recreational ephemeris. It does not calculate eclipses, lunar libration, mountains on the horizon, atmospheric weather-dependent refraction, or full high-precision orbital perturbations. The Moon's position is approximate; use a more complete ephemeris if a later experiment needs eclipse timing or arcminute accuracy.

Independent unit fixtures were checked against the U.S. Naval Observatory on October 23, 2026:

| Source | Samples | Test tolerance |
| --- | --- | --- |
| [USNO Sun altitude/azimuth, Lovers Point](https://aa.usno.navy.mil/calculated/altaz?body=10&date=2026-10-23&intv_mag=60&lat=36.6265&lon=-121.9166&label=LoversPoint&tz=0&tz_sign=1&submit=Get+Data) | October 23 at 15:00 and 20:00 UTC | 0.35° per angle |
| [USNO Moon altitude/azimuth, Lovers Point](https://aa.usno.navy.mil/calculated/altaz?body=11&date=2026-10-23&intv_mag=60&lat=36.6265&lon=-121.9166&label=LoversPoint&tz=0&tz_sign=1&submit=Get+Data) | October 23 at 01:00, 05:00, 09:00 UTC | 2° per angle |
| [USNO primary lunar phases](https://aa.usno.navy.mil/calculated/moon/phases?date=2026-10-01&nump=8&format=p) | October 10 new, October 18 first quarter, October 26 full, November 1 last quarter | 0.025 illuminated fraction; .02 phase cycle |

Those samples establish tested behavior, not a global maximum error bound. Additional checks cover scene compass directions, UTC-offset equivalence, pole behavior and one sidereal rotation. Weather tests use fixed provider-shaped fixtures to cover observed/forecast mixing, units, missing values, failed refreshes, staleness, cancellation and request coalescing; fixtures are never labeled live weather.

## Sun shadow coverage

The astronomical sun drives three blended camera-frustum shadow maps in `src/viewer/sunShadows.ts`. Every map follows cloud attenuation and stops updating below the horizon; the Moon has no shadow map. The weather service and solar direction are independent of coverage. Camera motion, flight and viewport changes refit coverage without changing the light's real-world direction. See the [viewer ownership guide](../src/viewer/README.md#cast-shadows) and coverage evidence (historical authoring evidence omitted from this public snapshot).

## Third-party astronomy notice

Adapted portions of SunCalc 1.9.0 retain its BSD-2-Clause license below (also retained in the source). No SunCalc package is installed.

```text
Copyright (c) 2014, Vladimir Agafonkin
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are
permitted provided that the following conditions are met:

   1. Redistributions of source code must retain the above copyright notice, this list of
      conditions and the following disclaimer.

   2. Redistributions in binary form must reproduce the above copyright notice, this list
      of conditions and the following disclaimer in the documentation and/or other materials
      provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```
