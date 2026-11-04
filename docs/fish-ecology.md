# Monterey Bay fish ecology

Map Study → **Fish ecology · NOAA surveys** inspects the historical evidence that game systems can consume. Open [the ecology view](http://127.0.0.1:5191/?tab=map&ecology), enable the survey grid, select a species/life stage/year/month and click a water cell. The sampled-cell selector and focus button provide a keyboard alternative. **Lovers Point reef** selects the current authored Gym dive-site footprint. The inspector can download a reproducible population recipe.

## Evidence shipped with the game

The initial cache covers the existing bay rectangle, **−122.12…−121.70° longitude, 36.55…37.03° latitude**, and requested dates **2015-01-01 through 2025-12-31 UTC**. It contains **127 represented hauls and 635 species/stage records**, with **61 positive rows**. Actual sampling months in this extract are April–June. The public dataset's coverage ends June 19, 2025; a 2026 retrieval is not a 2026 fish census.

| Pilot species | Scientific name | NOAA code | Records in extract |
| --- | --- | ---: | --- |
| Blue rockfish | *Sebastes mystinus* | 612 | 127 young-of-year; 19 positive, 108 explicit zeros. Older stage not recorded. |
| Lingcod | *Ophiodon elongatus* | 448 | 127 young-of-year (18 positive); 127 older/post-settlement (all explicit zeros). |
| Pacific sardine | *Sardinops sagax* | 562 | 127 young-of-year (11 positive); 127 older/post-settlement (13 positive). |

Source: NOAA SWFSC **[Rockfish Recruitment and Ecosystem Assessment Survey, Catch Data](https://coastwatch.pfeg.noaa.gov/erddap/info/FED_Rockfish_Catch/index.html)**, dataset `FED_Rockfish_Catch`. Its observations are midwater-trawl specimen catches at the net-in coordinates. Coordinates are survey locations rather than individual fish positions. NOAA defines Y as young-of-year/pelagic, A as older-than-YOY/post-settlement and U as unknown. A does not establish reproductive maturity. Follow the source taxonomy; this import does not reidentify historical specimens.

The original bounded CSV responses, metadata, retrieval times, exact queries and SHA-256 hashes are retained in [source evidence](../artifacts/ecology/sources/manifest.json). [The runtime JSON](../src/data/ecology/monterey-ecology.json) keeps that provenance and license alongside normalized haul/observation records. The source permits free use and redistribution; retain NOAA attribution and the original disclaimer. The first cache is approximately **55.3 KB JSON / 6 KB gzip**, not including regional geographic data already shared with Map Study.

## Interpretation contract

The game aggregates net-in points into its own approximately **2 × 2 km** cells, anchored at the cache's northwest corner using a local equirectangular metric grid. Edge cells are clipped. This is our aggregation, **not a downloaded NOAA DisMAP product** or a calibrated distribution model. No smoothing or nearest-cell transfer creates evidence in unsurveyed cells.

| Query state | Meaning |
| --- | --- |
| `detected` | At least one matching positive catch in the selected cell and filters |
| `not-detected` | Matching species/stage rows exist and every count is explicitly zero |
| `not-recorded` | Catch-table hauls exist, but the selected species/stage has no matching rows |
| `no-survey` | No represented catch-table hauls in this cell/date selection |
| `outside-coverage` | Point falls outside the bounded cache |

A represented haul comes from the distinct catch-table haul query, not an independent complete tow-effort log. `detectionFraction` is positive hauls divided by hauls with explicit records for the selected species/stage. It is an exploratory historical detection fraction, not occupancy probability. When combining stages, hauls are deduplicated. An explicit zero says the trawl did not detect the selected fish; it does not establish ecological absence.

`catchCount` is the sum of specimens caught in matching samples. **`relativeAbundance` and `populationEstimate` remain null** because this import has no tow effort, catchability correction or area-density calibration. Never compare catch totals across species as if they measured population proportions. Spring-only samples do not justify zero fish in other months. Juvenile evidence does not validate older fish at the same location. The absence of adult blue rockfish records in this survey especially needs nearshore diver data.

## Habitat and game recipes

[Species rules](../src/data/ecology/species.ts) reference NOAA and other primary sources for broad associations: blue rockfish with kelp/rocky reefs, older lingcod with rocky bottoms, and sardines schooling in the water column. **All numerical depth bands, suitability scores, group sizes and positions are provisional game tuning**, not fitted biological limits or population estimates. Seasonality is deliberately uncalibrated.

The only initially tagged kelp/reef patch is an **18 m authored circle** centered on the current Gym reef at `[92.71, 41.95]` Gym metres, converted from its documented geographic origin. It describes our scene, not surveyed real kelp extent. Other seabed substrate remains unknown; no reef species is inferred there by default. Pelagic suitability can apply over deep seafloor, with fish depth limited independently. The regional coast mask rejects land and out-of-region points.

The pure `habitatAt()` default uses existing NOAA-derived shoreline and coarse ETOPO1 relief. Positive/coastal-gap relief means unknown depth, never a fabricated shallow ocean. The Map Study recipe inspector additionally uses retained USGS bathymetry when source samples exist, relative to the **authored 1 m Gym water level**. This is not a live tide or a datum conversion. Game callers should supply their actual local world sampler with `contextAt` to keep fish above the rendered/collision seafloor.

`planPopulation()` creates nearby group descriptors; it does not construct models, allocate physics or change existing Gym wildlife. Defaults are **64 representatives / 6 groups**, with hard limits of **256 / 32**, within a maximum 100 m query radius. Counts, numeric habitat scores and placements are authored. Inference is off by default: a group requires historical detection for the same species and older stage plus suitable habitat. Enabling `allowHabitatInference` permits missing/zero/unsurveyed evidence to be supplemented by explicit habitat assumptions, with each group labelled `inferred-habitat`. A recipe records source hash, filters, seed, habitat/depth basis and budgets.

Recipes currently support **A only**. Juvenile/unknown records remain queryable, but planning them throws until appropriate habitat rules and models exist; the planner does not resize existing adult assets into fictional juvenile specimens. Render/collision/path systems remain responsible for verifying individual placements within groups, safe school extent and model-specific clearance. A center position is not a complete collision layout.

## Game API

The [service](../src/data/ecology/index.ts) has no DOM, Three.js, network, renderer or animation dependency. It builds a small spatial index once. Query it at area-entry/spawn time rather than on every animation frame. A future server can own the same data version, seed and recipes independently of camera LOD.

```ts
import { createEcologyService, planPopulation, habitatAt } from './data/ecology';

const ecology = createEcologyService();
const evidence = ecology.query(-121.95, 36.70, {
  speciesId: 'blue-rockfish', lifeStage: 'Y', year: 2024,
});
// Inspect evidence.status, detectionFraction, sampled years and lastSample.

const recipe = planPopulation(ecology, {
  longitude: -121.91581, latitude: 36.62522,
  seed: 6256, maxIndividuals: 48, maxGroups: 4,
  lifeStage: 'A', allowHabitatInference: true,
  contextAt: (lon, lat) => {
    const context = habitatAt(lon, lat);
    // A game's real adapter supplies measured world depth/substrate here.
    // Default context may return unknown depth and correctly yield no groups.
    return context;
  },
});
// recipe.groups: species/asset IDs, counts, positions, depth, stage and provenance.
// Downloaded JSON uses kind "monterey-bay-cozy-ecology-recipe" and schemaVersion 1.
```

All geographic points use WGS84 longitude/latitude; planned depths are positive downward from the caller's surface. Species IDs match the existing creature catalogue. Only A groups provide an existing asset ID. A caller can batch/instance nearby groups, apply LOD and keep distant populations as lightweight records. The current authored reef, shark patrol and tank demo populations are unchanged.

## Regeneration and verification

```sh
# Offline, checks retained source hashes and joins before replacing runtime JSON:
python3 scripts/extract-ecology.py
# Explicitly request a new public NOAA snapshot:
python3 scripts/extract-ecology.py --fetch
# Write a comparison without changing the shipped dataset:
python3 scripts/extract-ecology.py --output /tmp/monterey-ecology.json

node --import tsx --test tests/ecology.test.ts
node tests/ecology-browser.mjs
```

The extractor requests the three exact scientific names, preserving source codes and life stages. Its distinct-haul query uses the same bounds/time window without species filtering. Missing/duplicate/out-of-bounds records, join mismatches and source checksum changes fail rather than silently introducing zeros. Extraction uses Python's standard library; viewing needs no provider access.

The overlay is a demand-rendered DOM canvas clipped to the cached water polygon. It adds **zero 3D draw calls and zero GPU image textures**, pauses with Map Study, hides inside the Aquarium and disposes listeners/DOM with its owner. Verification evidence and known limits are in the ecology review (historical authoring evidence omitted from this public snapshot).

Next evidence to add: local PISCO/Reef Check diver observations for older reef fish, effort-standardized bottom-trawl/DisMAP layers where appropriate, and acoustic-trawl sardine data. Temperature/chlorophyll can later inform a validated habitat model; no live environmental input currently changes these population recipes.
