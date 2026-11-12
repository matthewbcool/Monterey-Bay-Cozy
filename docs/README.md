# Documentation map

Start with the [current feature overview and asset register](../README.md), then the [codebase guide](codebase.md) for source ownership, runtime flow and maintenance. [Contributor workflow](../CONTRIBUTING.md) and [agent instructions](../AGENTS.md) identify the canonical checkout, shared preview and branch.

## Find the right source

| Area | Maintainer entry point |
| --- | --- |
| Whole application, ownership, coordinates, lifecycle | [Codebase guide](codebase.md) |
| Browser scenes, rendering and input | [Viewer source map](../src/viewer/README.md) |
| Creature factories, animation, batching and physics adapters | [Model guide](../src/models/README.md) |
| Habitat and attached creatures | [Habitat guide](../src/models/habitat/README.md) |
| Cached geography, research inventories, saved recipes and provider data | [Data guide](../src/data/README.md) |
| Test selection, browser fixtures and evidence | [Test guide](../tests/README.md) |
| Data extraction and review generators | [Authoring scripts](../scripts/README.md) |

## Public source release

See [release scope](public-release.md), [licensing and data notices](../THIRD_PARTY_NOTICES.md), [community conduct](../CODE_OF_CONDUCT.md) and [security reporting](../SECURITY.md).

## Current feature guides

| Guide | Purpose |
| --- | --- |
| [Asset catalog audit](asset-catalog-audit.md) | Categorized library coverage, missing scene-only objects and retired models |
| [Project style guide](../README.md#art-direction-painterly-cel-shading) | Shape, color, lighting, palette and detail hierarchy |
| [Creature sizes](species-sizes.md) | Dimension types, sources and uncertainty |
| [Distance LOD](lod.md) | Geometry generation, inspection, cost and disposal |
| [Sea otter references](sea-otter-references.md) | Inspected southern sea otter photos/video, scale evidence, animation observations and simplification limits |
| [Black-tailed deer](deer.md) | Doe/fawn assets, grazing/walk/gallop, family avoidance, mapped habitat patches and distance sleep |
| [Western gulls](western-gull.md) | Male/female assets, ground actions, one-draw sky flocks and extreme distance silhouettes |
| [Tank demo](tank-demo.md) | Mixed population, routes and budgets |
| [Gym loading and diagnostics](gym-diagnostics.md) | Loading lifecycle, FPS, frame pacing, renderer counters and measurement limits |
| [Avatars and controls](avatar-creator.md) | Recipes, saving, rig, input, jumping and swimming |
| [Rowboat](gym-boat.md) | Movement, boarding, collision and limitations |
| [Underwater terrain and flight shadows](bathymetry.md) | USGS source, coordinate conversion, shoreline limits, shark patrol and verification |
| [Dive site](gym-dive-site.md) | Dive boat, scuba, reef composition and interest management |
| [Gym gray whales](gym-whale-pod.md) | Offshore mother, calf, adult, surface events and separate LOD budget |
| [Otter Man suit](otter-man.md) | Equipment, flight controls, model budget and safe return |
| [Caledonia Park](caledonia-park.md) | Named Gym destination, whole-park fence, Meals on Wheels exterior, plan views and terrain/collision extension |
| [Waterfront extension](waterfront-extension.md) | Shared next region, source provenance, terrain and budgets |
| [Gym geography](testing-gym-geography.md) | Coordinate frame, terrain, world budget and source limits |
| [Real-world comparison](lovers-point-real-world-data.md) | Cached neighbourhood data and dated reference audit |
| [Sculptures](lovers-point-statues.md) | Reusable factories, placement and provenance |
| [Ocean water](ocean-water.md) | Balanced surface and opt-in RGB transport, caustics, shafts and refracted sky |
| [Graphics quality](graphics-quality.md) | Hardware targets, lightweight defaults, Enhanced controls, isolation and cost ceilings |
| [Gym weather](weather-sources.md) | Provider lifecycle, astronomy, numerical checks and licensing |
| [Full Monterey Bay](monterey-bay-region.md) | Regional terrain, shoreline, highways, place navigation, seafloor and source limits |
| [Map Study](map-world.md) | Reprojected park, regional geometry and demand rendering |
| [Fish ecology](fish-ecology.md) | NOAA survey evidence, species/stage queries, habitat assumptions and bounded game recipes |
| [Map conditions](real-time-world.md) | Manual NOAA/NWS panel; distinct from automatic Gym weather |
| [Candidate live feeds](live-feeds.md) | Research catalogue; no embedded live video |
| [Coastal trees](coastal-trees.md) | Seven procedural silhouettes, municipal placements and source limits |
| [Coastal wildlife and trail](coastal-life.md) | Shark patrol, kelp beds, trail facilities and separate budgets |
| [Pacific Grove Museum](pacific-grove-museum.md) | Official plan references, shared building, cutaways and floors |
| [Museum district and Jewell Park](museum-district.md) | Entrance repair, empty galleries, ocean clipping and park details |

## Current facts and source notes


Current behavior belongs in feature/source guides and the root asset register. Dated sections in the root README, [changelog](../CHANGELOG.md), [rendering history](rendering-history.md) and `artifacts/` preserve earlier results. A historical count, screenshot or successful provider request does not establish the current source revision or ongoing provider availability.

When changing a feature, update its guide and relevant catalogue/register together. Keep old evidence with its date and source revision; distinguish new local edits, commits, pushes and deployments. Run `npm run check:docs` to check local Markdown link targets and heading fragments. It does not verify remote URLs, claims or screenshots.

- [Lovers Point recreation area](recreation-area.md): October 25 reference-photo pass, opening pool gate, court, trail, terrain grading and performance.

- [Gym rendering performance](gym-rendering-performance.md): per-pass draw audit, conservative shadow culling and wildlife growth guidance.

- [Lovers Point photo study and rideable surrey](lovers-point-surrey.md): November reference observations, provisional section/scale, controls, LOD and reproducible captures.

- [California ground squirrel](ground-squirrel.md): Ramero1993’s requested animal, rockside placement, instanced poses, scale and rendering costs.
