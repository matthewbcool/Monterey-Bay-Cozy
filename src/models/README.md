# Model structure

Start at `catalogue.ts` for the available fish and `types.ts` for their public contract. The [codebase guide](../../docs/codebase.md) places these factories within the application; the [viewer map](../viewer/README.md) identifies scene owners and the [test guide](../../tests/README.md) maps model changes to validation. A species factory composes geometry components, combines compatible surfaces into render batches, then attaches behavior. Components are plain TypeScript builders with explicit inputs; they do not import the viewer, manipulate the DOM, or load assets themselves.

## Where to make a change

| Change | File or folder |
| --- | --- |
| Register a fish | `catalogue.ts` |
| Biological size ranges, units, evidence basis and source links | `sizeRanges.ts`, `../../docs/species-sizes.md` |
| Toon ramps, palette and material helpers | `shared/style.ts` |
| Renderer-owned rim; Base/Standard device settings | `../viewer/nodeStyle.ts`, `../viewer/quality.ts` |
| Seeded habitat factories | `habitat/` |
| Surface anchors and attached placement | `shared/surfaceAttachment.ts` |
| Shared fish states, placement ownership and budgets | `types.ts` |
| Future engine's pose adapter | `physics.ts` |
| Named component assembly, batching, resource cleanup | `shared/assembly.ts` |
| Tuna entry point and assembly order | `tuna/createTunaModel.ts` |
| Tessellation, lower-fin attachment offsets, batch layout, collider/anchors | `tuna/definition.ts` |
| Tuna body cross-sections and surface queries | `tuna/profile.ts` |
| Body surface and countershading | `tuna/components/body.ts` |
| Fin shapes and placement | `tuna/components/fins.ts` |
| Normal/X eyes, mouth and gill contours | `tuna/components/face.ts` |
| Palette and per-fish material set | `tuna/materials.ts` |
| Cel shading and GPU body wave (TSL `TunaCelMaterial`, per-fish swim uniforms) | `tuna/toon.ts` |
| Final two-draw batch and GPU hinge matrices | `tuna/batching.ts` |
| Fin hinges, swimming, life states and disposal | `tuna/motion.ts` |
| Tank, camera, controls and route | `../viewer/` and `../main.ts` |

## Authoring components and render batches

The tuna has readable body, fin and face builders. Each builder creates named source parts through `ModelAssembly`. These names make placement changes and geometry checks straightforward before batching. All transforms use model coordinates: head −X, up +Y, near side +Z.

The factory first uses `TUNA_BATCHES` to assemble named surfaces, then `tuna/batching.ts` merges the whole body and fins into one indexed mesh. The visible live/caught face adds one draw: **two draws in either state**. Vertex colors bake material tints; `fishMatte` separates skin from matte fins without a material split, and `tunaJoint` selects four rigid hinge transforms. Tail, first dorsal and paired pectoral groups remain as empty animation controls. Their current-to-bind matrices and inverse-transpose normal matrices update after each pose; the other vertices keep the original GPU wave. This preserves all original triangles and fin motion.

`parts` exposes the final animation groups, not the original source-part list. The rigid `root` owns placement and contains `visual`. Physics/path code owns the root; animation owns only the visual rig. The model has no references back to its viewer.

## Attachment and ownership rules

- Place attached geometry using body surface queries and a deliberate small overlap. Lower tuna fins use `bodySurfaceY(x, z, -1)` so roots follow the elliptical belly at their actual lateral offset. Avoid fixed heights that float after a body-profile change.
- Geometry builders receive an assembly and materials. Material creation happens once per model; builders reuse those materials. They do not construct temporary replacement materials.
- `batchParts()` consumes source parts, bakes transforms relative to `visual`, and combines compatible attributes by material. It preserves UVs by default; the texture-free tuna explicitly discards them. Multi-material meshes must be split before batching.
- Each model instance owns its geometry/material lifetime. `disposeModelResources()` deduplicates disposal within that model. A future shared geometry cache needs reference-counted ownership before sharing resources between instances.
- CPU hinge motion and GPU body motion must describe the same wave. When changing the wave in `motion.ts` or `toon.ts`, update both and inspect attachment continuity.
- The final tuna batches share one material and one set of swim uniforms created in `createTunaMaterials()`. The unbatched `TunaCelMaterial.bent()` path remains for component and pose-equivalence checks. Node uniforms are bound at construction, so never replace them after a material exists.

## Adding a species

1. Create a species folder with a small factory, an explicit definition, geometry builders, materials and motion. Group by meaningful systems (body, fins, face); keep small shape helpers local to the system that uses them.
2. Implement `FishModel`, including alive/caught states, X eyes, placement ownership, a cheap physics descriptor and disposal. Use a category-appropriate public interface for future non-fish assets.
3. Promote a helper to `shared/` when its responsibility is independent of species. Keep species-specific proportions, wave parameters and visual choices in the species folder.
4. Register the factory in `catalogue.ts`, including its required `sizeRange` from `sizeRanges.ts`. Record published versus derived/selected endpoints in `docs/species-sizes.md`; keep the specimen factory size separate. Every registered fish automatically gets the shared collection contract test: both states must fit **5,000 triangles / 2 draw calls** and at most three primitive colliders.
5. Add meaningful geometry/behavior checks. For tuna, `attachments.test.ts` casts against the actual body mesh to detect separated lower-fin roots. Inspect slow, fast and caught poses from the side and below after attachment changes.
6. Run `npm test`, `npm run build`, and relevant browser checks. Record current visual evidence under `artifacts/<species>/`; keep original-reference/reconstruction history distinguishable from current results.

The gray whale follows this contract in `gray-whale/`: `definition.ts` holds dimensions, source and motion rates; `components.ts` builds the mottled body, attached flippers, low dorsal knuckles, horizontal flukes and facial marks; `createGrayWhaleModel.ts` batches them into a three-bone vertical tail rig. It is registered for in-place individual inspection but has no `DEMO_POPULATION` entry, so `createTankDemo()` excludes it. The single-view swimmer holds its rigid root at tank centre because the normal turning route cannot contain a 12 m body. Its capsule and anchors remain in metre-scale rigid-root coordinates for later physics integration.


## Non-fish assets and metre scale

The [Western gull guide](../../docs/western-gull.md) covers the male/female Objects entries, local ten-bone rig, bounded poop action and separate one-draw sky flock. Authored Far geometry removes tiny features and reaches 24 triangles per flying bird; world/physics placement remains host-owned.

Some existing prop builders use `props/primitives.ts` standard-material descriptors as temporary color/metal-response inputs. `finishStaticAsset()` consumes those descriptors, bakes transforms/colors, disposes the authoring resources and emits shared toon batches. They are an internal authoring bridge, not a second runtime shading system; keep new runtime materials on the shared toon/TSL path.

`props/furniture.ts` shares the existing park/café geometry between scene builders and Objects; raw source parts feed the world batch while `createFurniture()` finishes a one-draw inspection model. See the [catalog audit](../../docs/asset-catalog-audit.md) before adding or extracting a scene prop.

`props/catalogue.ts` registers code-generated objects; `props/dimensions.ts` declares metre conversions, nominal-size provenance and enforced budgets. `shared/staticAsset.ts` bakes source transforms and colors into two toon-material batches. Factories return unscaled Groups in metres and the viewer moves the camera to fit them. The comparison grid is a shared physical scale, not a set of normalized thumbnails.

The tuna keeps legacy design coordinates inside its animated visual subtree, but its factory converts the visual, colliders and anchors together. `lengthMeters` defaults to a clearly provisional 1.2 m. The rigid root is unscaled, so scene and physics placement remain in metres. Existing component seam tests can still operate in design space; the asset contract also checks the finished metric result.

Use `tests/asset-contract.test.ts` for scale and budget checks, `scripts/asset-audit.ts` for actual counts, and `tests/backend-qa.mjs` for toon-material WebGPU/WebGL 2 compatibility. GLB exports are optional generated copies; the running collection calls factories directly.

## Sardine and blue rockfish

These species share an ordinary six-bone rig and one shared toon material (`createFishMaterial()` → `createToonMaterial()`), while retaining their own anatomy and palette:

| Responsibility | Location |
| --- | --- |
| Species proportions, metre length, provenance, animation tuning and budget | `pacific-sardine/definition.ts`, `blue-rockfish/definition.ts` |
| Species fin outlines, colors, flank spots/mottling | Each species' `components.ts` |
| Public constructors | `createPacificSardineModel.ts`, `createBlueRockfishModel.ts` |
| Elliptical body with closed ends | `shared/fish/body.ts` |
| Surface queries, vertex colors and skin weights | `shared/fish/geometry.ts` |
| Fin extrusion and attachment coordinates | `shared/fish/fins.ts` |
| Normal eyes, X eyes, mouth and gills | `shared/fish/face.ts` |
| Shared toon material | `shared/fish/materials.ts` |
| Batching, six-bone skinning, state transitions and lifetime | `shared/fish/rig.ts` |

The new factories author proportions as fractions of total length, then bake positions directly into metres. Both root and visual scale remain one. Their `lengthMeters` option also changes the collider and mouth/grip offsets. Default adult lengths (sardine 25 cm, blue rockfish 35 cm) are representative design choices below documented maximum sizes, not specimen measurements. The Tank selector displays a sourced reference range with the specimen size in Size notes; follow-camera distance still uses the actual model dimensions. Catalogue travel speeds are metres per second and remain artistic animation choices.

All body, fin, mouth and marking components merge into one skinned mesh. The visible live or caught eye batch adds one draw. Six bones animate the middle, tail, dorsal tips and pectorals; fin-root vertices remain tied to the body. Identical full vertices are re-indexed after batching, preserving color/normal seams and skin weights. Geometry/normal buffers stay static and conservative bounds cover the swim poses without CPU vertex updates. This costs **2 model draws**, with **1,468 live / 1,280 caught triangles** for sardine and **1,872 / 1,684** for blue rockfish. Geometry remains indexed; the additional `fishMatte` scalar preserves membrane shading in both rigged and instanced models. One material is owned per fish; generated toon ramps are shared for the application lifetime. `dispose()` releases geometry, material and skeleton resources exactly once.

The existing tuna keeps its current factory and GPU-wave implementation. Shared interfaces do not require every species to use the same animation method. Factories emit built-in toon materials and standard GPU skinning. `createFishMaterial()` opts into the viewer's painted TSL conversion on native WebGPU and WebGL 2; classic WebGL remains an isolated geometry/animation compatibility fixture using its original toon ramp. `shared/fish/paintedLight.ts` is also used by tuna. The node material reads vertex paint once, so its built-in `vertexColors` multiplier is disabled. `fishMatte` suppresses rim light and uses a stable fin response, including in the one-draw school. Generic materials (including the shark) keep their separate style. Fin rounding and eye tessellation changes are limited to this opt-in material. The factory returns its canonical Near mesh; the shared LOD controller derives Mid/Far and retains independent resources per fish. Use the instanced sardine factory below for schools.

Run `node tests/new-fish-browser.mjs` against the development server for switching, slow/fast/caught views, camera framing, phone controls and the standalone backend fixture. `tests/fish-review.html?compare` provides a common metre-scale view of the registered fish; `?webgl` checks the toon-material models with the WebGL 2 backend and the default fixture checks WebGPU. Row spacing follows actual model height, so tall species fit without changing their scale. See `artifacts/fish-collection/` for the reference/design contract and recorded results.

## Ocean sunfish

The sunfish uses the same `FishModel` lifecycle and two-batch rendering contract, with its own fin-driven rig. Keep its flat-ended disc silhouette and motion distinct from tail-driven species.

| Responsibility | Location |
| --- | --- |
| Metre size, body sections, fin outlines, bone pivots, source links and budget | `ocean-sunfish/definition.ts` |
| Palette, attached hydrofoils, scalloped clavus, short gill slits and open beak | `ocean-sunfish/components.ts` |
| Factory and assembly order | `ocean-sunfish/createOceanSunfishModel.ts` |
| Six-bone rig, fin strokes, lifecycle and physics descriptors | `ocean-sunfish/motion.ts` |
| Common indexed surface/live-eye/caught-eye batches | `shared/fish/batches.ts` |
| Reusable normal/X eyes, without imposing another fish's mouth or gills | `shared/fish/face.ts` → `buildFishEyes()` |

The body builder accepts an optional fixed bone; sunfish body vertices bind to bone zero. Dorsal/anal roots blend from that rigid bone to separate propulsive-fin bones, while tips rotate laterally. The two mirrored hinges run in phase and remain fully extended in fast mode. The clavus is a lightly moving rudder, with no caudal peduncle or forked tail. Pectorals have their own hinges. All fins still merge into one skinned surface mesh, so six bones do not mean six draws. The shared matte toon material works with both renderer families.

The default 1.2 m length and 1.82 m resting fin span are representative artistic choices. A model's `inspectionSizeMeters` allows the viewer to frame its width, height and depth independently; use it for unusually tall shapes rather than enlarging or shrinking the root. Three X-axis capsules approximate the flattened main body; they omit fins, exact skin shape, mass and buoyancy. Body proxies and mouth/grip anchors scale with `lengthMeters`, and animation leaves the physics-owned root alone.

`tests/ocean-sunfish.test.ts` checks proportions, both-state budgets, fixed roots, moving fins, static buffers, route clearance, timing, caught state, physics ownership and disposal. `node tests/ocean-sunfish-browser.mjs` exercises actual rendering on classic WebGL, native WebGPU and WebGL 2 fallback plus phone framing and viewer controls. `tests/fish-review.html?species=ocean-sunfish` isolates it; append `&classic` or `&webgl` to choose a backend. Current evidence is under `artifacts/ocean-sunfish/`.

## California sheephead and kelp greenling

`california-sheephead/` and `kelp-greenling/` each contain a small public factory, `definition.ts` for size/profile/motion/provenance/budget, and `components.ts` for palette and anatomy. They reuse `shared/fish/` body, face, fin, material, batching and six-bone motion code. Add species-specific geometry there instead of branching the viewer or shared rig by fish name.

Sheephead models the adult male phase: a fuller forehead, dark head/tail, coral middle and pale chin. Four tiny canines join the surface batch. Greenling models the female phase: a slender profile, long notched dorsal, brow cirri and forty five-sided freckles projected onto the flanks. The freckles carry the same skin weights as the body. Lower fin roots use `bellyAt()` with inward overlap; pectoral roots use `flankAt()` and shared mirrored hinges. Both keep the dorsal visibly raised at fast speed.

Both use two model draws in either life state: sheephead 1,692 alive / 1,504 caught triangles; greenling 1,796 / 1,608. The ceiling is 2,000 triangles each. The default 55 cm / 35 cm lengths are artistic specimen choices. Root scale remains one; the shared capsule and anchors follow `lengthMeters`. Geometry/material/skeleton lifetime belongs to each model; the application-wide generated toon ramp is shared.

`tests/new-fish.test.ts` applies the existing scale, skinning, bounds, timing, caught, physics and lifetime contract to both factories. `tests/local-fish-browser.mjs` validates rendering, measured draws and animation on classic WebGL, native WebGPU and WebGL 2 fallback, plus tank navigation and phone layouts. Screenshots and source notes live in the respective `artifacts/<species>/` directories. Keyboard selection belongs to `main.ts`: it calls the same `selectCreature()` path as the dropdown, so disposal and state preservation have one owner.

## Chinook salmon

`chinook-salmon/` follows the sheephead/greenling layout: `definition.ts` (0.80 m length, profile, motion, provenance, budget), `components.ts` (ocean-phase palette, adipose fin, spotted back and both caudal lobes) and `createChinookSalmonModel.ts`. The adipose fin is weighted to the body bones rather than the dorsal bone, so it rides the tail bend. Spots are projected onto the body and tail and carry those surfaces' skin weights. Two draws in either state: 1,976 alive / 1,788 caught triangles (ceiling 2,000). `tests/chinook-salmon.test.ts` covers scale, budgets, spots and adipose placement, static buffers, fast-swim dorsal, X eyes on both sides, physics ownership, route clearance, timing and disposal. Evidence is in `artifacts/chinook-salmon/`.

## Instanced sardine school

`pacific-sardine/createSardineSchool.ts` is a separate collection constructor. Its placement/animation methods match the common fish behavior, but it deliberately has no single `physics` descriptor: the school is not one rigid fish. `takeFish(currentInstanceId)` removes an instance and returns an independently owned caught `FishModel`, ready for `bindFishPhysics()`. The returned root is in world coordinates; add it to an identity scene root or explicitly convert to another parent's local space. Uniform parent scaling is supported. Slot numbers change after removal and must not serve as persistent game IDs.

| Responsibility | Location |
| --- | --- |
| Shared six-bone poses, used by both live rig and bake | `shared/fish/pose.ts` |
| One-time bake, merged eyes/body, relative position/normal morph targets | `shared/fish/schoolGeometry.ts` |
| Schooling simulation (neighbours, steering, bending envelope, sizes, tail rates); species traits | `shared/school/schooling.ts`; `SARDINE_SCHOOLING` in `pacific-sardine/definition.ts` |
| Instanced buffers, slow/fast blend, caught batch, extraction and disposal | `pacific-sardine/createSardineSchool.ts` |
| Group selector and school-aware follow framing | `../main.ts` |
| Budgets, geometry, lifecycle, bounds, extraction and physics | `../../tests/sardine-school.test.ts` |
| Actual draw scaling, browser controls and backend checks | `../../tests/sardine-school-browser.mjs`, `../../tests/school-review.ts` |

Two eight-pose cycles are generated from the canonical sardine at creation. School pectoral flutter repeats once per tail cycle so the loop seam stays continuous. Position and normal deltas are immutable; each instance uploads a transform and 16 blend weights through Three's built-in `InstancedMesh.setMorphAt()`. Only four weights are nonzero during a slow/fast transition. Deformation uses standard morph instancing, with no per-fish skeleton, clone tree or per-frame vertex rewrite. The viewer applies the shared painted TSL lighting. Body and eyes share one indexed batch/material: 1,468 live or 1,280 caught triangles per instance, one school draw per pass.

The current Three r180 node renderer chooses a different morph source for a one-instance draw. The factory mirrors slot-zero weights into `morphTargetInfluences` and invalidates the material's cache key when crossing between one and many. Keep the browser sequence `1 → 16 → 48 → 128 → 256 → 1 → 48` when upgrading Three. Relative morphs keep the base influence consistent on both backends.

Capacity is fixed at creation (1–256); count may change from zero through capacity without rebuilding geometry or reallocating instance buffers. Growing the count keeps existing fish where they are and spawns newcomers inside the resized envelope; extraction compacts just one slot without reshuffling remaining fish. Bounds update only when membership changes; they cover the hard envelope limit, its bend, and the largest fish at any heading. `update()` never changes the root pose. The viewer's path owns school travel, while the formation owns local placement. Future independently simulated fish should leave the batch through `takeFish()`; no per-member physics solver is installed.

Each school owns two geometries, one material, two instanced matrix buffers and one weight texture. The temporary source rig is disposed after baking. `dispose()` calls `InstancedMesh.dispose()` as well as releasing geometry/materials; disposing only mesh geometry would leak instance resources. A future cross-school atlas cache needs explicit reference counting. The shared controller derives reduced levels without changing instance or morph-texture identity. Neighbour search is a spatial hash with k nearest neighbours; separation keeps fish apart, but there is no physical collision response. See the root README for byte/triangle counts, the inspection cap and target-device profiling limits.

## Habitat assets

`habitat/giantKelp.ts` builds giant kelp from verified anatomy (holdfast, stipes, a gas bladder per blade, surface canopy, growth tip) into one double-sided toon batch. Omitted variation options are randomized from a seed; omit `seed` for a new plant each call. Keep new habitat factories in `habitat/`, register inspectable ones in `props/catalogue.ts` with `random: true`, declare their ceiling in `props/dimensions.ts`, and test budgets across many seeds (see `tests/kelp.test.ts`).

## Attached habitat fauna

`habitat/batStar.ts` builds one seeded, metre-scale toon batch (814 near / 306 colony triangles; ceilings 850 / 400; one model draw). `habitat/batStarColony.ts` uses the simpler colony geometry and shares its material across instances, while independent anchor owners provide placement. `shared/surfaceAttachment.ts` converts raycast hits into local anchors and handles normals, target transforms and slow surface crawling. It leaves asset geometry static and stops at edges or sharp corners. Detach the placement owner before disposing its target; the helper does not own either asset's resources. See the root README and `artifacts/bat-star/REVIEW.md` for behavior, evidence and limits.

## Garibaldi and lingcod

`garibaldi/` and `lingcod/` follow the existing three-file species layout: `definition.ts` owns metre size, silhouette sections, motion, source and budget; `components.ts` owns palette and fin/marking geometry; `create*Model.ts` composes the shared body, face, material and rig. Register future species in `catalogue.ts` so selection and arrow navigation stay generic.

Garibaldi uses 24 × 14 body subdivisions and baked orange shading; its rounded tail lobes carry a shallow cleft. Lingcod uses 28 × 14 body subdivisions, broad anterior sections, deterministic color mottling and four batched fangs. Both use body-surface queries with inward overlap for lower/paired fin roots. Fast dorsal extension remains 94% / 92%. These are fixed authored species designs, with no stochastic geometry or regeneration option.

Both render two batches with one shared toon material and six bones. Garibaldi costs 1,456 alive / 1,268 caught triangles (ceiling 1,600); lingcod 1,652 / 1,464 (ceiling 1,800). Roots and visuals stay at scale one. The shared capsule and mouth/grip anchors scale with requested length; colliders approximate the body and omit fin detail. Physics/path placement owns the root; animation owns the rig. No species-specific viewer branches or new runtime dependencies.

`tests/new-fish.test.ts` covers both factories' scale, weights, culling bounds, static buffers, caught state, ownership, frame-rate-independent transitions and disposal. `tests/local-fish-browser.mjs` records exact renderer counts and captures all swim states on classic WebGL, native WebGPU and WebGL 2, plus keyboard and mobile controls. Current evidence is in `artifacts/garibaldi/` and `artifacts/lingcod/`.

## Green sea turtle and moon jelly

The historical `FishModel` name is the collection's swimmer interface, not a taxonomic classification. `green-sea-turtle/` separates size/budgets/pivots (`definition.ts`), anatomy composition (`components.ts`), faceted carapace and projected scute ribbons (`shell.ts`), continuous head/neck/beak (`head.ts`), closed hydrofoil sections and blended shoulder weights (`flippers.ts`) and the five-bone factory. Four independent flipper hinges share a single skinned surface draw; alive/caught eyes share one mutually exclusive draw. Shell seams are projected onto the actual faceted shell before batching. Seeded pigment variation is build-time only.

`moon-jelly/createMoonJellyModel.ts` adapts the existing bell/organ geometry in `habitat/moon-jelly/` to the creature contract. It is registered only in the Tank collection, not Objects. Both render batches share two morph weights: quick bell contraction/longer recovery and delayed oral-arm/fringe follow-through. Position and normal targets are built once; the frame loop changes only weights. Both batches retain translucency at every LOD. Caught state is a contracted, motionless bell: jelly anatomy has no eyes to replace. `measurementLabel` identifies bell diameter in the viewer.

`shared/creatureMotion.ts` owns validated modes, exponential slow/fast transitions, caught freeze, placement ownership and one-time disposal. It calls a species pose function that never changes the root. Turtle bones and jelly morphs keep vertex buffers static. Coarse capsule descriptors and anchors scale with public dimensions; no physics engine is embedded in either factory.

Turtle budgets: 1,800 triangles / two model draws (actual 1,670 alive, 1,422 caught). Jelly: 1,600 / two (actual 1,482 either state; 120.2 KiB geometry/index/target buffers). See `tests/turtle-jelly.test.ts`, `tests/turtle-jelly-browser.mjs` and `artifacts/green-sea-turtle/REVIEW.md` for evidence and artistic assumptions.

The refined jelly separates bell profile and rolled lip (`habitat/moon-jelly/bell.ts`), internal anatomy and folded appendages (`anatomy.ts`), build-time indexed strip composition (`surface.ts`), and static deformation targets/pulse sampling (`motion.ts`). `geometry.ts` composes them; both public jelly factories use the same pose sampler. See `tests/moon-jelly.test.ts`, `tests/moon-jelly-browser.mjs` and `artifacts/moon-jelly/REVIEW.md`. The optional GLB retains opacity and both morph targets; runtime motion still belongs to the procedural factory.


## Great white shark

`great-white-shark/definition.ts` owns total length, body sections, swim tuning, provenance and the 2,000-triangle/two-draw ceiling. `fins.ts` describes curved fin sections; `foil.ts` lofts them into closed tapered shells with six vertices per airfoil section, a sealed root and one tip. Dorsal, caudal and paired fins retain thickness without constant-depth plate edges. Small median fins use the shared helper. `face.ts` builds ten tapered, curved surface-ribbon gill slits, nares, a ventral U-shaped mouth and shared live/X eyes. The user-supplied October 15 oblique photograph guides the wider/flatter head, full shoulders, reduced fin proportions and lower countershading. Body sampling is 30 × 16; smooth pigment weights avoid stepped color boundaries on the coarse rings. `createGreatWhiteSharkModel({lengthMeters, seed})` composes the shared body builder, seeded girth/pigment variation, shared matte toon material and six-bone lifecycle. All variation is baked once. Source component names are retained in `root.userData.sourceParts` after batching.

The first dorsal and pectorals are fixed to the anterior body: they do not collapse or flap at fast speed. Posterior fins and the crescent tail follow the shared rear-body weights. Palette/ramp remain unchanged across quality tiers, with rim disabled on this whole batch to avoid thin-fin flashes without adding a material draw. Actual cost is 1,908 alive / 1,648 caught triangles, two visible draws, and 89,624 bytes of geometry/index storage including both eye states (excluding skeleton/driver overhead).

Default length is 4 m, baked into geometry, the capsule and mouth/grip anchors; root/visual scale stays one. The mouth anchor follows the ventral opening rather than the shared bony-fish nose default. Physics/path owns placement and animation only changes the rig. The collider is a coarse trunk proxy and deliberately omits fins. No hunting, jaws or physics engine are implemented. The UI reference span is informational and does not rescale specimens.

`tests/great-white-shark.test.ts` checks 60 seeds, finite weights, actual-body fin overlap, outward foil normals and closed shells, fixed main fins, tail movement, caught freeze, metre scaling, route clearance, physics ownership and connected export bones. `tests/great-white-shark-browser.mjs` records both backends, multi-angle swim/caught views, all quality tiers, arrows, 320 px framing, disposal and the generated six-bone GLB round trip. See `artifacts/great-white-shark/REVIEW.md`. The shared export helper uses `SkeletonUtils.clone()` so cloned skins reference bones inside the exported tree; live materials and geometry remain owned by the source model.

## Gallery visitor reference figures

`visitors/` builds the nine-person foreground crowd independently of the viewer. See its [guide](visitors/README.md) for chosen metre heights, connected silhouette geometry, one-batch skinning and the very small idle envelope. Gallery placement and floor height belong to `viewer/openSea/scenery.ts`; `createTank()` owns animation timing and disposal. These figures are scale references, not selectable fish or portraits.


## Mixed tank demonstration

The viewer's `tankDemo.ts` composes existing factories without changing their geometry or public scale. `demoPopulation.ts` declares artistic counts and habitat envelopes; `demoSchool.ts` uses the shared `createSchooling()` traits for six tuna and four blue rockfish while preserving each animal's rig. The large sardine group retains its instanced factory. Demo routes own school roots, while formation/animation owns local children. See [demo behavior and provenance](../../docs/tank-demo.md) for budgets, selected positions, sources and lifecycle.

## Giant sea bass

`giant-sea-bass/definition.ts` owns the grey adult profile, 1.5 m length, fin pivots, swim tuning and 2,200-triangle/two-draw ceiling. `components.ts` owns rounded fins and original seeded flank pigment; `face.ts` builds tapered gill ribbons and thick closed lips fitted to the actual body, plus shared normal/X eyes. `createGiantSeaBassModel({lengthMeters,seed})` composes the shared body, painted toon material and six-bone rig. The October 21 refinement uses clearer Marine Conservation Science Institute and UC Santa Barbara photographs; underside/cross sections remain inferred, rather than an exact individual reconstruction. Keep the gill-rim visibility test when editing the cheek or ribbon, since projected vertices alone do not guarantee that connecting triangles clear the body.

Body sampling is 32 × 18. Markings are baked into the body's vertex colors, avoiding overlapping spot meshes or runtime textures. Pectoral root weights stay on the head; the fan blends into its hinge. Lower fins overlap surface-query positions inside the actual body. The rigid root stays at scale one; geometry, mouth/grip anchors and the coarse capsule use metres. The body capsule deliberately omits fins. Random girth/pigment is construction-only; slow/fast motion changes bones, not vertex buffers. Caught state stops motion and shows X eyes on both sides.

Costs are **2,180 alive / 1,992 caught triangles and two model draws**. The size guide is a selected 1–2.3 m range: the lower endpoint is artistic and MBA supplies the maximum. Swim rates and route speed are artistic. Catalogue registration adds arrow navigation and shared controls; the mixed demo has one specimen on a lower/middle route. Geometry/variation/attachment tests live in `giant-sea-bass.test.ts`, the shared species contract in `new-fish.test.ts`, and renderer/mobile/export checks in `giant-sea-bass-browser.mjs`. See the review (historical authoring evidence omitted from this public snapshot) for references, costs and limitations.

## Giant Pacific octopus

`giant-pacific-octopus/definition.ts` owns the chosen 3 m extended arm-span class, arm sampling, source and 4,500-triangle/two-draw ceiling. `body.ts` builds the mantle, head, eye hoods, horizontal pupils, caught X eyes and siphon. `arms.ts` builds eight tapered arms, paired recessed suckers and the oral web. `geometry.ts` supplies seeded pigment and arm weights. The small factory composes these parts, batches them and binds `rig.ts`. `motion.ts` supplies the longer support/shorter recovery phases and rapid squeeze/slow refill timing.

This creature does not use the fish spine. Its 74 GPU bones are one head, one mantle and nine independent frames per arm. The frames follow smooth authored curves with staggered reaches, traveling bends and integrated distal coils; fast mode blends into trailing arms and stronger mantle contraction. Geometry and colors are construction-only. Eyes stay in a second, mutually exclusive alive/caught batch. Costs: **4,482 alive / 4,234 caught triangles, two draws**, including 112 stylized cups. The shared painted toon response supplies lighting; the whole model disables rim to avoid flashing thin features. No new runtime texture, shader dependency or GLB dependency.

`createGiantPacificOctopusModel({armSpanMeters,seed})` uses metres with an unscaled placement root. `lengthMeters` mirrors the arm-span field only for existing generic framing consumers; the UI identifies it as arm span. Body proportions, 0.13/0.8 Hz pose rates and 0.045/0.65 m/s route speeds are artistic. The mantle capsule and mouth/grip anchors are coarse physics integration metadata, not arm collision bodies. Rig bones never place the public root. Physics ownership suspends path placement; future contact/IK may replace the arm curves without changing the mesh or placement contract.

Catalogue motion labels are optional metadata, so Slow crawl / Jet swim revert to Slow cruise / Fast swim when switching away. `swimPath.ts` handles `crawl-jet` placement on the level tank floor and elevation into a low jet route; `demoRoute.ts` uses an asymmetric floor envelope and no banking for the crawl-only demo. The pose approximates floor contact but does not lock suckers to the world, conform to obstacles, climb arbitrary surfaces or simulate soft bodies. See the review (historical authoring evidence omitted from this public snapshot) for reference limits, measurements and browser evidence.

## Distance detail for the web world

See [LOD contract](../../docs/lod.md). `shared/lod/geometry.ts` owns attribute-aware simplification and geometry-family disposal; `shared/lod/controller.ts` owns projected-size selection, hysteresis, instance handling and counters. These modules have no DOM or renderer dependencies. Register roots after construction, await preparation, and call the controller before rendering. Factories, skeletons, shaders, root transforms and collision contracts remain canonical at all distances. LOD is client presentation, never a multiplayer identity or physics decision. New assets need all-level checks and visual evidence in both backends.


## Coastal avatars

`avatar/design.ts` defines normalized, serializable appearance and independent outfit fields. `createAvatarModel(design)` in `avatar/index.ts` returns one vertex-colored skinned mesh, an unscaled metre root facing +Z, 17 bones, attachment anchors, measured stats, `update(dt, { speed, swimming, emote, carrying, reducedMotion })` and idempotent disposal. Idle/walk/run/swim/tread/blink and wave/cheer/sit/cast poses affect visual bones only; controller placement is independent. Clothing changes rebuild a single merged batch; retain identity/placement and reattach equipment when replacing a model.

Size is part of the normalized recipe: `heightMeters` 1.20–1.80 (default 1.45), `bodyBuild` 0.80–1.25 (default 1). Missing fields retain legacy appearance. `avatar/sizing.ts` applies height uniformly and tapers body width/depth into the neck, preserving head/face/hair proportions. Bake the shape into geometry/normals and bind pivots at creation; never scale the root or external equipment. Read `model.dimensions` for collision radius, swim entry/immersion, camera target, hip and seated-contact guides. Use the seated-contact guide, not the hip pivot, to place a character on a fixed seat. Movement speed and breath stay independent of body size. All LODs retain the sized geometry and conservative animated bounds.

The avatar category ceiling is 5,000 Near triangles / one core color draw / one material / zero per-avatar image maps. All 810 appearance combinations, including optional skin-relative face lines, currently remain within 4,270 triangles. Default levels are 3,453 / 1,720 / 684 triangles. Register the root with the shared LOD controller; skin indices, weights and hand anchors survive all levels. External equipment and contact effects add their own scene cost. See [creator/runtime contract](../../docs/avatar-creator.md) for exact costs, saved recipes, controls and limitations.

### Coastal trees

`habitat/trees/createCoastalTree.ts` owns seven original static silhouettes, including three natives. Geometry is baked in metres, root scale is one, and `seed` reproduces branch/crown variation. One opaque vertex-colour batch has authored Near/Mid/Far tessellation; no alpha leaves, textures or per-frame updates. `TREE_SPECIES` feeds the Objects catalogue and size notes. The Gym/Map share these prototypes while placement reads the cached municipal inventory. See [tree dimensions, source limits and budgets](../../docs/coastal-trees.md); heights are chosen specimens, never measurements inferred from photographs or a species maximum.

`locations/pacificGroveMuseum/` is the renderer-independent museum site factory: architecture, original exhibit vignettes and native-garden study in six batches. [Source, scale and budget record](../../docs/pacific-grove-museum.md).

## Southern sea otter in Objects and Tank

`habitat/sea-otter/` owns the seeded geometry, rounded head, compact bent forelimbs and twelve-bone float/groom/prone-swim/dive motion. [`sea-otter/`](sea-otter/README.md) adapts that same model to `FishModel`, rotating its forward axis from −Z to −X, converting its coarse physics descriptors and adding a small caught-eye overlay. It does not duplicate the living geometry or own world travel. The shared viewer surface route provides Tank and Demo placement; current review (historical authoring evidence omitted from this public snapshot).
