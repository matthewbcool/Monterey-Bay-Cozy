# Museum entrance and Jewell Park

**Testing Gym → Menu → Visit Natural History Museum** reaches the courtyard. Walk down the front stairs toward Central Avenue and Jewell Park. **Museum exterior study** frames the repaired entrance. Map Study uses the same museum and waterfront geometry.

## Museum and depth fixes

- Six front steps have closed risers/foundations, a lower landing and a supported street approach. Visual tread heights agree with the controller's surface sampler. The approach slope and floor datum are authored accommodations to coarse terrain, not measured accessibility data.
- Interior displays, specimen cabinets and activity furniture are removed. Their collision obstacles are removed too. Rooms, openings, mezzanine, exterior architecture, native garden and Sandy remain. Former exhibit authoring code is retained without being rendered.
- Shop/services floor overlap is partitioned so there is one visible floor. The top internal stair tread now meets the mezzanine datum. Floor selection remains explicit; automatic traversal between interior storeys is not implemented.
- Museum-adjacent terrain no longer pulls up arbitrary grid vertices to room-floor height. This removes the folded ground triangles around the stairs and sidewalks.
- Roads, paths and lawn inside the grid-aligned museum/Jewell district share one partitioned terrain surface. Local convex clipping avoids nearly coincident map-join failures and stacked paving. Redundant park-colored terrain overlays are removed. Outside this district, the existing sparse route ribbons remain; this pass does not claim to eliminate every depth artifact in the entire regional map.
- Architecture and waterfront use conservative LOD error limits. A lower level may retain the same triangle count when additional simplification would damage small stairs or floor boundaries.

## Ocean extent

`testingGym/oceanGeometry.ts` cuts the Gym's ocean surface along the existing Lovers Point and waterfront coastline. No ocean triangles lie beneath the museum or Jewell Park. Offshore and horizon coverage remain; coast endpoints are extrapolated outside the studied area and do not constitute additional geographic research.

The uncut plane was 800 triangles. The clipped surface is **421 triangles**, one water draw, with a 1 mm error limit and locked border at lower LODs to preserve the coastline. Shared wave shading, wake coordinates, underwater appearance and existing swimming bounds are unchanged. Geometry is supplied through the water factory's optional owned-geometry argument and released with that factory.

## Jewell Park sources and interpretation

The [museum's visitor guide](https://www.pgmuseum.org/plan-your-visit) identifies Jewell Park directly across the front entrance. The city's [Park Registry, page 27](https://files.cityofpacificgrove.org/Document_Center/Departments/Public%20Works/Buildings%20%26%20Grounds/Parks%20Maintenance/Parks%20Inventory.pdf) supplies facility types and historic counts. It is not a current condition survey.

The retained October 24 OSM XML supplies park `way/36809611` (spelled “Jewel Park” in that snapshot), gazebo `node/8156311269`, bench `node/11994737399`, tree `node/11994737400`, and Little House/toilet building `way/558769043`. The new house replaces the old generic building rather than overlapping it. © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL 1.0.

Added scene details include an eight-sided gazebo, Little House and patio, seven benches, eight trees, two litter/recycling pairs, a park lamp, stone/wood boundary sections and concrete access paths. Gazebo, tree and one bench locations retain mapped pins; other positions, planting forms, proportions, roof shapes and paths are artistic. Building dimensions and all furniture sizes remain provisional. No photograph textures or new network calls are used.

The gazebo's deck has a matching walking surface. Posts, trees, benches, bins and the house have simple collision. The house is an exterior study with a solid collider, and boundary fences are visual. This is a reusable static scene assembly in `mapStudy/jewellPark.ts`, using seed `241025`; it is included in the existing waterfront batches and budget rather than creating an extra renderer.

## Performance and verification

The waterfront retains its **100,000 Near triangles / 90 draw** ceiling, including Jewell Park and the district surface changes. The museum retains its separate **26,000 / 8** ceiling. The new park requires no additional spatial render batches. Current Near/Mid/Far counts and storage appear in the repair review (historical authoring evidence omitted from this public snapshot).

`museum-district.test.ts` checks stair/approach raycasts, removed exhibit collisions, inland ocean exclusion, LOD coastline preservation, single-surface ground, park records and budgets. `museum-district-browser.mjs` checks the actual visit control, entrance walking, renderer identity and screenshots on both backends. These checks do not establish physical-phone performance, real-world navigability or code compliance.
