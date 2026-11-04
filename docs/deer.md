# Black-tailed deer and fawns

The Objects collection contains a Columbian black-tailed doe and a spotted fawn. Each supports **Standing, Walking, Galloping and Grazing**, with Near/Mid/Far and Auto inspection. The fawn has its own shorter trunk and muzzle, larger relative ears/head, slender limbs and cream flank spots. It is not a scaled adult. See [photo, biological and placement evidence](deer-references.md).

## Source ownership

- `src/models/habitat/deer/definition.ts`: dimensions, species identity, bone names and budgets.
- `geometry.ts`: seeded vertex colors and silhouette geometry, merged into one matte skinned mesh.
- `motion.ts`: local joints, two-segment leg contact, stride cadence and grazing pose.
- `createDeer.ts`: public factory, LOD family, transition blending, physics metadata and disposal.
- `src/viewer/testingGym/deerBehavior.ts`: deterministic ground movement and herd avoidance; no renderer, DOM or Three.js dependency.
- `src/viewer/testingGym/deer.ts`: source-backed placement, terrain/collider adapter, model bindings and interest sleep.
- `src/data/deer-habitats.json`: cached OSM park/course and fairway outlines, authored home patches and explicit provenance.

```ts
const deer = createDeer({ variant: 'fawn', seed: 42, pose: 'eat' });
deer.root.position.set(x, groundY, z); // host owns world placement
// Register root with the shared LOD controller; viewer applies node style.
deer.update(dt, { pose: 'walk', speed: .65 }); // metres/second; rig only
// Or deterministically inspect a pose without advancing the host simulation:
deer.poseAt(1.2, { pose: 'gallop' });
deer.dispose();
```

Factories use metres, +Y up, −Z forward and scale-one roots. `setPose(pose, transitionSeconds)` blends local joints; `poseAt(time, options)` seeks an exact pose. The Objects controls use immediate pose selection, while the Gym blends state changes. A shared 18-bone skeleton is preserved at every detail level. No animation rewrites geometry or moves the world root. `getDeer`, `setDeerPose` and `updateDeer` adapt generic Objects roots to the same model instance.

## Gym encounters

Open **Menu → Deer** to find a doe and fawn at Caledonia Park, Pacific Grove Golf Links or Del Monte Golf Course. Caledonia places the player near the north lawn for a walking encounter. Golf entries are observation cameras over the existing coarse regional terrain; they do not add a walkable golf-course extension. A low-flying player can also approach the animals. Returning to the ordinary walk view restores the player camera.

All six animals reuse the library factories. The mapped home points are **authored populations**, not real-time sightings. Caledonia's small lawn patch uses detailed terrain; the two fairway patches use the existing approximately 234 × 267 m regional terrain samples. Their positions follow map data, but individual course slopes and infrastructure are not reproduced. No remote source is fetched by the wildlife runtime.

The adult alternates grazing, rest and short walks. The fawn follows and stays within 6.5 m; the adult slows if it falls behind. A player within 6 m of either animal alerts the family, which gallops away along safe ground. Escape lasts at least 2.5 seconds and settles after 3 calm seconds beyond 11 m. These are explicit game-feel values, not measured wildlife behavior or advice for approaching animals. Swept body clearance keeps family members from overlapping. A trapped animal stops and turns rather than crossing a fence, leaving its habitat or teleporting.

The controller uses fixed 30 Hz steps, clamps a stalled frame to 0.1 seconds and checks swept paths, collider clearance, water and slope. It owns stable member IDs, velocities, poses and serializable state fields separately from the rig. Future network authority/physics can drive those placements without depending on visual LOD. This is local kinematic avoidance, not implemented multiplayer or rigid-body physics.

Interest enters at 110 m and sleeps beyond 140 m. Sleeping families hide and perform no movement or bone updates, with no simulation catch-up on wake. Full-bay overview sleeps all deer. Reduced motion freezes ambient wandering and grazing; required player avoidance still moves and articulates the animals. The existing shared Gym frame loop owns all updates; there is no additional timer or renderer.

## Rendering and verification

| Variant | Near triangles | Mid triangles | Far triangles | Draws |
| --- | ---: | ---: | ---: | ---: |
| Adult doe | 616 | 358 | 174 | 1 |
| Spotted fawn | 680 | 390 | 174 | 1 |
| Three complete families, before culling | 3,888 | 2,244 | 1,044 | 6 |

Each specimen stays below the 1,200 / 600 / 180 triangle ceilings. Six independently animated animals use six draws rather than a new instancing system; distant cells incur no animation work. Shared matte toon materials, painted vertex colors and the common ramp add **zero image maps**. The Far variant retains the body, head, ears, legs and tail; small eyes, nose and fawn spots are omitted. Conservative animation bounds prevent moving limbs from being clipped by culling.

The host samples a local ground plane and tilts the visual skin to support its hooves while preserving the root heading and physical placement. The body capsule and attachment anchors remain separate from rendered geometry and do not change with LOD. Population clearance uses a conservative horizontal radius, independently of the future torso capsule. Dispose the shared LOD controller before disposing an owning scene; individual factory disposal also releases its skeleton and attached LOD geometry exactly once.

Run `deer.test.ts`, `deer-behavior.test.ts` and `gym-deer.test.ts` for model/scale/seed/rig, behavior and actual terrain/collider contracts. `node tests/deer-auto-lod-browser.mjs` checks actual automatic Near → Mid → Far transitions at 3 / 50 / 180 m on both backends. `node tests/deer-browser.mjs` checks production materials on native WebGPU and WebGL 2, every pose/detail, Objects controls, actual keyboard approach, golf views and reduced-motion phone layout. Recorded review (historical authoring evidence omitted from this public snapshot) distinguishes per-model counts from whole-scene/shadow submissions and retains screenshots. No multiplayer throughput or device FPS claim is inferred from triangle counts.
