# Map Study: detailed places and real-world conditions

The default **Overview** now covers [all of Monterey Bay](monterey-bay-region.md), with regional terrain, highways, place navigation and optional seafloor relief. **Local study** retains the earlier OSM area.

Open **Map study → Lovers Point**, or `?tab=map&park&conditions`. The detailed park occupies its geographic location inside the existing regional study. **Detailed Lovers Point** toggles between the stylized terrain/scenery and the original source massing. **Real-world conditions → Refresh live data** obtains the current NOAA tide and NWS forecast products; opening the map or panel alone sends no external data request.

## Scene ownership and geographic placement

`src/viewer/mapStudy/loversPoint.ts` composes the existing gym components: cached OSM coast/features/buildings, USGS elevation, shoreline/access surfaces, photo-informed landmarks, spatially batched buildings and instanced cypress/granite. It owns its render resources. It excludes gym equipment, controllers, player avatar and ocean mesh; there is no extra renderer or animation loop. Photographs remain visual references rather than runtime textures. [Gym geography](testing-gym-geography.md) records source URLs and artistic limits.

The park and regional map have different projection origins. The factory bakes the latitude cosine correction into geometry and instance matrices, then applies the regional translation. Public root scale stays one, one unit stays one metre, and world bounds/footprint match the regional coordinate frame. The model is still a local equirectangular study, not survey-grade positioning.

Twenty-five OSM building IDs are supplied by the detailed park. Map Study keeps their original meshes hidden for comparison. Its `clip.ts` splits crossing base-map road/coast segments at the detail crop, preserving uncovered ends. Fifteen additional regional building footprints touch the raised land. Their original source height is retained above an estimated level floor at the highest touching terrain sample; a separate inferred foundation supports it down to the regional reference plane. This avoids burying the original massing while making the transition explicit. Turning detail off restores original zero-level geometry and line spans.

Lovers Point and the southeast waterfront extension now have cached USGS terrain. The original local massing stays on its flat comparison plane, joined to coarse bay-wide elevation by an authored 600 m transition. Detailed crops have real holes in the coarse terrain; their boundaries remain bounded studies rather than survey joins. Courtyard holes remain respected. Regional height/filter/wireframe controls apply to original massing and the additional raised context; detailed park buildings retain their authored style. Tide values are MLLW and never assigned directly to terrain or water Y.

## Rendering and LOD

The park uses shared matte toon conversion, warm/cool lights, static geometry and bounded nature instances. Its procedural factory is capped at **20 draws / 50,000 Near triangles**, including the two [Lovers Point sculptures](lovers-point-statues.md). Regional massing, raised context/foundations, guide lines, aquarium interior and output are additional; the October 22 integration review (historical authoring evidence omitted from this public snapshot) records their actual submitted cost separately from park-only geometry. Core and integrated simplification counts can differ slightly with the selected projection origin and renderer attributes; use dated browser measurements for the actual viewport.

Every new mesh registers once with the existing LOD controller. Auto/Near/Mid/Far uses the same materials and preserves world placement and instance slots. Geometry/index storage counts typed arrays, not GPU memory. Hidden comparison geometry remains allocated; the visible-scene readout excludes hidden branches. Counters are refreshed after LOD selection and reset for each render.

Conditions cards and source pins are DOM elements: no new mesh, image texture, draw call or per-frame network work. The map draws on camera/control/data changes and suspends when inactive. No polling or animation loop is added. Source framing expands the camera range for genuinely offshore sites; entering the aquarium resets its depth range. Do not move offshore stations into the street rectangle for convenience.

At shutdown, dispose the LOD controller first, then the conditions layer, feed layer and aquarium owner, followed by the park owner and remaining base-map resources. The park owner deduplicates shared geometry/materials, releases instance buffers and removes its root before the remaining scene traversal. Late requests cannot update a disposed panel.

## Data ownership and validation

`src/data/worldConditions.ts` validates and normalizes one shared snapshot for NOAA observed tide, predicted high/low tide, NWS forecast and approximate local daylight. `src/viewer/mapStudy/worldConditionsLayer.ts` formats that snapshot and the ten-source research catalogue. Source states, UTC timestamps, Pacific display time, MLLW datum, quality flags, caches, manual refresh limits and cancellation belong to this data layer, not to meshes. See the [conditions guide](real-time-world.md) for provider references and exact behavior. Moon, alerts, buoy observations, currents, ecology and vessel traffic are not fabricated as live channels.

The map-specific suites cover geographic alignment, clipping, terrain-edge footprints, holes, geometry budgets, LOD/disposal, live-data parsing, caches, stale values, errors and cancellation. `tests/map-world-browser.mjs` uses explicitly frozen provider-shaped fixtures for deterministic WebGPU/WebGL 2 and phone-layout checks; it never substitutes those fixtures into normal app use. Separate live browser evidence (historical authoring evidence omitted from this public snapshot) records a real NOAA/NWS refresh. These are browser emulation and dated access checks, not physical-phone frame-rate or continuous provider-availability guarantees.

The October 23 sculpture review (historical authoring evidence omitted from this public snapshot) records the subsequent shared park snapshot with both artworks and concurrent scenery cleanup. Its world counts supersede the earlier park-only counts for that source revision.

## Southeast waterfront region

**Waterfront extension** frames the next region toward the Aquarium, shared with the Gym. The detail checkbox includes both completed areas and hides their overlapping base massing/lines. [The extension guide](waterfront-extension.md) records its October 24 source extract, separate budget, transition treatment and current limits.

The [Natural History Museum](pacific-grove-museum.md) replaces OSM way/1293958818 at Forest/Central. Its site and floor views reuse the Gym factory and remain a separate owned, styled and LOD-registered root. Turning detailed geography off restores the original regional museum footprint.
