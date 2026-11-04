# Lovers Point sculptures

The Objects library, Testing Gym and detailed Map Study share two procedural landmark factories. They are stylized, low-poly studies of the supplied photographs, with estimated dimensions and inferred backs. Neither asset loads a photograph, texture map, external mesh, animation or additional render pass.

| Object | Identity and evidence | Placement source | Dimensions |
| --- | --- | --- | --- |
| Sailing boy | Dorothy Fowler’s *Yesterday’s Dream—Tomorrow’s Memory*. The [PGHS Alumni Association newsletter, March 2014, pp. 13–14](https://www.pghsaa.org/newsletters/KOII-March-2014-Sm.pdf) describes the life-size bronze on a boulder, pointing across the bay, and its spring 1990 installation. | [Historical visitor GPS tag](https://www.waymarking.com/waymarks/WM33F4): longitude −121.916350, latitude 36.626150. | Approximately 2 m including the boulder; photo-based estimate. |
| Monarch Butterfly | Gordon Newell’s granite sculpture, dedicated 1964; Smithsonian inventory IAS CA001941 and the [local public-art guide](https://www.93950.com/public.htm). | [Historical visitor GPS tag](https://www.waymarking.com/waymarks/WM1DP_Monarch_Butterfly_Sculpture): longitude −121.9164833333, latitude 36.6262666667. | Approximately 1.75 m including the pedestal; photo-based estimate. |

The pins were published in 2008 and 2005, respectively, with **unspecified positional accuracy**. Decimal precision is a conversion of degrees/minutes, not survey accuracy. The cached OSM park data does not supply artwork nodes. The boy’s east/southeast-facing heading and the butterfly’s south-facing heading are artistic estimates. Dimensions, exact facial likeness, folds, inscriptions, patina and carved panels are simplified; hidden surfaces are inferred. The plaque is a plain colored inset, without invented readable text.

## Source and runtime ownership

- `src/models/props/loversPointStatues/boy.ts`: granite boulder/plaque, shaped sweater and trousers, bare feet, reaching hand, face/hair and model sailboat.
- `src/models/props/loversPointStatues/butterfly.ts`: slab/pedestal, flared neck, closed volumetric wings, body and carved panels.
- `src/models/props/catalogue.ts` / `dimensions.ts`: library entries, provisional scale and ceilings.
- `src/data/lovers-point-artworks.ts`: coordinates, names, artists, provenance and uncertain headings.
- `src/viewer/testingGym/statues.ts`: geographic projection, terrain contact, fixed collision and scene placement. The model factories have no viewer or simulation dependency.

Factories return independent Groups with +Y up, +Z front, floor Y=0, geometry in metres and root scale `[1,1,1]`. Meaningful components are retained as source builders and `userData.sourceParts`. `finishStaticAsset()` merges each statue into **one matte shared-toon batch** with vertex colors. The bronze’s age is expressed through quiet pigment changes, not a metal glint. There are no outlines or photo textures. Source component separation does not multiply runtime draws.

The owner calls `applyNodeStyle()` and registers the root with the shared LOD controller. Near/Mid/Far keep the same style and root transform. Physics and multiplayer identity do not depend on the active mesh. The fixed broad circular base proxies prevent walking through the sculptures; nearby collision-valid approach points support keyboard/touch inspection. These are static landmarks, not a rigid-body simulation.

Each placement samples the USGS terrain and embeds its base by 2.5 cm for contact. Map Study reprojects the same coordinates, including the small longitude-scale correction on rotated geometry, while keeping roots unscaled. No work is performed per frame for the statues themselves. Library, gym and map own separate resources; normal LOD disposal plus `disposeObject()` releases every source/derived geometry and material.

## Budgets and validation

The boy’s ceiling is **2,400 triangles / one draw**; the butterfly’s is **1,000 / one draw**. They participate in the [current Gym park budget](testing-gym-geography.md#rendering-and-lifecycle) and the map park’s **20 draws / 50,000 Near triangles**. At the original sculpture review, the Gym allowance was 32 draws / 60,000 Near triangles; subsequent equipment, neighbourhood and wildlife changes superseded that allowance. The concurrent park cleanup reduced other scenery costs; these two assets add 2,832 canonical triangles and two draws. Ceilings are not measured costs or device performance claims.

Measured Near/Mid/Far triangles, geometry/index storage, actual scene submissions and both-backend screenshots are in the statue review (historical authoring evidence omitted from this public snapshot). Instance buffers, driver memory and complete app downloads are outside the geometry storage counter. The general asset tests enforce metre scale, one material/batch, ownership and category budgets. Statue tests cover historical coordinates, contact, collision, LOD savings and stable identity; gym/map regressions cover connected walking routes and geographic transforms. The browser review covers multiple views, both graphics backends, forced detail, library comparison, mobile layouts, exports and in-world inspection.

The supplied references are retained under `public/references/lovers-point-statues/` for review only. See location-research.json (historical authoring evidence omitted from this public snapshot) for source dates, evidence and uncertainty, and the staged model reviews for visual corrections.
