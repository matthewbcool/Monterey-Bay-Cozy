# Black-tailed deer

`createDeer.ts` composes the definition, geometry and local motion modules. The adult is a doe without antlers; the spotted fawn has its own shorter torso and muzzle, proportionately longer legs and larger ears. The [Presidio of Monterey](https://www.army.mil/article-amp/263548/presidio_of_monterey_assessing_deer_population_on_post) identifies the local population as Columbian black-tailed deer. Specimen sizes and gait timings are authored representative choices, not an age/sex growth chart.

| Variant | Nose–tail length | Ear-tip height | Near | Mid | Far | Color draws |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Adult doe | 1.58 m | 1.66 m | 616 | 358 | 174 | 1 |
| Spotted fawn | 0.96 m | 1.16 m | 680 | 390 | 174 | 1 |

These are upright bind-pose dimensions; ear motion adds a few millimetres. Both use one opaque vertex-colored shared-toon `SkinnedMesh`, eighteen bones and no image textures. Near/Mid preserve the fawn's cream spots by partitioning the body surface, without overlaid decals. Far retains the torso, neck, muzzle, ears, black tail, four articulated legs and hooves; tiny eyes, nose paint and spots disappear. All geometry levels use the same rig and conservative motion envelope. Register the root with the shared LOD controller; the model never selects its own level.

```ts
const deer = createDeer({ variant: 'adult', seed: 42 });
scene.add(deer.root);
await lod.register(deer.root);
deer.update(dt, { pose: 'walk', speed: 0.8 });
// Host code separately moves/rotates the root using terrain, route and physics.
deer.setPose('eat', 0.7);
deer.update(dt);
deer.dispose();
```

The root remains unscaled, +Y up, −Z forward, with its feet at Y=0. `physics` contains a coarse torso capsule and metre-scale feet/chest/head/mouth anchors. They remain unchanged across pose and LOD; ground adaptation and authoritative travel belong to the host. Animation changes bones only. The two-segment leg solve keeps support hooves on the local ground, with counter-rotating hoof bones and modest body motion. Eating lowers the articulated neck/head to the grass. Tail roots and shoulder/haunch masses overlap the actual body surface.

`update(dt, {pose?, speed?, gaitBlend?, reducedMotion?})` integrates one clock and a continuous stride phase. Speed is metres/second; optional `gaitBlend` interpolates walk (0) to gallop (1). `setPose(pose, blendSeconds=.3)` snapshots the current local rig into preallocated storage and blends to the new action without moving the root or resetting stride. Reduced motion freezes clocks and local animation. `poseAt(time, {pose?, speed?, gaitBlend?, stridePhase?})` seeks deterministically without a transition; pass authoritative `stridePhase` in cycles when restoring a variable-speed simulation.

The Objects integration can obtain the same controller through `getDeer(root)`, `setDeerPose(root, pose)` and `updateDeer(root, dt)`. No timers, geometry rewrites or scene references live in the model. The geometry-disposal event releases the skeleton and root lookup; either `deer.dispose()` or the standard `disposeObject(root)` releases the registered LOD family. Explicit model disposal is idempotent.

`tests/deer.test.ts` covers seeded skins and budgets, fawn pigment/proportions, every pose at every LOD, actual skinned hoof/floor and feeding distances, conservative bounds, unchanged buffers/root/physics, actual torso/tail/hip intersections, pose blending, deterministic seeking, reduced motion and complete disposal.
