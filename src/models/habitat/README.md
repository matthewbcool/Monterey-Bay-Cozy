# Habitat models and attached fauna

Use the repository's shared toon style, public metre scale, seeded variation, measured budgets and explicit resource ownership. Factories generate assets; scene code owns placement and simulation. Register inspectable habitat assets in `../props/catalogue.ts` and their ceilings/provenance in `../props/dimensions.ts`.

## Bat star

`createBatStar()` in `batStar.ts` composes the indexed radial body and tube-foot builder in `batStarGeometry.ts`. The supplied top and underside photos are preserved in `public/references/`. Five-arm contour, dorsal ridges, oral grooves, central mouth and paired feet are informed by those photos; dimensions, symmetry, color zones and sparse feet remain stylized. The photos have no physical scale, so the representative 18 cm across size remains an artistic choice.

| Detail level | Intended use | Triangles | Color-pass draws |
| --- | --- | ---: | ---: |
| `near` (default) | Inspection; oral grooves and 30 low-poly tube feet | 814 | 1 |
| `colony` | Attached environment stars; hidden feet omitted | 306 per star | 1 per instanced colony |

The ceilings are 850 triangles / one draw for inspection and 400 triangles per star for a colony. Distance LOD reduces the inspection and colony geometry; scene/shadow overhead is separate. The colony skips its own shadow pass because the animals sit against a receiving surface. Body, foot stems/pads, mouth and madreporite share one indexed mesh and one matte toon material. No photo maps, glossy PBR response, per-foot draw or per-frame vertex rewrite is added. Small surface papulae and dense photographic foot counts are intentionally simplified.

```ts
const star = createBatStar({ diameterMeters: .18, color: 'orange', seed: 17 });
scene.add(star);
const attachment = attachToSurface(star, surfaceAnchorFromHit(meshHit));
attachment.update(deltaSeconds);
attachment.detach(); // release placement to a future physics controller
disposeObject(star); // the factory owns its geometry/material
```

`attachToSurface()` in `../shared/surfaceAttachment.ts` receives a mesh anchor point, normal and optional heading in **geometry-local coordinates**. `surfaceAnchorFromHit()` converts a raycast's world point, including an instanced mesh's instance transform. Model +Y points outward from the contact plane. Targets may move, rotate and scale nonuniformly; normal transforms use the inverse transpose. The placement parent must have positive uniform scale; binding compensates that scale to preserve the animal's world metre size. Attachment never reparents the asset to the target or modifies its geometry.

The default game speed is **0.000002 m/s (0.12 mm/minute)**. It is deliberately subtle, not a measured species speed. Crawl projection runs at most once per accumulated second, stays on the original mesh/instance, stops at an edge or sharp change of normal, and is bounded to 2 cm. `update(0)` only follows target transforms. There is no swimming, visible idle sway or animated foot rig. The body attaches rigidly at its center; it does not simulate arms conforming around a small curved object. Use broad rock faces, floors or walls and an appropriate specimen size.

`createBatStarColony()` in `batStarColony.ts` shares geometry/material across all its instances. Separate placement nodes and bindings drive instance transforms. Static targets do not trigger repeated GPU uploads; movement updates only the instance matrix buffer. `dispose()` releases bindings, instance resources, geometry and material once. Never dispose individual placement nodes as though they own that shared render mesh.

`tests/bat-star.test.ts` checks seeded variation, both detail budgets, underside winding, contact planes, walls/ceilings, scaled and moving instanced targets, crawl timing, edge stopping, buffer stability and disposal. `tests/bat-star-browser.mjs` records actual render counts on classic WebGL, native WebGPU and the node renderer's WebGL 2 fallback. The node renderer adds a separately counted color-output draw. See `artifacts/bat-star/` for source notes, photo comparisons and visual evidence.

## Purple sea urchin and moon jelly

Each species has a folder containing `definition.ts` (dimensions, provenance and budgets), `geometry.ts` (anatomy and merged batches) and a public factory. `purple-urchin/colony.ts` owns instancing and detachable surface controllers. `moon-jelly/createMoonJelly.ts` owns pulse state in a WeakMap; the scene owns translation and drift. Keep visual animation separate from future physics placement.

`createPurpleUrchin({testDiameterMeters: .05, seed: 83})` returns one metre-scale toon mesh: 1,818 triangles / one draw. `createUrchinColony(anchors, seed)` shares that geometry across instances and uses edge-limited attachments at 1 cm/min. This is a conservative animation choice below sourced predator-trial rates, not a measured grazing average. The complete spiny envelope is about 7–8 cm.

`createMoonJelly({diameterMeters: .25, seed: 42})` returns 1,482 triangles / two draws (ceiling 1,600 / two): translucent bell and translucent merged internal anatomy. Call `updateMoonJelly(root, deltaSeconds)` only while playing. Both batches share a contraction target and a delayed trailing target, with static position and normal buffers. `bell.ts` owns the shallow scalloped membrane/rolled lip; `anatomy.ts` owns four horseshoes, four folded arms, fine branched canals and 48 simplified fringe ribbons. `motion.ts` samples a short contraction and longer recovery. Both batches preserve their transparency across LOD variants. Dispose the factory root with the standard disposal helper. A future physics controller may own its root without competing with pulse animation.

The urchin is registered in Objects and the Area scene; the jelly now enters the Tank creature collection through `../moon-jelly/createMoonJellyModel.ts`. Both expose coarse collider metadata and are tested by `tests/open-sea.test.ts` and `tests/open-sea-browser.mjs`. See `artifacts/moon-jelly/REVIEW.md` for the current jelly and `artifacts/open-sea/REVIEW.md` for the original fauna pass and urchin references. No per-spine meshes, textures, PBR materials or runtime GLBs are needed.

Urchins and sea stars are excluded from the main Tank scenery. `viewer/harbor.ts` owns their rock anchors, instanced colonies, updates and disposal in Area & buildings.

The main libraries and harbor register habitat meshes, colonies and scenery with the [shared LOD controller](../../../docs/lod.md). Surface anchors and crawl speed never depend on the active mesh. Instanced colonies use the nearest member for conservative batch selection.

## Living monarch butterfly

[`monarch-butterfly/`](monarch-butterfly/README.md) separates body, wing pigment, motion, dimensions and the public factory. The Objects entry uses one matte skinned batch and five bones at a representative 10 cm wingspan (published adult range 8.5–12 cm). Flight alternates wingbeats with glides; the API also supports still basking and folded perch poses. Animation never moves the world root or rewrites vertex buffers. All three LODs preserve the wing rig, and generic object disposal releases its skeleton. This is a living Habitat asset, distinct from the Lovers Point granite butterfly sculpture. `createMonarchBatch()` adds one-draw instanced groups with independent GPU wingbeats and host-owned placement; the Objects Group selector previews 32 / 128 / 256 butterflies and every LOD. See the module README for stable-slot and resource ownership rules.

## Western gulls

`western-gull/` provides male/female variants through `createWesternGull({sex,seed,pose})` and flight-only `createGullFlock({sex,seed,count,capacity})`. The individual has one matte skinned draw, ten bones and authored 380 / 170 / 32-triangle LODs; it supports flapping/gliding, standing, walking and a finite reusable poop effect. The flock has independent GPU shoulder/wrist motion in one instanced draw, 324 / 130 / 24 triangles per bird, stable slot IDs and bulk transform commits. Host code owns placement and future physics; no animation changes the root or rewrites geometry. Both are in Objects with sex, pose, group and distance-detail inspection. See [source/API/performance guide](../../../docs/western-gull.md) and browser evidence (historical authoring evidence omitted from this public snapshot).

## Anemones

`anemone/definition.ts` records the two species, size evidence and ceilings. `createAnemone({ species: 'giant-green' | 'aggregating', seed })` returns one vertex-colored toon mesh in metres, base at the origin with +Y out of the contact surface. `giantGreenGeometry.ts` owns the continuous stout column, ribbed oral disk, oval mouth and three staggered crown rows. Its 72 curved tentacles use seeded length, bend and tint variation; all anatomy merges into one draw, with source-part index ranges retained for inspection.

The giant-green inspector uses **1,984 / 388 / 352 Near/Mid/Far triangles**, with a 2,000-triangle ceiling. The static bed starts at **388**, then **352 / 190**, below its 400-triangle ceiling per animal. It shares one geometry/material and one draw per species, with matrices uploaded once and no per-frame work. All levels preserve the contact plane and seed sequence. Authored variants register through `defineGeometryLods()` and share the controller's disposal family; bed disposal is idempotent. The aggregating species retains its original 202-triangle geometry and generic distance reduction.

The 14 cm oral disk and 5.5 cm column are authored representative dimensions, not measurements of the photos. The Aquarium's published giant-green crown size was checked on October 25; colors, crown count and smaller LOD counts remain stylized. There is no tentacle sway or contraction state. The gym's [dive site](../../../docs/gym-dive-site.md) places both species on raycast boulder contacts. See the photo review and current costs (historical authoring evidence omitted from this public snapshot), `tests/anemone.test.ts` and `tests/anemone-browser.mjs`.

## Black-tailed deer

`deer/` separates species/dimensions, seeded geometry, local leg/neck animation and the public `createDeer` factory. Adult doe and spotted fawn are one matte skinned draw each with 18 bones and authored Near/Mid/Far variants. The host owns placement, collisions and future authority; animations never move the root. `deerBehavior.ts` and `deer.ts` under the Gym viewer own family movement and distance sleep. See the [API and budgets](../../../docs/deer.md), [inspected references](../../../docs/deer-references.md) and review (historical authoring evidence omitted from this public snapshot).

## Southern sea otter

[`sea-otter/`](sea-otter/README.md) separates sourced identity/dimensions, seeded geometry, local rig animation and the factory. `createSeaOtter()` returns one matte skinned mesh with Floating, Swimming, Grooming and Diving poses. The default adult measures 1.20 m nose to tail; the library also reports the combined-sex 1.00–1.50 m source range. Head, torso, paws, webbed hind feet and tail share one vertex-colored batch. Authored Near/Mid/Far variants retain the rig, physics metadata and host-owned placement. See [reference observations](../../../docs/sea-otter-references.md) and measured review (historical authoring evidence omitted from this public snapshot).

The Tank adapter reuses this same otter at the same scale; `viewer/seaOtterRoute.ts` owns surface rest, dive/swim/ascent travel. Objects retains all four direct pose previews.
