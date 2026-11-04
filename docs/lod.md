# Distance detail for an open web world

The October 22, 2026 art direction uses readable silhouettes, vertex paint and shared toon lighting. High quality, inverted-hull silhouettes and bloom are removed. Base/Standard control device costs such as pixel ratio, shadow size, rim and refraction. **Mesh LOD is independent and automatic in both settings.**

## Runtime contract

`src/models/shared/lod/geometry.ts` derives Near (LOD 0), Mid (LOD 1) and Far (LOD 2) from canonical procedural geometry with pinned `meshoptimizer` 1.0.1. The [upstream simplifier](https://github.com/zeux/meshoptimizer/tree/master/js#simplifier) preserves triangle topology and considers paint, normals and animation attributes. We retain exact surviving vertex records, including custom tuna hinge/matte attributes, skin indices/weights and every morph target. Morph trajectories participate in welding; representative targets also contribute to simplification error. Material groups remain separate. No authored mesh download, alternate material or extra draw is required.

Very thin, coplanar pigment partitions can lose their color fields during generic collapse. Such models may call `defineGeometryLods(source, builder)` before registration to supply smaller **procedural** Mid/Far geometry. The shared system invokes the builder once, keeps Near canonical, copies its conservative bounds, and owns the complete disposal family. Camera thresholds, materials, skeletons, world placement and physics remain shared and unchanged. The monarch uses this path: fewer broad wing fields at Mid and simple orange/brown lobes at Far preserve identity where the automatic reduction erased the pigment. Its test measures colored surface area at every level; merely retaining a color attribute is insufficient.

The [Western gull](western-gull.md) also authors its variants: 380 / 170 / 32 triangles for the single skinned bird, with small anatomy deliberately removed as its silhouette shrinks. Flight-only instances omit ground limbs/effect and use 324 / 130 / **24 triangles per bird**, retaining two wing hinges per side in one draw for the flock. Individual and instanced GPU flight are checked against one another on both renderers. Spatial cells are still required for widely separated flocks; this does not change the controller's conservative nearest-member policy or introduce another LOD system.

Mid aims for half the original triangles with an appearance-error ceiling of 0.8% of mesh extent; Far aims for one fifth with a 3.5% ceiling. These are simplifier error metrics, not a universal pixel-error guarantee. Static terrain and architectural geometry can opt into `geometry.userData.lodMaxErrorMetres`; the reducer clamps its relative target to that absolute error metric and preserves borders. Lovers Point uses 0.02 m to avoid metre-scale folds or collapsed facades in large batches. Other meshes retain the existing defaults. Silhouette, color, joints and topology can stop reduction early. Primitives below 24 triangles and partial draw ranges remain unchanged. Small disconnected features are not deliberately pruned. Near is exactly the original source. Skeleton counts and per-instance morph textures do not multiply with LOD.

`controller.ts` measures projected sphere diameter in **CSS pixels**, accounting for camera FOV/zoom, object transforms, metre scale and conservative motion bounds. Target boundaries are 180 px (Near/Mid) and 55 px (Mid/Far), with 15% hysteresis. Re-evaluation is limited to about 8 Hz, with immediate checks after explicit inspection changes. Bounds use depth to the sphere's front, so close or oblique views retain detail. This is a discrete switch without alpha crossfades, extra draws or temporary doubled geometry. Review transitions at actual gameplay size as well as enlarged forced variants.

Instanced schools and habitat colonies use the largest projected individual in the batch, keeping the closest member safe. They **retain one draw per original batch**, the original slot order, instance matrices, colors, morph textures, counts and extraction behavior. A very long school may keep more detail than strictly necessary; future world-scale schools should be partitioned into bounded spatial batches with stable identity mappings.

Morph-animated geometry switches also invalidate the current material bindings. Three r180 otherwise can keep the previous geometry’s morph texture, applying pulse/shape data to the wrong vertex order. This refresh happens only when geometry actually changes (including restoring Near on teardown), preserves morph weights and shared materials, and adds no draw calls. Static mesh switches do not invalidate materials. The moon jelly regression (historical authoring evidence omitted from this public snapshot) checks rendered size through repeated transitions and reproduces the old failure as a negative control.

LOD only chooses render geometry. It does not change position, scale, animation phase, clock, caught state, visibility, interaction range, colliders, anchors or motion ownership. Authoritative simulation and future multiplayer identity must never depend on camera distance. Physics updates are not throttled. Raycasts and surface-crawl probes use canonical Near geometry at every rendered level; the original raycast is restored on controller disposal. Three's existing frustum culling still applies. This work does not implement networking, occlusion culling, world streaming or a physics engine.

## Coverage and library inspection

- All 15 selectable creatures, both life states, including GPU-wave tuna, skinned fish/turtle/octopus/gray whale and morph-animated moon jelly. The whale is excluded from the mixed Demo population.
- All registered Objects: equipment, boats, habitat and both Lovers Point sculptures. Random seeds and physical dimensions remain unchanged when switching levels. The living monarch retains its four wing hinges and distinct reverse pigment in one skinned draw; its optional instanced group reuses authored levels and per-instance animation attributes in one draw for all butterflies. The Group selector and Detail controls inspect both paths; asset review (historical authoring evidence omitted from this public snapshot). Each statue keeps one matte batch; [placement and budgets](lovers-point-statues.md) remain independent of LOD.
- Selected sardine schools, the mixed 292-animal demo, harbor wildlife and instanced colonies.
- Shore, seabed, rocks, vegetation, water surfaces, gallery visitors and tank scenery. Already-simple surfaces keep their geometry. Existing custom shaders keep their inputs.
- The Lovers Point Testing Gym registers its full park, avatar and weather meshes. Cypress/granite prototypes are instanced in bounded 96 m groups; static furniture/walls and buildings use 128 m spatial batches. Its rendering panel exposes all world variants, separate from actual camera-culled submissions. See [gym geography and costs](testing-gym-geography.md).
- The map and aquarium interior use the same controller in their separate demand-rendered viewport. Map Study includes the shared Lovers Point scenery at true metre coordinates; a comparison toggle restores original map massing/lines. Extra source buildings intersecting its terrain retain their height above inferred foundations. The conditions catalogue uses DOM pins and adds no mesh draws. See [Map Study integration](map-world.md). The map's large merged building batches are selected conservatively as batches; they are not a streaming world partition. Guide lines and UI borders are not model outlines and remain.

The Gym atmosphere is counted separately from its park-only geometry ceiling: the canonical sky has 528 triangles; optional rain has 160 quads on Base or 240 on Standard (320 / 480 triangles), with a maximum of two draws and no image textures. Sun, Moon, clouds and artistic stars share the sky material. Rain density is a device-tier choice, not a change to physical scale or simulation. Mesh LOD does not remove the procedural sky's full-screen pixel cost. Clouds use seeded variation and uniform animation; rain shares static instance buffers. See [weather sources and lifecycle](weather-sources.md).

Gym shadow submissions have their own conservative caster filter; this does not replace mesh LOD or change color visibility. [Rendering cost and shadow-layer ownership](gym-rendering-performance.md).

The **Detail** control in each library offers Auto / Near / Mid / Far. **Detail levels** shows all variants' triangles and draw calls for the current life state, plus geometry/index storage across all owned states/levels. The live model counter describes the active mesh. Pinning a level is an inspection override, not a different style. `?lod=near|mid|far` supports deterministic main-viewer review. The map/interior has its own Detail selector and count readout. Objects exports the displayed level and seed; its filename identifies the forced level or Auto snapshot.

Inspect the comparison gallery (historical authoring evidence omitted from this public snapshot), review (historical authoring evidence omitted from this public snapshot) and actual renderer counters (historical authoring evidence omitted from this public snapshot). Canonical full-detail budgets in the asset register still apply to Near; record the reductions rather than treating the target ratios as measured counts. Seeded natural variants may produce slightly different reduced counts.

## Integration and ownership

```ts
const lod = createLodController();
const creature = createGiantPacificOctopusModel();
scene.add(creature.root);
await lod.register(creature.root); // once after construction, outside the frame loop
// Before rendering; keep your normal simulation/physics update separate.
lod.update(camera, viewportHeightCss, deltaSeconds);
// Removing the creature releases all associated LOD geometry, even if Far is active.
creature.dispose();
// At scene shutdown, restore remaining Near geometry before ordinary owner cleanup.
lod.dispose();
```

Factories still return the original, synchronous model contract. Preparation is asynchronous only for the simplifier's WASM initialization; reduction itself runs once on the main thread. A WeakMap reuses variants for the same source geometry. There is no cross-instance atlas or persistent disk cache. All original and derived geometries form one disposal family; disposing an active variant or the original releases the whole family and unregisters meshes. Rapid selection cancellation is tested. Scene shutdown restores canonical references before owners dispose resources.

LOD trades additional geometry memory and one-time build CPU for fewer submitted vertices/triangles. It does not reduce the initial source download or skeleton/simulation CPU. Counters report typed-array bytes, not driver memory, skeleton textures, shader programs or total heap. Large streamed worlds should generate/cache variants in a worker or offline build pipeline and lease shared geometry explicitly; never simplify in the render loop. These future optimizations are not claimed as implemented.

## Acceptance for every asset

1. Keep canonical factory source, metre scale, stable identity and the existing style/material policy.
2. Register new roots in every relevant world and library view. Reuse the controller rather than per-species camera logic.
3. Inspect Near/Mid/Far, automatic distance transitions, the silhouette from several angles, animation and caught state. Low-detail geometry may look faceted when deliberately forced close.
4. Assert finite/index-safe attributes, normalized skin weights, all morph targets, material groups, unchanged roots/physics and disposal. Test randomized assets across seeds when changing the reducer or their topology.
5. Record actual per-level triangles/draws and storage, then measure submitted rendering cost on native WebGPU and WebGL 2. Maintain static source buffers during playback. Keep instanced schools batched.
6. Run `npm test`, `npm run build`, `node tests/lod-browser.mjs`, `node tests/style-tiers-browser.mjs`, `node tests/lod-integration-browser.mjs` and relevant interaction regressions. Physical-phone performance remains a separate release gate; desktop viewport emulation is not hardware profiling.

Refresh the evidence table/gallery with `node scripts/lod-report.mjs` after the browser checks.

Historical High-tier screenshots and measurements remain in dated artifact folders and [rendering history](rendering-history.md). They are superseded evidence, not current implementation requirements.

## Optional water patch

[Enhanced Gym water](graphics-quality.md) retains the coastline mesh and adds a 16 m camera-local patch in the same draw. Its authored Near/Mid/Far family shares the same 12.5 cm grid to keep the wave intersection stable. Only its origin uniform moves; no geometry uploads or buoyancy changes occur. This opt-in rendering budget is separate from asset triangles and is absent in Balanced.
