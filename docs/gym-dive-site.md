# Testing Gym dive site and dive boat

The Testing Gym has a small kelp-forest dive site off Lovers Point's pier: a temperate **rocky reef** of granite boulders under giant kelp, like Monterey Bay's nearshore reefs. There is no coral; Monterey has no coral reefs. The site is populated only from the shared asset library, and a drivable dive boat takes you there. Open `?tab=gym`, walk to the end of the pier and **Board the dive boat**. Drive out with **W/S** and **A/D** (**Shift** for faster, controller **left stick** and **B**), **Put on scuba gear** and **Dive in**.

## Dive boat

The library **Marigold cabin boat** (`createCabinBoat()`, 5.52 × 2.40 m) is moored off the end of the mapped pier route. On deck, WASD or the stick drives it through the same kinematic controller as the rowboat (`src/viewer/testingGym/boatController.ts`), with its own hull test points, berth and tuning:

- **Speeds:** cruise 3.4 m/s, fast 5.5 m/s, reverse 1.3 m/s, with a wider turn than the rowboat. These are game choices, not a boat specification.
- **Collision:** the hull is sampled against the mapped coast and land, the bounded water and the rowboat's moving hull. The rowboat in turn avoids the dive boat. The water shader's single wake follows whichever boat is moving faster.
- **Swimmer collision:** circles along the keel follow the boat wherever it is driven, so swimmers and divers cannot pass through the hull.
- **Diving off:** **Dive in** drops you off the starboard side wherever the boat is; swim near the starboard ladder for **Climb aboard**.
- **Stepping ashore:** **Step onto the pier** appears only near the mooring. **Back to start**, loading a character or leaving the gym returns both character and boat to the pier.

## Rocky reef and kelp-forest community

`src/viewer/testingGym/reef.ts` composes library assets around a centre about 18 m beyond the mooring along the pier axis, on the gym's [survey-backed seabed](bathymetry.md), with authored shoreline joins and reef boulders:

| Group | Library source | Count | Notes |
| --- | --- | ---: | --- |
| Giant kelp | `createGiantKelp()` | 24 | Three seeded two-frond plants, eight instances each; holdfasts on the sand, mature fronds reach just above the water and spread a 2 m floating canopy visible from boats; surge sway |
| Granite boulders | Reef module (seeded, one instanced batch) | 9 | Also lift the swim floor so divers glide over them |
| Bat stars | `createBatStarColony()` | 10 | Attached to raycast contact points on boulder tops; existing crawl rules |
| Purple urchins | `createUrchinColony()` | 4 | Attached and crawling the same way |
| Giant green anemones | `createAnemoneBed('giant-green')` | 8 | New library asset, below |
| Aggregating anemones | `createAnemoneBed('aggregating')` | 16 | Pink-tipped clonal variant |
| Blue rockfish | `fishCollection` + `createDemoSchool()` | 5 (school) | Mid-water above the boulders |
| Kelp greenling | `fishCollection` | 2 | Low, close to the reef |
| California sheephead | `fishCollection` | 1 | Near the boulders |
| Lingcod | `fishCollection` | 1 | Just above the seabed |
| Pacific sardines | `createSardineSchool()` | 16 (one draw) | Wide loop near the surface |
| Moon jellies | `createMoonJelly()` | 3 | Slow drift; bells stay upright |

These are Monterey Bay kelp-forest residents. Counts, placement and routes are artistic staging, not survey abundance. Garibaldi is in the library but left out, because it is a Southern California reef fish. Fish follow seeded closed loops between the seabed and the surface, oriented with the same convention as the tank routes (head along −X). Kelp sways in a gentle surge: a vertex-shader offset that grows toward the frond tips, horizontal only so canopies stay on the surface, with a per-plant phase (no buffer uploads; frozen under reduced motion). Sway height uses the original plant geometry, independent of the seabed elevation, and CPU culling bounds include the 0.48 m maximum displacement. Fish do not avoid kelp or each other; animation and placement stay separate, so a future physics or AI owner can take over each root.

## Anemone library assets

`src/models/habitat/anemone/` supplies both species:

- **Species:** giant green (*Anthopleura xanthogrammica*, 14 cm disc) and aggregating (*A. elegantissima*, 5 cm disc).
- **Geometry:** the photo-refined giant green has a stout column, shallow ribbed disk, recessed mouth and three crown rows. Objects uses 1,984 Near triangles; reef beds use 388 / 352 / 190 Near/Mid/Far per animal. One draw per species bed, no added textures or frame updates. Aggregating remains 202 Near triangles. The eight giant-green animals add 1,488 Near triangles compared with the original bed; the reef remains inside its existing 80,000-triangle ceiling for the tested seeds.
- **Factories:** `createAnemone()` is the inspectable factory (in **Objects**). `createAnemoneBed()` is a static instanced bed, one draw per species with matrices uploaded once.
- **Provenance:** the giant-green oral disk (14 cm), column (5.5 cm), crown count and colors are authored; the supplied photos have no scale. The Aquarium crown reference (up to 17.8 cm) was checked October 25. Aggregating dimensions remain provisional. Both species are static; no tentacle sway or contraction is implemented. See the anemone review (historical authoring evidence omitted from this public snapshot).

## Shared underwater light (caustics)

Everything under the gym's water shares one caustic pattern from the style layer (`causticNode()` in `src/viewer/nodeStyle.ts`). That covers the seabed, boulders, kelp, anemones, sea stars, urchins, fish and the diving avatar, so the whole scene reads with one consistent look instead of each asset lighting itself.

- **Pattern:** it reuses the Open Sea exhibit's procedural cell field (`openSea/caustics.ts`: one seeded 256 KiB texture, no image downloads) and its warp and drift, so the exhibit and the gym match. A single web is drawn; the second sample only varies its brightness, because adding it as a second network read as a doubled layer on the broad seabed.
- **Projection:** the pattern is projected in world space, offset with depth as refracted light would be.
- **Masking:** it applies only below the water surface and fades with depth, strongest on upward-facing surfaces. Land is unaffected.
- **Weather:** direct-sun illumination is `sunUp × (1 − cloud)² × (1 − haze)`, separate from the key-light tint. Caustics turn off at night and in thick coastal fog; overcast leaves only a faint trace. Preview controls use the same path as live conditions. Translucent tissue receives 20% of the opaque-surface response.
- **Opt-in:** an environment opts in with `environment.caustics.enabled = true` before styling. The gym does this for its weather environment and sets `caustics.level` to the water surface when the gym loads. Set `caustics.illumination` to the available direct light (default zero); the weather system owns this value in the gym. Leaving the gym resets it to zero so caustics do not leak into the creator. The environment releases its generated field on teardown. Other viewers (tank, Map Study, Objects) compile exactly as before.
- **Cost:** two texture samples per styled pixel in the gym, with no extra draws, meshes or per-frame uploads. The October 23 underwater check at the reef submitted 28 draws on both backends.
- **Reduced motion:** the pattern holds still instead of drifting.
- **Not physics:** this is an artistic approximation, not a light-transport simulation. Strength (0.34) and depth falloff are tunable uniforms; sides of fish, kelp and rock receive only a trace (10%).

## Budget and interest management

The reef is a separate root beside the park, with its own ceiling of **44 draws / 80,000 Near triangles**. It currently measures **42 / 78,466** with seed 6256. Three fixed 5.06 m kelp prototypes are scaled per instance to the actual depth; deeper water does not generate more blade geometry. Doubling kelp from 12 to 24 plants uses three leaner two-frond prototypes, preserving three kelp draws and reducing total reef geometry by 1,264 triangles. Most of the cost is fish (each 1,500–2,200 triangles in three meshes) and the urchins and sardines.

- **Interest management:** the reef is hidden and its simulation stops while the player is more than **85 m** away in plan view, which covers most of the park. Near the spawn lawn it costs nothing.
- **Measured view:** in the October 23 browser check, the underwater view at the reef submitted 32–34 draws and about 75,000 triangles in total, with culling and distance LOD.
- **Earlier fixed-view comparison:** the reef refresh review (historical authoring evidence omitted from this public snapshot) records Near/Far/Auto reef geometry, whole-scene renderer submissions and screenshots from underwater and the surface on both graphics backends. Its camera and clear-weather preview differ from the earlier dive-boat check above, so the two whole-scene counts should not be compared as a before/after performance claim.
- **Current verification:** the October 25 anemone review (historical authoring evidence omitted from this public snapshot) records the refined models and reruns all four detail modes, actual underwater fog, jelly ordering and weather caustics on both backends. The underwater fixes review (historical authoring evidence omitted from this public snapshot) preserves the earlier optics changes. The open ocean without refraction is opaque, so it writes depth before translucent jelly tissue; refracting harbor water and the tank retain their existing passes.
- **Reduced motion:** fish loops freeze; the attached animals keep their imperceptible crawl.
- **Static park allowance:** 36 draws / 64,000 triangles. The later ambient monarch addition (historical authoring evidence omitted from this public snapshot) adds a separate 5,472-triangle wildlife allowance while keeping the combined 36-draw ceiling.

## Verification and limits

`tests/gym-reef.test.ts` checks the anemone budget, seeding and disposal, the reef budget and species, swimming and freezing, interest management, boulder floors, converted rock/kelp material teardown, and dive-boat travel, coast stops, moving hull colliders and reset. The kelp and rock node materials are released when the reef is disposed, including after node-style conversion. `tests/gym-reef-browser.mjs` checks 24 kelp, Near/Mid/Far/Auto, renderer counters, daylight/cloud/fog/night caustic levels, and jelly tissue visibility against water on both backends. Its negative control reproduces the former transparent-water ordering and confirms that it erased the tissue. Browser checks covered driving, diving, the reef view and both renderer backends in desktop Chrome. Physical phones and controllers have not been tested.

Remaining gaps:
- Collision with boulders is a floor lift only; there is no rock side collision.
- There is no fishing or catching at the reef.
- There is no sea otter or other mammal in the library.

The [additional coastal habitat](coastal-life.md) adds 120 kelp plants and 54 animals outside this reef assembly. Its budget and 210 m interest radius are separate; the original reef composition and 85 m radius remain unchanged.

The [Gym gray-whale pod](gym-whale-pod.md) is another separate offshore owner. Its surface route, spouts and breaches do not change this underwater reef budget or the Tank Demo population.
