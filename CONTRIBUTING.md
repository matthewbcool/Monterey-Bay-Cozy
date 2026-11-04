# Working together on Monterey Bay Cozy

The project is based in the Monterey Bay Tech Discord server, guided by its people-first, inclusive charter. The long-term goal is a cozy multiplayer web game that helps neighbors discover local parks, museums, city services and ecology, build relationships and shape the world together. Developers and non-developers can contribute local knowledge, ideas, references, feedback or code, with their choice of AI tools. See the [project vision and charter alignment](README.md#how-this-aligns-with-monterey-bay-techs-charter). No particular AI vendor or local model is required. Today this repository builds and inspects reusable assets. Multiplayer, a physics engine, Discord integration and automated contribution processing are not implemented.

## One shared checkout and branch

Use your clone of this public repository on `main`. The repository is [matthewbcool/Monterey-Bay-Cozy](https://github.com/matthewbcool/Monterey-Bay-Cozy). Keep one active checkout per preview session and coordinate overlapping edits.

Before editing, check branch, working-tree changes and worktrees. Fetch `origin`; if clean, pull with `git pull --ff-only`. Preserve other contributors' local changes. When several chats share this checkout, agree on file ownership and let one chat handle staging, committing and pushing after everyone has finished a bounded change. Final validation must run against the files that will be committed. Create another branch or worktree only when the user requests it.

Run `npm install` once, then `npm run dev`. Use [http://127.0.0.1:5191/](http://127.0.0.1:5191/); the server uses a strict port so a second preview cannot silently show different code. Do not delete unrelated user work.

## Contribution contract

Read the root [README](README.md), [AGENTS.md](AGENTS.md), [codebase guide](docs/codebase.md) and relevant [model guide](src/models/README.md). The [documentation map](docs/README.md) links feature ownership, data contracts and maintenance tools. Keep procedural factories independent of the viewer. Use metre-scale geometry, per-LOD category budgets, the shared toon style and seeded randomness for natural variation. Validate native WebGPU and WebGL 2 fallback when rendering changes.

Keep the asset debugger focused on inspecting looks and behavior. Preserve creature selection, follow framing, animation, keyboard/touch and reduced-motion behavior. Keep biological references separate from artistic choices. Source reference files remain read-only.

Run `npm run typecheck`, `npm run check:docs`, `npm test`, `npm run build` and the browser suites relevant to the change. The [test guide](tests/README.md) explains coverage, fixture provenance, output overrides and browser inspection. See the root README for current feature limits. Record meaningful screenshots and measurements; distinguish desktop/browser emulation from testing on physical phones. Optional GLBs must be regenerated when their source geometry changes.

## Documentation and handoff

The root README is the current feature and asset reference. `src/models/README.md` explains implementation ownership; [CHANGELOG](CHANGELOG.md) records consolidated changes. The private authoring archive is excluded from this public source snapshot; generated browser evidence stays local unless deliberately reviewed for publication. Mark superseded measurements and plans explicitly rather than claiming that old tests establish current behavior. Keep local links valid, and report what works, how to view it, remaining rough edges and the clearest next experiment.

Commit only the reviewed project changes, push `main` without force, and verify that GitHub's `main` matches the local commit. A successful local build or commit alone does not establish a successful push or deployment.

For world-scale assets, follow [distance LOD](docs/lod.md). Every addition must be reviewable at Near/Mid/Far and preserve animation, catch state and physics ownership. The historical High style tier is retired; do not restore silhouette hulls or bloom. Optional Enhanced Gym water is a separate explicit choice; preserve Balanced defaults and validate the [graphics cost policy](docs/graphics-quality.md).

## Contributions and licensing

Original code and project-authored documentation are MIT licensed; see LICENSE (historical authoring evidence omitted from this public snapshot) and third-party notices (historical authoring evidence omitted from this public snapshot). Submit only material you have the right to share. By submitting a contribution, you agree to license your original contribution under MIT, except separately identified datasets/material with their own compatible terms. Local knowledge, feedback, accessibility observations and research are welcome alongside code. Use AI tools if helpful, and review their output for correctness, provenance and compatibility.

Before publishing, run `npm run check:release` after staging new files. Use your GitHub no-reply commit email if you prefer to keep your personal address private. Never commit local configuration, credentials or unlicensed reference captures.
