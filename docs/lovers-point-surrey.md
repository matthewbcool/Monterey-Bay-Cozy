# Lovers Point photo study and rideable surrey

November 6, 2026. The contributor's nine November 3 photographs are visual evidence, not a survey. Existing OSM horizontal alignments and building footprints remain the geographic source. The cached USGS grid remains unchanged; small authored grading masks correct its inability to resolve a concrete landing. Gym and Map Study compose the same access, building and apron factories.

## Photo observations and resulting changes

| Reference | Characteristics | Implementation and limits |
| --- | --- | --- |
| Beach panorama and close pier, photos 1 and 4 | Solid pale concrete upper promenade; dark railing; lower waterside platform; stairs against the wall; cream hut with red cap | Level outer deck, separate lower landing, 16 descending treads, shared collision/footing table, concrete apron, red hut parapet and cream shutters. The inland approach retains its mapped alignment and DEM rise. Exact shoreline, weathering and railing spacing remain simplified. |
| Promenade/court, photos 2 and 7 | Broad pedestrian paving beside a narrower marked asphalt bicycle lane; timber parking rails; volleyball court and kiosk below the path; mature cypress | Retain the existing mapped trail, court terrace, lane markings and parking rails. Three overlapping cypress render placements (4869–4871) move to the adjacent planting strip after user confirmation; original tree inventory coordinates remain unchanged. Correct the kiosk fascia/sign to turquoise. Do not infer new surveyed path widths from perspective. |
| Street-facing building, photo 3 | Three storeys, gray walls, white balcony bays, dark shallow roof | Replace the generic single-storey lodge interpretation with an 8.4 m wall estimate, repeated window surrounds and two upper balcony rows. Keep its mapped footprint; the photograph covers only part of the frontage. The swan display is recorded as reference context, not newly recreated here. |
| Interpretive sign and rocky shore, photos 5 and 6 | Tilted sign, green court fence, low stone coastal wall, lawn and rocky point | Preserve existing park composition. The sign text is not transcribed or invented; fine stone and foliage detail remains outside this pass. |
| Surrey front and side, photos 8 and 9 | Green tubular chassis, yellow canopy/black trim, four bicycle wheels, silver mudguards, paired steering wheels, rear black adult bench, cream front child seat and low pedals | New reusable procedural surrey; broad palette blocks replace woven strands, tire tread, rental lettering and small hardware. Canopy seam, mudguard orientation and tree clearance were corrected during screenshot review. |

## Physical section and scale

All values below are **authored estimates**, not measured real-world dimensions. One scene unit is one metre; model roots remain unscaled.

- Outer pier alignment: existing OSM `way/633871951`; final section is approximately 16.7 m long. Upper surface 4.65 m, lower surface 2.05 m in the scene's NAVD88-aligned frame; display water remains 1 m, not a live tide. Stairs span 5.2 m, with sixteen 0.1625 m drops. Lower platform width is 2.6 m.
- Surrey: approximately 2.26 m overall length, 1.545 m overall width, 2.18 m height; 0.66 m tires, 1.56 m wheelbase, 1.52 m canopy width. Front points +Z. Tire diameter/canopy width is 0.434, preserving the large bicycle wheels visible in the front reference. This ratio is a modeling choice; the source camera is not calibrated.
- Lodge: 8.4 m authored wall height for three storeys. The map footprint is preserved; window spacing and balcony projection are estimates.

## Riding

Open **Testing Gym → Menu → Ride a surrey**, then press **E**. W/S pedal forward/reverse, A/D steer, and releasing movement brakes. The equivalent touch direction buttons and gamepad left stick use the same input path; E or gamepad X dismounts. Keyboard behavior is browser-tested; physical controller/touch hardware is not claimed tested.

Forward speed is capped at 3 m/s and reverse at 1 m/s. Wheel rotation follows distance, steering pivots turn the front wheels, and pedals/rider legs share the crank phase. A conservative enclosing footprint stops at obstacles, water and abrupt height changes. It is a kinematic vehicle, not a suspension or rigid-body simulation. It can use other clear, gentle park paving/ground; it is not locked to a spline. Side exits require clear ground at a similar elevation. Changing character, destination or tab safely releases the vehicle. The root, speed, heading and crank phase are separate from LOD and available in the workbench snapshot for future networking/physics adapters; multiplayer and passenger seats are not implemented.

## Performance and verification

The model uses the shared toon materials and distance LOD, with one static frame batch, four wheel batches and one crank batch. No image textures or new per-frame geometry uploads. Both the Objects library and Gym register every batch with the shared LOD controller. The Map Study uses the same pier/building geometry but does not create a vehicle simulation.

Final costs and screenshot measurements are recorded in the [review](reviews/lovers-point-surrey.md). Model counts are per color pass, separate from full scene/shadow submissions.

```sh
node --import tsx --test tests/surrey.test.ts tests/lovers-point-photo.test.ts tests/testing-gym-elevation.test.ts tests/testing-gym-surface.test.ts tests/asset-inventory.test.ts
node tests/surrey-browser.mjs
node tests/lovers-point-surrey-capture.mjs
WEBGL=1 LABEL=webgl node tests/lovers-point-surrey-capture.mjs
```

The capture fixes a 1400×900 browser viewport, 49° camera FOV, clear weather, November 6 at 13:00 Pacific, Balanced water and explicit detail levels. It saves camera coordinates, actual canvas size, projected surrey bounds, LOD costs and renderer counters alongside screenshots. The reference photographs have different viewpoints and unknown camera calibration: these are repeatable form comparisons, **not a photogrammetric reconstruction or a pixel-error accuracy claim**.
