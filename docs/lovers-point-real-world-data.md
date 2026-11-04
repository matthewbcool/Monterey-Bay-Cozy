# Lovers Point: real-world data and reference comparison

The Testing Gym and Map Study's detailed park recreate Lovers Point Park in Pacific Grove from cached public data. This page lists every real-world source the gym uses, what each one controls, and what remains authored. It also records the October 23 comparison against reference photos and the changes it produced. [Gym geography](testing-gym-geography.md) holds the detailed coordinate frame and per-feature assumptions; [Map Study](map-world.md) explains the regional view that shares these components.

The geographic records below are cached in `src/data/` and read locally; they are derived with standard-library scripts in `scripts/`. The separate [Gym weather service](weather-sources.md) does request nearby observations and forecasts at runtime.

## Data in use

| Data | Cached file | Source and date | Controls in the gym | Authored on top |
| --- | --- | --- | --- | --- |
| Regional OSM: coast, roads, buildings | `src/data/monterey-map.json` | OpenStreetMap contributors (ODbL 1.0), downloaded 2026-10-13 | Map Study's regional massing; source of both gym extracts below | — |
| Park core: coastline, paths, 25 building footprints | `src/data/lovers-point-gym.json` | Derived from the regional download | Walkable coast, building outlines, Beach House (`way/224525165`) | Wall/roof heights, facade detail |
| Park detail: routes, beaches, pool, court, parking, breakwater, park outline | `src/data/lovers-point-features.json` | OSM API extract 2026-10-22 ([bbox](https://api.openstreetmap.org/api/0.6/map?bbox=-121.9185,36.6245,-121.914,36.6275)), `scripts/extract-lovers-point-features.py` | Ground paint regions, surface tags, tagged 2 m footway width, stairs and concrete pier route (`way/633871951`), lawn vs town ground | Untagged widths, wall placement, stair treads |
| Terrain | `src/data/lovers-point-elevation.json` | USGS 3DEP, NAVD88, `CA_AZ_FEMA_R9_Lidar_2017_D18`, 2026-10-22 | Base terrain inside the crop; original samples remain unchanged | Local recreation terraces, retaining transitions, stair profiles and Beach House ground-floor datum; offshore terrain uses the separate [bathymetry source](bathymetry.md) |
| **Neighbourhood backdrop (new)** | `src/data/lovers-point-neighbourhood.json` | Derived from the regional download by `scripts/extract-lovers-point-neighbourhood.py` | 215 house footprints (OSM ids kept) and 144 street runs south of the crop, within 450 m | Heights, colours, ground beyond the DEM |
| Park tree inventory | `src/data/lovers-point-trees.json` | [City of Pacific Grove GIS](https://gis-web.cityofpacificgrove.org/arcgis/rest/services/Open_Data/Trees/MapServer/0), retrieved October 24, 2026; observation dates unknown | 52 tree positions and source taxa within the OSM park boundary | Crown shape, height, heading and condition; see [inventory limits](coastal-trees.md) |
| Artwork positions | `src/data/lovers-point-artworks.ts` | Historic visitor GPS pins | Sailing boy and Monarch Butterfly placement | Size and heading (see [statues](lovers-point-statues.md)) |

Show OpenStreetMap attribution with the gym; it is in the gym footer and in each derived file's `source` field.

### Neighbourhood backdrop

Before this pass the gym ended at a flat crop edge with an exposed terrain skirt and an empty horizon. The neighbourhood batch places the real street grid and house footprints from the cached regional download around the park:

```sh
python3 scripts/extract-lovers-point-neighbourhood.py --source src/data/monterey-map.json --output src/data/lovers-point-neighbourhood.json
```

- **Selection:** buildings whose every vertex lies outside the detailed crop (X −145…150 m, Z −160…130 m) and within 450 m of the origin. Road runs keep only consecutive points outside the crop, so nothing overlaps the park's own mapped roads. The extract is 55 KB and adds no runtime download beyond the gym chunk.
- **Coverage is south only:** 190 buildings lie south of the crop, 23 south-east and 2 west. The regional download stops at about X −141 m, so inland Pacific Grove to the west has no footprints. Filling it needs a new OSM extract, which this pass does not invent.
- **Heights are authored:** only 2 of the footprints carry `building:levels` (× 3 m); the rest use a 5.5 m cottage height with a flat cap. No source heights exist.
- **Ground beyond the DEM is authored:** the cached elevation grid ends at the crop, and its edge heights continue outward. A 25 m apron rises only near mapped houses and streets and sinks below the bay elsewhere, so the town never floats or covers open water.
- **Palette:** pastel walls (`#e6d08a`, `#eeece4`, `#a9c1cb`, `#c9b9a6`, `#9aa596`) and dark or terracotta roofs chosen by hashing each OSM id, read from photos of the neighbourhood (estimates). The same palette now applies to the 24 non-park buildings inside the crop.
- **Cost:** one static matte batch with distance LOD, about 6,150 triangles. No collision; the area is outside the playable bounds. Streets have no OSM ids or classes in this cache, so all use an authored 6 m width.

## Reference comparison, October 23

A side-by-side review compared gym captures with:

- **City of Pacific Grove, *Lovers Point Park Facilities* assessment** ([PDF](https://files.cityofpacificgrove.org/Document_Center/Departments/Public%20Works/Buildings%20%26%20Grounds/Lovers%20Point%20Park.pdf?t=202510301223500), draft, July 2025): photo pages 1 (cover), 13 (Beach House exterior), 19 (cave and breakwater), 33–34 (pool, court, fences), 44 (aerial) and 53 (court toward the Beach House).
- **Wikimedia Commons:** [Monterey Bay Coastal Trail and Lover's Point](https://commons.wikimedia.org/wiki/File:Monterey_Bay_Coastal_Trail_and_Lover%27s_Point.jpg) and [Lovers Point Park DSC06504](https://commons.wikimedia.org/wiki/File:Lovers_Point_Park_-_Pacific_Grove,_CA_-_DSC06504.JPG).

The photos are references only: none are stored in the repository or used as textures. The colour values below are estimates from photos taken in overcast light, not measurements.

### Changes made

This dated comparison records the earlier geometry. The [October 24 tree pass](coastal-trees.md) supersedes the cypress prototype and guessed planting below.

| Area | Observed in references | Change | Owner |
| --- | --- | --- | --- |
| Monterey cypress | Massive, dark, layered crowns 12–18 m wide starting low on thick, twisted trunks; the gym's thin trunks and high discs read as acacias | Trunk radius 0.34 → 0.55 m; crowns start at 3.6 m instead of 5.5 m and stack upward; crowns taller and 0.5 wider; leaf `#34503a` / `#4a6845`, bark `#5b4f45`. Same triangles | `testingGym/nature.ts` |
| Beach House roof and trim | Steep charcoal roof about 40% of the building's height; crisp white trim; saturated yellow awnings | Roof rise 2.2 → 5.5 m in `#3d4246`; trim `#f3f1e8`; awnings `#f0b428` with a deeper valance | `testingGym/buildings.ts` |
| Rocky point | Dark grey-brown jagged granite with lichen and white surf | Point granite `#7f776a`, boulders `#8d8272`, per-instance tint 0.72–1, taller boulders; a 1.4 m surf band along the point | `testingGym.ts`, `nature.ts` |
| Town ground and buildings | Lawn is limited to the park; the town is houses and streets with pastel walls | Mapped park outline (`relation/16861626`) stays lawn; the rest of the land reads as drier town ground `#a9a688`; per-building pastel palette; the neighbourhood backdrop above | `testingGym.ts`, `buildings.ts`, `testingGym/neighbourhood.ts` |
| Retaining walls | Continuous rubble/concrete seawall with a level cap | Coping smoothed along each run (never below the retained ground); granite `#a59e8f`, cap `#cdc8ba` | `testingGym/shore.ts` |
| Near-shore water | Dark slate water with brown kelp canopy patches | Shallows `#5f8e8a`; eight seeded kelp canopy mats `#4a4a2c` just under the surface (positions artistic) | `testingGym.ts` |
| Breakwater and sand | Paved grey jetty top; slightly grey sand | Jetty paint `#a9a69c`; sand `#d6cbb2` | `testingGym.ts` |

These components are shared with Map Study's detailed Lovers Point, so it changes the same way.

### Not changed, and why

- **Snack Shack on the breakwater:** the photos show a white building with an aqua fascia, but no mapped footprint lies on or near the breakwater polygon. It is not invented.
- **Round street-side turret on the Beach House:** visible in the photos, but its exact corner is not confirmed.
- **Taller trees overall:** scaling placement heights by about 1.4× would move trees, because the canopy-clearance checks depend on height.
- **Darker open-water shader colour:** this conflicts with the approved October 23 ocean look pass (historical authoring evidence omitted from this public snapshot). It remains an open decision.
- **Pool fence density:** the real fence has dense black pickets. It stayed unchanged in this earlier comparison; the later detail pass below adds a simplified picket rhythm.

## Budget change

This section records the neighbourhood/dive-boat revision before ambient monarchs were added. Use [Gym geography](testing-gym-geography.md#rendering-and-lifecycle) and the current budget tests for the combined park allowance; the reef and atmosphere have separate costs.

The dive boat (2 draws), scuba locker (1 draw) and neighbourhood backdrop (1 draw) take the gym world from 31 draws / 52,941 Near triangles to **35 draws / 62,797 Near triangles**. The seabed and every recolour were absorbed into existing batches. At the user's request to add these assets, the world ceiling moved from 32 / 60,000 to **36 draws / 64,000 Near triangles**, recorded in `tests/testing-gym.test.ts`. The avatar, sky and output pass remain separate.


## Later October 23 landmark detail pass

A small follow-up compared the running scene with PDF pages **13** and **33** (printed pages 11 and 31) of the same city facilities survey and the user's supplied coastal reference shots. It keeps the source footprints, elevation, collider definitions and walking routes intact:

- **Beach House:** a continuous dark upper dining-room window band with slim white mullions/transom replaces separated windows on the seaward facades. Grey-green siding is lighter, and lower storefront openings have cream surrounds. The existing gables and yellow awnings remain. Pane spacing, elevations and colors are visual estimates rather than surveyed dimensions.
- **Pool:** three thin dark pickets fill each existing fence bay. Six-triangle open columns end inside the horizontal rails. This is a simplified rhythm of the photographed close-set metal fence, not its exact bar count or a new gate/interaction.
- **Retaining walls:** two understated, irregular granite color fields on the lower-ground side of tall wall pieces break up the uniform face. Variation uses a seed derived from 6256. The facing is offset 2 cm from the solid wall to avoid coplanar fighting; the terrain, original wall face and cap remain in place. Stone joints and dimensions are artistic.

All three changes enter the existing matte spatial batches and appear in both the Gym and Map Study. The park adds **1,022 Near triangles**, from **68,269 to 69,291**, and stays at **36 draws**, within its existing combined allowance of 69,472 triangles. No image textures, extra rendering passes or runtime geography requests are added. The new details currently survive Mid/Far reduction under the park's 2 cm geometric-error limit; they are not free at distance.

See the before/after detail review (historical authoring evidence omitted from this public snapshot) for fixed daytime comparisons, source records, limitations and verification. The uncertain snack-shack footprint, street-side turret corner, regional terrain and a current on-site planting/crown survey remain separate future work. Cached municipal tree locations are now available, with the limits described above.


## October 24 surface and pathway follow-up

The supplied cozy game screenshots guide material treatment only: soft grain, low-contrast triangular grass marks, warm sand, gentle foliage light and broad contact shade. They do not establish Lovers Point geography. These are original procedural marks; reference pixels are not copied into runtime assets.

The cached OSM routes retain their centerlines, but now use their `surface` tags and the `width=2` metres on `way/486665218`. Other widths remain authored. The city facilities PDF pages **19** and **44**, plus the user's earlier Lovers Point shore photos, informed the concrete access, turn and slender metal rails. The east photo-interpreted stair (`way/633871947`, still tagged footway in OSM) and south stair (`way/633871934`) use an estimated 2.1 m width; the east connection tapers to 1.5 m at the beach. A 15 cm riser rhythm and 0.92 m rail height are authored choices above the coarse DEM. No new survey, tread count or current construction status is claimed.

Geometry and tagged path paint are shared with Map Study. Additional procedural material detail is scoped to the Gym. The current review (historical authoring evidence omitted from this public snapshot) records screenshots, unchanged category ceilings, reduced stair geometry and the remaining coarse wall/beach transitions.


## October 26 recreation height and layout correction

The user's **`img_0386.jpg`** and **`Lovers-Point-Volleyball.jpg`** show the pool, court, inland wall and old bathhouse / Beach House relationship. They were compared with PDF pages **33**, **44** and **53** of the [City of Pacific Grove facilities assessment](https://files.cityofpacificgrove.org/Document_Center/Departments/Public%20Works/Buildings%20%26%20Grounds/Lovers%20Point%20Park.pdf?t=202510301223500), including the aerial layout and the Beach House's lower accessible entrances. These references establish relative arrangement and visible transitions, not surveyed dimensions or current construction status.

- **Footprints:** keep cached OSM `way/224525165` (Beach House), `way/350647473` (pool), `way/350647475` (court) and `way/224525166` (Grill). Their north-to-south ordering is retained; apparent misplacement was worsened by the terrain and building foundation heights.
- **Height evidence:** raw DEM interpolation gives approximately 8.61 m near the pool and 8.06 m near the court, and 12.34 / 11.44 m at the modeled bike-trail endpoints. The reconstruction retains the authored level 8.25 m lower terrace and 11.5 m bike trail. Neither flat plane is a surveyed site level.
- **Retaining relationship:** use a provisional 9.85 m court-side inland apron, 1.6 m above the lower terrace, with a further inland transition toward the bike trail. Remove the elevated rim along the seaward promenade and Grill approach. This supersedes the first October 26 3.25 m bank surrounding the entire facility area; that earlier result remains historical evidence only.
- **Beach House frontage:** use a provisional 8.31 m ground-floor datum aligned to the lower promenade, allowing the rear to meet the hillside. A maximum-under-footprint foundation incorrectly lifted the whole front to the uphill corner.
- **Court-side beach stair:** widen `way/633871934` from the earlier 2.1 m estimate to a provisional 4 m, retaining its mapped centerline and updating the visible and walkable footprint together. The separate east-beach stair `way/633871947` keeps its existing width treatment.

See [recreation-area ownership and verification](recreation-area.md). Exact wall and stair geometry, building datums and terrace heights remain photo-informed interpretation. The cached source JSON and reference images are preserved; no reference photograph becomes a runtime texture.
