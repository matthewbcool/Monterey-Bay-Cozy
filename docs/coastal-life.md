# Coastal wildlife, kelp and trail details

Open **Testing Gym → Menu → Coastal wildlife** for the new offshore lookout. Use the existing scuba equipment for underwater viewing, or Otter Man to explore the coastal extension. The lookout changes only the camera. **Walk view** returns to the avatar.

## Habitat

The additional coastal assembly contains **120 giant-kelp plants in 12 beds**: four beds around Lovers Point and eight following the waterfront toward Hopkins Marine Station and the Aquarium. Together with the existing dive site's 24 plants, the Gym now has **144 kelp plants**. Seed `241027` reproduces the layout; two shared plant prototypes include small holdfast rocks. Canopies reach the surface and sway in the shared shader system.

There are **54 additional animals** using existing library models: one 4 m great white shark, two schools of 24 Pacific sardines, three blue rockfish and two kelp greenling. The shark follows a closed offshore patrol at 1.25 m/s, centred at X 180, Z −55 m with 28 × 60 m radii; the complete route remains within the arrival point’s wildlife visibility radius. It does not chase or damage players. Routes remain on the water side of the mapped coast, with body clearance checked over sampled curves. Movement owns root placement; model animation owns the swimming pose.

These populations, exact positions, depths and patrols are authored scenery, not current sightings, ecological estimates or safe-swimming guidance. NOAA describes [kelp forests on shallow rocky substrate](https://montereybay.noaa.gov/science/characterization/kelp-forests.html); the Aquarium describes [white sharks as highly migratory](https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/white-shark). The existing asset register records species anatomy and representative sizes.

All plants use the shared [USGS-backed seabed](bathymetry.md), with documented shoreline joins and NoData fallbacks. Per-instance heights keep canopies at the display surface. Swimming and boat navigation retain their current bounded exercise area. Otter Man can view the extended coast. Plants are scenery, without harvest, collision or ecology simulation.

## Coastal Trail

The shared waterfront factory now adds 13 benches, three litter bins, two bicycle-stand groups, three blank interpretation panels, 270 low planting clumps and 17 sectional fence spans. The main mapped Coastal Trail ribbons are split at DEM triangle boundaries so the Near surface follows the terrain. Static details are folded into the existing spatial material batches, and furniture has simple collision.

`src/data/waterfront-amenities.json` retains 27 candidate OSM nodes from the October 24 cached extract, including original IDs, coordinates and tags. Five nodes pass the trail-distance, land and building-clearance filters; these keep their mapped positions. Additional rest stops and planting are explicitly marked `authored` in the returned scene records. Orientations and dimensions are illustrative. Panels have no invented historical text. New benches are scenery with collision, without the original park bench's sit interaction. Fences are visual boundaries.

The city's [Parks Inventory](https://files.cityofpacificgrove.org/Document_Center/Departments/Public%20Works/Buildings%20%26%20Grounds/Parks%20Maintenance/Parks%20Inventory.pdf) documents benches and access details at Andy Jacobsen Park (page 1), and sectional trail fencing, bins, paths, ornamental planting and interpretation at Berwick Park (page 5). It supports facility types, not the exact new placements or a claim of a complete current survey. Bicycle stands are authored rest-stop equipment. Both Map Study and Testing Gym use this trail detail layer; the new animated coastal habitat is Gym-only.

© [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL 1.0. Regenerate candidate nodes offline from the retained XML:

```sh
python3 scripts/extract-waterfront-amenities.py --source artifacts/pacific-grove-waterfront/waterfront.osm --output /tmp/waterfront-amenities.json
```

## Performance and maintenance

The coastal assembly ceiling is **140,000 Near triangles / 32 draws**. The complete assembly measures **134,140 / 66,424 / 26,720 triangles** at Near/Mid/Far, **26 draws** at each level, and about **3.06 MiB** of unique geometry across LODs. These are asset counts before interest/frustum culling, separate from park, reef, waterfront, avatar, water, sky and renderer overhead. No new image textures or online wildlife requests are needed.

Kelp uses one instanced draw per bed. Schools share one draw each. Beds and swimmers outside 210 m of the viewing position sleep/hide; overview keeps beds and swimmers visible. Distant individual animation stops. Reduced motion freezes decorative travel and kelp surge. The frame loop reuses vectors and does not upload plant transforms each frame. Actual multiplayer population capacity and phone performance remain unmeasured.

The [Gym rendering audit](gym-rendering-performance.md) separates these population budgets from shadow overhead and documents the existing batching strategy for larger populations.

The complete waterfront retains its **100,000 triangles / 90 draws** ceiling, including the new static trail details. See the review and screenshots (historical authoring evidence omitted from this public snapshot) for current measured region counts and browser coverage. `tests/coastal-life.test.ts` checks budgets, source provenance, reproducibility, water clearance, interest management and disposal; `tests/coastal-life-browser.mjs` checks visible scene attachment, movement and all three LODs on WebGPU and WebGL 2.
