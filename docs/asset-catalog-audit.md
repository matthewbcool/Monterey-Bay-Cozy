# Asset catalog audit — October 26, 2026

## Findings and changes

The Objects selector previously had 26 entries. It now has **32**, grouped under visible category headings. Five existing park/café props now have a **Furniture** category, and the existing aggregating anemone has been added to **Habitat**.

The missing furniture was authored inside scene builders rather than registered as reusable models. `src/models/props/furniture.ts` is now the shared source for the Objects previews and the existing Gym placements. World colliders, positions, the pink parasol variation and scenery batching remain scene-owned. The standalone previews are one draw each, with no image textures; adding catalog entries does not add instances to the world.

## Added to Objects

All furniture dimensions are provisional artistic estimates from the existing reference-photo study, not surveyed measurements. The anemone's existing species definition remains its provenance source. Factories are `createFurniture(id)` and `createAnemone({species:'aggregating',seed:14})`. All support static inspection; normal shared LOD and disposal apply.

| ID | Overall X × Y × Z (m) | Near / Mid / Far triangles | Draws at each level | Geometry storage across levels |
| --- | --- | --- | --- | --- |
| `park-bench` | 1.700 × 1.040 × 0.532 | 84 / 84 / 28 | 1 | 11,256 bytes |
| `park-litter-bin` | 0.540 × 0.930 × 0.540 | 64 / 60 / 58 | 1 | 12,300 bytes |
| `cafe-chair` | 0.430 × 0.875 × 0.430 | 48 / 48 / 48 | 1 | 5,184 bytes |
| `cafe-table` | 1.060 × 0.795 × 1.060 | 48 / 40 / 40 | 1 | 9,120 bytes |
| `cafe-parasol` | 2.500 × 2.650 × 2.500 | 24 / 12 / 4 | 1 | 3,552 bytes |
| `aggregating-anemone` | 0.067 × 0.051 × 0.066 | 202 / 136 / 111 | 1 | 28,818 bytes |

Model costs exclude scene, shadow and output passes. Storage is geometry buffer allocation, not compressed download size. The chair is only 48 triangles; the simplifier retains its silhouette at every distance. The general LOD check now permits assets already at 100 triangles or fewer to retain detail, while still checking non-increasing cost, attributes, ownership, disposal and category budgets.

## Complete reviewed inventory of scene families

The machine-readable [scene inventory](../src/data/scene-asset-inventory.json) records semantic families, source owners, categories, library links and unresolved work. A row is not a count of placed instances or individual mesh parts. All current Objects entries are independently enumerated in measured catalog costs (historical authoring evidence omitted from this public snapshot).

- **library-shared:** registered model source used by the scene.
- **scene-only:** present geometry, still needs an independent factory/budget/preview before it can enter Objects.
- **mixed:** library representatives plus scene-specific geometry or composition.
- **other-workbench:** deliberately inspected in Tank, Map Study or another view.
- **retired:** retained source that is not rendered by the current owner.

| Family | Category | Status | Source and remaining work |
| --- | --- | --- | --- |
| Cypress bench and green litter bin | Furniture | library-shared | [parkFurniture.ts](../src/viewer/testingGym/parkFurniture.ts). Shared model source; world placement, collisions and batch remain scene-owned. |
| Café chairs, round tables and parasols | Furniture | library-shared | [cafeTerrace.ts](../src/viewer/testingGym/cafeTerrace.ts). Shared source; four table arrangements and pink parasol variation remain scene-owned. |
| Backed/backless trail benches, concrete bins, bicycle racks, interpretation boards | Furniture | scene-only | [waterfrontTrail.ts](../src/viewer/mapStudy/waterfrontTrail.ts). Distinct designs from the cypress bench. Extract raw builders before catalog registration; preserve OSM seats, authored infill and shared batching. |
| Jewell benches, litter/recycling containers and lantern | Furniture | scene-only | [jewellPark.ts](../src/viewer/mapStudy/jewellPark.ts). Bench is a distinct design; boxes used as bin proxies are not finished product models. |
| Caledonia benches, picnic tables, basketball hoops and city-photo playground equipment | Recreation | scene-only | [caledonia.ts](../src/viewer/mapStudy/caledonia.ts), [caledoniaPlaygrounds.ts](../src/viewer/mapStudy/caledoniaPlaygrounds.ts). Keep two court hoops and playground compositions distinct from their court surfaces. Extract and budget before registering. |
| Opening pool gate | Recreation | scene-only | [poolGate.ts](../src/viewer/testingGym/poolGate.ts). Already one batched rigid object. Separate the model from scene collision/toggle logic before exposing an inspection factory. |
| Volleyball posts/net, pool basin/deck/coping and court markings | Recreation | scene-only | [landmarks.ts](../src/viewer/testingGym/landmarks.ts). Net assembly is a reusable candidate; mapped pool/court ground is a location surface. |
| Picket fences, parking bollards/rails and pavement arrows | Infrastructure | scene-only | [parkFurniture.ts](../src/viewer/testingGym/parkFurniture.ts). Parametric fence/rail candidates; terrain-following placement and paint remain site-specific. |
| Chain-link court fences, gates, retaining boundaries and trail rails | Infrastructure | scene-only | [caledoniaFence.ts](../src/viewer/mapStudy/caledoniaFence.ts), [caledonia.ts](../src/viewer/mapStudy/caledonia.ts), [waterfrontTrail.ts](../src/viewer/mapStudy/waterfrontTrail.ts), [jewellPark.ts](../src/viewer/mapStudy/jewellPark.ts). Several fence designs; do not merge them into a single invented generic asset. |
| Beach House, Grill and park building details | Buildings | scene-only | [buildings.ts](../src/viewer/testingGym/buildings.ts). Mapped shells, roofs, awnings and windows; location study rather than stand-alone interchangeable furniture. |
| Gazebo and Little House | Buildings | scene-only | [jewellPark.ts](../src/viewer/mapStudy/jewellPark.ts). Candidate landmark factories; illustrative dimensions and supported terrain foundations. |
| Meals on Wheels / Sally Griffin frontage and residential massing | Buildings | scene-only | [caledoniaMeals.ts](../src/viewer/mapStudy/caledoniaMeals.ts), [caledonia.ts](../src/viewer/mapStudy/caledonia.ts), [caledoniaAnnex.ts](../src/viewer/mapStudy/caledoniaAnnex.ts). Site-specific frontage and contextual buildings, not verified complete architectural models. |
| Waterfront and neighbourhood shells, windows, signs and roofs | Buildings | scene-only | [waterfront.ts](../src/viewer/mapStudy/waterfront.ts), [neighbourhood.ts](../src/viewer/testingGym/neighbourhood.ts). Mapped massing and facade components; category recorded without claiming individual complete buildings. |
| Natural History Museum, whale sculpture, planters, rails and stairs | Landmarks | other-workbench | [index.ts](../src/models/locations/pacificGroveMuseum/index.ts), [museum.ts](../src/viewer/mapStudy/museum.ts). Museum is inspectable in Map Study. Attached detail remains part of that location, not an Objects entry. |
| Aquarium exterior, interior rooms, exhibits and building components | Landmarks | other-workbench | [createAquarium.ts](../src/models/aquarium/createAquarium.ts), [view.ts](../src/viewer/aquariumInterior/view.ts). Area/Map inspection; audit individual fixture reuse separately from the full building. |
| Park rocks, low plants and scene-specific trees | Habitat | scene-only | [nature.ts](../src/viewer/testingGym/nature.ts), [waterfrontTrail.ts](../src/viewer/mapStudy/waterfrontTrail.ts), [jewellPark.ts](../src/viewer/mapStudy/jewellPark.ts), [caledonia.ts](../src/viewer/mapStudy/caledonia.ts). Seven tree species are already cataloged. These extra rock/shrub/proxy tree geometries are not the same library models. |
| Reef boulders and attached habitat colonies | Habitat | mixed | [reef.ts](../src/viewer/testingGym/reef.ts), [seabed.ts](../src/viewer/seabed.ts). Rocks remain scene-only; kelp, stars, urchins and both anemones have library representatives. Colony instances are composition variants. |
| Coastal kelp patches and holdfast rocks | Habitat | mixed | [coastalLife.ts](../src/viewer/testingGym/coastalLife.ts). Library kelp with local batching/placement and simplified rock bases. |
| Gym butterflies, gulls, deer, fish, turtles, jellyfish and whales | Wildlife | other-workbench | [butterflies.ts](../src/viewer/testingGym/butterflies.ts), [gulls.ts](../src/viewer/testingGym/gulls.ts), [deer.ts](../src/viewer/testingGym/deer.ts), [coastalLife.ts](../src/viewer/testingGym/coastalLife.ts), [whalePod.ts](../src/viewer/testingGym/whalePod.ts). Land animals are in Objects; fish/turtle/jelly/octopus/whale are in Tank. Schools, herd/pod behavior and routes are scene compositions, not missing species assets. |
| Rods, tackle box, boats, dock, dive rack, Otter Man and two statues | Equipment | library-shared | [testingGym.ts](../src/viewer/testingGym.ts), [harbor.ts](../src/viewer/harbor.ts), [statues.ts](../src/viewer/testingGym/statues.ts). Already cataloged. Oars, boat benches, scuba pieces and suit jets are components of their owning assets. |
| Concrete pier, beach stairs, platforms, seawalls and rails | Infrastructure | scene-only | [access.ts](../src/viewer/testingGym/access.ts), [shore.ts](../src/viewer/testingGym/shore.ts). Location-scale terrain/access assemblies; maintain geometry/collision agreement when extracting reusable sections. |
| Tank gallery enclosure and visitor silhouettes | Presentation | other-workbench | [scenery.ts](../src/viewer/openSea/scenery.ts), [createGalleryVisitors.ts](../src/models/visitors/createGalleryVisitors.ts). Visible in Tank. Visitors are separate from configurable avatars; neither belongs to the prop selector by default. |
| Garden benches, drinking fountain, interpretation panels, fossil pit and seasonal wheel | Furniture | scene-only | [garden.ts](../src/models/locations/pacificGroveMuseum/garden.ts). Existing garden props; provisional site designs. The whale sculpture is part of the same garden module. |
| Rod holder, submerged pilings and coastal grass | Dockside | scene-only | [harbor.ts](../src/viewer/harbor.ts). Small attached/supporting components, currently batched into the harbor. |
| Museum cases, microscope, classroom tables/stools and dioramas | Historical | retired | [exhibits.ts](../src/models/locations/pacificGroveMuseum/exhibits.ts). Retained source, not imported by the current museum factory. Do not restore exhibits as part of catalog maintenance. |

## Next extraction priorities

1. The distinct waterfront, Jewell, Caledonia and museum-garden benches; bins/recycling containers, bike racks and interpretation panels. Preserve each design rather than treating every bench as the same model.
2. Pool gate, basketball hoops and volleyball net as independently inspectable assemblies; preserve working collision and gate behavior.
3. Playground tower/slide/ladder, drinking fountain, park lantern and rock/shrub families.
4. Parametric fence/bollard sections, gazebo and site buildings only when there is a reuse need. Building windows, oars, suit jets and other attached components do not each need a separate dropdown entry.

Museum exhibits were intentionally removed earlier. Their retained casework, microscope and classroom stools are recorded as retired; this audit does not restore them. Fish and other Tank creatures already have a separate species catalog and are not omissions from Objects.

## Preventing future omissions

`tests/asset-inventory.test.ts` checks unique catalog IDs, exact agreement with scale/budget/reference tables, real inventory source paths, and valid library links. It also scans viewer files for geometry construction: every matching file must have an inventory record or an explicit non-asset reason. That is a review reminder, not semantic proof: a new variant inside an already-covered file, an indirect helper call or geometry outside the viewer still requires manual classification.

For a new prop, update the library catalog and dimension/budget/reference tables together, then the README register. For new scene-only geometry, update this inventory with its category, source and extraction status. Keep retired work separate. The inventory is a maintenance artifact and is not loaded by the game.

## Verification

See the audit review (historical authoring evidence omitted from this public snapshot) for browser captures and final checks. Six additions were inspected through Near/Mid/Far on native WebGPU and WebGL 2 in local Chrome, with a café world capture on each backend. Physical mobile devices, Safari and Firefox were not checked in this pass.
