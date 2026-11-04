# Gallery visitor scale references

`createGalleryVisitors()` returns an unscaled metre-space root, one `SkinnedMesh`, nine named reference anchors, a skeleton, `update(elapsedSeconds)` and idempotent `dispose()`. The geometry is procedural TypeScript, with no runtime textures or GLB dependency.

- `definition.ts`: nine heights, spacing fractions, yaw, body width, pose and backpack choices. Heights are intentional reference dimensions, not population statistics or measurements from the aquarium photograph. Adults: 1.82, 1.68, 1.80, 1.58, 1.85, 1.72 and 1.65 m. Children: 1.20 and 1.30 m.
- `geometry.ts`: a shaped jacket torso, overlapping neck/head, continuous sleeve/trouser rings, hands and shoes. The child head proportions differ from adults. Every figure extends from Y=0 to its exact chosen height at rest. `visitorId` retains build-time attribution for geometry validation.
- `createGalleryVisitors.ts`: bake placement into one indexed mesh. One fixed bone holds all feet and legs; each person gets spine, head and right-arm controls (28 bones total). Geometry and skin attributes never change during playback. The shared toon material opts out of the rim layer.

Idle is driven by absolute simulation time, with different phases/periods per person. Gentle posture sway takes roughly 19–29 seconds, head turns 29–39 seconds, hand drift 21–28 seconds, and small breathing movement 6.5–8 seconds. These are artistic choices. Maximum sampled height drift is tested below 5 mm; all vertex motion stays within 2.5 cm of rest and shoes remain fixed. Repeated, backwards or invalid elapsed times do not advance the pose. The host pauses by not advancing its clock.

`viewer/openSea/scenery.ts` places the feet on the gallery floor and approximately 1.1–1.5 m from the window. `viewer/tank.ts` updates the crowd with water time and disposes it before the other gallery meshes. Follow fish hides the entire gallery. The small height caption in Whole tank follows the same visibility rule. Perspective is not a metric ruler: fish farther into the tank look smaller.

Budget: 2,682 triangles / one draw for all nine people, enforced ceiling 2,800 / one. Total tank scenery: 2,776 triangles / four draws. No shadow-map caster, extra hull, texture or per-person draw is added. Dispose through the crowd handle so the skeleton/bone texture and the current material's node-conversion owner are released once.

Verification: `tests/gallery-visitors.test.ts` and `tests/gallery-visitors-browser.mjs`; visual evidence in `artifacts/gallery-visitors/`. Close-up anatomy remains deliberately simple; the figures are intended to be read as silhouettes at the window distance.
