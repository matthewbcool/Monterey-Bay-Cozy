# Test guide

Run from the repository root. The [contributor guide](../CONTRIBUTING.md) identifies the canonical checkout and shared preview. Use the [codebase guide](../docs/codebase.md) to identify the owner of a change before selecting regressions.

## Local checks

```sh
npm run typecheck
npm run check:docs
npm test
npm run build
```

`typecheck` checks `src/`, TypeScript tests and Vite configuration, with strict typing and unused-local/parameter checks. `npm test` runs every `tests/*.test.ts` through Node's built-in runner and `tsx`; it does not launch a browser or execute `.mjs` suites. `build` typechecks and bundles a static site into `dist/`. Documentation checks scan maintained Markdown, not the historical artifact corpus or remote websites.

## Choose browser coverage

With the shared development preview running at `http://127.0.0.1:5191/` and Chrome installed, run the suite for the affected surface. `npm run test:browser` runs the original tank suite only; it is not an umbrella for all browser checks.

| Change | Contract tests / browser entry points |
| --- | --- |
| Gym loading / performance panel | `frame-metrics.test.ts`; `gym-diagnostics-browser.mjs` (delayed imports, first frame, both backends, keyboard/touch, tab switching and failed loading) |
| Catalog coverage and furniture | `asset-inventory.test.ts`, `asset-contract.test.ts`, `lod.test.ts`; `asset-inventory-browser.mjs` checks categorized selection, all six additions/LODs and Gym café on both backends |
| Caledonia district | `caledonia.test.ts`, `caledonia-meals.test.ts`, `caledonia-playgrounds.test.ts`; `caledonia-browser.mjs` (whole-park gates, ground seams, photo-informed building/playgrounds, destination/deep link/reset, both backends and touch) |
| Creature geometry, state, scale or disposal | `asset-contract`, `collection`, `lifecycle`, `attachments`, species `*.test.ts`; matching species browser suite, `browser-qa.mjs` |
| Gray whale and Demo exclusion | `gray-whale`, `species-sizes`, `tank-demo`; `gray-whale-browser.mjs` (both backends, LODs, caught state and phone framing) |
| Gym gray-whale pod | `gym-whale-pod.test.ts`; `gym-whale-pod-browser.mjs` (offshore placement, calf spacing, surface effects and both backends) |
| Gym draw-call cost | `shadow-casters.test.ts`; `gym-render-cost-browser.mjs` compares actual submissions and visible pixels against the unculled scene, across backends, tiers, sun angles and resizing |
| Gym shadow distance / flight | `sun-shadows.test.ts`; `sun-shadow-pixels-browser.mjs` checks actual caster-on/off pixels from 40–900 m and cascade joins; `gym-shadow-coverage-browser.mjs` checks walking/flight, viewport coverage and player-focus independence on WebGPU Standard / WebGL 2 Standard / Base |
| Cast shadows | `tank-water.test.ts`; `cast-shadows-browser.mjs` (caster-on/off pixel comparison, studio, Objects and Gym on both backends) |
| Shared fish paint/rig or shader style | `style`, `tuna-batching`, species tests; `fish-style-browser.mjs`, `style-tiers-browser.mjs` |
| LOD, geometry ownership or export | `lod.test.ts`; `lod-browser.mjs`, `lod-integration-browser.mjs` |
| Schooling or population routes | `sardine-school`, `schooling`, `tank-demo`, `open-sea` tests; corresponding `*-browser.mjs` |
| Tank optics/gallery | `tank-water`, `open-sea`, `gallery-visitors`; `tank-water-browser.mjs`, `tank-water-edge-browser.mjs`, `open-sea-browser.mjs` |
| Enhanced Gym water | `water-effects-settings.test.ts`; `enhanced-water-browser.mjs` (native WebGPU opt-in, WebGL fallback, zero optional imports in Balanced, CPU/GPU waterline, toggles, night, phone layout and measured costs) |
| Harbor/props/water | `coastal`, `water-depth`, `ocean-look`, `water-optics`; `coastal-browser-qa.mjs`, `water-depth-browser.mjs`, `water-optics-browser.mjs` (current Gym), `ocean-look-browser.mjs` (historical 800-triangle fixture) |
| Habitat or butterflies | `bat-star`, `kelp`, `monarch-butterfly`, `monarch-batch`; corresponding browser suites and `gym-butterflies-browser.mjs` |
| Giant green anemone | `anemone.test.ts`, `gym-reef.test.ts`; `anemone-browser.mjs` checks both backends, all LODs, instanced beds and mobile Base; accepts `ARTIFACT_DIR` |
| Southern sea otter | `sea-otter.test.ts`, `sea-otter-tank.test.ts`, `asset-contract.test.ts`, `asset-inventory.test.ts`, `tank-demo.test.ts`, `tank-water.test.ts`; `sea-otter-browser.mjs` checks pose/LOD/export/library; `sea-otter-tank-browser.mjs` checks actual surface/underwater visibility, transitions, controls, caught state, Demo restoration, both backends and phone framing. Both accept `ARTIFACT_DIR` |
| Deer and fawns | `deer.test.ts`, `deer-behavior.test.ts`, `gym-deer.test.ts`; `deer-browser.mjs` and `deer-auto-lod-browser.mjs` check both variants, every pose/LOD on both backends, real keyboard avoidance, mapped habitat views and reduced-motion phone layout |
| Western gulls and sky flocks | `western-gull.test.ts`, `gull-flock.test.ts`; `gull-browser.mjs` validates both sexes, every pose/LOD, finite replay, GPU parity, 0–1,024 instances, Objects controls and phone framing on both backends |
| Gulls in the Testing Gym | `gym-gulls.test.ts`; `gym-gulls-browser.mjs` checks grounded/coastal placement, independent slower flight, actual player approaches and safe retreats, distance sleep, LOD costs, reduced motion, view lifecycle and phone layout on both backends |
| Avatar shape, saves or input | `avatar-model`, `avatar-saves`, `avatar-controller`, sizing/jump/swim/dive tests; `avatar-browser.mjs`, `avatar-sizing-browser.mjs`, `avatar-swimming-browser.mjs` |
| Park tree scale / building relationships | `coastal-trees`, `testing-gym-surface`; `tree-scale-browser.mjs` (WebGPU/WebGL 2, ground-level reference, all LODs, Map Study; supports `ARTIFACT_DIR`) |
| Lovers Point café, walls and pier | `lovers-point-photo.test.ts` checks mapped passage clearance and canopy normals; `lovers-point-photo-browser.mjs` captures both backends, four reference views, café LODs, costs and source hashes. `testing-gym-surface.test.ts` verifies the two explicit photo height estimates, foundations and ground footing. |
| Pool gate, court and bike trail | `recreation-area.test.ts`, terrain/elevation/LOD checks; `recreation-area-browser.mjs` verifies keyboard passage, safe gate swing, touch/reduced motion, shared Map Study and both backends |
| Gym terrain/placement/interactions | `testing-gym`, elevation/surface/swimming, `gym-boat`, `gym-reef`; `testing-gym-browser.mjs`, `lovers-point-details-browser.mjs`, boat/reef/statue browser suites |
| Gym regional bay integration | `bay-region`, `gym-bay-extension`; `gym-bay-extension-browser.mjs` checks regional framing, local scene culling, place focus, LOD costs and restoration on both backends |
| Gym ground materials and beach access | `gym-paths`, `gym-surface-style`, `testing-gym-elevation`, `testing-gym-surface`; `gym-surfaces-paths-browser.mjs` checks both backends, Base/Standard, all LODs, day/night and phone viewport |
| Gym underwater optics | `gym-reef`, `weather-lighting`, `tank-water`; `gym-reef-browser.mjs` (jelly sorting negative control, weather caustics, kelp and LOD), `water-optics-browser.mjs` (current coast-clipped water: wake, animation, weather, Base/Standard and phone layout) |
| Gym underwater terrain / flight shadows | `bathymetry`, `testing-gym-swimming`, `coastal-life`, `gym-reef`; `bathymetry-browser.mjs` (WebGPU Standard, WebGL 2 Standard/Base; supports `ARTIFACT_DIR`) |
| Gym weather/lighting | `gym-weather`, `sky-astronomy`, `weather-lighting`; `gym-weather-browser.mjs`, plus style regression for shared material changes |
| Map geometry/interior | `map-study`, `map-clip`, `map-park`, `aquarium-interior`; `map-world-browser.mjs`, `map-study-browser.mjs`, `aquarium-interior-browser.mjs` |
| Provider adapters or feed research | `world-conditions`, `gym-weather`, `live-feeds`; `map-world-browser.mjs`, `live-feeds-browser.mjs`, `gym-weather-browser.mjs` |

The table groups tests by concern; file families are under this directory. HTML/TS review fixtures support capture/debugging and are not production entry points. Older review scripts can assume a particular UI or overwrite a dated artifact folder; read their inputs/outputs before running them.

## Reproducible browser inspection

Browser probes import the entry script URL already loaded by Vite, including its revision query. Importing a different `/src/main.ts` URL can execute a second app. Await `viewer.started`, the lazy workbench, and LOD readiness as appropriate. Explicitly verify the actual backend; a `?webgl` or WebGPU flag is only a request.

Use fixed seeds, date/time, camera, LOD and quality for screenshots that need deterministic comparison. Gym weather defaults to the real clock and regional data; a day/night image difference may be expected. Existing weather/map browser suites use clearly marked provider-shaped fixtures. A fixture pass does not verify live API access; record that separately with its date and source timestamps.

A renderer may submit output or shadow passes beyond model draws. Reset `renderer.info` before a measured render and record actual submissions. Keep geometry byte counts separate from total GPU/heap memory. Screenshot repeatability is not a frame-time measurement.

Some suites block only the local Vite HMR socket to hold a loaded revision stable while other chats write evidence. Preserve application networking. Source-hash checks detect edits during a run; a successful earlier run does not validate a later source revision.

## URLs, output folders and review evidence

Many suites accept `PREVIEW_URL`; support is not universal. Output overrides also differ:

- `museum-district-browser.mjs`, `coastal-life-browser.mjs`, `otter-thrusters-browser.mjs`: `ARTIFACT_DIR`.
- `browser-qa.mjs` (the `npm run test:browser` Tank suite): `ARTIFACT_DIR`; selector coverage follows the registered creature collection.
- `avatar-browser.mjs`: `AVATAR_ARTIFACT_DIR`; `AVATAR_PERSISTENCE_ONLY=1` narrows save/import checks.
- `avatar-swimming-browser.mjs`: `SWIMMING_ARTIFACT_DIR`.
- `testing-gym-browser.mjs`, `map-world-browser.mjs`, `gym-weather-browser.mjs`, `gym-surfaces-paths-browser.mjs`: `ARTIFACT_DIR`.
- Other suites often write fixed `artifacts/` paths. Inspect their declarations before a rerun.

Example isolated weather rerun:

```sh
ARTIFACT_DIR=/tmp/mb-weather-review node tests/gym-weather-browser.mjs
```

Browser channel overrides likewise vary; check `BROWSER_CHANNEL` support in the chosen suite. Current evidence generally uses Chrome on the development Mac. Phone-size/touch/reduced-motion emulation, scripted gamepads and forced WebGL 2 are explicit test modes, not physical-device or Safari/Firefox verification.

Save meaningful metrics/screenshots with a dated `REVIEW.md`, source hashes/revision and exact scope. Keep earlier experiment evidence intact unless deliberately refreshing its report; do not replace fixture output with invented live readings or treat historical passing counts as current acceptance.

For held underwater fixtures, save `gym.root.parent` before stopping the workbench; its public `scene` getter returns the studio when inactive. Apply the player’s underwater fog explicitly (0.8–24 m), update weather after stopping, and warm scene/light transforms before comparing frames. `gym-reef-browser.mjs` and `ocean-look-browser.mjs` accept `ARTIFACT_DIR` to preserve earlier captures.

The Map Study browser harness reads its backend and view attributes inside the page: the installed Playwright beta returned `null` from locator `getAttribute()` while direct DOM reads showed the populated attributes. Preserve the backend/view assertions when adjusting that compatibility workaround.

### Coastal trees and orbit-stable lighting

- `coastal-trees.test.ts`: 40 seeds per species, exact metre height, deterministic geometry, budgets, LOD ownership and municipal coordinates/instance IDs.
- `node tests/toon-lighting-browser.mjs`: rendered stock-material negative control and corrected fixed-surface pixel comparisons through eight camera headings; ordinary and nonuniform instanced geometry, default/ramp materials, and a moving sun, on WebGPU and WebGL 2.
- `node tests/coastal-trees-browser.mjs`: all seven Objects entries, regeneration, Near/Mid/Far, common-scale comparison, phone viewport, and the 52 park trees in five batches on both backends. Evidence lives in `artifacts/camera-lighting-trees/`.

## Otter Man and waterfront

`otter-flight.test.ts` checks flight clearance, bounds, landing, invalid input, avatar size and suit LOD. `waterfront.test.ts` checks shared coordinates, seam height, provenance and region budgets. `node tests/otter-flight-browser.mjs` drives equip, ascent, hover, landing, cross-region travel, return, both map views and phone touch on the shared preview. Set `OTTER_ARTIFACT_DIR` to keep a fresh evidence directory.

`otter-thrusters-browser.mjs` checks grounded exhaust, hover jets, prone forward flight, stronger boost, upright recovery and outfit return using keyboard input on both WebGPU and WebGL 2. It saves current suit screenshots and counts under `artifacts/otter-man-thrusters/`. `otter-flight.test.ts` additionally checks exhaust attachment at all LODs, conservative motion bounds and reduced-motion thrust behavior.

`museum.test.ts` checks museum placement, door routes, upper-floor barriers, scale, LOD and budgets. `museum-browser.mjs` checks the shared model in Map Study and Gym on WebGPU/WebGL2, including cutaway controls, a connected gallery walk and emulated-phone layout. Evidence: `artifacts/pacific-grove-museum/`.

## Coastal wildlife and trail

`coastal-life.test.ts` checks seeded kelp placement, whole-body water clearance, movement/sleep/reduced-motion behavior, resource disposal, trail provenance and assembly budgets. `node tests/coastal-life-browser.mjs` uses the shared preview, checks the actual lookout control, scene attachment and moving shark, then holds inspection cameras for underwater, canopy and trail views on both renderers. Camera fixtures never move the player or animals. Evidence goes to `artifacts/coastal-life/`.

`museum-district.test.ts` covers entrance support, removed exhibit collision, ocean exclusion at all LODs and single-surface park ground. `node tests/museum-district-browser.mjs` captures both renderers and walks down/up the entrance; evidence is in `artifacts/museum-district/`.


## Otter Man diving and park boundaries

`otter-diving.test.ts` covers surface crossing, underwater speed and seabed limits, tight rotated collision footprints, pool rails, bounded bubbles/lamp cleanup, and raycasts through the coastal trail surface. `node tests/otter-diving-browser.mjs` equips and flies/dives/resurfaces using real controls on native WebGPU and WebGL 2, then captures identical lamp-on/off frames and park/trail views. Evidence is in `artifacts/otter-man-diving/`. The held inspection cameras are visual fixtures, not evidence of player traversal. Shader lighting does not add a shadow map.


## Bay-wide Map Study

`bay-region.test.ts` checks region coverage, official source records, finite sampled terrain, marine/inland mask probes, metre scale, cutouts, budgets, shared LOD and disposal. `node tests/bay-region-browser.mjs` checks native WebGPU and WebGL 2, regional town navigation, optional seafloor, local park/museum preservation, comparison fill, keyboard, phone-width framing, inactivity and absence of external map/data requests. Output: `artifacts/monterey-bay-region/` (or `ARTIFACT_DIR`). Inspect [source/accuracy limits](../docs/monterey-bay-region.md) before interpreting the regional mesh as detailed habitat or navigational evidence.

## Morph animation across detail changes

`node tests/moon-jelly-lod-browser.mjs` uses the actual Gym moon jelly in a held-camera rendering fixture. It compares rendered silhouette dimensions with projected posed geometry over repeated Near/Mid/Far switches, pulse phases, caught pose and controller restoration on WebGPU and WebGL 2. A geometry-only negative control reproduces stale morph bindings and must fail the same pixel check. `PREVIEW_URL` and `ARTIFACT_DIR` are supported. See the regression review (historical authoring evidence omitted from this public snapshot); `lod.test.ts` also guards material-array invalidation, stable weights/placement, static-mesh reuse and restoration.

- Shoreline foam: `shore-foam.test.ts` checks finite metre geometry and shallow-terrain handling; `shore-foam-browser.mjs` checks both backends and captures the wash cycle under `artifacts/shore-foam/`.

- Recreation grading: `recreation-photo-correction-browser.mjs` captures the corrected trail, court, Grill, Beach House frontage and widened stairs on both backends, with court Near/Mid/Far views and source hashes. The older `recreation-grade-browser.mjs` captures the superseded surrounding bank. `recreation-area.test.ts` checks trail flatness and retaining-edge parity; `testing-gym-surface.test.ts` checks all-LOD ground coverage and clear storefront approaches; `gym-paths.test.ts` checks both stair landings and walking lanes.

## Fish ecology evidence and recipes

`ecology.test.ts` checks exact source hashes, haul joins, explicit zeros versus missing stages/periods, metric grid edges, malformed records, habitat constraints and bounded deterministic recipes. `ecology-browser.mjs` checks Map Study filters, portable recipe downloads, demand rendering, mobile layout, Aquarium visibility and zero added 3D draws on WebGPU and WebGL 2; it accepts `ARTIFACT_DIR`. [Data interpretation](../docs/fish-ecology.md).

## Rideable surrey and November Lovers Point study

`surrey.test.ts` checks scale, LOD, collision, braking/reverse steering, real trail clearance and the new pier section. `surrey-browser.mjs` drives the normal Gym UI on WebGPU and WebGL, including dismount and tab changes. `lovers-point-surrey-capture.mjs` writes fixed-camera screenshots and measured render/model bounds; see [the study](../docs/lovers-point-surrey.md).

## Ground squirrels

`ground-squirrel.test.ts` covers the asset, instancing, relative morphs, lifecycle and eight safe rockside placements. `ground-squirrel-browser.mjs` checks all library poses/LODs, one-draw 1/8/32 groups and the Gym shortcut on both backends. See [scale, sources and cost](../docs/ground-squirrel.md).
