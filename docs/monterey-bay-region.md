# Monterey Bay regional map

**Map study → Overview** now frames the whole bay, from Santa Cruz and Capitola around Moss Landing to Marina, Seaside, Monterey and Pacific Grove. The coverage rectangle is **37.5 × 53.4 km**, longitude −122.12..−121.70, latitude 36.55..37.03. It includes adjacent land for context; it does not represent the full marine sanctuary or a legal/gameplay boundary.

**Explore the bay** focuses 12 sourced places. Click a place label for the same action. **Top view** looks down over the bay. **Local study**, **Aquarium**, **Lovers Point**, **Natural History Museum** and **Waterfront extension** retain the existing close inspections. Home returns to the bay overview; arrows orbit and +/− zoom. Touch uses the existing orbit/pan/pinch controls. Labels avoid each other and the overview is framed around the control panel on wide and narrow screens.

**Show regional seafloor** hides the surface and reveals coarse NOAA relief, including the deep canyon region. Coordinates and heights remain metres without vertical exaggeration. This is a regional reference view, not navigational bathymetry.

The **Testing Gym → Menu → Monterey Bay overview** now uses this same cached landscape, reprojected to the Gym's Lovers Point origin. **Bay place** focuses one of the 12 sourced locations without moving the avatar. The full-bay view hides local park, museum, wildlife and water details and uses the flat fill under their terrain cutouts; returning to the park restores them. That keeps the bay view to the regional LOD owner rather than drawing every detailed asset at an imperceptible size. The Otter Man flight controller samples this regional land/water and coarse seafloor outside the local study. Walking, boating, building collisions and fine bathymetry remain local; the regional coast is an exploration backdrop, not a fully authored playable town or a navigation chart.

## Sources and derived data

All new responses were retrieved **October 25, 2026**, with exact request URLs and UTC retrieval times retained in [source evidence](../artifacts/monterey-bay-region/sources/). Viewing the map loads a local cache; it sends no request to these providers.

| Layer | Evidence and interpretation |
| --- | --- |
| Land/ocean mask | [California Cartographic Coastal Polygons](https://services3.arcgis.com/uknczv4rpevve42E/ArcGIS/rest/services/California_Cartographic_Coastal_Polygons/FeatureServer), based on NOAA CUSP as of September 2024, modified by California Department of Technology. The request generalized coordinates by 0.00008 degrees and retained six decimals. Its offshore polygon was clipped to the study rectangle and inverted to obtain land; 1,320 land-ring vertices remain. |
| Regional land elevation | [USGS 3DEP bare-earth ImageServer](https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer), float raster exported at 256 × 320 pixels. The cache samples it onto a 161 × 201 grid, roughly 234 × 267 m spacing. This is a regional sampling interval, not the source's positional accuracy. |
| Seafloor | NOAA NGDC ETOPO1, [regional NOAA ERDDAP distribution](https://cwcgom.aoml.noaa.gov/erddap/griddap/etopo360.html). The retained 34 × 37 sample subset is spaced one arc-minute, roughly 1.5 × 1.85 km here. Bilinear interpolation colors a coarse clipped seafloor mesh. Values are metres of global relief; narrow channels and nearshore depths are unresolved. |
| Main highways | [USGS National Map transportation](https://carto.nationalmap.gov/arcgis/rest/services/transportation/MapServer/9), generalized 1M-scale roads. Fifty source paths include State Route 1 and other main regional connections. These are not a complete street/path network. |
| Place navigation | [USGS National Map geographic names](https://carto.nationalmap.gov/arcgis/rest/services/geonames/MapServer), populated, incorporated and census place points. Each of the 12 choices retains its GNIS/gazetteer ID and source feature class. These are reference points, not city boundaries or surveyed entrances. |
| Existing close studies | The retained OSM local snapshot, park/USGS detail, waterfront and museum continue to use their own documented sources and geometry. Their ODbL attribution remains visible. |

The cartographic coastline deliberately closes some estuaries and harbors and omits certain breakwaters. **Elkhorn Slough's channels and harbor interiors are not reconstructed** by this mask. A place label at Moss Landing does not claim a completed harbor or slough model. An attempted regional OSM download was unavailable; no new OSM regional coverage is claimed.

The raster importer rejects nonfinite/no-data/out-of-range elevations before interpolation. The retained source contains 3,339 rejected samples, predominantly offshore and near the source coverage edges. Valid neighboring samples are reweighted; 162 output samples with no valid neighbor use nonnegative ETOPO relief. Values are not relabeled as measured local bathymetry. Regional land is held above the reference water plane. Detailed park terrain retains its own elevation interpretation.

## Composition and performance

`mapStudy/bayRegion.ts` generates indexed, vertex-colored terrain in 12 km spatial tiles, one clipped ocean surface, coastline/highway line batches and an optional seafloor. `bayPlaces.ts` owns DOM labels/navigation. There is no new renderer, texture download, continuous animation or polling. All meshes register with the existing shared LOD owner; model coordinates and the public root stay at metre scale.

The regional projection uses the existing local equirectangular origin. Distortion grows away from that reference latitude, so these are approximate regional positions rather than survey coordinates. In Map Study, the original local OSM massing remains on its comparison plane; an **authored 600 m transition** joins surrounding regional elevation to it. In the Gym, the regional mesh uses its own metre origin and leaves the detailed park/waterfront terrain untouched. Coarse terrain is cut out beneath those crops. Disabling detail reveals a flat comparison fill instead of a terrain hole. Local source buildings remain 1,272 parts in Map Study; buildings are not invented across the rest of the bay.

Highways split at the same terrain grid planes as the land mesh, avoiding buried line segments on slopes. The coastline mesh omits the rectangle's artificial crop edges. Terrain, water and seafloor use the shared toon path on native WebGPU and WebGL 2. The new regional assembly has a ceiling of **85,000 triangles / 40 mesh draws / zero image textures** across its loaded roots; the older detailed studies, source building massing, guide lines and output passes are additional. See the review (historical authoring evidence omitted from this public snapshot) for measured Near/Mid/Far and submitted scene costs.

`src/data/monterey-bay-region.json` is **184,870 bytes raw / 55,625 bytes gzip** in the authoring measurement. Actual client transfer depends on bundling and server compression. Raster/vector source evidence is authoring material and is not needed by the running client.

## Rebuild and verify

The importer is offline and requires Python/Pillow plus the repository's existing Node/tsx/polygon-clipping dependencies:

```sh
python3 scripts/extract-monterey-bay.py \
  --evidence artifacts/monterey-bay-region/sources \
  --output /tmp/monterey-bay-region.json
```

Use `--node /absolute/path/to/node` if the required runtime is not on PATH. Inspect and compare the output before replacing the cache. To refresh, obtain new provider responses and their actual request metadata first; changing the cache date alone does not update the underlying evidence. No extraction command downloads data or replaces raw source files.

`bay-region.test.ts` checks coverage, named places, finite grids, clipping, dry-land ocean exclusion, metric reprojection, a true detail cutout, budgets, LOD and deduplicated disposal. `bay-region-browser.mjs` checks both backends, all major shortcuts, seafloor mode, preserved detail/comparison, keyboard, narrow layout, demand rendering and the absence of remote map requests. Existing integrated map checks cover the conditions and Aquarium owners. Physical phones and other browser engines require a separate check.

The next useful local studies are Santa Cruz/Capitola waterfronts and Moss Landing/Elkhorn Slough, using finer coast/channel and infrastructure evidence before adding playable objects or extending controllers.
