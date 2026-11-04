# Testing Gym loading and performance

The Gym shows a preparation screen on its first visit, then a collapsible **Performance** panel in the lower-right corner. Open the [shared Gym preview](http://127.0.0.1:5191/?tab=gym). On phones the panel starts collapsed and sits above the movement buttons; its summary works with touch and keyboard.

## Reading the panel

| Indicator | Meaning |
| --- | --- |
| FPS | Rendered frames divided by elapsed time over a roughly one-second window |
| Frame avg | Average interval between rendered frames, in milliseconds |
| Variation (σ) | Population standard deviation of those intervals, in milliseconds; smaller means steadier frame pacing |
| Worst frame | Longest interval in the window, including stalls |
| CPU work | Average wall time spent updating the world and submitting its frame; this is not GPU execution time |
| Draw calls / triangles | Submissions in the latest measured frame, including shadow and output work; these are scene counts, separate from individual model budgets |
| Textures / geometry | Renderer resource counts, not memory usage in bytes or download size |
| Render passes | Renderer render invocations in that frame, including nested passes |
| Footer | Actual WebGPU/WebGL 2 backend, drawing-buffer dimensions, pixel ratio and selected LOD mode |

“Variation” is expressed as standard deviation rather than statistical variance (which would have squared-millisecond units). Timing uses raw rendered-frame intervals, independently of the simulation's clamped time step. Switching tabs or resuming a hidden document starts a fresh sample, excluding inactive time. The draw and resource counts are a single frame sampled when the timing window completes, not one-second averages.

The panel uses the existing animation loop, a constant-space accumulator and one DOM update per window. It adds no scene meshes, materials, textures, GPU queries or extra rendering loop. Renderer counters are reset once immediately before each frame so shadow work accumulates with the main view. Diagnostic snapshots are also exposed through the existing workbench inspection API.

## Loading behavior

The lightweight screen appears before the lazy character workbench downloads. It announces real stages: loading the park module, building Lovers Point and wildlife, preparing the regional bay, detail levels and the first view. Small yields give the browser an opportunity to paint between synchronous construction stages. The progress bar is indeterminate: these procedural assets do not have a reliable total-byte progress value.

Gym controls remain inert during preparation. The screen leaves only after the first Gym render; subsequent visits reuse the scene. Other application tabs remain available while loading. Failed asset or graphics initialization shows an error and a **Reload page** button instead of an endless progress indicator. Reloading restarts the page and discards unsaved work, following the browser's usual reload behavior.

Live weather is optional and does not gate readiness. Large procedural construction steps can still briefly block the main thread; this UI does not move them into a worker or reduce asset construction time. The reduced-motion presentation uses a static progress treatment.

The [Gym rendering audit](gym-rendering-performance.md) separates visible meshes from repeated shadow submissions and records the current caster-culling optimization. Draw counts vary with camera and sun direction; a count above 200 alone does not identify wildlife as the cause.

## Ownership and verification

- `src/main.ts`: early lazy-import screen and module-load failure.
- `src/viewer/gymLoading.ts` / `gymDiagnostics.css`: shared loading state and appearance.
- `src/viewer/frameMetrics.ts` / `gymDiagnostics.ts`: pure timing accumulator and DOM panel.
- `src/viewer/avatarWorkbench.ts`: staged initialization, first-frame readiness, counters and lifecycle.
- `tests/frame-metrics.test.ts`: cadence, variation, long stalls, reset and invalid timestamps.
- `tests/gym-diagnostics-browser.mjs`: delayed loading, first-frame dismissal, both renderer backends, tab switching, keyboard, touch and failure recovery UI.

See the dated verification record (historical authoring evidence omitted from this public snapshot). Browser captures are functional evidence, not representative hardware benchmarks. Safari, Firefox and physical mobile devices require separate checks.
