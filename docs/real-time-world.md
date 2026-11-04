# Real-world conditions in Map Study

This guide describes the **Map Study** panel and its manual data adapters. The Testing Gym now has a separate [live weather and astronomical sky system](weather-sources.md): **Menu → Sky & weather** automatically refreshes while visible, renders clouds/rain/fog and day/night lighting, and supports explicit condition/time previews. Map Study's existing catalogue, manual refresh, daylight card and display-only behavior remain separate. Its registry flags are not a global inventory of Gym features.

**Map Study integration: October 22, 2026 (Pacific). Original source research: October 20, 2026.** The [source inventory](../src/data/real-time-sources.json) retains the ten original research records and adds explicit `mapStudy` implementation metadata. Its original `access`, `refreshProposal`, `sources` and `checkedOn` fields describe that dated research; they are not new verification claims. Every `enabledInGame` remains `false` because these values are displayed for study and do not control gameplay.

Open **Map Study → Real-world conditions**, then select **Refresh live data** to request public NOAA and NWS data. Opening the panel, moving the camera, selecting a source and rendering a frame do not start a request. The local daylight card is calculated from the device clock when the panel reads its snapshot. This Map Study integration introduces no API key, polling loop, additional dependency, backend, game-water adjustment, lighting change or fish behavior.

## Implemented channels

| Channel | Displayed data and primary documentation | Meaning and limits |
| --- | --- | --- |
| NOAA Monterey observed tide | Latest station 9413450 water level in metres relative to MLLW, UTC observation time, sigma and original `f`/`q` flags. [NOAA API](https://api.tidesandcurrents.noaa.gov/api/prod/), [response/flag definitions](https://api.tidesandcurrents.noaa.gov/api/prod/responseHelp.html). | An observation at the station, often preliminary; not a survey of water height throughout the map. |
| NOAA Monterey predicted tides | Provider high/low events, requested with `interval=hilo` over 72 hours; next future high and low, metres MLLW and UTC event times. [Prediction API](https://api.tidesandcurrents.noaa.gov/api/prod/). | Astronomical predictions, separate from measurements and weather-driven anomalies. NOAA supplies no issue timestamp here, so displayed age is since fetch. |
| NWS weather forecast | Current valid hourly forecast: temperature °C, wind range m/s, direction the wind comes **from**, precipitation probability and text. The Aquarium [point lookup](https://api.weather.gov/points/36.6181,-121.9019) discovers the hourly grid endpoint. [NWS API guidance](https://www.weather.gov/documentation/services-web-api). | A regional grid forecast, not a measurement at the park or a camera. Missing fields remain unavailable, not zero. Weather icons are not downloaded. |
| Local daylight | Pacific local date, approximate sunrise/sunset, and whether the snapshot time falls between them, calculated locally from the [NOAA published equations](https://gml.noaa.gov/grad/solcalc/solareqns.PDF). | Computed daylight, not observed cloud, fog or terrain shading. This Map Study card does not integrate moon, twilight or sun directions; the Gym sky calculates sun and moon directions separately. |

The calculation uses the Aquarium anchor at **36.618084 N, 121.901918 W**. It is a small independent implementation of NOAA's fractional-year approximation, with no SunCalc dependency. SunCalc remains an original research candidate in this Map Study inventory; the separate Gym ephemeris now adapts compact SunCalc equations with their license notice. NOAA's [calculation notes](https://gml.noaa.gov/grad/solcalc/calcdetails.html) discuss atmospheric uncertainty and note that its calculator is no longer actively maintained. The display explicitly calls the result approximate; it is not certified astronomical data.

## Snapshot and request lifecycle

[src/data/worldConditions.ts](../src/data/worldConditions.ts) owns one versioned conditions snapshot for the panel. Each channel separately records its source ID, original mode, current state, value, units, source link/time, fetch time, validity interval, age, quality flags, spatial support and any failure reason. The states are **observed, predicted, forecast, computed, stale and unavailable**. Before a request, remote channels have no value; one successful channel cannot make another appear fresh.

Provider adapters validate timestamps, station identity, units and values before publishing a result. NOAA timestamps are requested in GMT and normalized to UTC. NWS ISO timestamps include their offset. Store UTC and format local times with `America/Los_Angeles`, not a fixed Pacific offset. The next tide events and current forecast period advance from cached normalized data when the snapshot is read, without another download.

Manual refreshes coalesce into one in-flight operation and have a **60-second minimum request interval**. Prototype cache policies are six minutes for observations, six hours for predictions and 15 minutes for forecasts. Provider `Cache-Control` can extend those local intervals up to 30 minutes, 24 hours and one hour respectively; the browser also follows HTTP caching. NWS point-to-grid discovery is cached for a day, then checked again. `Retry-After` is respected. These are client policies, not claims about provider publication cadence.

An observation becomes stale after 30 minutes. A weather forecast becomes stale after six hours from its issue time or when it lacks a currently valid period. Predictions become stale after 24 hours since fetch or when their remaining events no longer include both a future high and low. A manual refresh of a stale channel bypasses its local cache interval and requests HTTP cache revalidation, while retaining the global request throttle and any provider retry deadline.

Each source request has a 12-second timeout, a response-size limit and cancellation. Failed or invalid responses retain the last valid value explicitly as stale, with its original timestamps; without a prior value the channel is unavailable. Leaving the map or closing the active view cancels pending requests without labeling navigation as a network failure. A canceled request may be retried immediately; any genuine provider retry deadline still applies. Disposal prevents late results from publishing. This Map Study adapter has no background poll and performs no network or conditions work in the render loop.

NWS requires an identifying `User-Agent`. The adapter supplies the project's application string, but browsers control that header and may strip an override. The successful browser probe below confirms this prototype's access, not guaranteed application identification or future service availability. A future shared server adapter must send the identifying header reliably and continue following NWS caching guidance.

## Source locations, scale and future game use

Public scene units remain metres. Registry coordinates are WGS84 **[longitude, latitude]**; provider parameter order can differ. A station, query anchor, weather grid and regional ocean product have different spatial meanings. Source locations outside downloaded geometry remain outside it; unresolved stations and grid coverage must not receive invented pins.

NOAA station 9413450 is at **36.60889 N, 121.89139 W**, south of the original street-map rectangle. Its reading provides a nearby tidal reference, not a mapped water-surface elevation at Lovers Point. The Aquarium NWS point resolved to **MTR/92,51** in the October 22 integration check, but the adapter discovers that address rather than permanently hardcoding it.

A tide in MLLW cannot be assigned directly to game Y or assumed equal to a terrain elevation datum. The newer terrain work does not itself establish a calibrated tidal waterline. Any future water response needs an explicit same-datum reference:

    game water Y = authored reference Y + (source height − source height at the authored reference)

Both source heights must use the same datum and metre units. Water shading, CPU buoyancy, shore placement and attached objects must agree on any future offset. Managed Aquarium exhibits keep their own water and lighting. No such scene change is part of this integration.

For a future multiplayer world, one authoritative service should obtain/cache provider data and distribute a versioned snapshot and shared time to the room. Clients should not disagree because each independently fetched a different forecast. Record snapshots for reproducible tests, demos and replays; a simulated clock or fixture must remain explicitly labeled.

## Six research-only channels

These catalogue entries remain visible in the study, with source links and access limits. Selecting them does not contact their providers or fabricate live values.

| Candidate | What is still required |
| --- | --- |
| [NWS local alerts](https://www.weather.gov/documentation/services-web-api) | An adapter with relevant geometry/zone, issuer, effective/expiry and cancellation checks. The historical successful request was a connectivity probe, not an implemented alert service. Empty or failed data cannot imply safe conditions. |
| [NDBC offshore buoy 46042](https://www.ndbc.noaa.gov/station_realtime.php?station=46042) | A permitted smaller/shared delivery path and actual per-variable timestamps/QA. The historical full text response lacked a cross-origin header. Offshore significant wave height is not a harbor reading or a single shader-wave amplitude. |
| [CeNCOOS Aquarium intake/shore properties](https://www.cencoos.org/data-by-location/monterey-bay/) | Select and verify a current dataset, station position, sensor depth, variables, units, QA, browser access and dataset-specific rights. No location or current values are invented. |
| [CeNCOOS/IOOS surface currents](https://www.cencoos.org/hf-radar-data-access/) | Select/subset a current product and verify coverage masks, grid scale and attribution. Kilometre-scale regional surface flow cannot resolve every cove or imply subsurface flow. |
| [iNaturalist observations](https://api.inaturalist.org/v1/docs/) | Bounded metadata queries, timestamps, identification quality, record/media licenses and [geoprivacy](https://help.inaturalist.org/en/support/solutions/articles/151000169938-what-is-geoprivacy-what-does-it-mean-for-an-observation-to-be-obscured-) handling. Reports are delayed sightings, not live animal tracking or guaranteed game spawns. |
| [AIS vessel traffic](https://aisstream.io/documentation) | A server-held key, provider/redistribution permission and bounded shared subscription. The reviewed provider forbids direct browser connections. No account, key or connection has been added. |

Water temperature, chlorophyll or sightings cannot establish fish population or catch odds. Any later artistic response must be a deliberate, labeled game-design choice. Camera video remains a separate [potential live-feed study](live-feeds.md), not an automatic measurement of game conditions.

## Verification and historical evidence

**October 22, 2026 integration (October 23 UTC):** the production adapters were checked against actual NOAA observation/high-low and discovered NWS hourly responses. A Chrome/Vite page then fetched all three remote channels across origins at **2026-10-23 04:26:06 UTC** without source errors. The observation was 1.672 m MLLW at 04:18 UTC, preliminary; those values are a dated verification example, not a pinned live display. See current live-access evidence (historical authoring evidence omitted from this public snapshot) and browser capture (historical authoring evidence omitted from this public snapshot). This proves that browser/path at that moment, not continued availability or every browser/device.

The focused suite, [tests/world-conditions.test.ts](../tests/world-conditions.test.ts), covers separate source states, datum/time/flag preservation, missing values, next-event/current-period advancement, source freshness, coalescing and caches, provider retry deadlines, stale retention, intentional navigation cancellation, immediate retry, timeout/disposal, endpoint validation and Pacific calendar/daylight behavior. Its provider-shaped fixtures are explicitly frozen test inputs and are never substituted for live UI data.

**October 20, 2026 research probes:** preserve the original HTTP metadata (historical authoring evidence omitted from this public snapshot) and Chrome access probe (historical authoring evidence omitted from this public snapshot). They measured connectivity before adapters existed. NOAA's sampled observation was 167 bytes and sampled daily predictions 9,110 bytes; the NDBC history response was 612,410 bytes without an `Access-Control-Allow-Origin` header. Those historical samples are not current payload budgets. The old NWS alert probe does not mean alerts are integrated today.

The Map Study conditions panel uses small normalized data and DOM information/pins rather than meshes or per-frame visual effects. It adds no 3D draw calls, triangles, image textures or permanent rendering loop. Existing shared LOD, WebGPU/WebGL 2 rendering and matte toon art direction remain in effect.
