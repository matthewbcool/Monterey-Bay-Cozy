# Graphics quality and hardware targets

Keep the game welcoming on modest hardware. Better hardware may enable richer lighting, but must not be required for readable creatures, navigation or play. WebGPU support is a capability check, not a performance rating.

## Defaults and choices

Base and Standard continue to select device pixel ratio, shadow resolution and rim lighting. Coarse-pointer devices or reported device memory of 4 GiB or less default to Base; other devices start at Standard. The existing slow-frame probe may step Standard down. Neither tier changes the shared palette, toon ramp, physics or creature identity.

The Gym starts with **Balanced water on every device** unless the player explicitly selected Enhanced previously or used `?water=enhanced`. Choose **Menu → Water graphics → Appearance**. Enhanced requires the actual native WebGPU backend; a request on WebGL 2 resolves to Balanced. Chromatic caustics and light shafts can be adjusted independently. Shafts offer Off, Balanced (12 samples) and Detailed (24 samples). Mode changes reload the view and release the previous pipeline; effect controls update live. The choice persists locally under `monterey-bay-cozy-water-effects-v1`.

| Profile | Intended audience and target, not a certification | Water cost policy |
| --- | --- | --- |
| Base + Balanced | Modest integrated-graphics laptops and midrange phones; aim for sustained 30 fps at a readable resolution | One existing ocean draw, 421 triangles, no Enhanced imports, buffers or passes |
| Standard + Balanced | Mainstream desktops/laptops; aim for 60 fps | Same lightweight Gym ocean; existing higher-resolution shadows and rim |
| Base/Standard + Enhanced | Opt-in on capable WebGPU devices; keep 60 fps where practical | Bounded HDR refraction, RGB transport, local chromatic caustics and optional half-resolution shafts |

These targets need testing on physical low-end and mobile hardware. Desktop Chrome and a phone-sized viewport do not establish mobile performance. See current review evidence (historical authoring evidence omitted from this public snapshot). If movement becomes less smooth, return to Balanced; GPU availability alone must never turn Enhanced on automatically.

## Cost ceilings and maintenance

Balanced does not load `enhancedWater/`, allocate its targets or execute its passes. Preserve this boundary when adding future effects. The historical High style tier, silhouette hulls and bloom remain retired; optional Enhanced water is a separate rendering choice authorized October 26, 2026.

Enhanced uses two HDR color/depth buffers capped at 1920 × 1080, shafts capped at 960 × 540, and one 1024² RGB caustic atlas. Their approximate maximum texture payload is **62 MiB**, including atlas mipmaps but excluding driver overhead and existing scene/shadow resources. Smaller views allocate less. The moving water patch adds 32,768 triangles in one existing water draw. The atlas adds one instanced draw / 221,184 triangles when refreshed, at most roughly 30 Hz while water time advances; camera or sun movement can force a refresh. It stops in darkness or when neither caustics nor shafts are enabled. Shafts and the output composite each add one fullscreen draw; transparency is resubmitted against water depth to preserve foreground jellyfish. Color/depth copies and GPU fill cost matter even when draw counts are small.

Keep wildlife batching, distance LOD, interest gating and simulation sleep in both modes. Aim to keep ordinary walking views below 200 submitted draws, counting shadows and output passes; investigate excursions rather than silently reducing creature population or correctness. This is a review target, not a claimed universal current limit. Report scene submissions separately from reusable-asset budgets and atlas/mesh triangles separately from per-pixel work.

For a rendering change, compare the same camera, weather, resolution, population and LOD in both modes. Record frame pacing, submissions, triangles, resource counts and GPU measurements where supported. The opt-in `?profileGPU` diagnostic enables timestamp queries; callers must resolve them promptly. A full frame needs timing around all passes, not just the last `render()` call. No normal-gameplay timestamp readbacks are enabled.

## Ownership

- [waterEffectsSettings.ts](../src/viewer/waterEffectsSettings.ts): validated preferences, capability fallback and resolution ceilings.
- [waterEffectsPanel.ts](../src/viewer/waterEffectsPanel.ts): player controls, persistence and mode reload.
- [enhancedWater/index.ts](../src/viewer/enhancedWater/index.ts): lazy GPU resources, pass order and disposal.
- [Ocean rendering guide](ocean-water.md): optics, shared waves, source attribution and current approximations.

The tank, harbor and regional whole-bay overview keep their existing renderers. Enhanced currently applies to the local Testing Gym ocean.
