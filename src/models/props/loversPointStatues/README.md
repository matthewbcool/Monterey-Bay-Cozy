# Lovers Point sculptures

`createSailingBoyStatue()` and `createButterflyStatue()` are synchronous procedural Group factories, authored in metres, with floor Y=0 and +Z front. Each owns one matte toon batch after named source components are merged. Keep the boy’s reaching pose/sailboat and the butterfly’s raised, thick carved wings recognizable at every LOD.

World placement and historical-coordinate evidence belong to `src/data/lovers-point-artworks.ts` and `src/viewer/testingGym/statues.ts`, not these factories. Root transforms, collision proxies and inspection identities remain independent from render detail. Owners apply node style, register shared LOD and dispose their resources.

See [sculpture guidance, provenance and budgets](../../../../docs/lovers-point-statues.md) and measured review (historical authoring evidence omitted from this public snapshot). Public factory geometry is canonical; GLBs are optional exports. Do not add textured photographs, glossy metal response or separate draws for face, hair, veins or plaque details.
