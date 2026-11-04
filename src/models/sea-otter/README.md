# Sea otter Tank adapter

`createSeaOtterModel.ts` adapts the [habitat sea otter](../habitat/sea-otter/README.md) to the collection's `FishModel` lifecycle. Tank, Demo and Objects share the same procedural body, twelve-joint skeleton, toon material, authored Near/Mid/Far variants and sourced adult size range. There is no separate aquarium mesh or downloaded model.

## Coordinates and ownership

The habitat asset faces −Z; the adapter rotates its visual group +π/2 about Y so the collection model faces −X. The public root and visual remain unscaled in metres. Collider centers and mouth/grip anchors receive the same coordinate conversion. Root Y=0 is the floating waterline in model space. Animation changes the visual rig only; a route, external host or future physics engine owns the rigid root.

`createSeaOtterModel({ seed?, lengthMeters?, pose? })` returns the ordinary `FishModel` methods plus `setOtterPose(pose, transitionSeconds?)` and `getOtterPose()`. Poses remain `float`, `groom`, `dive` and `swim`. `setSwimMode()` controls local stroke cadence; it does not select the route activity. `getSeaOtterModel(root)` retrieves the adapter without storing callbacks in serializable metadata.

Caught state freezes the existing pose and enables two X eyes attached to the existing head joint. It preserves root placement and physics ownership. Restoring life resumes local animation; acquiring a route remains an explicit host choice when the model is externally owned. Disposal releases the shared habitat resources, eye geometry families and skeleton once.

## Geometry cost and LOD

Alive rendering has one body draw and the habitat model's triangle counts. Caught rendering adds one draw and **8 triangles at every LOD**. The marks use 16 vertices, 432 bytes per level and 1,296 bytes across their three owned geometry variants. Each variant projects onto that level's actual skull triangles, avoiding floating marks after silhouette reduction. These figures describe typed geometry storage, not total GPU memory. Current body costs and reference provenance live in the habitat guide.

The adapter's root budget permits two draws; the reusable habitat asset remains a one-draw model. The existing shared LOD controller registers both body and initially hidden eye marks. No per-frame vertex edits, geometry creation, material changes or CPU skin scans are required.

## Surface route

[`seaOtterRoute.ts`](../../viewer/seaOtterRoute.ts) supplies one placement controller for selected Tank and Demo. `createSwimmer()` and `createDemoRoute()` dispatch using `root.userData.locomotion === 'surface-otter'`. The route receives tank dimensions explicitly, avoiding a module-initialization dependency on the generic swimmer.

The authored natural cycle lasts 100 seconds:

| Time | Behavior |
| --- | --- |
| 0–45 s | Quiet surface floating |
| 45–70 s | Surface grooming |
| 70–76 s | Dive into forward underwater posture |
| 76–92 s | Underwater swimming |
| 92–100 s | Rise and restore back-floating posture before reaching the surface |

The 70% surface share, travel speeds and 2.4 m maximum cycle depth are exhibit choreography, not measured wild behavior. Surface rest places the root exactly on the real tank water plane; exposed head and feet may extend above it. The complete animated envelope still clears the side walls, front/back walls and floor. The route exposes `surfaceAware` and `surfaceEnvelope` so validation does not mistake the water plane for a solid ceiling. `cruiseRootDepth` describes the authored cycle; `maximumRootDepth` also allows safe deeper external placements during an explicit resume and blended ascent.

`setActivity('cycle' | 'surface' | 'swim')` selects natural behavior or an explicit mode. Mode changes blend root depth over four seconds; the habitat rig blends its local head, limb and diving posture. `getPhase()` returns `{ stage, time, cycleTime, depth }` for diagnostics. `update(dt)` bounds a long step to 0.1 seconds and ignores invalid or paused time. It never advances route time, changes pose or places the root while caught, disposed or owned by external/physics code. Construction acquires eligible living models; `resume()` explicitly reacquires an externally owned living model, using its nearest horizontal lane and current depth. Physics ownership is never stolen.

## Verification

`tests/sea-otter-tank.test.ts` checks reuse and axis conversion, collider/anchor parity, caught marks against each actual skull, frozen buffers, resource disposal, the complete 100-second cycle at maximum size and every LOD, exposed/submerged skin, wall/floor clearance, smooth control changes, bounded time, frame partition agreement and placement ownership. `tests/sea-otter.test.ts` owns the underlying anatomy and local-motion checks. Collection, LOD and Demo tests apply their existing integration contracts to this adapter.
