# Living monarch butterfly

`createMonarchButterfly()` returns an unscaled, metre-authored `Group`. This is the living Habitat asset (`monarch-butterfly`), separate from the granite Lovers Point sculpture (`butterfly-statue`). The Objects library supplies Flying / Wings open / Wings folded poses, regeneration, playback, distance-detail inspection and optional GLB export.

| Responsibility | Module |
| --- | --- |
| Wingspan range, source, ceilings and authored flight timing | `definition.ts` |
| Head, thorax, abdomen, clubbed antennae and six legs | `body.ts` |
| Four thin wing membranes, broad cells, sparse cream spots, brown reverse pigment | `wings.ts` |
| Mirrored flight hinges, eased glides, basking and folded poses | `motion.ts` |
| Individual assembly, five-bone rig, public API and resource ownership | `createMonarchButterfly.ts` |
| Shared instanced group, stable placement slots and lifecycle | `createMonarchBatch.ts` |
| GPU hinge/normal animation before instance transforms, shared toon ramp | `batchMaterial.ts` |

```ts
const butterfly = createMonarchButterfly({ seed: 42, wingspanMeters: .10 });
scene.add(butterfly);
await lod.register(butterfly);
updateMonarchButterfly(butterfly, deltaSeconds); // omit while paused
setMonarchPose(butterfly, 'perched');            // quiet, wings folded above body
setMonarchPose(butterfly, 'basking');            // open for sunlight/inspection
setMonarchPose(butterfly, 'flight');             // resume from the open flight pose
disposeObject(butterfly);
```

The [Florida Museum](https://www.floridamuseum.ufl.edu/wildflowers/butterfly/monarch/) gives an adult wingspan of 85–120 mm. Our default is 100 mm; explicit positive sizes are also supported. This measures open wingspan, not body length. The source photo supplies the dorsal pattern, but its tips are cropped and its underside hidden. Complete contours, body dimensions, sparse spots and muted leaf-brown ventral paint are stylized. The darker reverse palette follows the user’s camouflage direction; it is not a calibrated color measurement. Reference notes (historical authoring evidence omitted from this public snapshot) distinguish evidence from choices. Pacific Grove is a documented seasonal overwintering area; the asset does not establish a permanent Lovers Point colony.

Geometry and vertex paint are canonical. No image texture, downloaded mesh, transparency layer, per-wing draw or custom shader is used. Explicit reverse faces have their own color and winding; keep the single shared toon material `FrontSide`. A five-bone `SkinnedMesh` rigidly weights the body and four wings. Animation changes bone rotations only, with no geometry/normal uploads or per-frame allocation. The 4.2 Hz beat and periodic glide are authored motion, not measurements of flight speed or aerodynamics. There is no root translation or flight-path simulation.

Local +Y is dorsal, the head faces −Z and open wings extend along ±X. Host placement and future physics own the root. `userData.physics` supplies a body-only capsule and perch/grip anchors in metres; wings, mass and aerodynamic forces are excluded. A host can align the perch anchor to a surface without changing the rig. The conservative flight bounds keep flapping wings inside the camera-culling envelope and above the library display stand.

Factories own geometry, one material and one skeleton. `disposeObject()` disposes the active geometry family; its source-disposal event releases the skeleton exactly once. Never dispose a shared global toon ramp. `defineGeometryLods()` lazily builds simpler procedural Mid/Far wings because generic collapse erased their coplanar pigment regions. Mid retains a few broad fields and spots; Far keeps orange upper/brown lower lobes and a narrow dark margin, while omitting legs and clubs. All levels use the shared camera controller, five-bone rig, material and resource ownership. The near ceiling is 1,000 triangles / one color-pass draw. See the measured review (historical authoring evidence omitted from this public snapshot) for all levels, storage and actual browser submissions. For populations, use the instanced batch below; the individual rig remains useful for close inspection and skinned GLB export.

`tests/monarch-butterfly.test.ts` checks seeded variation, scale, attached hinges, poses, static buffers, all LODs and disposal. `tests/monarch-butterfly-browser.mjs` checks native WebGPU and WebGL 2, reduced motion, playback/pause, distance selection, 320 px layout and skinned GLB export. Desktop viewport emulation is not a phone hardware benchmark.

## Instanced groups

`createMonarchBatch({count, capacity, seed, wingspanMeters})` reuses the same procedural body, orange/brown wings and authored LODs in one `InstancedMesh`. The library's **Group** control offers 1 / 32 / 128 / 256 butterflies; one uses the original rig, larger groups use this batch. Pose and playback controls work for both.

```ts
const batch = createMonarchBatch({ count: 32, capacity: 256, seed: 42 });
scene.add(batch.root);
applyNodeStyle(batch.root);
await lod.register(batch.root);
batch.update(deltaSeconds);                      // one animation-clock uniform
batch.setTransformAt(slot, localMatrix);           // host owns placement
batch.setFlightAt(slot, { phaseRadians: 1.2, rateScale: .95 });
batch.setPose('perched', slot);                    // individual pose
batch.setPose('flight');                          // whole group
batch.setCount(128);                              // stable prefix of allocated slots
batch.dispose();                                 // or disposeObject(batch.root)
```

The GPU rotates wing positions and normals around their original hinges. Each slot has its own beat phase, rate, glide offset, pose and positive uniform size; geometry and instance matrices stay unchanged during wing animation. This avoids a skeleton or baked morph atlas per butterfly. It uses the shared toon ramp with TSL on both supported rendering backends. One batch shares a seeded wing pattern; separate batches may use different seeds.

Slots remain stable when count changes, but they are local render slots, not multiplayer IDs. Keep world identities in the host, which also owns navigation and physics. Instance matrices are local to the unscaled batch root; uniform scale represents wingspan relative to the base geometry. Use bounded spatial groups for a large world: the shared controller selects detail conservatively for the nearest member, and the group's bounds encompass every active butterfly. No flocking behavior, flight paths, collisions or networking are added.

A nonempty batch takes one color-pass draw at every LOD. Triangles still multiply by count: each butterfly uses 912 / 560 / 212 at Near / Mid / Far. Instancing reduces draw submissions and shared-resource overhead; it does not make 256 butterflies cost the same number of triangles as one. Shadows add their own pass. Per-level measurements and actual backend checks are in the batch review (historical authoring evidence omitted from this public snapshot).

**Save GLB** remains available for the individual model. Group export is hidden because glTF does not serialize this runtime TSL wing animation. The reusable group is its TypeScript factory.
