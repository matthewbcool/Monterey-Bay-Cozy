# Model work

Read `README.md` in this directory for the file map, ownership rules and species workflow.

- Keep factories small: compose geometry builders, apply explicit batches, attach behavior.
- Preserve the separation between species geometry/materials/motion, shared assembly/physics contracts, and viewer code.
- Keep meaningful source components even when rendering merges them. Preserve the collection's triangle/draw-call budgets and alive/caught contract.
- Fit fin roots to the body surface with overlap. Verify changed attachments in slow, fast and caught views, including an underside or oblique view.
- Run model tests and the production build after source changes. Use focused browser checks for visual changes; preserve unrelated viewer work.

- Use procedural TypeScript as the canonical model source; GLB files are optional generated exports, never a required runtime dependency by default.
- All public factory geometry/placements, colliders and anchors must use metres with an unscaled root. Record nominal dimensions, source and uncertainty. Never normalize model geometry in the viewer.
- Enforce category-specific triangle/draw-call ceilings; prefer fewer. Static props batch palette colors into two toon-material responses. Keep geometry components readable in source and only preserve runtime groups that animate independently.
- Test models on native WebGPU and the WebGL 2 backend. Custom model shading must be TSL/node materials (see `tuna/toon.ts`); publish `userData.styleBase` and `userData.rim` so the viewer can add its rim layer.

- All new assets must participate in shared distance LOD. Follow `../../docs/lod.md`; verify all levels, both life states, animation attributes, source ownership and disposal. Record Near/Mid/Far costs instead of only the full-detail budget.
