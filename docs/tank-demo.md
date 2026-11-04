# Mixed tank demo

Check **Demo mode** beneath Creature in the Tank tab, or press **D** while the tank is focused. The shortcut is ignored when typing in a form control, when another tab is active, or when a modifier key is held. It widens the camera to include the complete exhibit and replaces the inspected specimen with the full collection. Uncheck it to restore the same specimen, life state, sardine group size, placement and prior camera view. Demo mode uses independent, gently drifting swim paces instead of the shared Slow/Fast/Cycle controls. Only Pause/Play remains visible; the previous single-creature speed choice returns when the demo ends. Reduced motion starts paused, and explicitly pressing Play is required to animate it.

## Population and staging

Only species listed in the explicit demo population are spawned. The full-size gray whale is in the creature collection for in-place swimming inspection but is excluded from this tank-wide scene. Its rigid root stays at the centre in single-creature Tank view because the usual closed route would carry it through the glass; its body and flukes still animate.

| Creature | Number | Demo behavior |
| --- | ---: | --- |
| Tuna | 6 | Coordinated school cruising across middle water |
| Pacific sardine | 256 | Dense, instanced school sweeping the upper/middle water |
| Blue rockfish | 4 | Small coordinated school toward the rear, below mid-height |
| Ocean sunfish | 1 | Broad middle-water loop |
| California sheephead | 3 | Lower/middle routes with separate heights and phases |
| Kelp greenling | 3 | Low, gently undulating routes |
| Chinook salmon | 3 | Broad open-water routes at different heights |
| Garibaldi | 4 | Smaller side territories, in the lower half |
| Lingcod | 2 | Separate routes close to the floor |
| Moon jelly | 4 | Very slow, smaller loops in upper water |
| Green sea turtle | 2 | Broad routes biased toward upper water |
| Great white shark | 1 | Broad middle-water cruising |
| Giant sea bass | 1 | Slow lower/middle reef-style cruising |
| Giant Pacific octopus | 1 | Slow, level crawl along the floor |
| Southern sea otter | 1 | Long surface floating/grooming, then a short dive, underwater cruise and ascent |
| **Total** | **292** | **15 species** |

Each asset keeps its factory's metre scale. Visitor silhouettes remain a common human size reference. Exact lane heights, counts, speeds, school spacing and the shared exhibit are artistic choices. This is a collection demonstration, not a reconstruction of the Aquarium's live population or a husbandry simulation. Upper-water turtle routes do not implement an actual surfacing/breathing cycle. Habitat preferences are soft staging ideas expressed as bounded route envelopes; no terrain was added to this tank.

## Evidence behind the choices

- **Tuna and sardines school:** the Aquarium's [Open Sea facts](https://storage.montereybayaquarium.org/storage/pressroom/presskit/pdf/11-open%20sea%20press%20kit.pdf) describes their tight schooling in open water. The project's tuna remains a provisional generic tuna design; these references do not newly identify its species.
- **Blue rockfish school around reef habitat:** [Hannah and Blume's drop-camera study](https://academic.oup.com/mcf/article/7/1/87/7827145) identifies blue rockfish among pelagic schooling rockfish and describes their relationship to reef structure. Rear/lower-middle placement is an artistic proxy, not a measured depth preference.
- **Lingcod live around the bottom:** the Aquarium's [lingcod profile](https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/lingcod) describes rocky reefs/ocean bottoms and solitary fish near a home base. The low routes are stylized movement rather than an ambush/territory simulation.
- **Kelp greenling are bottom/reef associated:** [California's nearshore fishery background](https://nrm.dfg.ca.gov/FileHandler.ashx?DocumentID=33920) describes bottom-dwelling species associated with kelp beds and reef structure. No precise real-world depth distribution is inferred from our tank coordinates.
- **Garibaldi use reef territories:** the Aquarium's [garibaldi profile](https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/garibaldi) describes territoriality tied to rocky reefs. The two sides of the tank stand in for separate areas.
- **Sheephead feed around kelp/rocks:** the Aquarium's [California sheephead profile](https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/california-sheephead) describes a kelp-forest animal that removes hard-shelled prey from rocks. Lower/middle cruising is a staging choice.
- **Giant sea bass cruise near reefs:** the [Aquarium profile](https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/giant-sea-bass) describes slow movement over rocky reefs, sands and ledges, with short fast bursts. The lower/middle route is an artistic staging choice.
- **Turtles need access to the surface:** the Aquarium's [green turtle profile](https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/green-turtle) confirms air breathing and use of both open-ocean and shallow coastal habitats. Upper-water bias makes this readable but does not imply that turtles always remain near the surface.

- **Giant Pacific octopus crawls and jets:** [NOAA’s Kodiak aquarium account](https://www.fisheries.noaa.gov/science-blog/view-inside-kodiak-lab-aquarium-post-4) describes both locomotion modes. The demo uses the crawl pose on a level floor route; exact speed and arm timing are authored.

## Implementation and cost

`src/viewer/demoPopulation.ts` owns counts, habitat envelopes and small-school traits. `demoRoute.ts` builds per-actor closed curves with arc-length travel and bounded turns. Conservative animation bounds reserve clearance from the glass, floor and surface. The octopus uses a floor-origin envelope with its height above the root and zero banking; other ordinary swimmers retain their symmetric clearance envelopes. The sea otter uses `seaOtterRoute.ts`, shared with single-creature Tank view: its root rests at the exact 4.5 m water plane, allowing its head and feet above the surface. Actual skinned bounds are checked over its full cycle at every LOD, with independent wall/floor clearance. Floor contact is an authored pose, without obstacle avoidance or suction simulation. The level tuna school uses its vertical extent plus maximum banking allowance, rather than treating its entire long horizontal formation as a vertical radius.

`demoSchool.ts` reuses `createSchooling()` for tuna and blue rockfish: local separation/alignment/cohesion with a shared travelling root and independently animated existing rigs. Initial staggered lanes keep bodies apart. Those small groups retain two draws per animal; the 256 sardines use their existing instanced morph factory and **one draw for the whole school**. No exported GLB or geometry changes are required.

`createTankDemo()` assigns each group a repeatable, bounded pace and varies it slowly over time. Tuna and blue-rockfish school members also receive small tail-timing differences while their formations travel together. These are artistic motion choices, not measured species swim speeds. Pause and inactive tabs freeze the timing.

`createTankDemo()` owns models, routes and cleanup. It is created on demand and fully disposed when disabled. The single inspected model stays hidden and frozen while the demo is active. Hidden tabs stop demo updates. All models receive the shared node style and tank water lighting. Every creature uses the shared distance LOD controller. The demo has no silhouette or bloom passes.

The population costs **72 nominal model draws / 449,260 triangles at Near** per color pass before culling, with a ceiling of **72 / 450,000**. Scene/water, shadows, transparent extra passes and postprocessing are excluded. The existing 256-fish school contributes 375,808 of those triangles; instancing reduces draws, not triangle work. Browser counters are recorded separately in `artifacts/tank-demo/browser-qa.json`. This is not a physical-phone performance guarantee.

The complete population occupies upper/lower, front/back and left/right water, rather than every animal taking the same central route. Schools use local separation, but different species do not yet avoid each other or hunt/feed. Adding inter-species avoidance is the clearest next behavioral experiment; the school now has reduced LOD meshes; splitting much larger schools into spatial batches remains future work.

## Verification

- `tests/tank-demo.test.ts`: explicit population coverage and gray-whale exclusion, population caps, unscaled roots, budgets, complete-loop wall/floor/surface clearance, habitat placement, school coordination, independent motion, static buffers, invalid time and disposal.
- `tests/tank-demo-browser.mjs`: native WebGPU and WebGL 2; both device settings; actual draw submissions; D/Space/touch toggles, key repeat and form focus; reduced motion, pause, independently varied demo timing and hidden speed controls; tab visibility; restoring a caught sardine school/follow camera; repeated-toggle GPU resource counts; 320/390/700/820 px layouts.
- Existing model tests, production build and tank control browser regression are also required.

Current LOD measurements are in the shared review (historical authoring evidence omitted from this public snapshot), with automatic/forced detail and actual GPU counters. Old demo artifacts retain their dated full-detail measurements.

## Sea otter surface cycle

The same procedural adult remains inspectable in Objects. The Tank adapter and path add no duplicate living geometry. The authored 100-second cycle uses 45 seconds of quiet floating, 25 seconds of grooming, 6 seconds to dive, 16 seconds of submerged swimming and 8 seconds to resurface. It spends 70% of the cycle at the surface; this is exhibition choreography, not a measured biological time budget. The head stays upright during the belly-down cruise, with front paws tucked and the large hind feet and tail driving the stroke.

Single-creature controls choose **Surface rest**, **Underwater swim** or **Natural cycle**. Changes blend depth and posture rather than teleporting. Demo always uses the natural cycle at its assigned pace. The camera follows through the waterline; a new upward-facing water plane adds two triangles to the same enclosure draw, and caustics fade off anatomy above water. Caught state freezes placement and pose and adds small X eyes. A physics owner always retains root authority.

The compact head, shortened bent forelimbs and movement references are in the [source guide](sea-otter-references.md). The current review (historical authoring evidence omitted from this public snapshot) records both backends, all LODs, exact model costs, generated exports and transition/ownership regressions. The sea otter adds **730 / 418 / 176** triangles and **one living draw**; caught X eyes add 8 triangles and one draw only while caught.
