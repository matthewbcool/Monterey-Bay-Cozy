# Public release scope

Monterey Bay Cozy starts with a fresh community-focused source snapshot. The private working repository, its commit history and its full authoring archive are not imported. Personal author emails and local-machine filesystem paths are excluded from the new history.

The root MIT license permits reuse, modification, redistribution and commercial use of original project code and project-authored documentation, with its notice retained. Public datasets and third-party code keep their own terms; see [third-party notices](../THIRD_PARTY_NOTICES.md). The community's no-advertising vision describes this project's intended operation, not a restriction on MIT licensees.

## Included and excluded material

Included: procedural TypeScript factories, browser scenes, tests, authoring tools, public data caches, selected provider evidence needed for data regeneration/checks, and source documentation. Provider evidence is listed in [the manifest](../artifacts/public-data-manifest.json).

Excluded: reference photos, third-party game screenshots, reference/model comparison images, historical captures/logs/videos, optional generated GLBs, old review bundles and private machine history. These are not required runtime assets. The tuna reference link now opens a public species source instead of a bundled photograph. Written observations and source-page citations remain, with uncertainty preserved. Omitted historical evidence is identified in the documentation; old validation claims describe earlier work, not tests newly performed on this release.

Generated browser captures and logs are ignored by default. The November Lovers Point PR includes a small set of explicitly requested, project-rendered review screenshots under `docs/reviews/`, with reproducible camera/settings and measurements. These contain no source photographs or third-party comparison imagery. Keep downloaded references outside the public tree unless you have verified redistribution permission. The project uses metres, procedural geometry, the existing shared toon style and WebGPU/WebGL 2 fallback without importing third-party model meshes.

## Verification

The source snapshot is checked with the unit suite, production build/type check, documentation validation and tracked-source privacy/credential-pattern checks. Chrome 156 passed 38 Tank/keyboard/touch/reduced-motion checks on each backend plus 13 Gym/Map Study checks across actual WebGPU and WebGL 2, with no captured page/shader/missing-file errors. These are desktop and touch-emulation checks, not physical phone or Safari/Firefox verification. Original gameplay/rendering source is preserved apart from replacing reference-photo links/metadata. Run from the checkout root:

```sh
npm ci
npm run check:release
npm run check:docs
npm run typecheck
npm test
npm run build
```

Browser checks require a local preview and the browser/channel configured in each suite. The fresh snapshot should be reviewed in native WebGPU and WebGL 2; desktop browser emulation does not establish physical mobile device support. See [the test guide](../tests/README.md).

## Contributions

Read [CONTRIBUTING](../CONTRIBUTING.md), [community conduct](../CODE_OF_CONDUCT.md) and [security reporting](../SECURITY.md). Local knowledge, corrections and feedback are welcome alongside code. Include sources and rights for anything you add, and avoid publishing personal information or local-machine paths.
