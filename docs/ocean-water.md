# Ocean water

The local Testing Gym has **Balanced water by default** and **Enhanced water as a native-WebGPU opt-in**. Both use the same physical wave definition, weather clock, coastal terrain, creature assets and art palette. The look and optical structure take inspiration from [Minamo](https://github.com/kanaworksai-hue/minamo) and its [rendering notes](https://github.com/kanaworksai-hue/minamo/blob/main/docs/HOW_IT_WORKS.md). This is an original TypeScript/TSL implementation; no Minamo source, models or textures are bundled.

## Balanced

The coastline-clipped ocean remains one opaque draw / 421 triangles, with a 256 × 192 R8 floor-depth texture (48 KiB). It uses depth-derived blue-green color, layered filtered normals, soft sun glints, pale crests and the speed-driven rowboat wake. Its approximate underwater light window uses the sky palette. Balanced has no Enhanced HDR targets, screen-space ocean refraction, caustic atlas, ray-marched shafts or underwater composite. Both native WebGPU and WebGL 2 render this path.

[water.ts](../src/viewer/water.ts) owns the surface, scoped weather uniforms, displacement, wake and disposal. The four shared `waveNode` / `sampleWater` waves drive geometry and buoyancy. [oceanOptics.ts](../src/viewer/oceanOptics.ts) adds six warped optical wave scales, approximately 24 m to 0.5 m; these fragment normals do not change wave height or physics. [waterDepth.ts](../src/viewer/waterDepth.ts) samples the existing world floor once at construction. Terrain, colliders and boat buoyancy are unchanged by appearance settings.

## Enhanced

Choose **Menu → Water graphics → Enhanced**. The optional owner is lazy-loaded only after checking the actual renderer backend. See [device policy and cost ceilings](graphics-quality.md).

- [medium.ts](../src/viewer/enhancedWater/medium.ts) applies per-channel Beer–Lambert extinction and a closed-form single-scattering integral along the camera ray. Direct sunlight uses a forward scattering phase function; sky fill is separate. Absorption coefficients `(0.42, 0.065, 0.025)` and scattering `(0.020, 0.030, 0.045)` are a clear coastal artistic preset inspired by the reference, **not measured Monterey water properties**.
- [caustics.ts](../src/viewer/enhancedWater/caustics.ts) refracts the shared physical waves at three indices of refraction, then uses the ratio of source/projected triangle areas to focus an RGB atlas. Shared styled submerged surfaces sample it in world space, with depth attenuation and normal-facing response. Creature, rock and terrain materials receive it without extra receiver meshes or draws.
- [index.ts](../src/viewer/enhancedWater/index.ts) captures scene color/depth, renders the water against that backdrop, preserves foreground transparents, then integrates underwater transport. Optional shafts march 12 or 24 samples through the local caustic field at half resolution, followed by depth-aware upsampling. They stop above water and at night.
- Each output pixel reconstructs a point on the camera near plane and compares its world height against **the same `waveNode` function, time, chop and origin used by the water mesh**. The water material and underwater composite use this same mask. CPU buoyancy uses its numerical twin. This avoids a whole-screen switch based only on camera height.
- The surface refracts the actual shared procedural weather sky, including clouds, sun, moon and stars, into Snell's window. Total internal reflection outside the window uses an approximate water-body color. The sky generator is reused as a function; it has no duplicate weather clock or independently placed sun.
- [surfaceGeometry.ts](../src/viewer/enhancedWater/surfaceGeometry.ts) appends a camera-local 16 m wave patch with 12.5 cm spacing, sharing the existing water draw. The grid uploads once and moves through a snapped uniform. Its authored LODs retain the same resolution to keep waterline behavior stable.

## Current approximations

This is a bounded rendering experiment, not feature parity with Minamo or a fluid simulation. There is no FFT ocean. Screen-space refraction can sample only captured visible content; nearby boats/buildings are not reflected in the sky reflection. Total internal reflection does not trace submerged objects. The caustic atlas covers a camera-local 20 m square, projects to a representative 4 m depth and adjusts/softens sampling for receiver depth; outside it the field fades to neutral. It is not an exact arbitrary-receiver ray trace, and overhangs do not occlude the added caustic light or shafts. Transparent creatures retain their foreground visibility but the volume integral uses opaque depth, so their exact optical path is approximate. Foreground resubmission can increase transparency density where the water surface did not overwrite the original capture.

Near-plane classification is analytic; the visible water mesh is triangulated. Small intersection/patch-boundary differences can remain at grazing angles. The near patch is covered by terrain depth on land rather than separately clipped to the shore. Keep shoreline, submerged camera and jellyfish fixtures in visual reviews. Harbor, aquarium tank and regional overview renderers are separate and unchanged by this setting.

## Verification

`water-optics.test.ts` covers bounded depth fields and scoped weather uniforms. `water-effects-settings.test.ts` covers opt-in/fallback, render-target ceilings, patch LOD and material ownership. `enhanced-water-browser.mjs` checks native WebGPU, WebGL fallback isolation, actual effect toggles, a CPU/GPU per-pixel waterline comparison, day/night, pause, phone layout and render costs. `water-optics-browser.mjs` checks the Balanced ocean on both backends and device settings, including wake, rain, night and reduced motion.

See Enhanced review (historical authoring evidence omitted from this public snapshot) and the earlier Balanced review (historical authoring evidence omitted from this public snapshot). The older `ocean-look-browser.mjs` expects the superseded 800-triangle rectangle and is historical.
