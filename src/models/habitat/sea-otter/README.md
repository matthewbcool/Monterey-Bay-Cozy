# Southern sea otter

`createSeaOtter.ts` composes the definition, continuous weighted geometry and local motion modules. This is a stylized **southern sea otter, Enhydra lutris nereis**. The default is a 1.20 m nose-to-tail adult floating belly-up, with the head toward −Z, belly toward +Y and the authored waterline at root Y=0. Root scale remains one; geometry, pivots, dimensions and physics all use metres.

The [Monterey Bay Aquarium](https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/sea-otter) photos guide the broad pale head, paired small muzzle pads, tiny round ears, long dark torso and folded hands. [CDFW's identification reference](https://wildlife.ca.gov/OSPR/Science/MWVCRC/Sea-Otter-Stranding-Response) distinguishes the two broad hind feet and central tapered tail. [Shedd Aquarium](https://www.sheddaquarium.org/animals/southern-sea-otter) gives female lengths of 1.00–1.40 m and male lengths of 1.20–1.50 m. The factory accepts that combined 1.00–1.50 m adult interval; the source's length endpoints are not specified. The modeled nose-to-tail measurement, proportions, pale coat choice and animation timing remain authored approximations, not a sex-specific average or a juvenile growth model.

| Detail | Triangles | Color-pass draws | Authoring / WebGL 2 bytes | WebGPU after render bytes |
| --- | ---: | ---: | ---: | ---: |
| Near | 730 | 1 | 31,440 | 39,428 |
| Mid | 418 | 1 | 19,008 | 23,716 |
| Far | 176 | 1 | 9,636 | 11,836 |
| Owned geometry family | — | — | 60,084 | 74,980 |

Counts are deterministic across coat seeds and lengths. The ceilings are 1,500 / 700 / 220 triangles and one draw. Shadow and scene-output passes are additional. WebGL 2 retains the authoring typed arrays. Native WebGPU promotes `Uint16` indices and skin-index attributes to `Uint32` on first use: the family counter progresses through 68,072 → 72,780 → 74,980 bytes as Near/Mid/Far are first rendered. This is renderer conversion, not allocation by animation. The table excludes driver allocations, skeleton storage and shader programs; browser measurements are retained in the viewer's artifact review.

All three levels use one opaque vertex-colored shared-toon `SkinnedMesh`, twelve bones and no downloaded image textures, fur cards, PBR/gloss layers or separate facial draws. A continuous surface blends the rounded forehead and cheeks through a short neck into the chest, belly and pelvis. Bent forearms and compact paws tuck against the chest; shoulder-to-wrist span is about 26% shorter than the initial version. The broad asymmetric rear feet and tapered two-hinge tail merge into the same draw. Build-time seed variation changes coat tint only. Mid/Far remove small shape detail while preserving the full functional rig and identity. Eyes and muzzle pads are embedded against each level's actual head triangles to avoid detached details on the coarse skull. `geometry.userData.partRanges` records named source components in final index-buffer units for inspection and regression tests.

## Public API

```ts
const otter = createSeaOtter({ seed: 42, lengthMeters: 1.2, pose: 'float' });
applyNodeStyle(otter.root); // Viewer-owned shared WebGPU/WebGL 2 style conversion.
scene.add(otter.root);
await lod.register(otter.root);
otter.update(deltaSeconds);
otter.setPose('groom', 0.55);
otter.update(deltaSeconds, { reducedMotion: prefersReducedMotion });
otter.dispose();
```

The returned model exposes `root`, `mesh`, `rig` (bones, absolute bind pivots and skeleton), `dimensions`, `physics`, `setPose`, `update`, `poseAt`, `pose`, `time`, `strokePhase` and `dispose`. Root-based collection helpers are `getSeaOtter(root)`, `updateSeaOtter(root, dt, options?)` and `setSeaOtterPose(root, pose, blendSeconds?)`. They use the same controller through a WeakMap and create no second animation loop.

- **Float:** quiet local roll, small head motion, hands tucked against the chest and gently raised rear feet.
- **Swim:** an upright forward-looking head, hands tucked beneath the chest, coordinated rear-foot strokes and subtle chest/pelvis/tail undulation. The uniformly dark torso keeps a continuous untwisted surface; the head and forelimb posture distinguish underwater cruising from surface floating. `speed` controls stroke cadence only; it does not translate the animal or change stroke amplitude.
- **Groom:** alternating hands move to the sides of the face with wrist articulation.
- **Dive:** a local nose-down pitch develops over 1.6 seconds while the hands tuck beneath the chest, with rear-foot strokes and tail clearance. The host must supply any actual descent or world travel.

`setPose(pose, blendSeconds=.55)` snapshots into preallocated rig storage and blends the local pose without resetting the continuous stroke phase. A fixed target quaternion hemisphere keeps large forelimb rotations continuous even as the animated target moves. `update(dt, {pose?, speed?, reducedMotion?})` advances the local clocks; reduced motion freezes clocks, transitions and bones. `poseAt(time, {pose?, speed?})` is an immediate deterministic seek for inspection at the supplied time and cadence. No animation changes the world root or writes geometry/normal/skin buffers. Ordinary variable-speed updates integrate stroke phase continuously; seeking is not a network-state restoration protocol.

## Ownership and limits

Register the root with the existing shared distance-LOD controller. The model does not inspect a camera, change detail or throttle its own simulation. A fixed conservative envelope includes grooming and the complete dive pitch, so there is no per-frame CPU skin scan for bounds. The same torso capsule and waterline/chest/head/mouth/front-paw/hind-foot/tail anchors remain independent of LOD and pose.

Placement, water contact, buoyancy, collision, multiplayer authority and travel belong to the host. The habitat factory adds no scene population and does not implement a caught/dead state, instancing, feeding tools, fur simulation or water effects. The separate [Tank adapter](../../sea-otter/createSeaOtterModel.ts) supplies the FishModel contract and caught-eye overlay; Tank routing owns long floating periods, underwater travel and resurfacing. Those responsibilities do not change the habitat rig or its placement contract.

Each instance owns its material, skeleton and complete LOD geometry family. `dispose()` is idempotent. The standard `disposeObject(root)` also releases the skeleton/WeakMap state through geometry disposal, including when Far is active. Export clones use the shared exporter so skin bindings remain independent.

`tests/sea-otter.test.ts` verifies seeded geometry/style/budgets, all poses and levels, actual grooming contact, hind-foot-dominated propulsion, underwater hands below the torso with eyes above the forward muzzle, metre scaling, motion bounds, immutable root/buffers/physics, deterministic sampling, skin continuity through float/swim/dive transitions, reduced motion, export bindings and full resource disposal. Current browser render submissions, generated exports and reference comparisons are retained in the refinement and Tank review (historical authoring evidence omitted from this public snapshot); `artifacts/sea-otter/` preserves the first pass and source images.
