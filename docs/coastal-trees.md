# Coastal trees and inventory placement

The October 24 pass replaces the fifteen guessed park trees with **52 records from the City of Pacific Grove public tree inventory**. Gym and Map Study use the same coordinates and library geometry. Objects exposes three native trees—Monterey cypress, Monterey pine, coast live oak—and four introduced/provisional inventory silhouettes. Pine and oak are library assets; neither is inserted into the park without a source record.

## Placement provenance

Source: [municipal Trees layer](https://gis-web.cityofpacificgrove.org/arcgis/rest/services/Open_Data/Trees/MapServer/0), retrieved October 24, 2026. The bounded query covers longitude −121.9185…−121.914 and latitude 36.6245…36.6275, requests WGS84 coordinates and returns 87 records without pagination truncation. `scripts/import-park-trees.py` selects the 52 points within the OSM park outer ring and retains municipal `OBJECTID`, original botanical name, original coordinates and the DBH source value. No addresses, work orders or staff records are retained.

The frame is the existing origin **121.91685° W, 36.6256° N**, metres, +X east and +Z south; projection uses Earth radius 6371008.8 m. Millimetre storage rounding is not an accuracy claim. The public service supplied no verified observation date, positional accuracy, crown width or height. Its certificate had expired; retrieval used one scoped certificate-verification exception for an unauthenticated public GET. No runtime fetch, credentials, insecure app setting or automatic refresh is introduced. A future refresh should obtain a trusted response and review additions/removals before replacing the cache.

| Source taxon | Records | Rendering |
| --- | ---: | --- |
| Cupressus macrocarpa (Hesperocyparis macrocarpa) | 43 | Monterey cypress |
| Metrosideros excelsus | 5 | Pōhutukawa, introduced |
| Phoenix canariensis | 2 | Canary Island date palm, introduced |
| Cordyline australis | 1 | Cabbage tree, introduced |
| Ilex spp. | 1 | Holly silhouette proxy; exact species unknown |

The old search could move a tree up to 24 m to satisfy guessed clearances. It is gone. Source records remain unchanged. Following the November photo review and the user’s confirmation that the bicycle lane has no trees, render placements for IDs 4869, 4870 and 4871 move to the adjacent compacted planting strip, approximately 5 m from the trail centreline. These three explicit overrides are authored estimates, shared by Gym, Map Study and collision proxies; they are not surveyed replacements for the GIS coordinates. All other placements remain fixed. `treePlacementIssues` reports remaining map disagreements instead of automatically moving trees. Before these three overrides, 21 records have a conservative path, crown, beach/facility or slope warning, including one crown near a building; no trunk lies inside a mapped building footprint. A real tree can overhang a path, grow at a retaining wall, or occupy a planting strip missing from OSM. These warnings need site confirmation, not invented “corrected” coordinates. The elevation grid still controls root Y.

Cypress heights outside the photo study use authored 2.8 / 5 / 7 / 9 m classes ordered by the source DBH values; the service does not state DBH units, so values are never converted to physical diameters or calculated heights. Other species use the representative heights below. Crowns, age/health, growth direction and exact current presence remain provisional. The cypress trunk collision radius is 3% of chosen height, matching its slimmer trunk; other species retain 6%. These are gameplay proxies, not measured diameters.

## Original procedural assets

`src/models/habitat/trees/createCoastalTree.ts` is the source of truth. Factories bake metres into geometry and keep the root unscaled. A supplied seed reproduces the tree; unseeded calls record a new seed for Objects → Regenerate. These are static plants, with no animation or physics competing with placement. One opaque toon batch uses vertex colours; no leaf textures, alpha cards, skeletons, wind updates, fruit, cones or individual needles. Near/Mid/Far retain branch/crown centres and reduce tessellation; palms reduce their frond count. Colours and sparse geometry are artistic.

| Asset | Chosen height | Near / Mid / Far triangles | Draws |
| --- | ---: | ---: | ---: |
| Monterey cypress | 8 m | 200 / 144 / 68 | 1 |
| Monterey pine | 9 m | 200 / 144 / 68 | 1 |
| Coast live oak | 6 m | 244 / 176 / 82 | 1 |
| Pōhutukawa | 5 m | 244 / 176 / 82 | 1 |
| Canary Island date palm | 8 m | 104 / 72 / 52 | 1 |
| Cabbage tree | 4 m | 104 / 72 / 52 | 1 |
| Holly proxy | 3 m | 200 / 144 / 68 | 1 |

All have a ceiling of 260 triangles / one draw. Species identity and native-range references: [UF/IFAS Monterey cypress](https://ask.ifas.ufl.edu/publication/ST224), [USDA Monterey pine](https://plants.usda.gov/DocumentLibrary/plantguide/pdf/pg_pira2.pdf), [USFS coast live oak](https://research.fs.usda.gov/feis/species-reviews/queagr). Those sources ground identity and general form; they do not measure the authored specimen. The ornamental proxies are grounded only in the municipal taxon labels, with simplified inferred silhouettes.

## Scene cost and ownership

All 52 park trees fit into five species batches in one 256 m cell centred on the park. Larger authored scenes can occupy additional cells. Rocks retain their separate 96 m cells. LOD uses the largest projected individual in a batch, avoiding cell-size-driven detail; nearby and distant trees in a shared batch still use one detail level. That is an explicit tradeoff for five draws at this population size.

The park draw ceiling increases from 36 to 38 to represent five inventoried species; its 69,472-triangle ceiling is unchanged. Map Study's park ceiling increases from 20 to 22 draws.

The park trees alone submit **10,332 / 7,432 / 3,558 triangles** across Near/Mid/Far. Five prototype geometry families occupy **192,456 bytes** of typed arrays across all levels, plus **3,952 bytes** for the 52 matrices and colours. These are CPU array sizes, not GPU memory measurements. There are no per-frame allocations or buffer uploads for trees. Resource disposal follows the shared geometry-family/controller ownership; unused prototypes are released.

Review and screenshots (historical authoring evidence omitted from this public snapshot) distinguish tree cost from whole-scene, avatar, waterfront, atmosphere and output costs. Physical mobile hardware remains untested.

## October 25 lawn-grove scale correction

The user-supplied panorama (historical authoring evidence omitted from this public snapshot) shows mature cypress towering over the Beach House and nearby lodging, with long exposed trunks and high spreading crowns. The former universal 9 m cypress cap made every mature tree too short relative to the buildings.

`testingGym/treeScaleStudy.ts` records **14 provisional height estimates, 12–22 m**, for the central lawn/Beach House grove and its immediate roadside backdrop. The largest isolated lawn-side record, municipal ID 4852, is 22 m; records 4859 and 4860 are 20 and 21 m. Smaller replacements and the wind-exposed perimeter retain the earlier classes. This is a site-specific correction; the Objects cypress remains an 8 m representative specimen.

All 52 municipal X/Z positions, source IDs and species remain unchanged. The plan (historical authoring evidence omitted from this public snapshot) relates the tree records to the mapped Beach House, Lovers Point Inn and Borg’s Motel footprints. The comparison camera is inferred east of the grove, looking west with the Beach House to the left and the large isolated tree to the right. The photo is wide-angle; apparent size alone is not a direct measurement, and correspondence of individual trunks is provisional. Building footprints and existing estimated building dimensions are not recalibrated by this pass.

The height uncertainty is approximately ±3 m as an authoring range, not a statistical confidence interval. The estimates are stored separately from the downloaded inventory; DBH is not converted into height. Rendered crowns and height increase together, while a slimmer cypress trunk avoids a two-metre-thick visual/collision obstacle. Crown bases remain high enough for the building-facing trunks to read clearly. The canopy contact field follows the same resolved tree dimensions.

No tree, branch layer, draw, texture or per-frame update is added. All LODs retain the same rooted heights and instance matrices. Geometry remains **200 / 144 / 68 triangles per cypress** and the park's five tree batches are preserved. Matched ground-level views, scale audit and verification (historical authoring evidence omitted from this public snapshot) document the result.
