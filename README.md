# Monterey Bay Cozy

**Think Google Maps meets a cozy multiplayer game, curated by neighbors to help you discover your community and build relationships—without ads or paid placement.**

Monterey Bay Cozy is a community project based in the **Monterey Bay Tech Discord server**. The vision is a welcoming web game where people in and around Monterey Bay can explore together, share local knowledge and get to know one another. Fishing and a cozy world give neighbors a reason to spend time together; local relationships are the purpose.

We want to help people discover parks, museums, city services and community resources they may not know exist, and learn about the area's plants, animals and marine life. Recommendations should come from people's local knowledge, experience and care for their community. The intended experience puts community usefulness ahead of commercial interests: no advertising, paid rankings or sponsored placement driving what people discover.

Players and supporters should also be able to help shape the world. A reference photo, a favorite park, a corrected species detail, an accessibility observation or a conversation can be a meaningful contribution. AI tools are one way to help turn those contributions into a shared, playable experience.

## How this aligns with Monterey Bay Tech's charter

Monterey Bay Tech brings together people passionate about technology in and around the Monterey Bay area. Its charter says: **“technology is for everyone and should put people first.”** It welcomes seasoned professionals, students, beginners and people who simply love technology into an inclusive, supportive space for learning, innovation and sharing.

The charter's principles guide the project in practical ways:

| Charter principle | What it means for this project |
| --- | --- |
| Put people first | Build around local discovery, friendships and shared experiences; choose recommendations for community value rather than commercial placement. |
| Technology is for everyone | Welcome developers and non-developers. Local knowledge, creative ideas, research, feedback and accessibility observations matter alongside code. |
| Be inclusive and supportive | Make participation approachable across experience levels, with helpful feedback, contributor credit and an inviting game that aims to work on modest hardware. |
| Encourage learning and innovation | Learn about Monterey Bay's places and ecology while experimenting together with web games, AI, art and software development. |
| Share work, ideas and knowledge | Use the Monterey Bay Tech Discord server to exchange ideas, show experiments, find collaborators and improve a shared world. Contributors can use the AI tools that suit them. |

These are design and participation commitments. Multiplayer, community-curated recommendations and an integrated contribution workflow remain goals; the current prototype establishes the world and assets on which to test them.

## License and public release

The project's original code and project-authored documentation are available under the [MIT License](LICENSE): you may use, modify, share and build on them, including commercially, while preserving the license notice. The no-advertising vision describes how this community project operates; it does not restrict others' rights under MIT. Third-party code and public datasets retain their own terms; see [third-party notices](THIRD_PARTY_NOTICES.md).

This is a fresh public source snapshot. Private authoring history, captured reference photos, third-party game screenshots, comparison images, recordings and old logs are excluded. Source links and data attribution remain. See [public release scope and verification](docs/public-release.md).

## Current prototype

An asset collection and browser workbench built with TypeScript and Three.js for a cozy Monterey Bay community world. **The current phase is models and assets:** create a reusable fish collection and supporting game assets, then refine their shape, materials, scale, animation, browser performance, and compatibility across browsers and devices. The fish collection contains a cel-shaded procedural tuna reconstructed from a supplied photograph, plus a Pacific sardine, a blue rockfish, an ocean sunfish, a California sheephead, a kelp greenling, a Chinook salmon, a garibaldi, a lingcod, a great white shark and a giant sea bass, plus a moon jelly, green sea turtle and Giant Pacific octopus using the same creature controls, plus a full-size gray whale for in-place inspection. The long-term goal is a multiplayer community world with fishing and local exploration that its players and supporters can help build together using AI tools. That comes after the asset foundation is working.

## Shared project and current status

Clone [matthewbcool/Monterey-Bay-Cozy](https://github.com/matthewbcool/Monterey-Bay-Cozy) and work in that checkout on `main`. Start the local preview with `npm install` and `npm run dev`, then open [http://127.0.0.1:5191/](http://127.0.0.1:5191/). See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow.

For maintenance, start with the [documentation map](docs/README.md) and [codebase guide](docs/codebase.md), then the [viewer](src/viewer/README.md), [model](src/models/README.md), [data](src/data/README.md), [test](tests/README.md) or [script](scripts/README.md) guide for the area you are changing. The root README describes current behavior; `src/models/README.md` describes the authoring contract. Dated experiment sections and artifact reviews preserve earlier measurements. Their historical counts and limitations should not be read as the current project status.



The final October 23 integration check (historical authoring evidence omitted from this public snapshot) covers the bundled monarch assets and gym wildlife, avatar controls, dive site, neighbourhood and live sky/weather.


The current Gym also has a drivable dive boat and a small rocky-reef dive site off the pier. Twenty-four instanced giant-kelp plants form a surface canopy and sway gently; boulders host attached sea stars, urchins and two library anemone species, with local fish and jelly routes above them. The reef is a separately budgeted scene root that sleeps beyond 85 m. Shared underwater caustics form one web, respond to sunlight/cloud/fog and turn off at night. The open ocean renders before translucent jellyfish so their oral tissue remains visible. See the [dive-site composition and controls](docs/gym-dive-site.md) and current underwater fixes, LOD and renderer capture (historical authoring evidence omitted from this public snapshot).

## Visual previews

Run the local browser workbench to explore the scenes and creatures. Source photographs and historical captures are excluded from this public source release; selected project-rendered PR review screenshots are documented with their reproduction settings. Browser tests can generate fresh local screenshots; see [public release scope](docs/public-release.md).

## Object catalog coverage

The [rideable pedal surrey and Lovers Point photo study](docs/lovers-point-surrey.md) add a Vehicles entry, animated driving in the Gym, and shared pier/building refinements in Map Study. Use **Gym → Menu → Ride a surrey**, then **E** to board.

Objects now groups **34 entries by category**, including **Furniture**: the cypress bench, green litter bin, café chair, round table and parasol. The reef’s aggregating anemone and a southern sea otter are also available under Habitat. The otter has Floating, Swimming, Grooming and Diving poses with shared distance LOD, plus a Tank route that spends most of its cycle resting and grooming at the surface. The [asset catalog audit](docs/asset-catalog-audit.md) records remaining scene-only furniture, recreation equipment, building components and retired work so they are not lost.

## Current exhibit and creature collection

The Tank has **16 selectable creatures**: eleven fish, a moon jelly, a green sea turtle, a Giant Pacific octopus, a gray whale and a southern sea otter. The otter has **Surface rest / Underwater swim / Natural cycle** controls; its authored 100-second cycle spends 70 seconds floating or grooming, with shorter dives, submerged cruises and surfacing transitions. Its head and forearms are refined from underwater references; current review (historical authoring evidence omitted from this public snapshot). The jelly and turtle use the same selector, arrow navigation, slow/fast playback, follow camera, caught state and physics placement contract. The octopus has **Slow crawl / Jet swim** controls, independent curling arms, a pulsing mantle, a floor route and caught X eyes. Its arm-span guide is separate from fish length. See the octopus review (historical authoring evidence omitted from this public snapshot). A sardine school remains available through the sardine's Group control. The widened Tank panel keeps Creature, Demo mode, State, size and model details, and the **Whole tank / Follow fish** switcher together; State sits below the camera switcher, and the controls stack above the details on phones. **Demo mode**, beneath Creature (keyboard shortcut **D**), adds the tank-sized population: **292 creatures across 15 species**, including **six schooling tuna, 256 instanced sardines, one great white, two turtles and one surface-resting sea otter**. The full-size gray whale stays in the individual selector for in-place swimming inspection and is excluded from Demo mode; a 12 m animal cannot turn within this tank. Species use different height/depth areas; open-water routes span the exhibit, while bottom dwellers remain low and garibaldi use smaller side territories. Demo animals move at independently varied, gently drifting paces; the global Slow/Fast/Cycle controls give way to Pause/Play until Demo mode ends. See [demo behavior, counts and sources](docs/tank-demo.md).

The Open Sea window has a blue-green water volume, a rippling surface underside, animated caustics and visitor silhouettes. Light patterns reach the selected creature, while absorption depends on the distance through water; the gallery stays dry. **With Demo mode off, only the selected creature or selected school occupies the tank.** Turning it off restores the previous specimen, life state, group size and view. The demo uses the current procedural creature factories; older decorative fish, ray/turtle stand-ins, resident jellies, urchins, sea stars and their side ledge remain removed. Urchins and sea stars remain inspectable in Objects and are attached to seabed rocks in Area & buildings. The sourced window width is 27.432 m; height/depth and composition are artistic approximations.

The turtle is a stylized 1.15 m green sea turtle with a low, tapered shell, continuous beaked head, shaped flippers with blended shoulders, five-bone propulsion and X eyes when caught. Its shell measures 90.85 cm. The 25 cm moon jelly has a scalloped translucent bell, broad horseshoe organs, branching canals, folded oral arms and a short fringe. A quick contraction eases into a slower recovery, with delayed soft-tissue motion; caught mode contracts its bell and stops motion without adding fictional eyes. Swim and pulse speeds are animation choices, not measured species averages.

| Asset | Model triangles | Model draws |
| --- | ---: | ---: |
| Great white shark, alive / caught | 1,908 / 1,648 | 2 |
| Giant sea bass, alive / caught | 2,180 / 1,992 | 2 |
| Green sea turtle, alive / caught | 1,670 / 1,422 | 2 |
| Moon jelly, either state | 1,482 | 2 |
| Purple sea urchin (Area / Objects) | 1,818 | 1 |
| Tank scenery, excluding creatures | 2,776 | 4 |
| Demo population, excluding scenery | 448,530 | 71 |

The October 21 giant sea bass refinement (historical authoring evidence omitted from this public snapshot) uses clearer full-body and head references, with a longer sloping forehead, heavier jaw, broader tail, elongated pectorals and softer grey markings. The review records the sources, before/after comparison and both-backend checks.

The October 15 moon jelly refinement (historical authoring evidence omitted from this public snapshot) records the current jelly geometry, two static position/normal morphs, transparency and regenerated GLB. Shadow and output passes are additional; these are LOD 0 geometry counts. See turtle and jelly review (historical authoring evidence omitted from this public snapshot), dated jelly counters (historical authoring evidence omitted from this public snapshot), turtle counters (historical authoring evidence omitted from this public snapshot) and [habitat authoring notes](src/models/habitat/README.md). Historical measurements below describe their dated scenes.

## Monterey Bay map study

**[Map study](http://127.0.0.1:5191/?tab=map)** now opens across the whole bay: **37.5 × 53.4 km**, covering Santa Cruz, Capitola, Aptos, Moss Landing, Marina, Seaside, Monterey and Pacific Grove. **Explore the bay** and clickable place labels provide 12 shortcuts; **Show regional seafloor** reveals coarse NOAA relief. Regional terrain, shoreline and major roads are cached locally, with no map-service requests during viewing. The added geography is about **56 KB gzip**, with zero downloaded image textures.

The detailed park, waterfront, museum and Aquarium remain available through their existing controls; **Local study** frames the earlier OSM area. This adds regional coverage rather than detailed buildings throughout every town. See [sources, accuracy limits, performance and regeneration](docs/monterey-bay-region.md) and browser evidence (historical authoring evidence omitted from this public snapshot).

The same regional landscape is also in the **Testing Gym**: **Menu → Monterey Bay overview** frames it, and **Bay place** focuses a named location. The park, museum and wildlife stay in their detailed local scene; the bay overview hides those tiny assets to keep browser rendering lean. Otter Man flight can continue across the coarse regional terrain and water, while walking and boats retain their local authored limits. See the Gym bay review (historical authoring evidence omitted from this public snapshot).

## Fish ecology data

**[Map Study → Fish ecology](http://127.0.0.1:5191/?tab=map&ecology)** now has a historical NOAA survey grid for blue rockfish, lingcod and Pacific sardine. It ships 127 represented hauls / 635 species-stage records from 2015–2025, with life-stage/year/month filters, explicit non-detections and missing-data states. The renderer-independent service supports habitat queries and reproducible, bounded game-population recipes, exportable as JSON. Source catches are not real population counts; recipes use labelled game tuning and optional habitat inference. The cache is about 6 KB gzip and the overlay adds zero 3D draw calls. Existing Gym wildlife remains authored. See [sources, APIs, regeneration and limits](docs/fish-ecology.md).

## Lovers Point Testing Gym

The Gym now has a staged **loading screen** through its first rendered frame, plus a lower-right **Performance** panel with FPS, frame-time variation, CPU work, draw calls, triangles and renderer resource counts. Collapse it by clicking its heading; it starts collapsed on phones. [Metrics, loading behavior and limitations](docs/gym-diagnostics.md).

**Menu → Pool & volleyball court** now leads to a [photo-informed recreation area](docs/recreation-area.md): level pool/court ground, sandy cypress seating areas, clearer bike trail markings and parking edges, and a pool gate you can open with **E / X / the touch prompt**. Walk onto the deck through the open gate; the basin remains decorative. The adjoining Grill now has a photo-inspired serving frontage, sign, paved café apron and red/pink parasols; smoother beach walls and dark pier rails follow the October 26 references.

The Gym ocean now uses layered ripples, soft weather-aware sun glints and shallow-to-deep color sampled from the existing seafloor. The local surface remains one draw and 421 triangles; its new depth lookup adds 48 KiB. See [water appearance, Minamo inspiration and verification](docs/ocean-water.md).

The underwater floor now follows [USGS bathymetry](docs/bathymetry.md) across the bounded coast, with explicit shoreline joins and source-gap fallbacks. The offshore shark patrol is closer to Lovers Point, and flight and walking share stabilized, blended shadow cascades with conservative caster culling.

The **[Pacific Grove Museum of Natural History study](docs/pacific-grove-museum.md)** is now at its mapped Forest/Central Avenue location. Use **Menu → Visit Natural History Museum** or **Visit museum mezzanine**; **Map Study → Natural History Museum** offers exterior, floor cutaways and room focus. The museum’s own public plans guide the layout; dimensions remain fitted approximations. Interior exhibits are cleared, the front stairs have supported access, and [Jewell Park across the street](docs/museum-district.md) now has its gazebo, Little House, paths and furnishings.

**Caledonia Park is a separate Gym destination.** Select **Menu → Destination → Caledonia Park**, or open `?tab=gym&destination=caledonia-park`. Its name, reset and overview follow the selected destination. The fence surrounds the whole mapped park, with five pedestrian openings; the court stays open inside it. City gallery photos now guide the colorful climbing equipment, red-roofed playhouse, slides and timber-edged play beds; individual dimensions and placements remain estimates. **Meals on Wheels center** visits the photo-informed building at its real 700 Jewell Avenue footprint. Map Study shares the park, building and terrain. [Sources, performance and limitations](docs/caledonia-park.md).

The aquarium and tagged Cannery Row buildings now include a shared, provisional cannery-style exterior detail pass in both outdoor views; see [source and geometry limits](docs/waterfront-extension.md).

The [Pacific Grove waterfront extension](docs/waterfront-extension.md) now continues southeast toward the Aquarium in both Map Study and the Gym. **Menu → Waterfront overview** frames it. Equip the **[Otter Man exploration suit](docs/otter-man.md)** beside the park entrance to fly or dive: Space rises, C descends, Shift boosts, and releasing movement hovers. Underwater the four jets become bubbles, a headlamp lights the seabed, and the sealed suit has unlimited air. Ordinary swimming still uses breath. The suit is also in Objects; its one-draw geometry preserves the saved avatar outfit.

The **Testing Gym** tab is a metre-scale walking playground for saved avatars and the existing prop collection. Its coastline, beaches, path/road network, pool, sand court and building footprints follow OpenStreetMap; city reference photos guide granite walls, cypress silhouettes and the Beach House. Terrain follows cached USGS elevations; exact wall/stair dimensions, building heights, planting and exercise stations remain authored. **Park overview** frames the whole place; **Walk view** returns to the character. See [geography, sources and limitations](docs/testing-gym-geography.md) and the elevation/area audit (historical authoring evidence omitted from this public snapshot).

The starting area preserves the mapped paved pathway. The invented bench, sign, dirt shortcuts and interaction circles have been removed; the fishing rod and tackle box now sit beside the rowboat landing. These equipment positions remain authored gameplay choices.

The gym has a scoped, procedural surface style: warm sand grain, scattered grass flecks, faint paving joints, softer foliage and a generated canopy contact field. Path paint uses cached surface tags and the recorded 2 m asphalt footway width. The two main beach accesses have estimated wider treads and handrails; the east access has regular risers and a turning landing. See the October 24 surface and access review (historical authoring evidence omitted from this public snapshot) for screenshots, costs and accuracy limits.

The October 23 landmark detail pass (historical authoring evidence omitted from this public snapshot) adds the Beach House’s continuous white-framed upper windows, dark pool pickets and subtle stone variation on beach retaining walls. These photo-informed details share the existing batches and keep the mapped footprints, elevation and walking routes intact.

The central cypress grove now rises above the Beach House, guided by the supplied ground-level reference: fourteen trees use provisional 12–22 m heights, while young trees and the exposed perimeter stay smaller. Municipal positions relative to the buildings are retained; see [tree scale, uncertainty and costs](docs/coastal-trees.md#october-25-lawn-grove-scale-correction).

Six instanced monarch butterflies flutter within three metres of the Monarch Butterfly statue at their real 8.5–12 cm scale. They add one draw, with shared distance LOD; see the gym butterfly review (historical authoring evidence omitted from this public snapshot).

Six Western gulls stand or stroll on the coastal lawns and beaches, while eighteen fly along the shoreline in three instanced groups with slower, individually varying routes. Grounded gulls take off when a player gets within about 2½ feet, retreat and settle on a clear patch. Both sexes use the shared library models at real scale. The separate population adds at most nine color-pass draws and 8,112 / 3,360 / 624 triangles across Near / Mid / Far, with distance sleep. See the [gull placement and performance guide](docs/western-gull.md#park-and-coastal-population).

The gym uses the shared painterly toon style and Near/Mid/Far LOD, with spatially instanced trees/rocks and batched scenery. The avatar, trees and props cast sun shadows onto grass and paths through three blended maps that cover the camera view during walking and flight; coverage and rendering cost (historical authoring evidence omitted from this public snapshot). Conservative caster culling avoids redrawing objects that cannot affect those shadows; [the rendering audit](docs/gym-rendering-performance.md) records 34–70% fewer draws in five controlled views. The studio plinth and Tank water also receive silhouettes; shadow costs and both-backend evidence (historical authoring evidence omitted from this public snapshot) are separate from model budgets. Its rendering panel displays every detail variant, draw count and unique geometry storage. The October 23 surface and placement audit (historical authoring evidence omitted from this public snapshot) removes competing ground layers, corrects tree clearances and supports buildings on level foundations. Review its measured browser submissions and screenshots (historical authoring evidence omitted from this public snapshot), which distinguish the full world from visible submissions including the avatar, sky and output pass. Collision and interaction stay independent of rendering detail; this remains a local exercise world, not a multiplayer implementation.

The gym ocean uses turquoise water, broad rolling highlights, broken pale crests and a subtle speed-driven rowboat wake, guided by the supplied October 23 video. Distant detail fades for readable overview views. The default Balanced coastline-clipped surface uses **421 triangles and one water draw**, with no ocean mesh beneath the museum or other mapped inland sites. This replaces the earlier 800-triangle rectangle; shadow and scene passes are separate costs. See the ocean look review (historical authoring evidence omitted from this public snapshot) for reference interpretation, browser checks and limitations.

**Menu → Sky & weather** controls a live outdoor atmosphere. The Gym requests nearby NWS observations and regional forecasts while its tab is visible, with source timestamps and explicit stale/unavailable states. Procedural clouds, wind-driven rain, visibility fog and daylight respond to those values. The sun and moon use the actual UTC date and Lovers Point coordinates; the Moon's illuminated side and phase follow the date, and an artistic star field rotates with sidereal time. **Preview** offers clear, scattered-cloud, overcast, fog and rain conditions plus a Pacific date/time clock. **Return to live** restores current weather and time. Weather lighting is scoped to the Gym; the avatar authoring studio keeps its inspection lighting. See [weather sources, precision and lifecycle](docs/weather-sources.md) and the Gym weather review (historical authoring evidence omitted from this public snapshot).

The atmosphere uses a 528-triangle sky and up to one instanced rain draw: 160 quads on Base or 240 on Standard (320 / 480 triangles), at most two draws and no image textures. The full-screen cloud shader still has a pixel cost. Sun and Moon discs are enlarged for readability; their positions are computed, while cloud shapes and star placement are artistic. Rain amounts are reported period averages, and nearby airport conditions can differ from fog at the park. Weather changes appearance and visibility; the authored water level and boat buoyancy remain separate.

**Menu → Coastal wildlife** frames the 4 m shark patrol and nearby fish. Twelve coastal beds add 120 kelp plants, for 144 across the Gym. The trail now includes mapped and authored facilities; see [coastal wildlife and trail details](docs/coastal-life.md). **Menu → Gray whales** frames the offshore mother, calf and second adult. Their rigs, surface events and distance-based updates have a [separate whale-pod budget](docs/gym-whale-pod.md). These routes are authored scenery, not live sightings.

## Long-term vision: a game its community can build together

Monterey Bay Cozy is a place to discover your community and build relationships through shared play. Explore local parks, museums and city resources, learn about the bay's plants and wildlife, and spend time with neighbors in a cozy multiplayer world.

The Monterey Bay Tech Discord server is the community home for sharing local knowledge, ideas and contributions. Developers and non-developers can help shape the world through photographs they have permission to share, place corrections, species knowledge, accessibility feedback, original assets or code. Contributors can use AI tools if helpful; human review, source attribution and community usefulness guide what becomes part of the game.

The current browser prototype provides the world, assets and local interactions. Multiplayer, community-curated recommendations and an integrated contribution workflow remain goals. The project welcomes collaboration now without presenting those future features as already implemented.

## Rules for every model and asset

The asset foundation targets an open multiplayer world on the web. Client-side LOD is presentation only: it must never change authoritative simulation, identity, collision or interaction range. It reduces geometry cost; networking, streaming, physics simulation and occlusion remain separate future systems.

- **Procedural code is the source of truth.** Generate assets from small, readable TypeScript factories. The running collection does not load the exported GLBs. A GLB is an optional serialized copy of generated geometry/materials, not an indication that the model was made in Blender. Do not introduce manually modeled mesh dependencies unless explicitly requested.
- **Use as few triangles and draw calls as the silhouette needs.** Measure first; budgets are ceilings, not targets. Combine static components, bake palette colors into vertices, share compatible material responses and instance repeated assets where appropriate. Keep independently animated parts separate. Count model draws per render pass and report scene/shadow overhead separately. Keep the collection's 5,000-triangle / two-draw ceiling, with tighter species limits where defined; prop ceilings are enforced in `src/models/props/dimensions.ts` and `tests/asset-contract.test.ts`.
- **One scene unit is one metre.** Public factory results, attachment points, colliders and scene placements use metres. Legacy design coordinates must be converted inside the factory. Keep root scale at one. Fit inspection cameras to an asset; never resize an object just to fill the screen. Show dimensions and provide a common metre-grid comparison.
- **Use representative real dimensions, with provenance.** Record the measurement type (hull length, beam, rod shaft, case body), reference and uncertainty. A sourced product size can guide an original design; it does not make the design a replica. When the exact species/object is unknown, label the size provisional rather than claiming a measured match.
- **Plan for WebGPU and WebGL 2.** Keep geometry, data, animation ownership and physics independent of the renderer. Built-in toon (and standard) materials work across both tested backends. The whole viewer now runs on `WebGPURenderer` (native WebGPU, or its WebGL 2 backend); write all custom rendering with TSL/node materials and validate both backends. Raw GLSL `ShaderMaterial` / `onBeforeCompile` cannot run on it; `tests/style-tiers-browser.mjs` fails if any remains in the scene.
- **Use the shared toon style.** Render with `createToonMaterial()` / `finishStaticAsset()` and the `STYLE` tokens in `src/models/shared/style.ts`; see [Art direction](#art-direction-painterly-cel-shading). Use the shared distance-detail controller and record every LOD level.
- **Distance detail is required.** Register every new scene asset with `createLodController()`, inspect all three variants and report actual savings. Preserve metre-scale silhouettes, paint, skin/morph attributes and disposal. See [LOD contract](docs/lod.md).
- **Verify before growing the scene.** Run budget/scale tests, inspect the silhouettes and relevant animation, and test touch, keyboard and reduced motion. Exported GLBs are optional interchange artifacts; regenerate them after geometry or scale changes.

## Art direction: painterly cel shading


**Goal:** a warm, open-air cel look with original designs and a Monterey Bay palette, running on mid-range laptops and phones. The assets are for a community-built Monterey Bay web game; contributors can use local models or any other AI tools. The look should hold up on modest and borrowed hardware. Shape, paint and lighting must read at gameplay distance. Rendering cost must fall as details become too small to matter.

### What makes the look (and what we use)

| Ingredient | What it does on screen | Our implementation | Cost | Status |
| --- | --- | --- | --- | --- |
| **Two-band light ramp** | Broad lit and shadow shapes with a narrow, slightly soft terminator, instead of gradual PBR falloff | `MeshToonMaterial` + one shared 64×1 generated ramp (`toonRamp()`) | Cheaper than `MeshStandardMaterial` (no GGX/env) | **Done:** all props, shore, seabed, kelp, rocks, sardine, rockfish |
| **Warm key, cool shadow** | Sunlit faces go cream/gold; shadow sides take the sky's blue rather than going black | Warm `DirectionalLight` + `HemisphereLight` (sky blue / sand bounce). The ramp's shadow floor is 0.28, so core shadow is mostly sky fill | One light swap | **Done** |
| **Crisp cast shadows** | Shadows read as graphic shapes | `PCFShadowMap`, fitted per view; Gym uses three blended camera-frustum cascades for walking and flight | Two additional Gym shadow passes | **Done** |
| **Painted metal glint** | Brass and steel get a hard white band, not a blurry specular | Second ramp (`metal`) with a 1.5× band past dot(N,L) 0.9 | Same draw, same shader | **Done** |
| **Sky and horizon haze** | Readable daytime, sunset and night backdrop | Harbor/Objects retain `sky.ts`; the Gym uses a 528-triangle procedural weather dome with clouds, sun, Moon and stars | 1 sky draw; optional Gym rain adds 1 | **Done:** Gym weather is scoped separately from inspection skies |
| **Stylized water glints** | Gym: soft, filtered highlights and layered ripples; harbor/tank retain painted flecks | `water.ts` / `oceanOptics.ts`; Gym supplies astronomical light, cloud/fog attenuation and sky colors; [depth coloring](docs/ocean-water.md) follows the seafloor | 0 extra draws; Gym depth field +48 KiB | **Done** |
| **Rim light** | Bright backlit edge that separates characters from the background (a signature of the reference) | Hard-edged Fresnel band × sun-facing mask × sideways mask, added as `emissiveNode` on `MeshToonNodeMaterial` (`src/viewer/nodeStyle.ts`). Terrain opts out with `rim: false` | ~10 ALU ops per pixel; no measurable frame-time change (below) | **Done in the main viewer** (Standard). The tuna's custom TSL body material takes the same rim through `userData.styleBase`; its matte fins opt out |
| **Aerial perspective** | Distance fades toward the horizon; visibility responds to weather | Gym `scene.fog` and its water shading share weather-driven color/range; underwater fog remains separate | 0 extra draws | **Done in the Gym** |
| **Painterly ground texture** | Soft grass/sand variation and readable paving | Gym-only TSL material detail over the single painted terrain; generated canopy contact field | No extra draws; one 256×256 field (~341 KiB with mipmaps), fragment-shader work | **Done in the Gym**; other viewers retain their own surfaces |

### Shader system decision: TSL on `WebGPURenderer`

**Implemented decision: use TSL (Three.js Shading Language) node materials on `WebGPURenderer` for all custom shading throughout the main viewer.** The rim experiment answered the question: TSL gives the look we need, with one shader source, on both backends, at no measurable cost.

| Option | One source for WebGPU + WebGL 2? | Fits our Three.js code | Verdict |
| --- | --- | --- | --- |
| **TSL / node materials** | Yes: compiles to WGSL on WebGPU and GLSL on the WebGL 2 backend | Built in; `MeshToonMaterial` converts automatically; fish skinning and morph instancing work unchanged | **Use** |
| Raw GLSL `ShaderMaterial` / `onBeforeCompile` (former tuna, water, caustics) | No: WebGL only; WebGPURenderer cannot run it | Replaced by TSL in the current viewer | Do not add |
| Hand-written WGSL | No: WebGPU only, so no fallback for older browsers | Loses Three's lighting/shadow chunks | No |
| Switch engine (Babylon.js, PlayCanvas) | Yes | Rewrites every factory and test | No |

Evidence (`tests/rim-review.html`, `node tests/rim-review-browser.mjs` → `artifacts/rim-light/`). The scene has 6 props, a rockfish and a 64-sardine school, 1280×820, local Chrome on this Mac, GPU timestamps, median of 90 frames:

| Backend | View | Rim on | Rim off | Draws |
| --- | --- | ---: | ---: | ---: |
| Native WebGPU | overview | 0.418 ms | 0.408 ms | 18 / 18 |
| Native WebGPU | close-up | 0.389 ms | 0.404 ms | 16 / 16 |
| WebGPURenderer → WebGL 2 | overview | 2.69 ms | 3.23 ms | 30 / 30 |

The difference is within run-to-run noise on both backends. WebGL 2 timings are noisier and include backend overhead, and the WebGL backend's draw counter is less reliable. These are single-machine numbers; profile a mid-range phone before shipping. Both backends render the same image (`close-webgpu-rim.png` vs `close-webgl2-rim.png`).

**Migration order** (each step keeps the current look):
1. ~~Main viewer: `WebGLRenderer` → `WebGPURenderer` (automatic WebGL 2 fallback), calling `applyNodeStyle(scene)` after building scenes.~~ **Done** ([historical rendering experiment](docs/rendering-history.md)).
2. ~~Port the tuna wave/cel `ShaderMaterial`~~ **Done:** `TunaCelMaterial` (`MeshBasicNodeMaterial`, `positionNode` body bend, same two bands).
3. ~~Port the water (refraction capture, depth, glints) and caustics to TSL.~~ **Done:** water, seabed caustics, tank backdrop and tank caustics are TSL.
4. Distance detail is now shared across asset libraries and scenes. Kelp sway remains future work.

**Fin shading:** tuna and the eight painted shared-rig fish use a vertex mask to keep fins matte and suppress rim light within the body batch. The great white uses its separate matte foil treatment with rim disabled. No extra fin draw is required. Earlier rim experiments below retain their historical measurements.

### Device settings and distance detail

**The historical High style tier has been removed**, including its silhouette hulls and bloom pass. The Gym now offers a separate, explicit **Enhanced water** option on native WebGPU; **Balanced water remains the default on every device**. See [graphics targets and cost policy](docs/graphics-quality.md) and [ocean optics](docs/ocean-water.md). Shape, vertex paint and the shared light ramp carry the art. **Base** and **Standard** remain device settings; they do not select mesh detail or change the palette.

| Setting | Rendering policy |
| --- | --- |
| **Base** | DPR ≤ 1.5, 1024² shadows, toon lighting and water glints; no rim or harbor refraction copy |
| **Standard** | DPR ≤ 2, 2048² shadows, shared rim and harbor water refraction |

Explicit `?quality=base|standard` wins. Otherwise coarse-pointer devices or reported memory ≤ 4 GiB start at Base; desktops start at Standard. A slow first-frame probe can step Standard down once. Retired or unknown quality URLs use the device default. These are policy choices, not FPS guarantees.

**Auto LOD is on by default.** Every library fish and object has Near / Mid / Far geometry, generated from its procedural source. Selection uses projected size in CSS pixels, camera FOV/zoom, metre scale and a 15% hysteresis band. Distant meshes aim for 50% / 20% of the original triangles with conservative error limits. Small primitives or protected detail may reduce less. Geometry is built once and swapped without extra render passes; animation, caught eyes, material paint, instance identity, physics proxies and placement remain owned by the original asset.

Use **Detail → Auto / Near / Mid / Far** in Tank, Objects or Area. **Detail levels** shows every variant's triangles and draws; forced levels let you inspect the same pose at the same camera scale. The map/interior has its own Detail selector. `?lod=near|mid|far` pins the main libraries for reproducible reviews. See [LOD architecture, coverage, costs and limits](docs/lod.md) and the visual comparison gallery (historical authoring evidence omitted from this public snapshot).

### How to author an asset in this style

1. **Material:** call `createToonMaterial()` from `src/models/shared/style.ts`, or use `finishStaticAsset()`, which does it for you (matte + metal batches). Never create a `MeshStandardMaterial` for rendering. `mat()` in `primitives.ts` is only an authoring input that gets baked away. Tests fail if a prop or new fish renders with a non-toon material.
2. **Color carries the art, not light.** Bake palette into vertex colors. Shading only splits each color into two values, so paint deliberate *value* contrast between parts (dark trim against a light hull, cream cabin against marigold hull) and keep each part to 1–2 colors.
3. **Mid-value, slightly desaturated bases; saturated accents.** Large surfaces stay soft (sand, sea-green, weathered wood). Reserve strong saturation for small focal accents (floats, life rings, the tackle box) so they read at gameplay distance.
4. **Shape over detail.** Bevel or round big forms so the terminator draws a smooth curve. Faceted rocks are an intentional exception: give them non-indexed geometry plus `computeVertexNormals()`, because toon has no `flatShading`.
5. **Shared light defaults and scoped environments.** Read `STYLE.sun`, `STYLE.sky`, `STYLE.dome` and `STYLE.ramp` for the inspection defaults. Outdoor water, sky and fish shading must also accept the viewer's scoped environment: the Gym supplies astronomical light directions, sky colors and night exposure, while library/studio views retain their shared inspection defaults. The tuna's TSL key light follows that environment when supplied.
6. **Export:** glTF has no toon model. *Save GLB* uses `exportableClone()`, which swaps in matching standard materials on a clone only. Game code should rebuild toon materials on import.

### Monterey Bay palette notes

These are artistic choices, informed by these sources:

- **Giant kelp** (*Macrocystis pyrifera*) is a brown alga that appears golden to olive-brown ([Monterey Bay Aquarium](https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/giant-kelp)), so the seabed kelp now uses olive-gold `#8c7a35` instead of leaf green. The exact hue is an artistic pick.
- **Water** stays teal-green rather than tropical turquoise; the existing `uShallow`/`uDeep` values already follow the supplied video.
- **Sky:** the Gym now has coastal grey fog, layered clouds and time-dependent daylight/night colors. **Menu → Sky & weather → Preview · coastal fog** provides a repeatable marine-layer look; Live uses available regional visibility and cloud reports. This atmospheric palette is a scoped Gym environment, with the source and interpretation limits documented in the weather review (historical authoring evidence omitted from this public snapshot).

### Tuning the look

Most changes happen in one file, `src/models/shared/style.ts`:

- `ramp.terminator` / `ramp.softness`: where and how sharply light turns to shadow. Keep softness ≥ 0.02 or the edge will alias on phones.
- `ramp.shadow`: shadow-band brightness. Raise it for a softer storybook look; lower it for more drama.
- `sky.color` and `sky.intensity`: the color of every shadow in the scene.
- `sun.color` and `sun.intensity`: warmth of lit faces.

Check changes with `node tests/toon-style-browser.mjs`, which writes `artifacts/toon-style/*.png` plus `browser-qa.json` (draws, triangles, and any remaining non-toon meshes).

## Asset debugger tabs

| Tab | Intended assets and purpose | Current state |
| --- | --- | --- |
| **Tank** | Fish and other ocean wildlife; inspect silhouettes, materials, swimming poses, and movement. | Working viewer with creature selection, camera controls, and playback. |
| **Area & buildings** | Monterey Bay terrain, coastline, and buildings; eventually inspect environment assets and how they fit together. | Working dockside water study, floating boats, pier and shore props. |
| **Objects** | Generated props and other objects; inspect shape, proportions, materials, and reuse. | Selectable fishing props, habitat, Lovers Point sculptures, a living monarch, male/female Western gulls, and seven coastal tree silhouettes. Includes orbit/turntable, GLB downloads, seeded **Regenerate**, butterfly/gull Group and Pose controls, and replay for finite actions. Gulls have flight, standing, walking and one-shot poop poses; [source and performance guide](docs/western-gull.md). |
| **Map study** | A sourced Monterey Bay layout and boundary study. | 1,272 OSM building parts and a metre-scale aquarium interior: two public floors, tank envelopes, selection and visitor routes. Separate demand-rendered viewport. |
| **Avatars** | Create, dress, animate and save original coastal characters. | Height/build sliders, five hairstyles, face/color choices, interchangeable tops and bottoms, local saves and portable JSON; one-draw procedural rig. |
| **Testing Gym** | Test saved/current avatars in a Lovers Point playground. | Walking, jumping, swimming and diving, scuba gear, gamepad/touch controls, rowing and a drivable dive boat, a rocky-reef dive site, and live weather with previews. |

Tank remains the default; `?tab=area` opens the dockside study, `?tab=objects` opens the prop viewer and `?tab=map` opens the map study. `?tab=avatars` opens the creator and `?tab=gym` opens the Testing Gym. Switching tabs suspends inactive scene simulation; fish selection and swimming mode are preserved. Tank and water share the pause state. The object turntable has its own explicit play control. In Objects, **Left / Right arrows** select the previous / next object and wrap around the collection when the page, preview canvas or an object button is focused. Dropdowns and editable fields retain their native keys; Up / Down still orbit the preview. Tabs support touch/click and keyboard navigation with Left/Right arrows, Home, and End.

Develop each debugger when its assets require it. Keep asset factories and reusable materials/animation separate from viewer controls. Each development task should answer a clear asset question and produce a viewable result. Aim for warm, readable shapes, inviting colors and original designs. Ground species, habitats, and Monterey Bay geography in reliable references, and record artistic choices or uncertainty.

The Testing Gym is the first local movement and interaction prototype. Fishing simulation, multiplayer and community contribution systems remain future work; networking and backend services are not implemented.

*Reference image omitted from this source release: Dockside water study*

## Run

Use Node.js 22.12+ (Node 24 recommended).

```sh
npm install
npm run dev
```

Work in your checkout on `main` and open **http://127.0.0.1:5191/**. This is the shared development preview; Vite stops if the port is occupied instead of silently opening another port. Do not run copied project directories as alternate previews. `npm run build` creates a static site in `dist/`; `npm run preview` serves it. Relative asset paths support hosting under a repository subpath.

## Watch the tank

The creature panel shows live **draw calls and triangle counts** for the selected model and swimming/caught state. Sardine schools show totals for the active instance count; **Mesh notes** includes triangles per fish at the active detail level; **Detail levels** compares all variants. Counts describe visible mesh submissions in one color pass before camera culling, excluding the tank/habitat, shadows, extra transparency passes and postprocessing. They are model costs, not whole-frame GPU counters.

- **Slow cruise:** gentle forward motion, 0.72 tail beats per second, open pectorals and a raised dorsal.
- **Fast swim:** faster travel, 2.65 tail beats per second, stronger rear-body movement and tucked pectorals. The first dorsal lowers to **62%** height, keeping it visible above the body.
- **State → Caught:** replaces both eyes with X marks, holds a straight resting pose, and stops forward travel. Choose **Swimming** to restore the live model. No duplicate body is created.
- **Cycle:** six seconds slow, six seconds fast, four seconds slow, then repeat. Speed and pose blend smoothly.
- **Whole tank** resets the wide camera. **Follow fish** moves the camera with the tuna for a closer look. Press either **Up** or **Down** to toggle between these views while the Tank canvas, page or a tank button is focused. Holding the key does not repeatedly toggle; menus and editable controls keep their native arrow behavior.
- **Left / Right arrows** switch to the previous / next fish and wrap around the collection. They preserve swim mode, caught state, pause, school size and the selected camera view. Use them with the tank canvas, page or a tank button focused; dropdowns, editable fields and tab navigation keep their native arrow behavior. Objects uses Left / Right for collection navigation; Area keeps arrow-key camera orbit.
- Drag to orbit; scroll or pinch to zoom. **Space** pauses; outside Demo mode, **1**, **2**, **3** select slow, fast, and cycle.

Reduced-motion preferences start playback paused. Pause freezes both swimming and tank effects. Hidden tabs stop rendering and resume without a large simulation jump. The viewer has no anatomy panel, picking, separation slider or reference dialog.

The closed swimming route is sampled by distance, keeps the fish inside the aquarium, and turns the fish to face its direction of travel. The caught preview freezes the fish while the aquarium continues running. Swimming is stylized animation, not a physical or biological simulation.

## Fish collection

The October 15 fish style pass (historical authoring evidence omitted from this public snapshot) reduces tuna from nine draws to two and brings the eight shared-rig fish closer to its painted shading, with smoother body normals and softly rounded membrane fins. Compare before and after (historical authoring evidence omitted from this public snapshot).

The Tank displays a researched **length range** for every creature. **Size notes** explains the evidence, links the sources and preserves the actual preview size. Jelly ranges measure bell diameter; turtle ranges measure the shell. Published ranges, average-to-maximum reference spans and selected authoring bounds are distinguished in [the size guide](docs/species-sizes.md). These labels do not change geometry or physics scale.

Choose a species from **Creature**, then **Follow fish** for a closer view. Each has slow/fast swimming, a caught state with X eyes on both sides, a rigid physics placement root, lightweight capsule proxies and mouth/grip anchors. Follow-camera distance adapts to the actual metre size and tall-fin span; it does not resize the model.

| Model | Model length | Alive triangles | Caught triangles | Draws in either state |
| --- | ---: | ---: | ---: | ---: |
| Tuna | 1.20 m | 3,368 | 2,784 | 2 |
| Pacific sardine | 0.25 m | 1,468 | 1,280 | 2 |
| Blue rockfish | 0.35 m | 1,872 | 1,684 | 2 |
| Ocean sunfish (Mola mola) | 1.20 m | 1,668 | 1,480 | 2 |
| California sheephead (male) | 0.55 m | 1,692 | 1,504 | 2 |
| Kelp greenling (female) | 0.35 m | 1,796 | 1,608 | 2 |
| Chinook salmon (ocean phase) | 0.80 m | 1,976 | 1,788 | 2 |
| Garibaldi | 0.28 m | 1,456 | 1,268 | 2 |
| Lingcod | 0.85 m | 1,652 | 1,464 | 2 |
| Moon jelly | 0.25 m bell | 1,482 | 1,482 | 2 |
| Green sea turtle | 1.15 m body | 1,670 | 1,422 | 2 |
| Great white shark | 4.00 m | 1,908 | 1,648 | 2 |
| Giant sea bass | 1.50 m | 2,180 | 1,992 | 2 |
| Giant Pacific octopus | 3 m extended arm span | 4,482 | 4,234 | 2 |

The sardine's slender body, blue-green back, pale flanks, dark spots and forked tail follow [NOAA's species reference](https://www.fisheries.noaa.gov/species/pacific-sardine). Blue rockfish occur in the sanctuary's kelp forests ([NOAA gallery](https://montereybay.noaa.gov/gallery/photos-and-videos.html)); this model emphasizes the deep body, slate mottling, spiny dorsal and broad pectorals. The 25 cm and 35 cm lengths are representative artistic choices below the documented maxima of [38 cm for sardine](https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/pacific-sardine) and [53 cm for blue rockfish](https://wildlife.ca.gov/Fishing/Ocean/Fish-ID/Quiz). Cross-sections, exact markings and motion are stylized, not measured reconstructions.

*Reference image omitted from this source release: Fish at a common scale; grid squares are 10 cm*

Fin-bearing species use shared body/fin/face builders, a six-bone GPU rig and one shared toon material per fish. Body and markings render together; only the eye batch changes for caught fish. There are no texture downloads, per-frame vertex uploads, or per-fin draw calls. See the [component guide](src/models/README.md#sardine-and-blue-rockfish) and new-species review (historical authoring evidence omitted from this public snapshot). The table above reports standalone fish; sardines also have the instanced school below.

### Great white shark

Select **Great white shark**, or press Left from Tuna, then **Follow fish**. The photo-refined 4 m specimen has a broader, flatter snout, five tapered gill slits per side, a ventral mouth, curved dorsal, thick swept pectorals and a smaller curved crescent tail. Slow/fast swimming bends the rear body and tail; the main fins stay extended. Caught state freezes the pose and swaps both eyes to X marks. The shared matte toon ramp is retained; rim is disabled on the batched shark surface to avoid fin glare.

The displayed 3.5–6 m span is male maturity to estimated maximum total length, not a typical adult interval ([Florida Museum](https://www.floridamuseum.ufl.edu/discover-fish/species-profiles/white-shark/)). Seeded girth/pigment variation, the 4 m specimen, exact proportions and 0.70/1.8 m/s travel are artistic choices. See source and performance review (historical authoring evidence omitted from this public snapshot).

### Ocean sunfish

The ocean sunfish is an original low-poly interpretation of **Mola mola**, using the [Monterey Bay Aquarium reference](https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/ocean-sunfish) for its compressed disc body, small mouth and blunt, scalloped clavus. Its **1.20 m snout-to-clavus length** and roughly **1.82 m resting fin span** are artistic dimensions, not measurements of a particular fish or a species maximum. No reference image or downloaded model is used at runtime.

Its tall dorsal and anal fins make coordinated lateral strokes while the body stays rigid, guided by [Watanabe and Sato's swimming study](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0003446). Slow/fast modes use stylized 0.40/0.82 Hz strokes and 0.28/0.66 m/s viewer travel; fast mode increases stroke rate and amplitude without retracting the propulsive fins. The clavus has a small rudder movement and pectorals tuck slightly. Skin weights keep embedded fin roots attached. Caught mode stops all strokes and replaces both eyes with X marks.

`createOceanSunfishModel({ lengthMeters: 1.2 })` shares the collection's shared toon material, body builder, eye states and batching helper, with species-specific proportions, components and motion under `src/models/ocean-sunfish/`. It uses six bones, two model draws and three thin body-capsule proxies; fins do not get separate physics bodies. The viewer fits width and height independently so the tall fins remain readable on phones. See the sunfish review (historical authoring evidence omitted from this public snapshot) for side/oblique/underside evidence and WebGL/WebGPU checks.

### California sheephead and kelp greenling

The **55 cm male California sheephead** uses a dark forehead and tail, coral-red middle, white chin, red eye rim and small canine teeth. The [Monterey Bay Aquarium reference](https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/california-sheephead) documents that color phase and a range reaching Monterey Bay; it is less common this far north than in Southern California. The **35 cm female kelp greenling** has a slender body, long notched dorsal, small brow cirri, golden fins and brown-gold freckles. [ODFW](https://nrimp.dfw.state.or.us/mrp/default.aspx?page=74) describes its female colors and size; [CDFW](https://wildlife.ca.gov/Conservation/Marine/Nearshore/1000) records Monterey Bay sampling. These are original stylized models, with representative sizes and artistic fin shapes, markings and swimming rates.

Each species composes the shared body, face, fin and six-bone rig with its own `definition.ts`, `components.ts` and small factory. Both render in **two draws** with the shared matte toon ramp, have slow/fast swimming and caught X eyes, keep vertex buffers static, and expose a capsule and mouth/grip anchors for future physics. Their ceilings are **2,000 triangles / 2 draws** per color pass. Freckles and teeth merge into the body batch; no external textures or per-marking draws are added. See the [component guide](src/models/README.md#california-sheephead-and-kelp-greenling) and evidence under `artifacts/california-sheephead/` and `artifacts/kelp-greenling/`.

### Chinook salmon

The **80 cm ocean-phase Chinook (king) salmon** has a streamlined fusiform body, pointed snout, small adipose fin, broad slightly forked tail, dark blue-green back, bright silver flanks, white belly and small black spots on the back and both caudal lobes. [NOAA Fisheries](https://www.fisheries.noaa.gov/species/chinook-salmon-protected) documents those colors and a typical length of about 3 ft. The [WDFW marine ID card](https://wdfw.wa.gov/sites/default/files/2024-08/pacific-salmon-id-card-2024-4.pdf) lists spots on both tail lobes and black gums; the gums are omitted at this scale. A [CDFW-led environmental notice](https://ceqanet.lci.ca.gov/2025030879) covers juvenile Chinook releases at Monterey Harbor and Santa Cruz Wharf for later local harvest. The model reuses the shared body, face, fin and six-bone rig, with its own `definition.ts`, `components.ts` and factory under `src/models/chinook-salmon/`. It renders in **two draws** (1,976 alive / 1,788 caught triangles; ceiling 2,000 / 2). Sixty spots merge into the body batch with its skin weights, and the adipose fin is body-weighted so it follows the tail bend. Swimming is tail-driven at 0.85/2.30 Hz with 0.30/1.10 m/s travel, and the dorsal stays raised at fast speed. The adipose fin is intact; local hatchery releases are clipped. Length, proportions, spot layout, hues and motion are artistic. See `tests/chinook-salmon.test.ts` and the salmon review (historical authoring evidence omitted from this public snapshot).

## Instanced sardine schools

Selecting **Pacific sardine** starts a **48-fish school**. **Group** switches between single-fish inspection and schools of 16, 48, 128 or 256. **Follow fish** frames the whole school at its real size. Slow, fast, cycle, caught and pause controls work for the school; each swimming fish has its own tail phase.

`createSardineSchool()` shares one geometry and material across its swimming instances: **one school draw per render pass**, whether there are 1 or 256 fish. It bakes two eight-pose cycles from the canonical sardine rig once at construction, then interpolates them on the GPU using standard Three.js morph instancing. Normals animate too; no raw shader extension or per-fish skeleton is required. A separate static batch provides the X-eye caught preview, with only the active batch visible. There are no downloaded textures; the pose/weight textures are generated runtime data.

| School size | Alive triangles | Caught triangles | School draws |
| --- | ---: | ---: | ---: |
| 16 | 23,488 | 20,480 | 1 |
| 48 | 70,464 | 61,440 | 1 |
| 128 | 187,904 | 163,840 | 1 |
| 256 | 375,808 | 327,680 | 1 |

Instancing removes repeated draws and skeletons; triangle and pixel work still grow with fish count. The two geometries, including shared pose attributes, occupy **492,888 bytes** of typed-array storage per school. At the default capacity of 256, instance matrices use 32,768 bytes across both states and morph weights use 17,408 bytes. These are CPU buffer sizes, not total GPU/driver memory. Only the active matrices and live weights change each frame. Geometry and pose buffers stay fixed when the count changes. Distance LOD now reduces school geometry using the nearest visible member conservatively. Future larger scenes still need spatial school batches and profiling on actual mobile hardware; 256 is an inspection cap, not an FPS guarantee.

```ts
import { createSardineSchool } from './src/models/pacific-sardine/createSardineSchool';

const school = createSardineSchool({ count: 48, capacity: 256 });
scene.add(school.root); // unit scale, metres; an external controller owns placement
school.setSwimMode('fast');
school.update(deltaSeconds);
school.setCount(128); // reuses geometry, materials and allocated instance buffers

// Use a current raycast's instanceId. Promote only an interactive/caught fish.
const caughtFish = school.takeFish(instanceId);
scene.add(caughtFish.root); // returned in world coordinates; scene root must be identity
// caughtFish has X eyes, a collider and anchors; bindFishPhysics() can take over.

school.dispose(); // caughtFish owns independent resources and remains usable
caughtFish.dispose();
```

`takeFish()` removes the chosen slot, moves the last slot into its place, and returns a normal `FishModel` at the same world pose. Slot numbers are render indices, not persistent game IDs. `setCount()` preserves existing local positions, spawns added members inside the resized envelope and updates the bounds without rebuilding geometry. Each school owns its shared resources; schools do not borrow resources from one another. Placement, formation, shared pose baking and species geometry remain separate components. Local placement comes from the shared schooling algorithm below. It is a lightweight steering simulation, not collision physics.

### Schooling algorithm (any schooling species)

`createSchooling(capacity, bodyLength, traits, seed)` in `src/models/shared/school/schooling.ts` owns each fish's offset, heading, size and tail rate in the school's local frame. The host route or physics moves the school root; schooling never touches it. Species supply `SchoolingTraits` (sardine: `SARDINE_SCHOOLING` in `pacific-sardine/definition.ts`).

Each fixed substep (≤ 1/60 s):
1. **Neighbours:** a uniform spatial hash finds each fish's *k* nearest neighbours (default 7, a topological rule like those observed in real collective motion). A spatial hash limits neighbour candidates in the tested formations; crowded cells can still approach O(n²), so this is not a worst-case complexity guarantee.
2. **Steering:** separation inside the preferred spacing, alignment to neighbours' velocity, light cohesion, and a small per-fish wander.
3. **Envelope:** a soft pull back inside an ellipsoid (longer along travel, flatter vertically). Its centre line bends like a ribbon and it slowly breathes, so the school changes shape instead of holding a box. A hard limit keeps the conservative bounds honest.
4. **Heading:** each fish faces school travel plus its own relative velocity (capped so slow cruising stays polarized, about ±15–20°), and banks slightly into lateral drift.

**Size variation:** each fish gets a uniform scale within ±10% (fish 0 is nominal) through its instance matrix. It stays one draw with no extra geometry. Smaller fish beat their tails faster (tail rate ∝ 1/size, so the school moves at one speed). `sizeAt(slot)` reports it, and `takeFish()` rebuilds the caught fish at its own length with an unscaled root.

**Measured:** 0.47–0.51 ms per update for 256 fish on this Mac in Node (simulation plus instance prep). Tests check: no overlaps, median neighbour spacing near one body length, empty ellipsoid corners (not a box), no repeated grid columns, varied but polarized headings, bounds containing every vertex, and the 256-fish school clearing the tank route on turns.

**Artistic, not measured:** spacing (0.65 body lengths for sardine), envelope proportions, size spread and bend/breathe amounts are tuned by eye toward the general structure of real schools. Add predator avoidance, splitting/merging and size-sorting as separate steering terms when gameplay needs them.

Verified on classic WebGL, native WebGPU and the node renderer's WebGL 2 fallback. The isolated node-renderer fixtures also use one color-output draw/triangle, measured separately from fish geometry. The aquarium now uses `WebGPURenderer` too. See the school review (historical authoring evidence omitted from this public snapshot) for evidence and limits.

### Attached bat stars

`createBatStar()` is a seeded, 18 cm habitat asset with five broad webbed arms, available in Objects with Regenerate and GLB export. The near model includes underside grooves and tube feet; attached colonies omit that hidden detail. Both variants use one model draw. Tank floor/wall and harbor-rock examples share one instanced draw per colony. `attachToSurface()` in `src/models/shared/surfaceAttachment.ts` owns their rigid placement separately from model geometry. Local surface anchors follow target transforms; a surface ray probe stops crawling at edges instead of moving into open water. Crawling is an artistic preview, capped at 2 cm with a default speed of 2 micrometres per second. Pause freezes the scene's crawl clock. See the bat-star review (historical authoring evidence omitted from this public snapshot) for verified anatomy, limits and evidence.

## Reuse the tuna

```ts
import { createTunaModel } from './src/models/tuna/createTunaModel';

const tuna = createTunaModel();
scene.add(tuna.root);
tuna.setSwimMode('fast'); // blends from the current pose
tuna.setLifeState('caught'); // stops swimming and displays X-shaped eyes
tuna.setLifeState('alive');  // restores the regular eyes and swimming

// Call once per animation frame while playback is active.
tuna.update(deltaSeconds);

// Releases geometry/materials and removes the root.
tuna.dispose();
```

`setSwimMode(mode, true)` selects an immediate initial pose. `setLifeState('caught')` stops fish animation and swaps the eye details; the caught preview reuses the existing model and stays within the rendering budget. `getState()` exposes the mode, life state, motion owner, transition blend, phase, frequency and dorsal extension. `parts` is an internal animation rig; its mesh batches are not an anatomy/inspection API. `update()` accepts seconds and caps one step at 0.1 seconds. The model separates a rigid placement root from its animated visual child; the root supports placement, rotation and uniform scaling.

The head points toward **−X**, up is **+Y**, and the near flank is **+Z**. The fish defaults to **1.2 m total length**, a provisional representative target because the photo does not establish species or size. Set `createTunaModel({ lengthMeters: ... })` to use a better identified specimen size; its visual, colliders and anchors scale together. The aquarium is **12 × 4.5 × 6.75 m**. The legacy fish shape is built in design coordinates internally, then converted beneath an unscaled metre-space root. The model builds from lathed profiles, extruded shapes, spheres and tubes; it has no external mesh or texture dependency. The reference photo remains at `public/references/tuna.jpeg` for provenance.

The cel shader (`TunaCelMaterial`, TSL) uses vertex colors and a world-space `keyDirection` uniform. Fins use a gentle diffuse response with no camera-dependent specular or rim terms; the body takes the shared rim light on Standard. Body and fins now share one indexed batch with per-vertex paint, a matte-fin mask and four GPU hinge transforms. The live/caught face adds one draw. Named fin controls remain independent without separate meshes. The body bends in the vertex shader, keeping geometry buffers static during swimming; fin hinges follow the same wave on the CPU. It runs on `WebGPURenderer` with either backend; the classic `WebGLRenderer` can no longer draw the tuna.

## Component structure

See the [model guide](src/models/README.md) for the file map, ownership rules and new-species workflow. The tuna factory composes **body, fins and face** builders; proportions and attachment offsets live in `definition.ts`, appearance in `materials.ts`, and behavior in `motion.ts`. Shared assembly, batching and cleanup live in `src/models/shared/`. [Model instructions for agents](src/models/AGENTS.md) point to the same guide.

Readable source components are combined into efficient render batches. Lower-fin roots follow the belly profile with a small overlap, and a geometry check samples their seams across the fin thickness against the actual low-poly body. Geometry, materials, motion, physics data and viewer controls have separate responsibilities.

## Browser support and rendering backends

Aim to run the experience in as many modern browsers and devices as practical. Keep a reliable compatibility path and degrade gracefully when a browser lacks WebGPU or another advanced feature.

WebGPU is the primary rendering path on capable browsers. The same node renderer selects its WebGL 2 backend for wider support at runtime. Keep model factories, asset data, gameplay systems, and physics interfaces independent from renderer-specific code.

Performance is a project-wide requirement because the eventual experience may contain many fish and other objects, physics, and multiplayer. Keep geometry and draw-call budgets, batch or instance repeated assets when useful, avoid unnecessary per-frame CPU work and allocations, and measure representative scenes on desktop and mobile. Treat WebGPU as an important capability for scaling rendering and compute workloads, while benchmarking actual target devices instead of assuming a backend is automatically faster. Keep any future multiplayer simulation and rendering work decoupled so each can be profiled and improved separately.

The viewer uses Three.js `WebGPURenderer`: native WebGPU where the browser offers it, otherwise its WebGL 2 backend, selected at runtime. Add `?webgl` to force the WebGL 2 backend for comparison. Browsers with neither get an explanatory message. Procedural assets replace mesh downloads with source code and client-side generation. The application still downloads JavaScript, cached geographic data and shared rendering dependencies; generated texture and geometry memory is separate from network transfer. Build output and the latest integration review are the authority for current compressed chunk sizes. Lazy scenes and the optional GLB exporter load separately; those chunk sizes should not be presented as a complete first-visit download.

## Model budgets and authoring

Favor the fewest polygons that preserve the fish's silhouette and close-view quality. The collection ceiling is **5,000 triangles and at most 2 draw calls per fish**, with lower counts preferred, with no textures unless they materially improve the result. These are project targets, not universal performance limits. The shared automatic LOD system reduces detail at distance across creatures, props and habitat, including bat-star colonies. Inspect all levels and retain per-level budget evidence; see [LOD policy](docs/lod.md).

| Tuna state | Triangles | Model draw calls |
| --- | ---: | ---: |
| Alive | **3,368** | **2** |
| Caught | **2,784** | **2** |

The original prototype used 18,156 triangles and 44 model draw calls. State variants share the body and rig; only the small face batches are duplicated in memory. The inactive face does not render.

Before the ripple-water revision, the aquarium measured **3,616 rendered triangles, 18 draw calls, 80 points and 12 edge lines**. The first ripple surface added 64,800 triangles. The same 48 × 27 m comparison tile now needs 5,904 triangles (91% fewer), while retaining fragment-shader ripple detail. The resized 12 × 6.75 m tank surface uses 396 triangles. Fish geometry counts are unchanged. Culling can change scene totals. The early optimization removed prototype outline shells, reduced tessellation and merged small meshes. Those prototype shells are removed; current rendering uses distance LOD without extra silhouette passes. The first dorsal and paired pectorals retain their own hinges.

**Procedural code does not inherently render faster than an authored GLB.** Once created or loaded, comparable geometry, materials, draw calls and animation have comparable rendering costs. Three.js documents the draw-call overhead of many separate meshes; glTF/GLB is designed for efficient runtime asset delivery. Procedural generation trades mesh downloads for startup computation and convenient parameter changes. The current fish already uses a vertex shader for body deformation. For larger schools, suitable batching, measured device performance, and possibly instancing or shared animation data will matter more than the choice of authoring tool.

Keep procedural modeling as the collection's default. The generated source controls geometry and proportions. GLB export is optional interchange; importing manually modeled meshes is outside the current direction unless explicitly requested. Reductions below come from batching and simpler geometry, not from avoiding the GLB file format.

Sources: [Three.js on reducing draw calls](https://threejs.org/manual/pages/optimize-lots-of-objects.html), [Khronos glTF overview](https://www.khronos.org/gltf/).

## Physics integration boundary

Physics is prepared in the model contract; **no physics engine or simulation is installed**. Each model has a rigid `root` for placement and a child `visual` for animation. `update()` never changes the root transform, so swimming can animate while a rigid body controls position and rotation.

`fish.physics` exposes coarse X-axis capsules, a center-of-mass estimate, and local mouth/grip points. Most fish use one capsule; the sunfish uses three stacked capsules to approximate its deep, thin body. These are cheap game proxies in metres relative to the rigid root, scaled with the selected specimen length. They are not measured biological shapes. They intentionally omit fin collisions and detailed body contact. The factory converts the visual and descriptors together; normal scene use requires no further scale conversion. Mass, buoyancy, drag, gravity, collision groups, solver settings and body lifetime belong to the future physics integration.

`bindFishPhysics(fish, adapter)` from `src/models/physics.ts` reserves physics ownership. Implement `adapter.readWorldPose(position, quaternion)` by filling the supplied Three.js objects with the engine's current/interpolated world pose. Call the returned `sync()` after stepping physics. It supports transformed, uniformly scaled parents and does not allocate new Three.js math objects each frame. Nonuniform parent scale/shear is outside this rigid-body contract.

The tank route only moves a fish whose `motionOwner` is `path` and whose life state is `alive`. Thus it cannot overwrite a physics pose, and caught fish can still be carried, dropped or moved by a future rigid body. `binding.detach()` leaves placement under `external` ownership; it does not destroy the host's body or unexpectedly restart the route. `swimmer.resume()` explicitly hands control back at the nearest route point, in the route's coordinate space. Detach the binding before disposing its host body.

`fish.physics.anchors.mouth` and `.grip` can become a fishing-line attachment or held-item constraint. Use them as local offsets; do not add visible socket meshes or per-fin rigid bodies just to prepare the model.

```ts
import { bindFishPhysics } from './src/models/physics';

const binding = bindFishPhysics(tuna, rigidBody); // host adapter
binding.sync();   // after the host physics step
binding.detach(); // when the host releases the body
```

## Add another fish

1. Add a factory under `src/models/` implementing `FishModel` from `src/models/types.ts`.
2. Implement **both alive and caught states**, with X eyes on both sides for caught fish. Keep proportions, materials and movement separate. Share materials and batch surfaces that move together. Never animate the placement root from the visual update.
3. Register the factory in `src/models/catalogue.ts`. The Tank creature selector automatically lists registered entries; the first entry is the initial selection.
4. Supply lightweight primitive collider data and mouth/grip anchors. The collection contract test automatically checks both states against the triangle/draw-call ceilings and permits at most three primitive colliders per fish.
5. Check the geometry budget, slow/fast/caught poses, side and oblique silhouettes, and swimming-route clearance. Adjust the route/tank if a new fish is larger.

## Validation

```sh
npm run typecheck
npm run check:docs
npm test
npm run build
# With the development server running and Chrome installed:
npm run test:browser
node tests/coastal-browser-qa.mjs
node tests/water-depth-browser.mjs
node tests/new-fish-browser.mjs
node tests/fish-style-browser.mjs
node tests/fish-style-capture.mjs
node tests/sardine-school-browser.mjs
node tests/ocean-sunfish-browser.mjs
node tests/local-fish-browser.mjs
node tests/great-white-shark-browser.mjs
node tests/style-tiers-browser.mjs
node tests/lod-browser.mjs
node tests/bat-star-browser.mjs
node tests/map-study-browser.mjs
node tests/gym-weather-browser.mjs
node tests/lovers-point-details-browser.mjs
node tests/schooling-browser.mjs
node tests/toon-style-browser.mjs
node tests/backend-qa.mjs
node tests/rim-review-browser.mjs
```

See the [test guide](tests/README.md) for coverage selection, output overrides, fixture provenance and current browser-inspection practices. `npm run test:browser` runs the original tank suite only. `npm run check:docs` validates local paths and Markdown heading links in maintained guides; it does not check remote websites or historical artifact contents.

The model, style, device setting, LOD, schooling, habitat, route, lifecycle, scale, budget and coastal-asset tests cover finite geometry, budgets, fin extension, matte materials, stable animation timing, GPU deformation, disposal, caught eyes, physics ownership, route clearance, fin attachment and shared batching. School checks also cover static pose buffers, independent phases, continuous loop seams, population changes, extraction and resource ownership. Fifty-three school browser checks verify actual draw scaling on three rendering paths, caught extraction, controls and mobile layouts. Thirty new-species browser checks cover small-fish framing, switching, both life states, phone controls and native WebGPU/WebGL 2 fixtures. Thirty-five existing tank browser checks cover swimming, travel, pause, cameras, keyboard/touch, caught state, static GPU buffers, mobile layout and reduced motion. Sunfish browser checks add fin-driven motion, tall-fish phone framing, X-eye states and measured draws on all three rendering paths. The local-fish suite covers sheephead, greenling and salmon on three render backends, arrow-key wraparound, focus rules, state preservation, disposal and phone layouts. `node tests/style-tiers-browser.mjs` checks the two device settings and retired-URL fallback on both backends. `node tests/lod-browser.mjs` checks every fish/object at every LOD, GPU submissions, animation, schools, automatic distance transitions and mobile layouts. All browser suites check for browser/shader errors. `PREVIEW_URL` overrides the QA URL; the original tank suite also accepts `BROWSER_CHANNEL`.

Run `PREVIEW_URL=http://127.0.0.1:5191/ node tests/coastal-browser-qa.mjs` for the coastal browser checks and refreshed GLBs in `artifacts/coastal/models/`. These cover water, buoyancy, object selection and GLB round trips, repeated resource disposal, keyboard/touch and reduced motion.

See coastal review (historical authoring evidence omitted from this public snapshot), coastal browser results (historical authoring evidence omitted from this public snapshot), original review notes (historical authoring evidence omitted from this public snapshot) and browser results (historical authoring evidence omitted from this public snapshot). Local Chrome measured a 16.7 ms median active frame interval and 17.3 ms p95; this is a local observation, not a cross-device performance guarantee. Vite's production build passes with a size advisory for the shared Three.js chunk; see [Browser support](#browser-support-and-rendering-backends) for the current bundle sizes.

## Project direction

Build and refine reusable models and assets first, with budgets and architecture that can scale to many objects, physics, and eventual multiplayer. Keep factories and presentation modular. The WebGPU path and WebGL 2 fallback are implemented. Once the asset foundation is established, expand into fishing gameplay, multiplayer and the [community contribution workflow](#long-term-vision-a-game-its-community-can-build-together); there is no networking or backend in this repository today.

## Reference limits

The tuna is a stylized single-view reconstruction: its hidden side and body width are inferred, and its exact species, physical size and fin-ray anatomy are unverified. The named species and habitat assets have their own linked sources in the asset register and reviews; their dimensions, proportions, markings and motion still include artistic choices. Blue/silver countershading and painted light bands adapt the tuna photograph to the requested cel-shaded look.

## Implementation history

These dated entries record earlier implementation work. Their test counts, captures, render paths and next steps describe that stage; they do not override the current instructions, asset register or later entries. Refreshed JSON/screenshots can supersede original measurements. See [CHANGELOG.md](CHANGELOG.md) for the consolidated changes and latest audit.

## Water and dockside assets — October 13, 2026

**Experiment:** can overlapping small waves and restrained reflections bring the supplied water reference into the collection's warm, stylized look, while the same waves support reusable boats?


- **Tank:** the former nearly invisible flat sheet now uses the shared ripple shader. Its transparent variant keeps the fish readable below the surface.
- **Area & buildings:** a small dockside display with the shared water, two floating boats, rods, tackle box and connected dock modules. Drag or use the focused canvas's arrow keys to orbit; scroll/pinch or `+` / `−` to zoom; Home or Reset view returns to the overview. Water detail opens a close view of the surface. The ripple slider spans still, gentle and breezy. Pause freezes both boats and water.
- **Objects:** pick any of the assets (six props at the time of this section), move through the collection with previous/next, inspect it on a turntable, or save a self-contained GLB. Preview geometry and exports retain metre scale. The camera frames the selected asset. Compare sizes shows all six assets on a 1 m grid with a 1.8 m height marker. Boat bows point +Z, up is +Y, and boat waterlines sit near Y=0. Dock deck height is Y=0.4526 m; gear rests near Y=0.

| Asset | Factory | Details |
| --- | --- | --- |
| Harbor spinning rod | `createFishingRod()` | Cork grip, reel spool and crank, guide rings, line and coral float |
| Bamboo float rod | `createFishingRod(true)` | Wrapped bamboo nodes, simple line and ochre float |
| Pedal surrey | `createSurrey()` | Green four-wheel pedal vehicle, yellow canopy, animated wheel/steering/crank groups; [scale, sources, LOD and Gym controls](docs/lovers-point-surrey.md) |
| Seafoam rowboat | `createRowboat()` | Open double-skin hull, wooden trim, floorboards, benches and wooden oars |
| Marigold cabin boat | `createCabinBoat()` | Wheelhouse, windows, railings, fenders, life ring and outboard |
| Timber dock section | `createDock()` | Planks, pilings, rope rails and mooring cleat |
| Coral tackle box | `createTackleBox()` | Rounded body, lid, handle, feet and brass latches |
| Giant green anemone | `createAnemone()` / `createAnemoneBed()` | Stout column, ribbed oral disc, recessed mouth and three rows of tapered giant-green tentacles; lighter instanced beds |
| park-bench | `createFurniture('park-bench')` | 1.700 × 1.040 × 0.532 m overall, provisional | Existing scene geometry; [audit and provenance](docs/asset-catalog-audit.md) | Static original design; no new surveyed measurements | 84 / 1; [all LOD costs](docs/asset-catalog-audit.md#added-to-objects) |
| park-litter-bin | `createFurniture('park-litter-bin')` | 0.540 × 0.930 × 0.540 m overall, provisional | Existing scene geometry; [audit and provenance](docs/asset-catalog-audit.md) | Static original design; no new surveyed measurements | 64 / 1; [all LOD costs](docs/asset-catalog-audit.md#added-to-objects) |
| cafe-chair | `createFurniture('cafe-chair')` | 0.430 × 0.875 × 0.430 m overall, provisional | Existing scene geometry; [audit and provenance](docs/asset-catalog-audit.md) | Static original design; no new surveyed measurements | 48 / 1; [all LOD costs](docs/asset-catalog-audit.md#added-to-objects) |
| cafe-table | `createFurniture('cafe-table')` | 1.060 × 0.795 × 1.060 m overall, provisional | Existing scene geometry; [audit and provenance](docs/asset-catalog-audit.md) | Static original design; no new surveyed measurements | 48 / 1; [all LOD costs](docs/asset-catalog-audit.md#added-to-objects) |
| cafe-parasol | `createFurniture('cafe-parasol')` | 2.500 × 2.650 × 2.500 m overall, provisional | Existing scene geometry; [audit and provenance](docs/asset-catalog-audit.md) | Static original design; no new surveyed measurements | 24 / 1; [all LOD costs](docs/asset-catalog-audit.md#added-to-objects) |
| aggregating-anemone | `createAnemone({species:'aggregating',seed:14})` | 0.067 × 0.051 × 0.066 m overall, provisional | Existing scene geometry; [audit and provenance](docs/asset-catalog-audit.md) | Static original design; no new surveyed measurements | 202 / 1; [all LOD costs](docs/asset-catalog-audit.md#added-to-objects) |
| Scuba gear rack | `createScubaRack()` | Dive locker crate, folded wetsuit, upright tank, mask and fins; on the gym's dive boat |

Factories live in `src/models/props/` and register in `catalogue.ts`. They return independent, unscaled Three.js Groups containing two toon-material batches (matte and metal). Editable component names remain in source and in `userData.sourceParts`; palette colors are carried by vertex attributes. Add another factory and catalogue entry to extend the picker. Call `disposeObject(group)` from `primitives.ts` when removing one. All six assets use the shared toon materials and procedural geometry, with no external textures.

Water is in `src/viewer/water.ts`: four directional waves share their parameters between GPU displacement and CPU buoyancy, with additional fine normal ripples, approximate sky reflections, Fresnel response and subtle refracted light. The objects are original artistic designs. The miniature shore is a presentation setting, not a reconstruction of a Monterey Bay location; no specific boat plan, fishing regulations or marine engineering suitability is asserted.

**Limits and next experiment:** reflections are an inexpensive sky approximation, without true scene reflections or boat shadows on the water; the depth revision below adds screen-space refraction. Boats are placed and gently tilted from wave samples, not simulated with hydrodynamics. GLBs are static; they do not include the custom water shader, bobbing, casting or rowing animations. Static props are now two material batches each. At this stage, repeated instances, distant levels of detail and the full-app TSL migration remained work. School instancing and the TSL migration have since shipped; distance-based detail remains future work. The clearest next experiment is a reusable casting animation that couples the rod tip, line, float and a small water-entry ripple. No multiplayer or backend was added.

## Scale and performance revision — October 13, 2026

The earlier dockside pass used arbitrary design units, oversized gear and an inspector that normalized objects to the same height. This revision keeps the world in metres and uses camera framing for close inspection. Nominal dimensions below refer to the actual object type; overall bounds can include oars, fenders, handles, line or antennas.

| Asset | Chosen representative size | Basis |
| --- | --- | --- |
| Spinning rod | 2.13 m shaft (7 ft) | [Ugly Stik GX2 rod lengths](https://www.uglystik.com/collections/spinning-rods/products/gx2-spinning-rod-1624495); original styling |
| Bamboo rod | 3.66 m shaft (12 ft) | [B'n'M manufacturer catalogue](https://images.carid.com/bnm-fishing/products/pdf/bnm-fishing-product-catalog.pdf); approximate pole length |
| Rowboat | 3.80 m hull × 1.45 m beam | Provisional small recreational rowboat target; exact source boat remains unestablished |
| Cabin boat | 5.52 m hull × 2.40 m beam | [Beneteau Antares 6 specification brochure](https://brochures.beneteau.com/antares/FR/publication/contents/templates/BNT_ANTARES_2022.pdf); original design, not a replica |
| Dock | 3.00 × 1.20 m deck; 0.45 m above water | Provisional modular design target |
| Tackle box | 41 × 23 × 21 cm case, plus raised handle | [Plano three-tray specifications](https://planofishing.com.au/product/three-tray-tackle-box/) |
| Scuba gear rack | 62 × 42 cm crate, 0.58 m tank | Artistic; tank shortened from a typical 0.66 m aluminium 80 for the stylized avatar |
| Tuna | 1.20 m total length | Provisional; specimen species/size unverified |

| Asset | Previous model draws → current | Previous triangles → current |
| --- | ---: | ---: |
| Spinning rod | 29 → 2 | 6,132 → 2,128 |
| Bamboo rod | 14 → 2 | 2,352 → 984 |
| Rowboat | 37 → 2 | 11,088 → 2,352 |
| Cabin boat | 58 → 2 | 12,480 → 3,020 |
| Dock | 74 → 2 | 12,276 → 2,052 |
| Tackle box | 10 → 2 | 2,916 → 372 |
| **Six-prop total** | **222 → 12 (95% fewer)** | **47,244 → 10,908 (77% fewer)** |

Counts are per model in one color pass; shadow rendering and viewer/environment geometry are additional. Two shared toon responses (matte and metal ramps) retain vertex colors. The current builds use no mesh or texture downloads. `scripts/asset-audit.ts` reports actual geometry and bounds. Tests enforce each prop's ceiling. Factory source components remain separate from the final rendering batches; add a separate batch only when a part must animate independently.

The standalone prop fixture at `tests/webgpu-assets.html` verifies these same generated props with `WebGPURenderer`, using native WebGPU and its forced WebGL 2 backend. Run `PREVIEW_URL=http://127.0.0.1:5191/ node tests/backend-qa.mjs`. This fixture does **not** switch the main viewer's backend. At this measurement stage the full app used classic WebGL. The subsequent full-viewer migration now runs these effects as TSL on both node-renderer backends. Three.js documents that custom `ShaderMaterial` / `onBeforeCompile` paths cannot simply be moved to WebGPURenderer: [official migration guidance](https://threejs.org/manual/pages/webgpurenderer).

See `artifacts/performance/` for before/after counts, backend results and scale comparison evidence.

## Water depth and underwater inspection — October 13, 2026

The second water pass revisits the supplied video: quieter, irregular blue-silver reflections, fine directional ripples and a clearer teal foreground. Water color now responds to actual geometry beneath the surface. A half-resolution color/depth capture refracts the seabed and submerged objects; absorption increases with the distance through water. Capture width is capped at 1,024 pixels. The above-water tank keeps its inexpensive transparent variant.

**View it:** Area & buildings → **Water detail** or **Underwater**. The direct link is `?tab=area&view=underwater`. Underwater starts at 2 m depth. **Viewing depth** spans 0.5–5.5 m, moving offshore for the deepest views; **Visibility** varies the artistic haze/absorption setting from 6–24 m. Drag, touch/pinch, arrow keys and +/− still work. The camera can cross the surface manually, and the haze follows its actual position. Reset view returns to the overview. Reduced motion starts paused; explicit Play animates water, boats, fish and seabed light together.

The former solid display block is now an open water volume above a sandy shelf, approximately 1.25–7.5 m deep. Submerged pier supports, a giant-kelp forest (originally simple ribbons; now `createGiantKelp()` plants, see the asset register), instanced rocks, two existing sardines and a blue rockfish make the depth legible. All sizes stay in metres. These depths, visibility labels and plant shapes are **artistic test settings**, not surveyed bathymetry, measured optical visibility or a botanical reconstruction.

`src/viewer/bathymetry.ts` owns the shared depth profile. `seabed.ts` builds five rendering batches; `water.ts` owns the surface and refraction target; `harbor.ts` places the scene and wildlife. Static shore details are combined into one batch. The 32 × 24 m surface remains **3,456 triangles / one draw per color pass**. Refraction adds an additional, reduced-resolution scene pass; the final renderer counter alone does not represent its total cost. Shadow updates are skipped during capture. See `artifacts/water-depth/browser-qa.json` for capture and main-pass counts separately.

*Update (later on October 13):* the water and caustics are now TSL on `WebGPURenderer`, and refraction reads a once-per-frame viewport color/depth copy instead of a second, half-resolution scene pass; see the [WebGPU viewer section](#shader-system-decision-tsl-on-webgpurenderer). Original note: this extended the then-current **WebGL** water path. Reflection remains an approximation of the sky, and screen-space refraction cannot recover geometry outside the camera view. That planned TSL port is now complete; current work focuses on kelp sway and target-device profiling.

Run `PREVIEW_URL=http://127.0.0.1:5191/ node tests/water-depth-browser.mjs` for depth, visibility, surface crossing, pause, resource reuse and phone-layout checks. See water review (historical authoring evidence omitted from this public snapshot), surface (historical authoring evidence omitted from this public snapshot) and underwater (historical authoring evidence omitted from this public snapshot).

## Toon style revision — October 13, 2026

**Experiment:** can the whole collection move from mixed PBR + one custom cel shader to a single shared cel style, closer to the reference look, without raising draw or triangle budgets and without blocking WebGPU?

- **Result:** yes. All props, shore, seabed, kelp, rocks, sardine (single and instanced school) and rockfish now render with `MeshToonMaterial`, using one generated ramp texture. The lighting rig changed from flat ambient + sun to a hemisphere sky fill + warm sun. A one-draw sky dome replaces the dark void. Water reflects the same sky and uses hard glints. The tuna's custom shader takes its key light from the shared sun.
- **Budgets:** model triangles and draws are unchanged (props still 2 draws each; the WebGPU fixture still measures 13 draws / 10,909 triangles for six props). The scene adds one sky draw (~550 triangles) on the Area and Objects tabs. Toon shading drops the GGX specular/environment work of standard materials, and hard PCF is cheaper than soft PCF. Local Chrome tank timing: 16.6 ms median / 17.6 ms p95 (vsync-bound, same as before; not a cross-device guarantee).
- **Backends at this stage:** the WebGPU fixture (`tests/backend-qa.mjs`) rendered the toon props on native WebGPU and forced WebGL 2; the main viewer was classic WebGL. The later full-viewer migration completed the remaining TSL shaders.
- **Verified:** `npm test` (45), `npm run build`, and browser suites: tank 35, coastal 53, water-depth 29, new-fish 30, toon-style 4 checks (no non-toon meshes, GLB export clean, no console errors). The sardine-school suite's "Pause freezes school and path" check is **intermittent, and fails the same way on the untouched `water-depth` baseline**. It compares follow-camera distance while orbit damping is still settling; that is a test issue, not a style regression.
- **Rough edges at this stage:** the early renderer had fewer style features. Current art direction is described above. The overview's lower sky reads as flat sea-teal. The Objects compare grid floats on the studio gradient. Tank lighting is only retuned, not restyled.
- **Next experiment at this stage (since completed):** a TSL toon node (`MeshToonNodeMaterial` plus a rim term from `STYLE`), applied to the props first and then ported to the tuna wave shader. Compare WebGPU vs WebGL 2 frame time on a phone, and keep this ramp so both paths look identical.

Evidence: artifacts/toon-style/ (historical authoring evidence omitted from this public snapshot) (`harbor-overview.png`, `water-detail.png`, `underwater.png`, `rowboat.png`, `cabin-boat.png`, `compare.png`, `tuna.png`, `rockfish.png`, `sardine-school.png`, `browser-qa.json`).

**Docs audit:** The original written reviews are preserved in this consolidated repository alongside the newer toon-style evidence. Earlier working copies omitted those files; the links now resolve here.

## Avatar Creator and Lovers Point Testing Gym

Create an original character in **Avatars**, adjust **You → Height (1.20–1.80 m) and Build**, add **Face → Face lines: None / Soft / Defined**, change tops and bottoms independently, preview walk/run/swim/tread/emotes, and save it in this browser. Download/import a JSON recipe to move a design between browsers. **Try in Testing Gym** takes the current design into a bounded Lovers Point world; the gym also loads saved characters. Walk with WASD/arrows or the touch buttons, jump with Space or the touch Jump button, hold Shift/toggle Run, drag to look, and press **E** near a station. Gym tools (character picker, Back to start, Try swimming, Park overview, controls and rendering notes) sit in one **Menu**; station prompts appear only when one is in reach. **Q** opens an emote wheel; standard gamepads are supported. While swimming, **C** dives; board the **dive boat** at the pier's end, drive it out to the kelp-forest [dive site](docs/gym-dive-site.md) and put on scuba gear with an unlimited tank. See [jumping, emotes, controller, diving and scuba](docs/avatar-creator.md#jumping) and the [real-world data and reference comparison](docs/lovers-point-real-world-data.md). Pick up the existing library rod, try its casting pose, use the Sit emote or inspect the other props and bat star. At the dock, press **E** or tap **Board the rowboat**; W/S rows forward/back, A/D steers, and Shift or the touch speed button rows faster. Return near the dock and press **E** to step ashore. **Back to start** safely resets both character and boat. See [boat controls and limitations](docs/gym-boat.md).

**Try swimming** starts a beach exercise: walk into deep water to swim with WASD/arrows or touch. Hold **C** or the touch Dive control to descend; **Space** swims upward. Without scuba gear, the **20-second breath meter** counts down only while the head is underwater, warns at 5 seconds, and returns an exhausted character to their last safe shore position. Surfacing, wading, reaching land or boarding either boat immediately resets breath to 20 seconds and hides the meter; the dive boat's scuba gear supplies unlimited air. These are authored game rules. [Swimming, diving and breath](docs/avatar-creator.md#swimming-and-breath).

The standard avatar uses **one skinned draw, one material, 17 bones and zero image textures**. Otter Man adds four exhaust bones within the same draw; its dedicated budget is 21 bones. The standard avatar’s default Near/Mid/Far levels are **3,453 / 1,720 / 684 triangles**; all 810 appearance combinations stay at or below **4,270** against a 5,000 ceiling. Height defaults to 1.45 m; the supported size range and proportions are artistic. Outfits, collision clearance, swimming depth and seating follow the chosen size; movement speed and breath remain the same. Size sliders keep the same geometry and draw budgets. See the sizing review (historical authoring evidence omitted from this public snapshot). The park's current Near ceiling is **38 draws / 69,472 triangles** including six monarch butterflies; the reef has its own **44 draws / 80,000 triangles** and is hidden when distant. Avatar, sky, ground contact and backend overhead are counted separately. The park follows OSM coast, roads, paths, beaches, pool/court and footprints, with photo-informed scenery and cached USGS elevation. See [gym geography](docs/testing-gym-geography.md). Both boats use lightweight kinematic controllers, not rigid-body or fluid physics. Actual multiplayer scaling and catching fish remain later experiments.

See [creator controls, saving, animation and performance](docs/avatar-creator.md), [geographic sources](docs/testing-gym-geography.md), and browser review (historical authoring evidence omitted from this public snapshot). The review records dated feature-chunk compression estimates separately from shared dependencies; they are not a complete first-visit download or development-server transfer.

## Asset register

Every reusable asset, its factory, size basis, what is **verified** (with a source) vs **artistic**, and its budget. Add a row for each new asset.

| Asset | Factory | Size basis | Verified (source) | Artistic choices | Budget (tris / draws) |
| --- | --- | --- | --- | --- | --- |
| Caledonia Park and neighborhood | `createCaledoniaArea()` | 285 × 360 m district plus 95 × 75 m Meals site; mapped court ~30.75 × 17.43 m | OSM boundaries/routes/buildings, USGS terrain, city playground gallery, court and official center photos; [provenance](docs/caledonia-park.md) | Seed 251025; grading, widths, furniture, planting, play equipment and building heights; static, walking/flight collision | Ceiling 45,000 / 8; measured 44,497 Near triangles / 8 draws; no image textures |
| Monterey Bay regional landscape | `createBayRegion()` | 37.5 × 53.4 km, approximate local projection; metres without height exaggeration | NOAA/CA CDT shoreline, USGS terrain/highways/GNIS, NOAA ETOPO1; [provenance](docs/monterey-bay-region.md) | Palette, spatial batching, regional simplification and 600 m local transition; static view and seafloor toggle | Ceiling 85,000 triangles / 40 mesh draws; zero image maps; measured costs (historical authoring evidence omitted from this public snapshot) |
| Otter Man exploration suit | `createOtterManSuit()` / `createAvatarModel(design, {gear: 'otter-man'})` | 1.47 m display; worn version follows 1.20–1.80 m avatar sizing; fictional | Original procedural otter-inspired design | Equip, walk, hover, fly, dive, illuminate, land and return outfit; no real equipment claim | 2,848 worn / 2,560 display Near triangles; 1 draw; underwater bubbles add at most 864 triangles / 1 draw; ceiling 5,000 / 1; no image maps; [controls and budget](docs/otter-man.md) |
| Coastal wildlife and kelp assembly | `createCoastalLife()` | Metres; 4 m shark, existing library fish sizes, kelp fitted to authored depth | NOAA habitat context; see [sources](docs/coastal-life.md) | Seed 241027; 120 plants, 54 animals, closed routes and decorative sway; not a sightings database | Near/Mid/Far 134,140 / 66,424 / 26,720; 26 draws; ceiling 140,000 / 32; no new image maps |
| Park and coastal gulls | `createGymGulls()` | Six ground gulls plus eighteen flying; library metre scale | Existing Western gull references; [placement guide](docs/western-gull.md#park-and-coastal-population) | Seed 261026; coastal lawn/beach sites, independent offshore routes and player-triggered escapes are authored behavior | 8,112 / 3,360 / 624 triangles at Near/Mid/Far; 9 draws before culling, with a separate park-wildlife budget |
| Waterfront trail detail assembly | `addWaterfrontTrail()` | Benches 1.8 m; facility dimensions provisional | Retained OSM node positions and city inventory facility types | Infill, orientation, dimensions and planting; static, simple furniture collision | Shared waterfront ceiling 100,000 / 90; [source and state record](docs/coastal-life.md) |
| Tuna | `createTunaModel()` (`src/models/tuna/`) | 1.20 m, provisional | Shape traced from the supplied photo (`public/references/tuna.jpeg`); species/size **not** verified | Countershading bands, cel shading, motion | 3,368 / 2 (ceiling 5,000 / 2) |
| Pacific sardine | `createPacificSardineModel()` | 0.25 m representative | Body, back color, spots, forked tail ([NOAA](https://www.fisheries.noaa.gov/species/pacific-sardine)); max 38 cm ([MBA](https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/pacific-sardine)) | Exact markings, cross-section, motion | 1,468 / 2 |
| Sardine school | `createSardineSchool()` + `createSchooling()` | 0.25 m ± 10% per fish | Sardines school in dense, polarized groups (same sources) | Spacing, envelope, size spread, steering weights | 1 draw per school; 1,468 tris per fish |
| Blue rockfish | `createBlueRockfishModel()` | 0.35 m representative | Kelp-forest habitat ([NOAA MBNMS](https://montereybay.noaa.gov/gallery/photos-and-videos.html)); max 53 cm ([CDFW](https://wildlife.ca.gov/Fishing/Ocean/Fish-ID/Quiz)) | Mottling, fin shapes | 1,872 / 2 |
| Ocean sunfish | `createOceanSunfishModel()` | 1.20 m length / 1.82 m fin span, artistic | Compressed body and clavus ([MBA](https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/ocean-sunfish)); paired-fin propulsion ([study](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0003446)) | Proportions, markings, stroke rates and amplitudes | 1,668 / 2 (ceiling 1,800 / 2) |
| California sheephead | `createCaliforniaSheepheadModel()` | 0.55 m artistic adult male | Male color phase, white chin, canines, Monterey range ([MBA](https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/california-sheephead)) | Exact proportions, fin shapes, palette and motion | 1,692 / 2 (ceiling 2,000 / 2) |
| Kelp greenling | `createKelpGreenlingModel()` | 0.35 m artistic female | Female colors and size ([ODFW](https://nrimp.dfw.state.or.us/mrp/default.aspx?page=74)); Monterey sampling ([CDFW](https://wildlife.ca.gov/Conservation/Marine/Nearshore/1000)) | Exact freckles, fin contours and motion; lateral-line detail omitted | 1,796 / 2 (ceiling 2,000 / 2) |
| Chinook salmon | `createChinookSalmonModel()` | 0.80 m artistic ocean-phase adult | Blue-green back, black speckles on upper half and tail, silver sides, white belly; ~3 ft / up to 120 lb ([NOAA](https://www.fisheries.noaa.gov/species/chinook-salmon-protected)); spots on both tail lobes, black gums ([WDFW](https://wdfw.wa.gov/sites/default/files/2024-08/pacific-salmon-id-card-2024-4.pdf)); Monterey Harbor/Santa Cruz releases ([CDFW via CEQAnet](https://ceqanet.lci.ca.gov/2025030879)) | Proportions, fin contours, spot count/placement, hues, swim rates; gums omitted; adipose intact | 1,976 / 2 (ceiling 2,000 / 2) |
| Garibaldi | `createGaribaldiModel()` | 0.28 m artistic adult | Orange adult, deep body, heart-shaped tail; Monterey Bay is the northern range edge ([MBA](https://www.montereybayaquarium.org/es/animales-y-el-oceano/animales-de-la-a-a-la-z/jaqueta-garibaldi)) | Exact proportions, subdued orange palette, fin outlines and swim tuning; no juvenile blue spots | 1,456 alive / 1,268 caught; 2 draws (ceiling 1,600 / 2) |
| Lingcod | `createLingcodModel()` | 0.85 m artistic adult | Rocky-bottom solitary predator, variable brown/green coloring, pale belly, large toothy mouth ([MBA](https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/lingcod)) | Olive morph, deterministic vertex-color mottling, four visible fangs, fin shapes and tank cruise; no hunting behavior | 1,652 alive / 1,464 caught; 2 draws (ceiling 1,800 / 2) |
| Green sea turtle | `createGreenSeaTurtleModel()` | 1.15 m nose to tail, artistic adult | Round beak, long front flippers, rear rudders and shell; Open Sea resident ([MBA](https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/green-turtle)) | Scute layout, colors, specimen dimensions, 0.28/0.72 Hz strokes and 0.20/0.65 m/s routes | 1,670 alive / 1,422 caught; 2 draws (ceiling 1,800 / 2) |
| Moon jelly | `createMoonJellyModel()` | 0.25 m bell, artistic adult | Translucent bell, four horseshoes, short fringe and oral arms ([MBA](https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/moon-jelly)) | Pulse 0.45/0.8 Hz, route 0.015/0.035 m/s, stylized caught contraction; no eyes | 1,482 / 2 (ceiling 1,600 / 2) |
| Great white shark | `createGreatWhiteSharkModel()` | 4 m representative total length | Conical snout, large triangular dorsal, crescent tail, abrupt grey/white boundary; male maturity 3.5–4.1 m, estimated maximum about 6 m ([Florida Museum](https://www.floridamuseum.ufl.edu/discover-fish/species-profiles/white-shark/)) | Seeded girth/pigment, exact proportions, 0.48/1.12 Hz tailbeats, 0.70/1.8 m/s route; closed mouth, no teeth/denticles | 1,908 alive / 1,648 caught; 2 draws (ceiling 2,000 / 2) |
| Giant Pacific octopus | `createGiantPacificOctopusModel()` | 3 m fully extended arm-span class, artistic | Red/pink skin, eight sucker-lined arms and 2–4 m or greater span ([MBA](https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/giant-pacific-octopus)); crawl and siphon jet ([NOAA](https://www.fisheries.noaa.gov/science-blog/view-inside-kodiak-lab-aquarium-post-4)) | Seeded pigment, 112 simplified cups, 74-bone crawl/jet, 0.045/0.65 m/s authored travel; coarse mantle collider | 4,482 alive / 4,234 caught; 2 draws (ceiling 4,500 / 2) |
| Giant sea bass | `createGiantSeaBassModel()` | 1.5 m selected adult | Adult grey body/spots, large mouth, broad fins and slow reef cruising ([MBA](https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/giant-sea-bass)); reported maximum 2.3 m | Seeded markings/girth, exact proportions, 1 m lower range endpoint, 0.42/1.15 Hz strokes and 0.16/0.72 m/s routes | 2,180 alive / 1,992 caught; 2 draws (ceiling 2,200 / 2) |
| Gray whale | `createGrayWhaleModel()` (`src/models/gray-whale/`) | 12 m authored adult, 11.1–15.2 m reference span | Mottled body, no tall dorsal fin, low hump/knuckles and paddle-like flippers ([NOAA](https://www.fisheries.noaa.gov/species/gray-whale)); adult lengths ([Canada COSEWIC](https://www.canada.ca/en/environment-climate-change/services/species-risk-public-registry/cosewic-assessments-status-reports/grey-whale/chapter-5.html)) | Sparse barnacle hints, vertical fluke stroke, 0.17/0.42 Hz authored rates; in-place inspection only, excluded from Demo population | 1,520 alive / 1,484 caught; 2 draws (ceiling 1,800 / 2) |
| Purple sea urchin | `createPurpleUrchin()` / `createUrchinColony()` | 5 cm test, 7–8 cm spiny envelope | Purple spines and tube feet ([MBA](https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/purple-sea-urchin)) | Representative size, simplified feet, conservative 1 cm/min crawl | 1,818 / 1 (ceiling 2,000 / 1) |
| Giant green and aggregating anemones | `createAnemone()` / `createAnemoneBed()` | Authored 14 cm / provisional 5 cm oral discs; giant-green column 5.5 cm | Aquarium [giant green](https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/giant-green-anemone) crown reference up to 17.8 cm, checked October 25; [aggregating](https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/aggregating-anemone) | Photo-informed giant-green crown, disk and mouth; counts, dimensions and colors are artistic. Static, seeded, no tentacle animation; current review (historical authoring evidence omitted from this public snapshot) | Giant-green Near/Mid/Far: 1,984 / 388 / 352; beds: 388 / 352 / 190 per animal; one draw per species bed. Aggregating unchanged at 202 Near |
| Scuba gear rack | `createScubaRack()` | 62 × 42 cm crate, 0.58 m tank; artistic | No measured product dimensions claimed | Folded suit, mask and fins are simplified; tank is shortened for the avatar | Ceiling 600 / 1; placed on the gym dive boat |
| **Giant kelp** | `createGiantKelp({height, fronds, canopy, bladeSpacing, canopyDensity, juvenile, seed})` (`src/models/habitat/giantKelp.ts`) | 6.0 m inspection plant; scene plants fit the local depth | *Macrocystis pyrifera*: branching **holdfast** on rock, flexible **stipes**, a **gas bladder** at the base of each blade, fronds reaching the surface to form a **canopy**, splitting **growth tip**, golden-brown color, ~30 m typical / 53 m max height ([MBA](https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/giant-kelp)) | Frond count (random 2–4), juvenile share, blade size/spacing, canopy meander, exact hues, shallow scene heights | Worst case over 60 seeds 1,994 / 1 (ceiling 2,200); scene forest of 11 plants 4.8k / 1 |
| Bat star | `createBatStar()` / `createBatStarColony()` (`src/models/habitat/`) | 0.18 m artistic diameter | Five webbed arms and species reference ([MBA](https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/bat-star)) | Orange/purple palette, markings, thickness and very slow crawl | 814 near / 306 colony triangles; 1 draw (ceilings 850 / 400); one instanced draw per colony |
| Pacific Grove Museum of Natural History | `createPacificGroveMuseum()` | Fitted 37.83 × 33.04 m building envelope; garden extends to about 40 m | [Official public plans, photo references and OSM placement](docs/pacific-grove-museum.md) | Original low-poly architecture, empty interior galleries, estimated heights/floor datum, explicit floor selection | Ceiling 26,000 / 8; shared LOD, six batches; review (historical authoring evidence omitted from this public snapshot) |
| Jewell Park district assembly | `addJewellPark()` | OSM boundary and feature pins; structure/furniture sizes provisional | [City inventory and retained OSM](docs/museum-district.md) | Seed 241025; gazebo, Little House, seven benches, eight trees, paths and boundaries; static, simple collision | Included in shared waterfront ceiling 100,000 / 90; no image textures |
| Lovers Point sailing boy | `createSailingBoyStatue()` | About 2 m including boulder; provisional | Fowler bronze, life-size figure and 1990 installation ([PGHS newsletter](https://www.pghsaa.org/newsletters/KOII-March-2014-Sm.pdf)); historic GPS pin | Low-poly likeness, pose details, patina, hidden surfaces, dimensions and heading | 2,184 / 1 (ceiling 2,400 / 1); [LOD and source review](docs/lovers-point-statues.md) |
| Lovers Point Monarch Butterfly | `createButterflyStatue()` | About 1.75 m including pedestal; provisional | Gordon Newell granite sculpture ([local art guide](https://www.93950.com/public.htm)); historic GPS pin | Wing contours, carved panels, hidden back, dimensions and heading | 648 / 1 (ceiling 1,000 / 1); [LOD and source review](docs/lovers-point-statues.md) |
| Living monarch butterfly | `createMonarchButterfly({seed, wingspanMeters, pose})` (`src/models/habitat/monarch-butterfly/`) | 10 cm open wingspan; adult range 8.5–12 cm | Orange upper wings, black veins, light spots and distinct reverse pigment ([Florida Museum](https://www.floridamuseum.ufl.edu/wildflowers/butterfly/monarch/)); seasonal Pacific Grove presence ([local museum](https://www.pgmuseum.org/monarchs)) | Sparse markings, 160-triangle body, muted leaf-brown underside, 4.2 Hz beat and glide; Flying / Wings open / Wings folded poses; Group previews 1 / 32 / 128 / 256 with independent instanced wingbeats | 912 / 1 per individual (ceiling 1,000 / 1); groups share one draw and 912 / 560 / 212 triangles per butterfly across LODs; batch contract and costs (historical authoring evidence omitted from this public snapshot); LOD, geometry storage and browser review (historical authoring evidence omitted from this public snapshot) |
| Southern sea otter | `createSeaOtter({seed,pose,lengthMeters})` (`src/models/habitat/sea-otter/`) | Authored 1.20 m nose-to-tail adult; combined adult reference range 1.00–1.50 m | Southern subspecies, pale broad face, small forepaws, webbed hind feet and separate tail; inspected Aquarium/FWS photos and NOAA grooming frames; [sources and measurement limits](docs/sea-otter-references.md) | Seeded coat tint, rounder head and shorter bent forelimbs; floating/grooming/prone swimming/dive articulation; Tank surface cycle, coarse torso collider and bind-frame anchors | Near/Mid/Far **730 / 418 / 176** triangles; **one draw**, 12 bones; Tank caught X eyes add 8 triangles / one draw. Normal geometry: 60,084 authoring/WebGL 2 bytes, 74,980 after WebGPU conversion. [API](src/models/habitat/sea-otter/README.md); review (historical authoring evidence omitted from this public snapshot) |
| Black-tailed deer · doe and fawn | `createDeer({variant,seed,pose})` (`src/models/habitat/deer/`) | Broad adult body-length reference 1.35–1.65 m; authored doe 1.58 m / 0.86 m shoulder, fawn 0.96 m / 0.58 m shoulder | Local Columbian black-tailed deer, inspected adult/fawn photos and broad State Parks range; [sources and limits](docs/deer-references.md) | Antlerless adult, separate spotted-fawn proportions, walk/gallop/graze, seeded coat; family groups at three source-backed park/course sites, player avoidance and distance sleep | Doe 616 / 358 / 174, fawn 680 / 390 / 174 Near/Mid/Far triangles; one draw each, 18 bones; six Gym animals 3,888 / 2,244 / 1,044 and six draws before culling. [API and behavior](docs/deer.md); evidence (historical authoring evidence omitted from this public snapshot) |
| Western gull · male and female | `createWesternGull({sex,seed,pose})`, `createGullFlock({sex,seed,count,capacity})` | Male 65 cm / 1.37 m wingspan; female 59.8 cm / 1.2604 m; selected specimens within overlapping adult ranges | Western gull anatomy and 56–66 cm / 120–144 cm combined-sex range ([Cornell](https://www.allaboutbirds.org/guide/Western_Gull/id)); similar adult plumage and slightly larger males ([Audubon](https://www.audubon.org/field-guide/bird/western-gull)) | Seeded mantle tint, simplified webbed feet/wings; authored flap/glide, stand, walk and finite poop action; female cream/lavender palette is an explicit artistic distinction | Single 380 / 170 / 32 triangles, 1 draw; ceiling 400 / 1. Sky groups 324 / 130 / 24 per gull, **one draw up to 1,024 birds**. [API, sources, LOD storage and limits](docs/western-gull.md); browser evidence (historical authoring evidence omitted from this public snapshot) |
| Monterey cypress | `createCoastalTree({species:'monterey-cypress',seed,heightMetres})` | 8 m authored specimen | Native Monterey Bay evergreen; broad irregular crowns ([UF/IFAS](https://ask.ifas.ufl.edu/publication/ST224)) | Sparse crown clusters, simplified trunk/branches; static, no leaves/cones/wind simulation | Near/Mid/Far **200 / 144 / 68**, one draw; ceiling 260 / 1 |
| Monterey pine | `createCoastalTree({species:'monterey-pine',seed,heightMetres})` | 9 m authored specimen | Native coastal pine ([USDA](https://plants.usda.gov/DocumentLibrary/plantguide/pdf/pg_pira2.pdf)) | Tiered adult silhouette; no individual needles or cones; static | **200 / 144 / 68**, one draw; ceiling 260 / 1 |
| Coast live oak | `createCoastalTree({species:'coast-live-oak',seed,heightMetres})` | 6 m authored specimen | Native evergreen oak ([USFS](https://research.fs.usda.gov/feis/species-reviews/queagr)) | Broad rounded crown clusters, simplified branching; no individual leaves/acorns; static | **244 / 176 / 82**, one draw; ceiling 260 / 1 |
| Introduced park trees | `createCoastalTree()` with `pohutukawa`, `canary-island-date-palm`, `cabbage-tree`, `inventory-holly` | Authored 5 / 8 / 4 / 3 m specimens | Taxa and positions from [Pacific Grove inventory](https://gis-web.cityofpacificgrove.org/arcgis/rest/services/Open_Data/Trees/MapServer/0); holly only identified to genus | Static silhouette proxies, not native replacements or measured individuals | Near **244 / 104 / 104 / 200**, one draw each; ceiling 260 / 1; [sources and costs](docs/coastal-trees.md) |
| Aquarium interior study | `createAquarium()` (`src/models/aquarium/`) | Metres; OSM-anchored outer footprint | Major tank envelope/height references ([MBA](https://www.montereybayaquarium.org/about-us/about-the-aquarium/newsroom/media-kits/facts-and-figures)); exhibit adjacency from visitor maps | Room sizes, tank footprints except Open Sea, floor elevations, rounded shapes, route graph and service-flow schematic | First floor 3,208 / 8; upper floor 1,048 / 7; ceiling per floor 3,500 / 8, excluding 2–3 guide-line draws |
| Coastal avatar | `createAvatarModel()` (`src/models/avatar/`) | 1.20–1.80 m nominal, default 1.45 m; build 0.80–1.25; hair adds variation; artistic | Procedural metre bounds and 810 variant combinations verified by tests; user-supplied creator screenshots are style references | Original face, adjustable height/build, five hair styles, optional face lines, modular clothes, blinking and idle/walk/run/swim/tread/wave/cheer/sit/cast poses | Default 3,453 / 1; max 4,270 / 1; ceiling 5,000 / 1; no image maps; [full budget](docs/avatar-creator.md) |
| Gallery visitor silhouettes | `createGalleryVisitors()` | Nine people; adults 1.58–1.85 m, children 1.20 / 1.30 m | Exact chosen metre heights, floor contact and scale verified in tests; not measurements of real visitors | Proportions, clothes, poses, placement and tiny idle movements | 2,682 / 1; ceiling 2,800 / 1 |
| Spinning rod, bamboo rod, rowboat, cabin boat, dock, tackle box | `src/models/props/` (see the size table above) | Sourced or provisional per row | Size references only ([table](#scale-and-performance-revision--october-13-2026)) | Original designs, not replicas | 372–3,020 / 2 each |

**Procedural randomness:** kelp is the first random asset. `createGiantKelp()` without `seed` makes a new plant each call and records `userData.seed`; pass the seed to rebuild it. Scenes pass fixed seeds so layouts are stable, and tests check budgets across 60 seeds. The Objects tab's **Regenerate** button shows variations. New natural assets (rocks, grass, other algae) should follow this pattern.

**Scene composition and presentation systems** (not standalone asset-register entries; add a factory and row when scenery becomes a reusable library asset):

- **Seabed** (`src/viewer/seabed.ts` + `bathymetry.ts`): sandy shelf 1.25–7.5 m deep, 18 instanced rocks, caustics, volume sides. Depths are an artistic test profile, not surveyed bathymetry.
- **Lovers Point café terrace**: `addCafeTerrace()`; four 2.5 m parasols, tables and eight chairs, 672 static triangles folded into existing spatial batches. Photo-inferred dimensions and placements; [component records and limits](docs/recreation-area.md).
- **Lovers Point pool gate and recreation fixtures**: `createPoolGate()` / `addRecreationTrail()`; a 1.65 × 1.15 m opening leaf, one draw / 144 Near triangles, plus batched benches, bins and trail barriers. Dimensions and positions are photo-informed estimates. [States, scale, sources and limitations](docs/recreation-area.md).
- **Lovers Point gym** (`src/viewer/testingGym.ts`): mapped coastline, paths, beaches, pool/court and footprints with municipal-inventory trees, seeded rocks and library stations. Spatial instancing and shared LOD keep detail inspectable; terrain follows USGS data, while structures and exercise placements remain approximations. [Geographic source record and current costs](docs/testing-gym-geography.md).
- **Offshore gray whales** (`src/viewer/testingGym/whalePod.ts`): a mother and calf with a second adult surface beyond Lovers Point, spout and occasionally breach. **Testing Gym → Menu → Gray whales** frames the pod. The real-scale rigs use shared LOD; the small Tank Demo still excludes them. [Placement, source limits and separate performance budget](docs/gym-whale-pod.md).
- **Shore setting** (`src/viewer/harbor.ts`): sand island, grass bank, boulders, grass tufts, pier extensions. A presentation diorama, not a Monterey Bay location. Next factory candidates: `createShoreRock()` and `createGrassTuft()` with the kelp's seed pattern.
- **Water** (`src/viewer/water.ts`): coastal wave/reflection look based on the supplied video; not a measurement of sea state. Tank water uses `src/viewer/openSea/waterLook.ts`: one batched enclosure, generated caustic texture and optical-depth shading; artistic water optics.
- **Inspection sky** (`src/viewer/sky.ts`) and **tank** (`src/viewer/tank.ts`): presentation only. The Gym uses `src/viewer/gymWeatherSky.ts` for the procedural atmosphere and `src/viewer/gymWeatherSystem.ts` for its controls, data lifecycle, fog and scoped lighting; `src/data/gymWeather.ts` and `skyAstronomy.ts` provide weather and astronomical directions.
- **Proposed additions:** bull kelp (*Nereocystis luetkeana*, single stipe and one large float), more urchin species and reusable Cannery Row architecture/cypress assets. Purple urchins and the southern sea otter already have library factories; the Gym already has authored buildings and seeded cypress scenery.

## Schooling, rim light and giant kelp — October 13, 2026

**Experiments:** (1) Can a general schooling algorithm replace the boxy sardine formation, with per-fish size variation, inside the same draw/bounds contract? (2) Does a TSL rim light deliver the reference look on WebGPU with acceptable cost, and should TSL be our shader system? (3) Can kelp become a researched, random procedural factory?

- **Schooling:** yes. The sardine school is now a bending, breathing ellipsoid of steering fish with ±10% sizes. It's still one draw. 256 fish cost about 0.5 ms per update on the CPU. See [Schooling algorithm](#schooling-algorithm-any-schooling-species). Evidence: `artifacts/schooling/` (`school-side.png`, `school-top.png`, `school-front.png`, `school-follow.png`; `node tests/schooling-browser.mjs`).
- **Rim and TSL:** yes. See [Shader system decision](#shader-system-decision-tsl-on-webgpurenderer). This experiment initially used a standalone node-renderer path; rim light is now in the main viewer at Standard.
- **Kelp:** `createGiantKelp()` is registered in the Objects collection, used for the seabed forest, randomized per call, and documented with verified anatomy. Evidence: `artifacts/toon-style/giant-kelp*.png`, `underwater.png`.
- **Tests fixed:** the sardine browser suite's pause check was intermittently failing (also on the `water-depth` baseline) from ~1e-15 camera-distance noise. That revision compared to a micrometre and passed 3/3 runs. The consolidated check asserts frozen fish state and travel independently of camera damping.
- **Budgets changed (deliberately):** seabed ceiling 5,500 → 9,000 triangles (8,710 measured at that stage); the kelp forest itself is one instanced draw; kelp prop 2,200 / 1.
- **Verified:** `npm test` 52/52, `npm run build`, and browser suites: tank 35, coastal 57, water-depth 29, new-fish 30, sardine-school 53 (3/3 runs), toon-style 5, backend fixture, rim review (both backends), schooling capture. All clean of browser/shader errors.
- **Rough edges:** kelp does not sway yet (needs a TSL `positionNode` after migration). Fish fins can flash under rim light edge-on. The school has no predator response or splitting. At that stage rim was not visible in the main viewer; the later renderer switch resolved this.
- **Next experiment at this stage:** the main-viewer migration (now complete), followed by Base/Standard profiling on physical phones (still needed).

## Earlier rendering experiment

The former three-tier experiment and its measurements are retained in [rendering history](docs/rendering-history.md). Current rendering and distance detail follow [the LOD policy](docs/lod.md).

## Real boundary / OpenStreetMap study

The bay-wide overview above is now the default for **Map study**, or `?tab=map`. **Local study** frames the preserved original OSM study. Its proposed boundary follows the four supplied latitude/longitude points; the data rectangle is west −121.91842591664363, south 36.61731221878796, east −121.88116900699488, north 36.63867767647263. Public factory coordinates remain metres (X east, Y up, Z south), using a local equirectangular projection suited to this small layout study, not surveying.

The snapshot was downloaded October 13, 2026 from the official OpenStreetMap `/api/0.6/map` endpoint. Attribution: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL. `src/data/monterey-map.json` stores the derived footprints, roads/paths, coastline and boundary; runtime viewing needs no remote map server. Buildings with complete multipolygon rings preserve courtyard holes; one point-only building is omitted; complete multipolygon segments are stitched into rings. Incomplete regional relations were omitted from the source import copy; received ways/nodes are preserved. Features are context for the bounding rectangle, not clipped to the proposed quadrilateral.

**Inspect:** Overview / Top view / Aquarium / **Lovers Point**, with a **Detailed Lovers Point** toggle for comparison. The park reuses the gym’s mapped coastline, beaches, paths, pool/court, source-based buildings, granite/cypress scenery and USGS elevation at its actual geographic position. It excludes exercise equipment, the avatar and the gym’s large ocean surface. Base buildings and route spans covered by the detail are replaced rather than drawn twice. Fifteen other regional footprints touch the elevated land; their source building heights remain unchanged above raised floors and explicitly inferred foundations. The original local massing keeps its flat comparison plane; the surrounding bay now has coarse regional terrain and an authored transition at the join.

Regional massing/footprint, wireframe, estimated-height, road and boundary controls remain available. Gold means an OSM height tag, seafoam a floor count × an artistic 3 m, and muted massing an artistic 6 m. Park buildings retain their authored toon appearance. These remain approximate geographic studies. The new regional seafloor toggle uses coarse NOAA ETOPO1 relief; no calibrated live waterline or navigational depth is implied. The separate viewport renders only on change, uses shared Near/Mid/Far LOD, and suspends while hidden. The detail readout distinguishes visible scene variants, park geometry/storage and actual last-frame submissions.

**Real-world conditions** provides manual NOAA observed/predicted tides, a discovered NWS hourly forecast and calculated local daylight. Open its source catalogue to inspect all ten known candidates and their real locations; unimplemented sources stay clearly marked. **Refresh live data** is the only remote-data trigger. There is no background polling or change to scene water, lighting or fish behavior. Open `?tab=map&park&conditions` for the park and conditions panel together.

See [Map Study integration and ownership](docs/map-world.md), [conditions and source states](docs/real-time-world.md), [map data provenance](src/data/README.md), and current rendering/browser evidence (historical authoring evidence omitted from this public snapshot). Run `node tests/map-world-browser.mjs` for the integrated park/conditions checks; the existing `tests/map-study-browser.mjs` and `tests/live-feeds-browser.mjs` cover the original map controls and camera-candidate layer. Their older reviews retain dated evidence.

## Garibaldi and lingcod — October 13, 2026

The collection now has nine fish. Choose **Garibaldi** or **Lingcod** in the Tank selector, or use the left/right arrow keys. Both reuse the shared six-bone rig, matte toon ramp, slow/fast swimming, caught X eyes, single metre-scale placement root and coarse physics descriptor. Their definitions, component builders and public factories live in separate species folders. Neither requires runtime textures or a GLB.

Garibaldi is a compact orange adult with a deep body and heart-shaped tail. Lingcod has a broad head, long taper, large pectoral fans, a notched dorsal outline, olive mottling and simplified fangs. Both are solitary/territorial examples; neither adds a school. Sizes, exact contours and swimming rates are artistic choices. Garibaldi occurs at Monterey's northern range edge and is more common farther south. Lingcod's tank cruise is an inspection animation, not a simulation of its bottom-dwelling ambush behavior.

Measured model cost per color pass: garibaldi **1,404 alive / 1,144 caught triangles**, lingcod **1,544 / 1,284**, **2 draws each**. Node-renderer inspection adds one color-output draw/triangle; shadows remain scene overhead; current distance detail follows the LOD policy. Geometry buffers stay static during swimming. No physical-device frame-rate claim is made.

Validation: production build and 101 unit tests pass; the expanded `tests/local-fish-browser.mjs` checks all three renderer paths, slow/fast/caught poses, oblique/underside/far-side views, nine-species keyboard navigation, disposal and 320/390/600 px layouts. Evidence and limitations: garibaldi (historical authoring evidence omitted from this public snapshot), lingcod (historical authoring evidence omitted from this public snapshot), and browser results (historical authoring evidence omitted from this public snapshot).

## Aquarium interior navigation study — October 14, 2026

Open **Map study → Inside aquarium**, or [the interior preview](http://127.0.0.1:5191/?tab=map&interior). The procedural cutaway adds the two public floors, Ocean’s Edge, the east wing, a simplified upper bridge, nine tank/display envelopes, 17 destinations and a connected route graph. Choose an exhibit, focus it, switch to a floor plan, or follow **Route from entrance → Next** at a 1.65 m eye height. Floor changes happen at schematic lift markers. Orbit, keyboard, touch and reduced-motion operation are supported; the map renders on interaction rather than continuously.

The supplied `aquarium-visitor-map-May2026.png` governs the first-floor relationships. The [official visitor maps](https://www.montereybayaquarium.org/visit/aquarium-maps) supply the upper-floor relationships. The [aquarium’s published figures](https://www.montereybayaquarium.org/about-us/about-the-aquarium/newsroom/media-kits/facts-and-figures) anchor Kelp Forest and Sea Otter heights and Open Sea’s complete envelope. Other measurements are labeled estimates in the inspector. The OSM roof outline anchors the building horizontally; roof/atrium holes are filled as inferred visitor floor. The estimated 5.2 m floor rise and geographic alignment are not survey measurements.

This answers whether a low-cost, metre-scale interior can support tank placement and navigation. It is a layout blockout: gallery partitions, smaller display groupings, vertical tank placement and route lengths remain approximate. Third-floor overlooks and staff-only equipment rooms are not modeled. **How the water moves** gives a sourced conceptual flow, not invented pipe locations. Navigation is a prototype route graph, not verified visitor wayfinding or an accessibility plan. The clearest next experiment is to calibrate corridor widths, tank footprints and floor elevations against a measured plan or on-site reference, before adding detailed exhibit scenery.

Rendering stays procedural and uses the shared toon materials converted to node materials, with no GLB dependency or new package. Static geometry is batched by floor and material. The active first floor uses 3,208 triangles / 8 mesh batches; the upper floor uses 1,048 / 7, plus two guide-line draws (three with a route). Budgets are enforced per visible floor. These are model costs, not whole-app GPU counters or physical-phone benchmarks.

Source ownership, evidence and validation: [model notes](src/models/aquarium/README.md), review (historical authoring evidence omitted from this public snapshot), browser results (historical authoring evidence omitted from this public snapshot). Run `node --import tsx --test tests/aquarium-interior.test.ts` and `node tests/aquarium-interior-browser.mjs` against the shared preview.

## Tank water and caustics — October 15, 2026

The **Tank** now reads as an underwater volume in both Whole tank and Follow fish. The surface underside shimmers, curved caustic filaments drift across the floor and walls, and soft light columns fade with depth. The same moving field illuminates the selected creature after its shared toon shading. Color absorption uses the length of the view ray inside the tank bounds, so standing farther back in the dry gallery does not count as more water. Translucent jelly alpha, fish rigs, real metre scale and the single-selected-creature rule are preserved.

The dry window surround has 2 cm clearance from the water planes, preventing overlapping faces and edge flicker. The October 15 enclosure combined five planes in **one draw / 10 triangles**. The sea-otter surfacing pass adds an upward-facing surface to that same batch: **one draw / 12 triangles**; caustics fade off exposed anatomy above the waterline. At this water revision, the enclosure and gallery used **four scenery draws / 1,382 triangles** (the subsequent visitor pass uses 2,776 triangles at the same four draws): eight triangles more than the previous flat backdrop, with no additional scenery draw calls, refraction captures or postprocessing passes. A deterministic, code-generated 256 × 256 caustic field occupies 256 KiB before mipmaps (about 341 KiB including them). Two warped samples animate it on the GPU; no per-frame geometry or texture uploads. The previously hidden generic ripple surface was removed from the tank. Coastal water keeps its existing separate implementation.

The look runs at every quality tier on native WebGPU and the WebGL 2 fallback. Current rendering uses shared distance LOD with no extra silhouette or bloom passes. Pause freezes the water clock; reduced motion starts paused. Depth tint and caustics are renderer-owned node expressions, leaving the model factories and optional GLB exports unchanged. This is stylized absorption and refracted-light approximation, not simulated fluid optics, true volumetric ray marching, a physical glass refraction model or calibrated aquarium lighting.

Review and before/after evidence: tank-water review (historical authoring evidence omitted from this public snapshot). Relevant checks: `node --import tsx --test tests/tank-water.test.ts`, `node tests/tank-water-browser.mjs`; comparative local measurements: `node tests/tank-water-profile.mjs`. The next useful refinement is to tune the caustic scale and water clarity against a close underwater reference, then profile on an actual mid-range phone.

## Fish shading and batching pass (2026-10-15)

Tuna now uses **two model draws in either life state**, down from nine alive and eight caught, with exactly the same 3,368 / 2,784 triangles. Four matrix uniforms preserve its independent tail, dorsal and pectoral motion inside the body batch. The extra silhouette pass was subsequently retired. Source parts remain procedural; no authored mesh, texture dependency or runtime GLB was added.

The eight shared-rig fish now use the same painted-light response, with a vertex mask for stable matte fins. Continuous body pigment transitions, joined seam normals, selective fin rounding and root-to-tip fin color improve volume and silhouette. Eyes use fewer triangles so more of the budget goes to body cross-sections and membranes. Species markings, fin spines, rigs, physical dimensions and collider scaling remain distinct. All stay within their existing species triangle ceilings and two draws; sardine schools remain one draw. The collection-wide draw ceiling is now two.

The great white was inspected on both backends alongside this pass and retains its separate matte foil treatment; its photo-driven refinement is documented in its own review. Turtle and jelly are outside this fish-shape pass. Current measurements and limitations are in the review (historical authoring evidence omitted from this public snapshot); earlier dated experiment counts above are historical.

## Foreground visitors (2026-10-15)

Whole tank now includes **nine visitors**, up from seven, with connected necks and limbs, varied jackets/backpacks, relaxed stances and two children pointing into the water. They remain dark silhouettes so the fish stays the focus. Adults are **1.58–1.85 m** tall; children are **1.20 and 1.30 m**. These are deliberate reference dimensions, not inferred measurements of actual people. Every resting mesh height is checked in metres, with shoes planted at the gallery floor height.

The crowd sits closer to the glass (feet approximately 1.1–1.5 m in front of it). The viewer never scales a person or fish to fit the camera. A small height caption appears in Whole tank; Size notes explains that perspective still changes apparent size. A distant fish will look smaller than an equally long object near the window.

Slow weight shifts, breathing, head turns and hand drift use a single 28-bone skinned batch. Feet stay fixed, sampled height change stays below 5 mm, and 120-second pose checks keep every vertex within 2.5 cm of rest. Each visitor has a different phase; idle speed is independent of fish speed. Pause and reduced motion stop visitors with the same tank simulation clock.

The nine people cost **2,682 triangles and one draw**, within a 2,800-triangle ceiling. Total tank scenery is **2,776 triangles / four draws**, excluding the selected fish and rendering passes. Geometry stays static; only bone transforms change. See visitor review (historical authoring evidence omitted from this public snapshot), [factory guide](src/models/visitors/README.md), `tests/gallery-visitors.test.ts` and `tests/gallery-visitors-browser.mjs`.

## Potential real-world live feeds — October 20, 2026

Open [Map study → Potential live feeds](http://127.0.0.1:5191/?tab=map&feeds). The versioned [candidate database](src/data/live-feeds.json) records nine feed candidates at four approximate geographic anchors: six Aquarium cams at the shared campus point, Surfline Monterey Bay, Domenico’s on the Wharf, and Portola Hotel & Spa. The map has selectable location pins, a feed selector, Focus location, and All feed locations. Pins add no 3D draw calls, update on interaction, and never load video or contact feed providers automatically.

Each record keeps position basis/uncertainty, provider links, content type, schedule uncertainty, technical evidence, permission status, next step, and research date. The three non-Aquarium anchors lie south of the existing downloaded street map; their positions are retained outside that rectangle rather than clamped into it. Beyond the downloaded rectangle, the overview shows pins without invented streets or terrain. Aquarium exhibit cams remain distinguished from the outdoor wild-bay cam and are not given invented per-camera coordinates.

These are potential integrations, not approved or playback-verified feeds. Surfline’s [official guidance](https://support.surfline.com/hc/en-us/articles/13883563949979-Can-we-embed-a-forecast-or-a-cam-to-our-website) requires a commercial streaming discussion. The other providers’ permission and current player behavior remain unconfirmed. See [feed research, source links and maintenance](docs/live-feeds.md). Validate changes with the feed/map tests, production build and browser suite at tests/live-feeds-browser.mjs; evidence is stored under artifacts/live-feeds/.

## Real-world conditions — Map Study, October 22, 2026

Open **Map Study → Real-world conditions → Refresh live data** for NOAA Monterey observed tide and next predicted high/low (metres MLLW), the NWS forecast discovered for the Aquarium anchor, and locally computed approximate sunrise/sunset. Each channel shows its source, timestamps, units, coverage, quality flags and observed/predicted/forecast/computed/stale/unavailable state. Missing or failed data is never replaced with a fabricated live value; a previous reading remains explicitly stale.

The [source inventory](src/data/real-time-sources.json) retains its October 20 research and adds `mapStudy` implementation metadata. Six channels remain research-only: NWS alerts, offshore NDBC buoy data, CeNCOOS intake/shore properties and currents, iNaturalist reports, and AIS traffic. The Map Study daylight card has no Moon display; the separate Testing Gym computes the Moon and renders its phase alongside astronomical sunlight, clouds, fog, rain and stars. Every `enabledInGame` flag in this Map Study inventory stays false because this panel is a study display without water, lighting, fish or other gameplay effects. These flags do not describe the Gym weather implementation.

[src/data/worldConditions.ts](src/data/worldConditions.ts) provides a shared snapshot, manual refresh, request coalescing/caching, source-specific freshness, timeout/cancellation and provider retry handling. Opening the panel makes no remote request; no polling, keys, backend or new dependency is added. DOM information and pins add no 3D draw calls or triangles. Browser-controlled `User-Agent` limits remain documented for NWS; a future authoritative multiplayer service must reliably identify the application and distribute one versioned snapshot.

Actual Chrome/Vite cross-origin NOAA observation/prediction and discovered NWS forecast requests succeeded on October 22 Pacific (October 23 UTC). See the live-access evidence (historical authoring evidence omitted from this public snapshot), [12 focused adapter tests](tests/world-conditions.test.ts), and [implementation guide, primary sources and historical research](docs/real-time-world.md). This dated check does not guarantee future provider availability.

## Coastal wildlife and trail expansion

**Testing Gym → Menu → Coastal wildlife** frames the new offshore habitat: a patrolling 4 m great white, 48 schooling sardines, three blue rockfish and two kelp greenling. Twelve new kelp beds add 120 plants, bringing the Gym total to 144. The Lovers Point–Aquarium trail gains mapped and authored benches, bins, bicycle stands, interpretation panels, planting and sectional fencing; the shared Map Study shows these trail details too. See [sources, budgets and limitations](docs/coastal-life.md).
