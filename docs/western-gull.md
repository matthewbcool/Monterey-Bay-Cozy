# Western gull assets and sky flocks

The Objects library includes **Western gull · male** and **Western gull · female**, both using the same procedural asset family. Select Flying, Standing, Walking in place or Pooping. Pooping plays once, returns to standing and offers **Replay motion**. Reduced-motion preferences start moving poses paused; explicitly pressing Play/Replay enables them. Group previews contain 32, 256 or 1,024 flying gulls. Near/Mid/Far and Auto work for individuals and groups. The Testing Gym also places these assets along the park and waterfront; the Tank is unchanged.

## References and artistic decisions

Western gull (*Larus occidentalis*) is a Monterey coastal species. The [Monterey Bay Aquarium](https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/western-gull) provides standing/flight photographs and local context. [Cornell's identification gallery](https://www.allaboutbirds.org/guide/Western_Gull/id) shows the heavy yellow bill, red lower-bill mark, white head/breast, slate mantle, black primary tips, white wing mirrors and pink webbed feet. Its combined-sex adult range is **56–66 cm body length / 120–144 cm wingspan**. The Aquarium gives a different rounded length range, **61–70 cm**; this asset uses Cornell's range explicitly rather than merging endpoints into a sex-specific claim.

[Audubon](https://www.audubon.org/field-guide/bird/western-gull) describes similar adult plumage with males slightly larger. The models share topology. At the user’s request, the female now uses a warmer cream body, lavender-gray mantle/wings and muted plum tips; the male retains neutral cream/slate. This is an artistic identification cue, not a claim about sex-specific natural plumage. Individual birds, all LODs and instanced flocks use the same palette source. The selected male measures **65 cm long / 1.37 m wingspan**, the female **59.8 cm / 1.2604 m**. This 8% difference is an authored pair, not a measured average, a sex-identification rule or separate biological ranges. Small seeded mantle variation is reproducible within each palette. No reference photo is claimed to identify its subject's sex.

The [CSUMB gull behavior surveys](https://sites.google.com/csumb.edu/biological-collection/educational-resources/virtual-field-surveys-lessons/gull-behavioral-surveys) document five-minute observations around Monterey/Pacific Grove, including Lovers Point. The page/locations were reviewed, but embedded video playback was unavailable. Consequently the 2.3 Hz flap, eight-second flap/glide cycle, 1.45 Hz walk, 0.38 m/s suggested host walking speed and 1.7-second poop action are **artistic animation choices**, not measurements from those videos.

## Shape, style and costs

A continuous ring-built body joins the stocky trunk, neck and head. Two hinges per wing provide flaps, delayed wingtips and glides. Folded wings foreshorten onto the mantle without modeling individual feathers. The simple legs alternate support and lifted phases; the host applies travel. Near includes bill/eyes/wing mirrors; Mid removes small marks; Far preserves the body, bent-wing silhouette, tail and minimal ground legs. Sky geometry removes legs and the droplet at construction. White markings are adjacent color regions, including a triangulated hole in the black primary, never overlapping coplanar paint.

All levels use opaque vertex colors and the shared matte toon ramp with rim disabled. No photo maps, PBR gloss, outlines, separate feather meshes or alpha crossfades. Geometry stays indexed and static during motion. Counts are per color pass, with shadows, background/output passes and other scene objects counted separately.

| Path | Near triangles | Mid triangles | Far triangles | Model draws |
| --- | ---: | ---: | ---: | ---: |
| Single, either sex, every pose | 380 | 170 | 32 | 1 |
| Sky flock, per gull | 324 | 130 | 24 | 1 for the whole flock |
| 1,024 flying gulls | 331,776 | 133,120 | 24,576 | 1 |

The single-asset ceiling is **400 triangles / one draw**. Its three geometry variants total **34,812 bytes**. A 1,024-capacity sky flock uses **31,396 bytes** of distinct geometry/index/flight-parameter arrays plus **65,536 bytes** of matrices: **96,932 bytes (94.7 KiB)**. This excludes material, driver, heap and renderer overhead. The current generic LOD panel sums each geometry's attributes and reports **55,972 bytes** for that flock because its shared 12,288-byte flight buffer is encountered at all three levels; it excludes the separate matrices. Do not call either number total GPU memory.

## Ownership and world integration

Source lives in `src/models/habitat/western-gull/`:

| File | Responsibility |
| --- | --- |
| `definition.ts` | Sourced dimensions, sex/pose types, pivots, budget and authored timing |
| `body.ts`, `geometry.ts` | Continuous body, readable named anatomy, vertex paint and authored LODs |
| `motion.ts` | Local skeletal poses and bounded droplet trajectory |
| `createWesternGull.ts` | Unscaled metre root, ten-bone single draw, state and physics metadata |
| `flockMaterial.ts` | TSL shoulder/wrist transforms, shared clock and individual phases |
| `createGullFlock.ts` | One-draw instancing, stable slots, transform commits and resource ownership |

```ts
const gull = createWesternGull({ sex: 'female', seed: 42, pose: 'standing' });
scene.add(gull);
applyNodeStyle(gull); // renderer-owned shared lighting
await lod.register(gull);
setGullPose(gull, 'walking');
updateWesternGull(gull, deltaSeconds); // pause by not advancing
// The world owns gull.position/quaternion and uses userData.physics.
disposeObject(gull); // active LOD family, material and skeleton
```

```ts
const flock = createGullFlock({ sex: 'male', seed: 42, count: 32, capacity: 256 });
scene.add(flock.root);
applyNodeStyle(flock.root);
await lod.register(flock.root);
flock.setTransformAt(slotId, worldCellLocalMatrix);
flock.commitTransforms(); // once after all changed slots, not per bird
flock.update(deltaSeconds); // unchanged placements: only the clock changes
flock.dispose();
```

Batch matrices accept finite positive uniform scale/rotation/translation. Slot identity, sex, phase and physical size survive count changes and LOD swaps. `setFlightAt()` controls independent phase/rate/glide offset; no per-instance skeleton or animation texture is allocated. Empty flocks submit nothing. Static placements upload neither matrices nor flight parameters every frame. Bounds are rebuilt only after explicit placement/count changes; transform writes are committed together, avoiding an all-birds scan per moved bird.

Use **compact spatial cells** for world skies. The shared controller chooses a batch's detail conservatively from its nearest member at about 8 Hz; a single enormous batch containing a close bird would retain unnecessary detail for distant birds. Native frustum culling uses conservative animated bounds. The three authored levels are inspection overrides and automatic distance choices, not networking, identity or simulation states. There is no separate subpixel/occlusion culler. The Gym controller below owns its authored coastal routes independently of the reusable asset factories.

The root, collider and perch/grip/bill/vent anchors use metres, +Y up and −Z forward. Animation changes only local bones. The single bird's coarse capsule omits wings/feet; it is a future integration descriptor, not collision, flight dynamics or contact IK. Walking is in place. Poop uses one eight-triangle reusable droplet in the existing draw, a brief ground flatten/fade and no accumulated decals; Far omits that tiny visual. Completion, interruption and disposal clean up the same state at every LOD. World-aware dropping/collision can replace the local trajectory later.

## Park and coastal population

`src/viewer/testingGym/gulls.ts` owns a separate wildlife root with **six ground gulls and eighteen flying gulls**. Four birds gather on open coastal lawns and two stand on the beaches. Two lawn birds alternate short, 1.14 m strolls with long rests and slow turns. Three compact, six-bird sky batches fly off the beach, headland and waterfront. Each flyer has its own seeded pace, starting position, direction, changing route shape and altitude; they no longer follow one equally spaced circuit. All bird roots remain at physical metre scale, including the seeded size differences within each flight batch.

Population, exact sites and motion are artistic choices, not live sightings or measured local flight behavior. The earlier October 26 offshore-only behavior pass reduced ambient flight from 6.8–7.4 m/s to about **2.8–4.3 m/s**, averaging **3.5 m/s** in a one-hour simulation. Independently paced circuits have broad turns, slowly changing shapes and heights, and no equal slot spacing or synchronized reversals. Immutable per-bird distance tables and analytic motion samples keep update work bounded; sleeping cells can seek directly to current time. The tables hold 37,008 bytes of numeric data across eighteen birds, apart from JS object overhead and render geometry.

Each cell derives its orientation from the cached shoreline. Routes now span a conservative **206 × 106 m envelope**, centered 5 m offshore, with seeded 65–90 m alongshore and 30–45 m cross-shore radii. Larger independent drift and harmonic variation carry the birds inland and out over water on longer, smoothly changing circuits. A construction-time terrain scan sets a fixed cruising height with 20 m allowance for route height variation and scenery; no terrain queries are added to the flight update. The earlier offshore-only audit (historical authoring evidence omitted from this public snapshot) records the superseded 72 × 18 m routes, not current coverage. A subsequent 21,600-position audit over one simulated hour measured circuits of 96–127 seconds, inland reach up to 44.75 m, and minimum terrain clearance of 18.91 m. Ground positions follow the same physical terrain/access heights as the park. The world owns placement and receives actual player position independently of the camera; existing physics descriptors remain available for future interaction.

A grounded gull takes off when the walking player's feet come within **3 m horizontally** and **1.8 m vertically**. Overview cameras, boating and flying actors do not trigger it. It opens its wings over 0.32 seconds, lifts and retreats away from the player along a reusable curved path, then looks for a dry, clear patch roughly 7–12 m away. Landing requires a clear footprint, gentle terrain, a clear approach corridor and at least 3.2 m of separation from the player. Occupied destinations cause another departure; unavailable landings cause a short airborne holding circle and bounded retries. It never teleports home beneath the player. After touchdown, wings fold over 0.38 seconds, the new perch becomes its home, and a walking bird only resumes strolling if the entire new lane is clear. The 3 m response and all escape timings are game tuning.

`gulls.ts` owns population, interest and player input; `gullFlight.ts` samples ambient offshore movement; `gullEscape.ts` owns triggered departure/landing states. `setGullPose(root, pose, transitionSeconds?)` optionally blends the existing local rig. No added mesh, material, shader, shadow pass or per-frame vertex update is needed.

The workbench applies its scoped shared toon lighting, registers every gull mesh with the shared LOD controller, updates motion and disposes the separate root. The park-only budget is unchanged. With every bird active, gulls add **nine color-pass draws and 8,112 / 3,360 / 624 triangles at Near / Mid / Far**; the flying population alone costs three draws and **432 Far triangles**. Before rendering, the LOD geometry census reports **266,844 bytes** across all families (including repeated shared flight attributes). Browser readback stayed at that value on WebGL 2 and reached **321,456 bytes** on WebGPU after all levels compiled. These are observed geometry-array counts, not total GPU memory. Ground gulls can cast sun shadows; sky batches do not. Frustum and interest culling reduce actual submissions further.

Ground groups enter within 90 m and leave beyond 140 m; sky cells enter within 500 m and leave beyond 550 m. Ordinary interest checks run at most four times per second; teleports and overview changes refresh immediately. Hidden birds do no pose, transform-upload or flight-clock work. A shared elapsed clock lets ambient routes catch up when they return, preserving identity, route and size through LOD changes. Reactive escapes retain their state while asleep. Reduced motion freezes displayed motion and proximity reactions until animation resumes. Park overview keeps the local population available; regional bay overview hides and stops it, and leaving the Gym stops the owner loop. Flight transforms are committed once per cell, with one bounds scan after its six writes.

## Verification

`tests/western-gull.test.ts` covers 60 seeds per sex, finite/index-safe geometry, scale, skin weights, all poses/levels, conservative bounds, ground contact, static buffers, physics ownership, continuous-time motion, one-shot cleanup and disposal. `tests/gull-flock.test.ts` checks 0–1,024 active slots, independently seeded motion, one draw, immutable parked buffers, bulk transform commits, identity/LOD continuity and lifetime. The browser review (historical authoring evidence omitted from this public snapshot) records native WebGPU and WebGL 2 rendering, CPU/GPU pose parity, camera-selected LOD, actual submissions, all Objects controls, reduced motion and a phone-width viewport. Desktop browser emulation is not physical-phone frame-time profiling.

`tests/gym-gulls.test.ts` checks terrain/collider clearance, slower individual routes, facing, player proximity and vertical separation, continuous escape/landing, occupied destinations, relocated strolls, sleep/reentry, LOD independence and ownership. `tests/western-gull.test.ts` also checks optional local pose blending. `tests/gym-gulls-browser.mjs` checks actual player-control approaches, both renderers, submitted budgets, motion, reduced motion, scene switching and mobile layout. See the current behavior review (historical authoring evidence omitted from this public snapshot) and the original park placement review (historical authoring evidence omitted from this public snapshot).
