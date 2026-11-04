# Pacific Grove waterfront extension

The next Map Study region extends southeast from Lovers Point toward Hopkins Marine Station and the Monterey Bay Aquarium. It shares one procedural factory between **Map Study → Waterfront extension** and **Testing Gym → Menu → Waterfront overview**. Wear the [Otter Man suit](otter-man.md) to fly across it; accessible land also uses the avatar walking controller.

## Coverage and source evidence

The bounded crop is X -145..1500 m, Z 130..900 m relative to the existing Lovers Point origin (-121.91685, 36.6256). This is a 1,645 × 770 m study rectangle, with ocean removed using the mapped coastline. It includes the coastal corridor and surrounding Pacific Grove streets, not all of Monterey Bay. The cropped inland and southern edges are deliberate limits.

- **OpenStreetMap vectors:** public [map API response](https://api.openstreetmap.org/api/0.6/map?bbox=-121.9186,36.6173,-121.8995,36.6247), retrieved October 24, 2026. The extracted data retains 302 coastal vertices, 3,073 clipped route segments with highway/surface/width tags, and five beach/park polygons. Coast segments are stitched by shared endpoints; incomplete source geometry is rejected.
- **Building footprints:** 1,162 candidate building parts from the already retained October 13 regional snapshot. Rings, holes, feature IDs and original tags are retained. Buildings whose centres fall outside mapped land are omitted from this detail layer. Tagged heights take precedence, then floors × 3 m; untagged buildings use an explicitly authored 6 m height. Roofs are simplified flat caps. Lower walls extend into the sloping terrain so buildings have support.
- **USGS 3DEP:** a fresh [bare-earth elevation service](https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer) float raster retrieved October 24. Returned raster/extent metadata are retained, including the service's aspect-ratio adjustment. The runtime grid is 190 × 95 samples, approximately 8.97 × 11.18 m apart. Sampling interval is not positional accuracy, and offshore DEM values are not bathymetry.
- **License:** © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Attribution remains in both views. Source XML, raster and request metadata are retained under [waterfront evidence](../artifacts/pacific-grove-waterfront/).

`src/data/pacific-grove-waterfront.json` is 767,179 bytes raw and approximately 159,222 bytes gzip in the authoring measurement. Bundler output and server compression determine actual transfer size. The runtime loads cached data with the scene; it makes no OSM or USGS request. Python, the source XML and TIFF are authoring evidence only.

## Geometry, interpretation and limits

`mapStudy/waterfront.ts` owns the shared factory. The coast clips a triangulated DEM surface; roads and paths in the coastal trail corridor and museum district are partitioned into that same terrain surface, with bevel joins closing gaps at bends. Distant residential routes retain sparse draped ribbons. Buildings preserve footprint rings and holes. Surface widths use a numeric OSM width where available, otherwise 2.2 m for walking/cycling routes, 3.5 m for service roads and 6 m for other roads. These widths and simplified surfaces are illustrative, not a street survey.

A 20 m authored blend joins the older park terrain at Z 130. The coastal join uses the existing park edge at [72,130]; the true new source point is retained as `mappedNorthSeam`. Terrain is held at least 1.08 m above the reference plane to avoid coarse coastal samples flooding the land at the authored 1 m water level. Vegetation uses seed 241026; plant positions and rock scale are artistic. No new photograph textures, building interiors, surveyed vegetation, exact facades or tide-driven shoreline are claimed.

Map Study bakes its latitude correction into geometry/instance transforms and translates the root; public root scale remains one. It hides overlapping original building parts and clips base road/coast lines through the detail crops. The detail checkbox restores the original regional comparison. Outside the completed crops, the regional map remains its earlier flat study.

In the Gym the extension has a separate owned root, static batches and collision data. It replaces the earlier 450 m neighbourhood backdrop. Walking uses the same terrain sampler and polygon building footprints. The existing swimming/boat/reef exercise stays in its original bounded water area; Otter Man can fly over and dive into the extended coastal water, using an authored shallow seabed. Expanded ordinary swimming and multiplayer are future work.

## Budgets and maintenance

The extension ceiling is 100,000 Near triangles / 90 draws, separate from the original park, avatar, water and reef. Spatial batches use 256 m cells and shared distance LOD; the extension now allows up to 0.02 m simplification error, while the close park keeps its tighter limits. Nature is instanced. Source matrices, physics and placement remain unchanged across levels. Shared static park buildings and scenery now use the same compatible per-cell batch, restoring the existing park ceilings without changing appearance.

Rebuild the data offline with the retained evidence:

```sh
python3 scripts/extract-waterfront.py --evidence artifacts/pacific-grove-waterfront --map src/data/monterey-map.json --output /tmp/pacific-grove-waterfront.json
```

The extractor requires Pillow. Compare a regenerated result before replacing the checked-in dataset; changing retrieval dates does not refresh its inputs. See the integration review (historical authoring evidence omitted from this public snapshot) for measured counts, screenshots, browser coverage and current limitations.

The [Pacific Grove Museum study](pacific-grove-museum.md) is the first detailed building/interior replacement inside this extension. Its separate root replaces way/1293958818 and the solid building collider; the local floor/entrance grading and planting exclusion are authored exceptions to generic regional massing. The no-interiors description above applies to the remaining generic buildings.

The [coastal trail detail pass](coastal-life.md) adds source-backed and authored facilities, planting and sectional fencing to both views, and splits the main trail surface at DEM cell boundaries. The separate Gym habitat adds kelp along this coast. Historical counts in the initial review precede this pass.

The [museum/Jewell Park district](museum-district.md) uses disjoint ground paint instead of paving overlays. The adjacent DEM keeps its original surface height; museum floors and the entry approach own their separate supported geometry. Other regional route ribbons remain sparse overlays.

## Aquarium and Cannery Row exterior detail — November 2, 2026

Both outdoor viewers now share industrial window bays, mullions and sills on the mapped aquarium and tagged Cannery Row buildings. The aquarium has low monitor roofs and two cannery-inspired stacks, fitted inside its mapped outline without filling courtyard holes. The existing footprint, terrain and walking collision remain authoritative; flight clearance includes the roof additions. Details merge into existing spatial batches and use shared toon materials/LOD, without textures or per-frame updates.

Primary references: [aquarium history](https://www.montereybayaquarium.org/about-us/about-the-aquarium/our-history), [original architect EHDD](https://ehdd.com/project/monterey-bay-aquarium/), and the [official visitor map](https://www.montereybayaquarium.org/globalassets/mba/pdf/maps/aquarium-visitor-map.pdf). These support the cannery heritage and public waterfront context; the new facade rhythm, colors, monitor roofs and stack positions are architectural interpretations, not surveyed reproductions. The existing interior inspector remains separate. Deck reconstruction, street furniture and detailed adjoining facades still need a more complete site/photo study.

Validation: the waterfront geometry/projection/LOD budget test passes against the unchanged 100,000-triangle / 90-draw ceiling. Full build, documentation validation and integrated browser review are blocked by unrelated unfinished sea-otter imports and missing documentation in the shared checkout. This exterior pass is locally implemented but not visually approved or pushed.
