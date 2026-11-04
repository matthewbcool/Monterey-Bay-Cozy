# Data sources and adapters

This directory owns cached geographic evidence, validated appearance recipes and provider adapters. The [codebase guide](../../docs/codebase.md) describes consumers and coordinate/time boundaries; [authoring tools](../../scripts/README.md) document extraction and its limits. Data services return snapshots and provenance; viewer modules own their presentation and mesh effects.

## Monterey map snapshot

`monterey-map.json` is derived vector data downloaded October 13, 2026 from the official [OpenStreetMap map API](https://wiki.openstreetmap.org/wiki/API_v0.6#Bounding_box:_GET_/api/0.6/map), covering the rectangle and proposed four-point game boundary documented in the root README.

© [OpenStreetMap contributors](https://www.openstreetmap.org/copyright). OpenStreetMap data is available under the [Open Data Commons Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/). This derived snapshot retains that attribution and license. It contains building rings/tags, roads/paths, coastline, bounds and the user-supplied study boundary. The renderer generates its own mesh from these vectors; no Blender or scanned mesh is included.

Complete relation segments are stitched into multipolygon rings, including courtyard holes. One point-only building is omitted. Incomplete regional relations were omitted from the import copy; the received way/node geometry is preserved. The 1,272 rendered building parts are outer rings/parts, not independently counted properties. Features cover the rectangle rather than being clipped to the proposed quadrilateral.

Four parts have OSM height tags, twelve use floor count multiplied by an artistic 3 m, and 1,256 use an artistic 6 m fallback. OSM tags are sourced metadata, not independently surveyed dimensions. Terrain is flat; elevation, seabed depth, detailed roofs and façades are absent. The small-area equirectangular projection uses metres with X east, Y up and Z south; it is not survey-grade.

The map viewport loads this local JSON on demand and makes no runtime request to an external map server. Keep attribution in the viewport and preserve the license/provenance when regenerating or redistributing this data. See the map review (historical authoring evidence omitted from this public snapshot) and [root README](../../README.md#real-boundary--openstreetmap-study).


## Potential live feeds

[live-feeds.json](live-feeds.json) is a separate researched candidate inventory dated October 20, 2026. It is not part of the OSM snapshot or an approved-stream registry. Geographic positions are WGS84 venue/area approximations with source URLs and explicit uncertainty; six Aquarium candidates share one campus point. Three other sites fall south of the downloaded map bounds. The map preserves those coordinates and offers a wider pin view without adding invented geographic detail. See [research and maintenance](../../docs/live-feeds.md). The inventory initiates no feed-provider requests, player loading or streams. The app’s existing Google Fonts requests are unchanged.


## Real-world conditions source inventory

[real-time-sources.json](real-time-sources.json) records ten researched data/derived-condition candidates and their possible outdoor-game uses. Map Study imports it for its source catalogue and integration metadata; its `enabledInGame` flags remain false because that panel displays data without driving the world. It distinguishes observations, predictions, forecasts, computed sky conditions, alerts and delayed reports, including coverage/coordinates where verified, access evidence, proposed refresh intervals and remaining gaps. The [Map Study conditions guide](../../docs/real-time-world.md) describes the implemented manual tide/weather/daylight panel and preserves earlier NOAA/NWS access probes. The separate Gym weather adapters below drive the Gym atmosphere; this research registry itself creates no automatic API requests or environment changes.


## Avatar saves and Lovers Point gym

`avatarSaves.ts` parses a versioned browser-local collection and portable `monterey-bay-cozy-avatar` JSON recipes. Only validated appearance fields are stored; there are no cloud saves, mesh payloads or executable imports. See [creator persistence](../../docs/avatar-creator.md).

`lovers-point-gym.json` is a bounded derived subset of the existing OSM download: local metre coordinates for 117 coast vertices, 77 path/road runs and 25 building footprints. It retains the ODbL source, download date, origin and feature IDs. See [geography and photo provenance](../../docs/testing-gym-geography.md) for the extraction bounds, attribution and artistic terrain limitations. The gym loads this subset with its own lazy module and does not need the full map-study JSON.

`lovers-point-features.json` adds the October 22, 2026 OSM detail extract: three mapped beaches, the pool, volleyball sand area, five parking areas, breakwater, park boundary and 86 classified route runs. Source IDs, tags, coordinates, date and license are retained. `scripts/extract-lovers-point-features.py` reproduces it from a local XML response; no map service is contacted at runtime. See the [gym geography guide](../../docs/testing-gym-geography.md) for sources, the reproducible command and limits.

`lovers-point-neighbourhood.json` is derived from `monterey-map.json` by `scripts/extract-lovers-point-neighbourhood.py`: 215 house footprints (OSM ids kept) and 144 street runs outside the gym crop and within 450 m, in gym metres. Heights, colours and ground beyond the DEM are authored; see [real-world data](../../docs/lovers-point-real-world-data.md).

`lovers-point-elevation.json` contains a cached USGS 3DEP bare-earth elevation grid downloaded October 22, 2026. Source metadata identifies 1 m NAVD88 terrain; the runtime grid is resampled to 60 × 59 points at approximately 5 × 6.23 m spacing. `scripts/extract-lovers-point-elevation.py` reproduces it offline from the retained TIFF and returned extent in the elevation audit (historical authoring evidence omitted from this public snapshot). The runtime's piecewise planar height sampler matches rendered triangles. This data is not bathymetry or survey control, and the authored 1 m display water level is not a live tide. The separate kilometre-scale map study remains flat.


## Detailed park and conditions in Map Study

Map Study now composes the same Lovers Point source datasets and scenery components as the gym. It projects the park into the regional map without scaling the public root, replaces duplicate base footprints/line spans, and marks raised foundations for additional touching buildings as inferred. The regional `monterey-map.json` snapshot itself remains unchanged and contains no elevations; only the detailed local patch uses the separate cached USGS dataset. See [integration and ownership](../../docs/map-world.md).

`worldConditions.ts` is the manual-refresh adapter for NOAA tide observations/predictions and a discovered NWS hourly forecast, plus approximate local daylight calculation. `real-time-sources.json` retains its October 20 research and now adds explicit Map Study integration metadata: four connected/calculated channels and six research-only records. No Map Study source affects gameplay. The [conditions guide](../../docs/real-time-world.md) documents timestamps, datum, provenance, freshness, request/cache limits and verified live browser evidence.


## Testing Gym weather and sky

`gymWeather.ts` is the Gym's separate NWS client. At 36.6265° N, −121.9166° longitude it discovers the hourly/grid forecast and nearby observation stations, preserves per-field source/time/validity and missingness, and combines fresh observations with valid forecast fallbacks. Rain quantities are observed last-hour or forecast-interval averages; precipitation probability stays separate. It coalesces requests, caches discovery for a day, throttles ordinary refreshes to ten minutes, cancels navigation requests without treating them as failures, and retains dated last-good values through outages. The viewer requests on entry and every 15 minutes only while active and visible. A real request on October 23 Pacific returned KMRY (approximately 7.26 km away), an observation timestamp of 2026-10-24T02:20Z and a forecast rain average of zero without errors; that is dated access evidence, not a pinned current reading.

`skyAstronomy.ts` computes the sun and moon from UTC with local east/up/south directions, lunar illumination/phase and sidereal rotation. Its compact SunCalc adaptation has no package dependency and retains the BSD-2-Clause notice. Independent USNO samples and provider-shaped fixture tests cover the numerical and data contracts. See [weather sources, approximations and license](../../docs/weather-sources.md). Clouds, enlarged celestial discs and star placement are artistic rendering choices; regional weather is not a park sensor or a gameplay tide.

## Pacific Grove waterfront

`pacific-grove-waterfront.json` combines an October 24 OSM coast/route extract and USGS raster with the retained October 13 regional building rings. [Coverage, reproducible extraction, attribution, geometry costs and uncertainty](../../docs/waterfront-extension.md) distinguish source measurements from the authored seam, width, roof and vegetation choices. Both Map Study and the Gym consume the same local factory/data.

`pacificGroveMuseum.ts` records the museum’s public floor-plan sources, current room labels, fitted metre dimensions, projection basis, wall openings and authored floor/entry heights. These are a documented location study, not surveyed architectural data. See the [museum source record](../../docs/pacific-grove-museum.md).

`waterfront-amenities.json` retains 27 candidate bench, bin, bicycle-parking and information nodes from the cached October 24 OSM extract. Runtime filters select suitable coastal-trail placements; authored infill stays in the scene factory. See [provenance and regeneration](../../docs/coastal-life.md).

## Gym bathymetry

`monterey-bathymetry.json` retains a 10 m runtime crop of the USGS 2 m Offshore Monterey bathymetry, in NAVD88 metres. It preserves source dates, projection, NoData, native control samples and the input checksum. The [source and runtime contract](../../docs/bathymetry.md) separates measured offshore terrain from the authored shoreline join and gap fallbacks. The retained GeoTIFF is an offline authoring reference, not a browser download.


## Bay-wide regional snapshot

`monterey-bay-region.json` extends the map to 37.5 × 53.4 km around Monterey Bay. It retains October 25, 2026 request provenance for NOAA-derived CA coastal polygons, USGS 3DEP land elevations, USGS generalized highways/GNIS places and NOAA ETOPO1 relief. This cache contains no invented regional building stock. The local OSM snapshot remains a separate source with its original coverage/license. [Resolution, cartographic coastline limitations, fallback samples and offline rebuild](../../docs/monterey-bay-region.md).

The October 25 [recreation terrace](../../docs/recreation-area.md) derives an explicitly authored local grade in `testingGym/recreationGrade.ts` before sampling/rendering the park. `lovers-point-elevation.json` remains the original cached USGS-derived grid; the correction does not claim a new survey.

## Caledonia district

`caledonia-park.json` holds the October 25 OSM boundaries, routes and buildings plus retained USGS terrain. `scripts/extract-caledonia.py` rebuilds it offline; raw evidence is under `artifacts/caledonia-park/`. [Sources, crop, authoring choices and costs](../../docs/caledonia-park.md).

`caledonia-meals-site.json` extends the district north to the real 700 Jewell Avenue site: exact OSM way `559348745`, 49 clipped route segments and 504 retained USGS samples. Original tags, source versions/hashes and NAVD88 provenance remain in the cache. `scripts/extract-caledonia-meals.py` regenerates it offline; reference evidence (historical authoring evidence omitted from this public snapshot) separates measured outlines from the photo-based facade interpretation.

## Deer habitat patches

`deer-habitats.json` retains source park/course/fairway boundaries and provenance for Caledonia, Pacific Grove Golf Links and Del Monte. Home coordinates and roam circles are authored placements within those boundaries, not live sightings. Both golf sites use coarse regional terrain; runtime wildlife fetches no provider data. See [source interpretation](../../docs/deer-references.md) and [runtime ownership](../../docs/deer.md).

## Scene asset inventory

`scene-asset-inventory.json` is a maintenance register of current object families, source owners, categories, library links, unresolved extractions and retired work. It is not geographic evidence or a runtime download. See the [audit](../../docs/asset-catalog-audit.md) and `tests/asset-inventory.test.ts` for coverage limits and checks.

## Fish ecology

[`ecology/`](ecology/index.ts) owns the versioned NOAA catch/haul cache, source provenance, historical cell queries, explicit missing/zero states and seeded game-population recipes. It is independent of Three.js, DOM and provider calls. Species habitat associations are sourced; numeric tuning and the Gym reef patch are authored. [Data contract, API and regeneration](../../docs/fish-ecology.md).
