# Pacific Grove Museum of Natural History study

The museum at **165 Forest Avenue, on Central Avenue between Forest and Grand**, is the next detailed location in the shared waterfront world. Open **Map Study → Natural History Museum** for exterior, ground-floor and mezzanine cutaways, or **Testing Gym → Menu → Visit Natural History Museum** to walk inside. The menu also offers the mezzanine and an exterior overview. Both viewers use the same procedural factory, placed about 420 m south of the Gym origin.

## Evidence and precedence

Research inspected on October 24, 2026. Public sources remain links; third-party photographs/PDF pages are not bundled as textures or redistributed in the game.

| Source | Used for | Limits |
| --- | --- | --- |
| [Museum accessibility map, three pages](https://www.pgmuseum.org/s/PGMNH-Accessibility-Map-2.pdf) | Ground floor, open mezzanine, elevator/two stairs, garden circulation; September 2026 PDF metadata | Public schematic, no dimensions or north arrow; garden page retains some older exhibit labels |
| [July 2026 visitor social story, 18 pages](https://www.pgmuseum.org/s/PG-Museum-Social-Story-Jul2026-1.pdf) | Current exhibit names, entrance/ramp and interior photographs | Visitor guide, not a measured building survey |
| [Museum rentals and layout](https://www.pgmuseum.org/facility-rentals) | Cross-check room adjacency and courtyard | Older labels conflict with current visitor map: use the gift shop beside the rear lobby, not the former front-side store |
| [Museum exterior photograph](https://www.pgmuseum.org/) | Cream stucco, tile roof, arched steel window, blind arcade, recessed canopy | Roof pitch, window size and heights estimated from photographs |
| [Museum native garden](https://www.pgmuseum.org/garden) | Native planting, fossil pit, Ohlone Seasonal Wheel and Traditional Ruk presence | Arrangement and construction are schematic here, not an ethnographic reconstruction |
| [OSM way 1293958818](https://www.openstreetmap.org/way/1293958818) and cached waterfront roads | Location, footprint envelope, street orientation and metre scale | October 13 footprint in October 24 waterfront extract; building outline does not resolve all courtyard recesses |
| [Museum statement reported by KSBW](https://www.ksbw.com/article/the-pacific-grove-museum-of-natural-history-celebrates-sandy-the-whales-birthday/42679549) | Sandy's approximately 40 ft length, used as a provisional 12.2 m sculpture study | Rounded published length, not a scan |
| Cached [USGS terrain and regional map](waterfront-extension.md) | Surrounding block elevations and street/park context | Coarse runtime grid; museum floor grading is authored |

The latest visitor material identifies Bird Room, Main Gallery, Jade, Wonder, Exploration Station, classroom, lobby monarch display and upstairs Changes. The mezzanine surrounds an open central void. Interior exhibits, cabinets and activity furniture were removed at the user’s request on October 24. The architectural room layout, wall openings, mezzanine, garden and exterior Sandy landmark remain. The former exhibit builder is retained as historical authoring code but is not called by the live factory.

## Scale and orientation

`src/data/pacificGroveMuseum.ts` holds the source record, room rectangles, wall openings and surface heights. The plan's **right** points toward Forest Avenue (west/northwest in the world), while **back** points inland. Central is the front; Grand is the Bird Room side. The supplied museum diagram is not north-up.

The cached OSM front Grand-side corner is Gym **X −3.382, Z 415.291 m**. The orthogonal basis is right **[−0.936388, −0.350967]**, inland **[−0.350967, 0.936388]**. The building envelope is approximately **37.83 × 33.04 m**. The original plan is fitted inside that envelope; rooms have not been surveyed. The garden extends the study to about 40 m inland. Local geometry stays in metres with unit root scale; Map Study's small latitude correction is baked into vertices.

The floor is provisionally **Y 28.05 m**, the mezzanine **3.6 m above it** and the main roof ridge about **9.3 m above it**. These are authoring choices referenced to nearby cached terrain, not measured NAVD88 floor elevations. Front stairs rise 1.08 m in six closed, supported steps. A lower landing and an authored 8 m approach connect them to the coarse street elevation; a Forest-side ramp spans about 20.5 m. These dimensions support the prototype and must not be used as real accessibility or code-compliance information.

| Space | Fitted local X range | Fitted local Z range |
| --- | --- | --- |
| Bird Room | 0–14.08 m | 0–14 m |
| Recessed entrance courtyard | 14.08–19 m | 0–14 m |
| Lobby | 14.08–19 m | 14–20.82 m |
| Main Gallery | 19–30.8 m | 5.7–20.82 m |
| Exploration Station | 30.8–37.83 m | 5.7–9.5 m |
| Wonder | 30.8–37.83 m | 9.5–18 m |
| Jade | 30.8–37.83 m | 18–22.6 m |
| Classroom | 25.6–37.83 m | 26–33.04 m |

Workshop, public restrooms, elevator, gift shop and classroom passage are represented as additional plan regions. Staff/basement collection spaces are not invented beyond the public outline. The study does not reproduce every fixture, utility or exhibit.

## Implementation and ownership

- [Location factory](../src/models/locations/pacificGroveMuseum/index.ts) builds exterior, low walls, upper walls, roofs, empty ground floor and mezzanine as six vertex-colored toon batches. Room floors are partitioned so the shop/services overlap is rendered once. `garden.ts` and `helpers.ts` keep authoring manageable; `exhibits.ts` is inactive historical code. Seed **241024** reproduces planting and whale mottling.
- [Placement adapter](../src/viewer/mapStudy/museum.ts) bakes the reflected plan basis with corrected winding, supplies both projections, door colliders, room lookup, focus points and separate upper-floor bounds. It owns disposal.
- `mapStudy/waterfront.ts` omits the old solid museum placeholder, excludes random trees from the museum plot and carves out the museum-owned floors and entrance supports from the regional DEM. Adjacent street vertices retain their terrain height, avoiding folded sidewalks. The map's regional comparison still restores the original OSM footprint.
- `testingGym.ts` owns the museum as a separate root and adds its walls to land collision and its envelope to flight obstacles. The workbench applies shared node styling and registers that root with existing LOD. Museum cost stays separate from park and waterfront budgets.
- Ground cutaway removes roof, tall walls and mezzanine; upper cutaway reveals the mezzanine ring. Walking nearby opens the roof automatically. Switching camera mode never changes collision geometry.

The ground floor has continuous routes through the public rooms and garden. The current 2D ground controller cannot naturally resolve overlapping floors. **Visit museum mezzanine** explicitly selects the upper floor and its perimeter/void barriers; **Visit Natural History Museum** returns downstairs. Stairs/elevator are represented visually, but automatic stair traversal/elevator interaction remains the next movement experiment. Removed interior exhibits also have their old collision obstacles removed. Exterior garden fixtures remain illustrative. Museum interiors currently share outdoor lighting/weather; roof-aware precipitation and an indoor lighting zone remain future work.

## Budget and verification

The location ceiling is **26,000 Near triangles / 8 draws** for the entire site, separate from surrounding streets, park, avatar and weather. Static source geometry is batched; there are no photograph textures, custom shader compilation paths, extra renderers or per-frame exhibit animation. Shared LOD preserves world placement and collision.

Run `node --import tsx --test tests/museum.test.ts` for projection, current plan assumptions, generous-body door routes, upper void barriers, finite geometry, scale, LOD, budget and disposal checks. Run `node tests/museum-browser.mjs` for actual WebGPU/WebGL2 rendering, floor/room focus, regional comparison, walking routes, museum/reset controls and phone viewport checks. Review evidence (historical authoring evidence omitted from this public snapshot) records results and remaining uncertainty.


## Current repair and neighbouring park

The [museum district repair](museum-district.md) closes the front stair foundations, matches their visible treads to the walking sampler, clears interior exhibits and removes inland ocean geometry. It also partitions district roads/paths/grass into one ground surface and adds Jewell Park detail across Central Avenue. Current repair evidence (historical authoring evidence omitted from this public snapshot) supersedes the initial museum review's exhibit and cost descriptions.
