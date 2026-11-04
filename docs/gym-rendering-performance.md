# Testing Gym rendering cost

The diagnostics panel reports actual scene submissions, including shadows. Model counts in the asset register describe one color pass before culling. Lowering triangles through LOD does not necessarily reduce draws; a small mesh still costs a submission in every shadow map that includes it.

## October 26 shadow-caster optimization

The three blended sun cascades solved the visible shadow-distance cutoff, but their rectangular light-space volumes also included many objects that could not shadow the camera's view. In the controlled walking view, the previous path submitted 210 draws; conservative caster culling reduces this to 62. No population, shadow resolution, distance coverage or model detail was reduced.

| Controlled view, Standard | Unculled reference | Optimized | Reduction |
| --- | ---: | ---: | ---: |
| Arrival | 176 | 89 | 49% |
| Walking across park | 210 | 62 | 70% |
| Flight | 224 | 110 | 51% |
| Park overview | 237 | 157 | 34% |
| Reef inspection | 246 | 139 | 43% |

These are same-scene A/B comparisons on Chrome WebGPU and WebGL 2 with automatic geometry LOD, clear 13:00 Pacific preview, frozen animation, a 1280×900 viewport and the whale sighting enabled. Visible pixels match exactly in these fixtures. They are not universal frame costs: camera, sun angle, weather, active animals and viewport change the work. A low-angle evening view still costs 219 draws instead of 311 because long shadows legitimately reach more of the view. Base, portrait resizing and returning camera views are also covered; measurements and screenshots (historical authoring evidence omitted from this public snapshot).

## Ownership and correctness

`src/viewer/shadowCasters.ts` builds three conservative receiver frusta, including cascade fade overlap and a filter/bias margin. Each visible caster's world bounds are swept in the light direction down to the lowest visible receiving geometry. The test retains an offscreen tree whenever its shadow could enter the view. It rejects only casters whose swept bounds cannot reach that cascade's receivers; Three then performs its ordinary light-camera culling.

The Gym reserves **layers 1, 2 and 3** for these shadow submissions. Layer 0 remains the normal color view. Keep those bits reserved when adding another rendering layer. Other layer bits are preserved, removed actors are released from the bounds cache, and disposal restores previous bits. Color visibility, geometry, physics and animal motion are independent of this policy. Bounds must conservatively cover custom vertex displacement and animated poses, as required for ordinary view culling too. The receiver-floor margin is two metres; effects that displace receiving geometry further need an explicit expanded bound.

`sunShadows.ts` owns the culler and updates it after camera/weather fitting. It retains all three shadow maps, per-frame updates, texel stabilization, bias and blending. Five render passes remain: three shadows, scene color and output. Savings come from fewer submissions within those passes, not from hiding their counters or letting shadows become stale.

In one local live-WebGPU check over 120 rendered frames, the culling work averaged 0.095 ms with a 0.20 ms 95th percentile. This is CPU timing in a local automated browser, not GPU timing, a hardware benchmark or a mobile frame-rate promise.

## Wildlife generation and growth

The current scene already shares geometry and instances repeated populations: all six monarchs use one draw, eighteen airborne gulls use three spatial cells, each sardine school uses one draw and each kelp bed uses one draw with shared prototypes. Nearby interactive ground gulls retain individual rigs for walking and escape behavior. Reef/coastal/gull interest management stops or hides distant activity; individual asset animation and physics remain separate.

For larger populations, extend the existing instanced factories in bounded spatial cells, reuse immutable geometry/materials, retain stable host-owned identities, and sleep distant simulation. Avoid one model factory or skeleton per background animal. Keep interactive actors independent where behavior requires it. Measure actual color and shadow submissions before deciding whether additional batching, lazy generation or a worker is useful; none of those new systems is introduced by this pass.

## Verification

- `tests/shadow-casters.test.ts`: offscreen casters that shadow the view, away-facing and too-short shadows, deterministic sampled sweep checks, both clip-space conventions, layers and replaced-actor cleanup.
- `tests/sun-shadows.test.ts`: full frustum coverage, projection changes, stabilization, weather and map disposal.
- `tests/gym-render-cost-browser.mjs`: actual backend submissions by owner/pass, same-scene unculled reference and visible-pixel equality. `PHASE` names outputs; `BACKENDS`, `QUALITY`, `SWEEP` and `VIEWS` choose fixtures. Browser waits for GPU submission completion before pixel readback.
- Existing wildlife tests continue to enforce budgets, scale, instancing, seeds, motion, interest and disposal.

Safari, Firefox and physical phones remain unverified. Asset budgets and generated exports are unchanged because this is a viewer submission policy.
