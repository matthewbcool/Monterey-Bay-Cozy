# Aquarium interior blockout

Question: can a small procedural model preserve useful real-world scale and exhibit connectivity for the map study? The two public floors can be inspected independently and navigated using a lightweight graph. This is an original simplified model, not a survey or a copied mesh.

- `layout.ts`: source links, metre dimensions, uncertainty, tank outlines, public destinations, lift links and shortest routes.
- `createAquarium.ts`: renderer-independent geometry, palette batching and active-floor budgets. The caller owns/disposes the root's geometries and materials. Root scale stays one.
- `../../viewer/aquariumInterior/`: map placement, node-material conversion, camera framing, labels, controls and lifecycle. It uses the same renderer as the surrounding map and hides regional geometry during interior inspection.

Local coordinates: x follows Cannery Row southeast; scene z is the negative bay-facing coordinate. A rigid rotation/translation places the blockout in the map projection. The OSM outer roof ring provides the ground envelope. Its internal rings are not treated as proven floor voids; the inferred first-floor slab fills them. Floor two's slab has an opening around the Open Sea volume. The baseline elevation and 5.2 m upper floor are estimates, while geometry remains in metres.

Published measurements and inferred measurements are separately recorded on every tank. The source image supplied by the user is read-only and is not a runtime texture. The official upper-floor visitor map was also reviewed. No hidden technical room or real pipe route is inferred: the inspector's water-flow description is conceptual. The third-floor overlook, detailed stairs, exact partitions, irregular terrain and contents of tanks are omitted.

All static surfaces merge into vertex-color batches without per-component material groups. Water envelopes use a shared-per-floor transparent toon batch, not a refraction pass. There are no shadow maps, animation loops or asset textures in this experiment. With only one public floor visible, enforce 3,500 triangles / 8 mesh draws; grid, selection and route guides add 2–3 line draws. Thin rims use geometry and obey the same batch budget. Labels are DOM buttons with overlap suppression; every destination remains available in the select control.

Routes are connected public-space approximations. Tests sample every horizontal edge against tank footprints, verify vertical edges, check published scale anchors and enforce budgets. No collision solver or unrestricted first-person movement is claimed: Next/Back advances between explicit visitor waypoints. Room partitions and real accessibility have not been measured.

See review (historical authoring evidence omitted from this public snapshot) for browser evidence and limitations.
