# Lovers Point underwater terrain

The Testing Gym uses a compact, cached crop of [USGS Bathymetry, Offshore of Monterey, California](https://doi.org/10.5066/F70Z71C8) for its underwater terrain. The former uniform five-metre floor is removed. Otter Man and divers use the same Near-mesh triangle heights that are rendered; authored reef boulders remain a separate collision overlay. The geographic Map Study and the illustrative Area & buildings tank are separate views.

## Source and coordinates

- **Product:** USGS DS781 / OFR 2016–1110, published 2016; merged acoustic and lidar surveys collected 1998–2012. This is historical bathymetry, not a current survey.
- **Native grid:** 2 m pixels in NAD83 / UTM zone 10N (**EPSG:26910**), elevations in **metres NAVD88**. Negative numbers are below the datum; positive nearshore rock elevations are preserved. Grid spacing is not accuracy. Read the [original metadata](https://cmgds.marine.usgs.gov/data/csmp/OffshoreMonterey/metadata/Bathymetry_2m_OffshoreMonterey_metadata.html) for acquisition and uncertainty.
- **Downloaded:** October 25, 2026, from the [USGS GeoTIFF package](https://cmgds.marine.usgs.gov/data/csmp/OffshoreMonterey/data/Bathymetry_2m_OffshoreMonterey.zip). Original metadata, native-pixel crop and original TIFF checksum are retained in [the evidence directory](../artifacts/bathymetry/).
- **Coordinates:** the existing WGS84 origin is longitude −121.91685, latitude 36.6256. X is east, Z south; the local conversion uses Earth radius 6371008.8 m and cos(origin latitude). The extractor converts these geographic points to EPSG:26910 before sampling. No horizontal hand-alignment, vertical exaggeration or tide adjustment is applied.
- **Display water:** Y = 1 m remains the game's static NAVD88 reference. Depth below that displayed surface is `1 − elevation`; it is not measured tide or chart-datum depth.

The runtime JSON has 169 × 118 nodes spaced 10 m apart (19,942 total; 10,929 valid). It samples the nearest native pixel and rounds to millimetres for storage; that precision is not survey accuracy. Nulls preserve NoData, predominantly on land. Source provenance, independent native-cell control samples and a crop SHA-256 are embedded. The full source download is unnecessary at runtime.

## Survey, shoreline join and gaps

The rendered footprint is X −140..1500 m, Z −230..900 m: the bounded Otter Man water area along Lovers Point and the southeast waterfront. The land polygon clips the floor so it cannot rise through the park or town.

Beyond 20 m from the mapped coast, valid source triangles retain their surveyed elevation without clamping to the former depth limit. Within 20 m, an explicitly **authored shore join** reconciles the independently mapped OSM coastline with the land DEM and older bathymetry. It preserves a continuous low beach entry and submerges the cliff edge. The original park uses the land DEM at the coast; the waterfront join uses a shallow submerged edge. This narrow join is not surveyed beach morphology.

A missing triangle uses the nearest valid node within 30 m, labelled `gap-nearest`; larger holes use a labelled `gap-authored` slope (maximum 12 m below display water). Neither fallback is evidence of real terrain. `seafloorEvidence()` exposes these classifications for audits. The coverage audit (historical authoring evidence omitted from this public snapshot) weights them by rendered plan area: **93.78% survey, 6.12% shoreline join, 0.09% nearest-source gap fill**, with no larger-hole fallback used in this crop. Uncertainty at shore and in gaps must remain visible in documentation.

The 10 m runtime grid captures broad shelves and slopes. Small rocks, individual crevices, substrate composition and the authored reef boulders/kelp placements are not reconstructed from this bathymetry. The next accuracy improvement would be a finer local tile around a selected dive route, checked against the native crop and a newer survey where available.

## Rendering, movement and wildlife

`testingGym/bathymetry.ts` owns source sampling. `testingGym/seafloor.ts` builds the coast-clipped floor once, refining the shoreline join to 2.5 m triangles. Rendering and movement share those triangles through a per-cell barycentric lookup. There are no runtime downloads, raycasts or per-frame geometry rebuilds. The shoreline refinement adds geometry for joining surfaces; it does not add survey detail.

The floor is a separate owned root with a ceiling of **65,000 Near triangles / one draw**. The measured Near/Mid/Far counts are **51,553 / 25,775 / 22,719 triangles**, one draw at each level, and at most 2.18 MiB of reported geometry across the tested backends. It registers with the shared Near/Mid/Far controller, retaining an 8 cm simplification-error limit and locked borders; physics continues using Near geometry. It uses the shared matte toon material, weather and underwater caustics, without a new texture or postprocessing pass. Scene submissions, shadow passes and LOD storage are separate costs; see the browser measurements (historical authoring evidence omitted from this public snapshot).

All coastal kelp holdfasts now use this floor, with per-instance height scaled to the surface. The dive site's three fixed-size kelp prototypes retain their existing triangle ceiling as depths vary. The single 4 m great white follows an authored ellipse centred at X 180, Z −55 m, radii 28 × 60 m, speed 1.25 m/s. Its complete route stays offshore, clears the floor and remains within the park arrival's 210 m wildlife radius. **Menu → Coastal wildlife** frames it; overview now keeps swimmers visible too. This is a staged animal, not a reported shark sighting.

## Flight shadows

`sunShadows.ts` now fits three blended maps to the camera frustum during both walking and flight. It retains light-space texel snapping and resolution-aware normal bias from the earlier stripe fix, while replacing the 80/320 m player-centred square that produced a visible moving cutoff. Coverage reaches 3,600 m (clamped to camera far), with far fade beyond local clear-weather fog. Base uses three 1024² maps and Standard three 2048² maps; bias trades close contact precision for stability and distant shadows are coarser. See the current coverage review (historical authoring evidence omitted from this public snapshot) for actual shadow pixels and extra scene cost.

## Regeneration and verification

Install `rasterio` and `pyproj` in a separate authoring environment; they are not browser dependencies. Run from the checkout:

```sh
python scripts/extract-bathymetry.py artifacts/bathymetry/usgs-monterey-crop.tif --output /tmp/monterey-bathymetry.json
```

Compare the result to `src/data/monterey-bathymetry.json` before replacing it. The extractor accepts the original georeferenced TIFF too, but its input checksum will differ. Retain original source metadata and the acquisition dates when refreshing; do not relabel old measurements as newly surveyed data.

`tests/bathymetry.test.ts` checks source integrity/control elevations, NoData, mesh-versus-collision heights, LOD budgets, shark clearance/visibility, and kelp anchoring. `tests/sun-shadows.test.ts` checks camera-frustum coverage, stabilization, weather synchronization and map disposal. Existing swimming tests verify the accessible beach join and dry stair approach. `tests/bathymetry-browser.mjs` records flight and underwater inspections in Chrome with WebGPU Standard, WebGL 2 Standard and WebGL 2 Base; `ARTIFACT_DIR` selects an alternate output. Physical mobile hardware and other browsers are unverified. See the dated review (historical authoring evidence omitted from this public snapshot) for results and remaining limits.
