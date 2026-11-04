# Viewer source map

The viewer composes reusable assets into browser experiments. Start with the [codebase guide](../../docs/codebase.md) for layers, units and lifecycle, or [feature documentation](../../docs/README.md) for behavior. Model factories remain independent of controls and DOM panels.

## Viewport owners

| Owner | Responsibilities and main helpers |
| --- | --- |
| [main.ts](../main.ts) | Main DOM and Tank/Area/Objects renderer; tab routing, selection, export and shutdown |
| [mapStudy.ts](mapStudy.ts) | Lazy geographic viewport, base map, overlays, interior, LOD and demand rendering |
| [avatarWorkbench.ts](avatarWorkbench.ts) | Lazy shared Avatars/Gym renderer, recipes UI, input, cameras, interactions and equipment |

Only the active owner renders. Document visibility pauses loops; Map Study redraws on demand instead of running a continuous gameplay loop. When adding a tab or panel, use the existing owner's activation/disposal path rather than starting an unowned renderer or timer.

## Module families

| Area | Source and boundary |
| --- | --- |
| Inspection/render style | `nodeStyle.ts`, `quality.ts`, `modelStats.ts`, `sky.ts`; runtime material conversion, device policy and counters |
| Tank and gallery | `tank.ts`, `openSea/`, model visitors; enclosure optics and scenery, not creature travel |
| Single specimen travel | `swimPath.ts`; path-owned rigid root and follow-framing dimensions |
| Mixed exhibit | `tankDemo.ts`, `demoPopulation.ts`, `demoRoute.ts`, `demoSchool.ts`; population, habitat routes and school composition |
| Ocean appearance | `water.ts`, `oceanOptics.ts`, `waterDepth.ts`; shared displacement/buoyancy, Gym optical normals, weather-aware reflection and owned 48 KiB depth field; [maintenance guide](../../docs/ocean-water.md) |
| Area & buildings | `harbor.ts`, `seabed.ts`, `bathymetry.ts`, `water.ts`; presentation shore, habitat placement and CPU/GPU wave twins |
| Objects | `objects.ts`; selection, seeded regeneration, attached crawling and true-scale comparisons; catalogue is in `models/props/`. Optional instance-specific pose lists keep sky flocks flight-only; finite poses expose Replay through the existing motion control. Asset inspection heading affects the turntable, not exported geometry. |
| Avatars | `avatarController.ts`, `gamepad.ts`, `avatarWorkbench.ts`; simulation intent, input reader and browser orchestration respectively |
| Gym diagnostics and loading | `frameMetrics.ts`, `gymDiagnostics.ts`, `gymLoading.ts`, `gymDiagnostics.css`; lightweight UI and statistics, owned by the workbench frame/lifecycle, with bootstrap loading from `main.ts` |
| Gym composition | `testingGym.ts`; park root, interactions, water, vessels, swim world and separate reef/whale owners |
| Gym bay extension | `testingGym/bayExtension.ts`; shared regional map at the Gym origin, land/water flight samples and separate view ownership |
| Gym surface appearance | `gymSurfaceStyle.ts`; scoped ground/scenery TSL detail after `applyNodeStyle()`, static contact-field ownership and filtered metre-space marks |
| Optional ocean optics | `waterEffectsSettings.ts`, `waterEffectsPanel.ts`, `enhancedWater/`; lazy WebGPU transport, caustics, shafts and bounded render resources. See [graphics policy](../../docs/graphics-quality.md). |
| Gym atmosphere | `gymWeatherSystem.ts`, `gymWeatherSky.ts`, `gymWeather.css`, `sunShadows.ts`; controls/data lifecycle and scoped lights versus procedural sky/rain renderer |
| Map integration | `mapStudy/loversPoint.ts`, `clip.ts`; park reprojection, foundations and clipping base-map lines |
| Map conditions | `mapStudy/worldConditionsLayer.ts`; DOM cards/pins for the separate `data/worldConditions.ts` service |
| Aquarium navigation | `aquariumInterior/view.ts`, `style.ts`; rooms, routes and overlays sharing the map camera/renderer |
| Candidate feed pins | `liveFeedLayer.ts`; presentation of `data/liveFeeds.ts`, no video player/provider fetch |

## Gym geometry and simulation

| Files under `testingGym/` | Ownership |
| --- | --- |
| `elevation.ts`, `geometry.ts` | Terrain sampling/draping and metre-space geometry helpers |
| `groundSurface.ts`, `pathStyle.ts`, `shore.ts`, `access.ts` | Non-overlapping land with categorical `groundKind`, mapped surface/width rules, coastal boundaries and physical stair profiles |
| `placement.ts`, `treeScaleStudy.ts`, `nature.ts`, `spatialBatches.ts` | Municipal tree positions, separate provisional photo-height overrides and cross-source diagnostics; shared tree factories, seeded rocks and bounded render batches |
| `buildings.ts`, `neighbourhood.ts`, `landmarks.ts`, `cafeTerrace.ts`, `statues.ts` | Authored structures, cached context, photo-inferred café furniture and library sculpture placement; closed building shells omit buried/roof-covered caps |
| `bathymetry.ts`, `seafloor.ts` | USGS source sampling, explicit shore/gap handling and shared render/collision triangles; [source contract](../../docs/bathymetry.md) |
| `swimming.ts` | Water/land masks and access overrides; delegates floor heights to `seafloor.ts` |
| `boatController.ts` | Kinematic vessel input, hull sampling, collision and berth constraints |
| `reef.ts` | Separate habitat root, attached creatures, routes, kelp sway and proximity gating |
| `whalePod.ts` | Three metre-scale gray-whale rigs, mother-calf pairing, surface events and independent visibility |
| `bayExtension.ts`, `oceanGeometry.ts` | Regional LOD owner and flight samples; the bounded local ripple-water patch |
| `deer.ts`, `deerBehavior.ts` | Library doe/fawn assembly, source-backed grass patches and distance sleep; pure deterministic herd movement, player avoidance and swept terrain/collision safety |
| `butterflies.ts` | Seeded instanced butterfly routes and poses |
| `gulls.ts`, `gullFlight.ts`, `gullEscape.ts` | Ground/coastal population and distance sleep; independent seeded flight routes; player-triggered takeoff and safe landing, separate from camera LOD |

`avatarWorkbench.ts` is the place for browser input and HUD behavior. Keep terrain/boat/swim calculations in their existing modules so tests and future replicated state do not depend on DOM controls. Keep the reef separate from the park-only render budget. World bounds and physics do not change with LOD.

## Adding or replacing an asset

1. Construct the canonical library factory and place it in metres; keep seeds for reproducibility.
2. Configure a scoped style environment before conversion when needed, then call `applyNodeStyle()` on new roots. Do not overwrite the shared `STYLE` tokens for local weather.
3. Add the root to the right owner and register it with that owner's LOD controller. Account separately for independently animated roots and instanced batches.
4. Update only pose/uniforms in animation; build geometry and instance buffers at construction or explicit design changes.
5. Release the actual rendered geometry/materials and instance resources on replacement/disposal. Detach surface crawlers and cancel obsolete asynchronous work.
6. Verify relevant interactions and both graphics backends; see [test selection](../../tests/README.md).

Some model `userData` fields are extension contracts: `assetId`, seed, `styleBase`, paint/rim flags, physics metadata and conservative LOD bounds. Read their factory and the consuming helper before changing them. They are not a replacement for the public typed model/controller interfaces.

### Camera-stable toon diffuse response

`nodeStyle.ts` applies `toonLighting.ts` to converted and custom `MeshToonNodeMaterial` instances. Three r180 compares object-space normals to view-space light directions; the adapter uses `normalView` for both ordinary and instanced/deformed meshes while retaining the original gradient, Lambert lighting, AO and shadows. Keep the rendered negative-control regression when updating Three; remove the adapter only when the upstream model passes it. Rim/Fresnel effects intentionally remain view-dependent.

`mapStudy/museum.ts` places the same procedural museum in Map Study and the Gym, with cutaway modes, room lookup, floor heights, door colliders and an upper-floor loop. [Museum guide](../../docs/pacific-grove-museum.md) explains source precedence and explicit floor selection.

### Tank water lighting

`openSea/waterLook.ts` keeps one moving caustic web on the floor and creatures. Its second texture sample modulates brightness rather than adding another web. The distant vertical enclosure uses haze/light shafts instead of stretched XZ caustics; both faces of the surface have separate broad ripples, allowing the otter-follow camera to look down on the water. Keep these roles separate when tuning the look. The generated field, water absorption, animation clock and one-draw enclosure are retained; the new upward surface adds two triangles for twelve total, and creature caustics fade off above the waterline. Validate both backends with `tests/tank-water-browser.mjs`; the October 24 tank review (historical authoring evidence omitted from this public snapshot) records this look.

Museum district ground partitioning lives in `mapStudy/waterfrontSurfaces.ts`; Jewell Park composition in `mapStudy/jewellPark.ts`; the Gym ocean coastline mesh in `testingGym/oceanGeometry.ts`. See [district scope and source contracts](../../docs/museum-district.md).

### Cast shadows

The main viewer and avatar studio retain one PCF sun map (Base 1024, Standard 2048); the studio receives the avatar silhouette on its plinth. The Gym uses `sunShadows.ts`: three blended, texel-stabilized camera-frustum cascades with boundaries at 80 / 360 / 3,600 m (clamped to the camera far plane). Coverage follows the view during walking and flight, including camera zoom, aspect and FOV changes, without an abrupt player-centred square. Base uses 1024² per map and Standard 2048². Far shadows fade beyond the local clear-weather fog. Clouds reduce every cascade's intensity and all three stop updating below the horizon. The existing avatar contact disc remains a low-light fallback. Moonlight does not allocate another map.

The CSM adapter retains resolution-aware normal bias to suppress flight stripes, fits each map's depth to its frustum plus caster margin, and explicitly disposes all cloned map resources. Keep this adapter when upgrading Three until coverage, weather synchronization and disposal tests pass against the replacement. It adds two shadow passes relative to the former single map; geometry budgets are unchanged. The regional whole-bay overview deliberately has a much longer fog range and does not have kilometre-scale detailed shadows everywhere. Current coverage tests and limitations (historical authoring evidence omitted from this public snapshot).

`shadowCasters.ts` filters each Gym cascade with a conservative swept-bounds test. Offscreen contributors are retained; color visibility and wildlife simulation are untouched. Reserve layers 1–3 for this owner, keep animated/displaced bounds conservative, and preserve cleanup of replaced actors. [Performance audit and maintenance contract](../../docs/gym-rendering-performance.md).

The tank's unlit water explicitly samples the scene sun shadow to preserve its painted colour. Opaque creature bodies cast silhouettes, while transparent tissue does not cast solid shadows. `tests/cast-shadows-browser.mjs` verifies actual receiver pixels with a caster enabled/disabled and captures Objects, Avatars and Gym on both backends. Shadow-map submissions are extra work beyond asset budgets; no new model triangles are introduced.


### Full-bay regional map

`mapStudy/bayRegion.ts` owns the cached regional landscape, main-route line batches, clipped ocean and ETOPO seafloor toggle. `mapStudy/bayPlaces.ts` owns place selection/DOM labels. They share the existing Map Study renderer and demand rendering, with no provider requests or simulation loop. Preserve local-study cutouts, flat-source comparison and the authored edge transition when changing terrain. [Sources and budgets](../../docs/monterey-bay-region.md).

The [recreation-area guide](../../docs/recreation-area.md) covers `testingGym/poolGate.ts`, `parkFurniture.ts`, `landmarks.ts` and `recreationGrade.ts`. The latter derives a local level facility terrace without modifying the source DEM; both viewers and physics consume the existing elevation sampler.

### Caledonia Park

`mapStudy/caledonia.ts` owns the shared district factory, partitioned road/park surface, graded height sampler, court/furniture geometry and collisions. `mapStudy/caledoniaLabels.ts` owns the plan-only DOM labels. `testingGym.ts` expands walking/flight support; Map Study and `testingGym/bayExtension.ts` mask the regional terrain underneath. [Feature and source contract](../../docs/caledonia-park.md).

`mapStudy/caledonia.ts` composes the Caledonia district for both viewers. `caledoniaPlaygrounds.ts` owns the city-photo equipment, timber bed edges and geometry-derived collision bounds; it feeds the existing district batches. `caledoniaFence.ts` owns the perimeter, mapped gate corridors and authored fence LOD; `caledoniaMeals.ts` owns the one-draw photo-informed building; `caledoniaAnnex.ts` owns its cached northern ground patch and seam-aware triangle sampler. Keep their authored LOD families outside generic static batching. `avatarWorkbench.ts` owns destination selection, direct links and reset/overview behavior.

## Fish ecology inspector

[`mapStudy/ecologyLayer.ts`](mapStudy/ecologyLayer.ts) owns the demand-rendered survey grid, filters, cell inspection and JSON recipe export. It consumes the pure data service and existing local bathymetry, adds no 3D submissions and follows the Map Study interior/visibility/disposal lifecycle. [Evidence versus gameplay assumptions](../../docs/fish-ecology.md).

## Sea otter surface route

`seaOtterRoute.ts` is shared by `createSwimmer()` and `createDemoRoute()`. It owns exact waterline placement, long floating/grooming rests, short dives, underwater travel and smooth returns. `models/sea-otter/` adapts the same Objects model to the Tank lifecycle and adds caught X eyes. The route respects external/physics ownership and cannot move a caught animal. `main.ts` maps Surface rest / Underwater swim / Natural cycle to route activities, retains state across Demo toggles, and adjusts the follow camera through surface crossings. See the behavior and validation (historical authoring evidence omitted from this public snapshot).
