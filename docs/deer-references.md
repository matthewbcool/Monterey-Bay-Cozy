# Black-tailed deer: references and habitat placement

Research and photo inspection: October 26, 2026. This record supports the adult and spotted fawn assets, their walking, galloping and eating poses, and the small Gym groups. It distinguishes biological evidence, visible features and authored game behavior. Follow the [shared art direction](../README.md#art-direction-painterly-cel-shading) and [distance LOD policy](lod.md).

## Local identity

Use **Columbian black-tailed deer, *Odocoileus hemionus columbianus***. The [Presidio of Monterey's natural-resource account](https://www.army.mil/article-amp/263548/presidio_of_monterey_assessing_deer_population_on_post) specifically identifies this subspecies on the installation and supplies local adult photographs. The [Pacific Grove Golf Links operator](https://www.playpacificgrove.com/course/environment) independently lists coastal black-tailed deer among its wildlife. These sources establish a locally appropriate animal; they do not establish deer at every authored spawn point or a current population count.

[ODFW's species account](https://myodfw.com/wildlife-viewing/species/columbian-black-tailed-deer) describes the smaller, darker black-tailed form, a brown face, a modest pale rump patch, and a tail dark above and white beneath. Its discussion of concealment and caution supports a quiet browsing animal. The asset is a representative coastal deer, not a genetic identification of every deer around Monterey Bay.

## Photos actually inspected

The following image pixels were opened in a browser and visually reviewed, rather than inferred from captions or search snippets. They inform original geometry and vertex colors; none is a runtime texture. The NPS gallery is from Point Reyes, so its fawns are anatomical references rather than Monterey sightings. Local adult photos are from the Presidio of Monterey article dated January 27, 2023.

| Reference | Observable features and limits |
| --- | --- |
| [Presidio doe walking beside a fence](https://api.army.mil/e2/c/images/2023/01/27/c71a41cf/size1.jpg), [article and caption](https://www.army.mil/article-amp/263548/presidio_of_monterey_assessing_deer_population_on_post) | Long, fine lower legs support a compact but deep torso. Rump is slightly higher than the shoulder in this pose. Neck tapers forward into a narrow muzzle; large ears stand above it. Dark tail lies against a small pale rump. Forelegs and hindlegs occupy different phases of a step. The image does not measure dimensions or walking speed. |
| [Presidio buck](https://api.army.mil/e2/c/images/2023/01/27/9422772e/size1.jpg), same article | Deeper neck and chest, narrow face, black nose, pale eye surround and forked antlers. Antlers belong to this male specimen; they are not required to make the requested adult doe recognizable. |
| [NPS spotted fawn](https://www.nps.gov/npgallery/GetAsset/575e6898-1dd8-b71b-0b37-7b82432a5c59/proxy/hires?), [gallery record](https://www.nps.gov/media/photo/gallery-item.htm?gid=5735F5F6-1DD8-B71B-0B332FA5F754A77F&id=575e6898-1dd8-b71b-0b37-7b82432a5c59) | Short muzzle, very large ears relative to the head, slim neck, tan-orange flanks and broken rows of pale spots. Lower legs are partly hidden by grass. Use different proportions from the adult, not uniform scaling. |
| [NPS doe and bounding fawn](https://www.nps.gov/npgallery/GetAsset/57624679-1dd8-b71b-0b64-fed91a8825b6/proxy/hires?) | Fawn has a smaller trunk and relatively long legs. Its forelegs fold beneath the chest during an airborne pose; rear legs trail, and its tail exposes a pale underside. The doe provides a useful qualitative age comparison, but perspective prevents a reliable size ratio. |
| [NPS deer bounding downhill](https://www.nps.gov/npgallery/GetAsset/5750ab6e-1dd8-b71b-0ba4-d67ce5f49785/proxy/hires?) | Forelegs reach toward landing while the hind hocks are flexed. Torso pitch follows the slope. This is one motion phase, not a measured gait cycle or evidence of a particular gallop speed. |
| [NPS deer foraging in dry grass](https://www.nps.gov/npgallery/GetAsset/575b275b-1dd8-b71b-0bdd-71338c224219/proxy/hires?) | Neck extends forward below shoulder level and the muzzle faces the vegetation. Ears remain alert. This frame shows a pause with the head turned toward the camera; exact chewing, jaw travel and nose-to-ground contact remain authored. |

The [NPS gallery's usage notice](https://www.nps.gov/media/photo/gallery-item.htm?gid=5735F5F6-1DD8-B71B-0B332FA5F754A77F&id=575e6898-1dd8-b71b-0b37-7b82432a5c59) distinguishes NPS public-domain images from separately credited material. Reference links do not imply a blanket redistribution license for every image.

## Scale: sources versus specimens

| Quantity | Evidence and interpretation |
| --- | --- |
| Adult length reference | California State Parks' [*The Conifer Connection*, printed p. 104 / PDF page 98](https://www.parks.ca.gov/pages/735/files/Natural%20History%20ADA%20compressed.pdf#page=98) lists *Mule Deer (Black-tailed Deer), Odocoileus hemionus* at **1.35–1.65 m** long. This is rounded, broad species guidance, not a Monterey-specific adult distribution. The entry does not define measurement endpoints. |
| Adult model | **1.58 m nominal length / 0.86 m shoulder height** are authored specimen dimensions. The length is informed by the broad guide; the exact proportions are fitted to the photos. |
| Spotted fawn model | **0.96 m nominal length / 0.58 m shoulder height** are authored dimensions for a mobile spotted juvenile, not a newborn or a verified age-specific percentile. No reliable local juvenile length range was established; do not manufacture one from the adult range. |
| Fawn stage | [Fawn Rescue of Sonoma County](https://www.fawnrescue.org/pages/faqs-informational-wildlife-articles), a specialist rehabilitation organization, describes reddish newborns with rows of pale spots, birth weights **4–6 lb / about 1.8–2.7 kg**, and spot loss around **3–4 months**. This supports the markings and distinction between a young fawn and an older juvenile; it does not provide the displayed specimen's measured dimensions. |

The State Parks guide's shoulder line contains inconsistent conversions: 35–41 inches would be about 0.89–1.04 m, while its printed metric line says 1–1.1 m. Do not silently treat that as precise support for our shoulder height. Likewise, the rescue page's short birth-length statement lacks clear endpoints and should not set a standing model's length. No body mass, collision volume or locomotion speed should be derived from those uncertain measurements without another source.

## Art and animation interpretation

Keep the identifying silhouette: ears, tapered muzzle, sloping neck, slender legs with articulated hind hocks, and a small dark-backed tail. Use broad warm brown planes, cooler shadow colors, a restrained pale throat/underside and a few clear fawn spots. Omit fur strands, modeled eyelids, individual teeth and tiny hoof details. Near geometry earns its cost through joints and silhouette; Mid drops markings and small facial accents; Far keeps the body/ears/legs readable. Use the existing shared material, metre scale, LOD owner, culling, disposal and measured-budget conventions rather than a special high-quality path.

Walking should show planted support feet and distinct fore/hind articulation. A gallop needs a readable gathered phase, extension, short aerial lift and a soft landing, with modest torso pitch. Eating lowers the neck and head together while the torso stays supported; small pauses and head turns are more useful than a continuously rotating jaw. These are photo-informed animation recommendations. Gait timing, step length, top speed, transition thresholds and blend amounts are authored, not measured wildlife data. The Presidio article's 5–10 mph figure concerns its **survey vehicle**, not deer movement.

Player avoidance, adult/fawn following, group spacing, alert delays and return-to-home behavior are game rules. They should preserve the pair and avoid fences/obstacles without implying an ecological simulation. A fawn can be represented as mobile for this interaction, but real young fawns also hide; do not label constant adult-following as universal behavior. Source behavior supports calm browsing and occasional escape, not perpetual galloping.

## Mapped placement cache

[`src/data/deer-habitats.json`](../src/data/deer-habitats.json) uses the Gym origin **longitude −121.91685, latitude 36.6256**. X points east, Z south, and coordinates are metres in the existing local equirectangular projection. Source outlines and grass polygons retain their OSM identities and revisions. The small home discs are **authored bounded spawn/roam areas**, not animal home ranges, reported sightings, surveyed lawn edges or public access permissions.

| Site | Source geometry | Authored home and radius | Ground limitation |
| --- | --- | --- | --- |
| Caledonia Park | [Park way 871779748](https://www.openstreetmap.org/way/871779748), existing local cache | X −233, Z 135; **5.5 m**. Lon/lat −121.91946094, 36.62438592. Northern lawn, outside mapped play/court areas and path envelopes. | Detailed Caledonia terrain. Runtime still needs existing fence, tree and furniture collision checks. |
| Pacific Grove Golf Links | [Course way 36437304](https://www.openstreetmap.org/way/36437304); [fairway relation 19321011](https://www.openstreetmap.org/relation/19321011), outer way 633512495, putting-green hole 633514969 | X −304, Z −6; **6.5 m**. Lon/lat −121.92025655, 36.62565396. Fairway center clearance 8.97 m; nearest mapped cart path 41.58 m away. | Outside the Meals annex; uses existing coarse regional land. This does not extend walkable local terrain. |
| Del Monte Golf Course | [Course way 27830670](https://www.openstreetmap.org/way/27830670); [fairway 18 relation 14090146](https://www.openstreetmap.org/relation/14090146), outer way 635445153, putting-green hole 635445152 | X 3894, Z 3742; **8.5 m**. Lon/lat −121.87321472, 36.59194743. Fairway center clearance 11.80 m; nearest mapped footway 19.01 m away. | Inside the bay-region coverage, outside authored local walking/building collision coverage. No course buildings or detailed slopes are claimed. |

The [Del Monte operator](https://www.pebblebeach.com/golf/del-monte-golf-course/) independently confirms the Monterey course and its 1300 Sylvan Road address. Its address is not used as a grass spawn location; the chosen grass comes from the mapped fairway. We did not verify a current deer sighting at Del Monte or Caledonia. Pacific Grove's operator confirms deer occur on its course, not at our exact chosen point.

The initially proposed Caledonia point (−246, 177) was outside the mapped park and was rejected. An initial PG candidate (−218, 23) overlapped a mapped cart path and was also rejected. Final discs were checked at 720 perimeter positions each against their actual source park/course outlines and fairway polygons, including exclusion of putting-green holes. Retained source geometry is rounded to millimetres for deterministic storage; this numeric precision is **not** positional accuracy.

Regional land spacing is roughly **234 × 267 m**. It can support a geographic overview and flight approach but cannot resolve fairway grading or small buildings. See the [regional terrain limitations](monterey-bay-region.md). Reusing the regional sampler avoids inventing high-resolution golf-course terrain. Sources load from the repository cache; no runtime network request is needed.

## Retained evidence

- Pacific Grove geometry: [`artifacts/caledonia-refinement/sources/meals-annex-map.osm`](../artifacts/caledonia-refinement/sources/meals-annex-map.osm), reused unchanged; related request provenance remains in that source directory.
- Del Monte full course: [`del-monte-course.json`](../artifacts/deer-reference/sources/del-monte-course.json), public OSM way/full response.
- Del Monte grass/paths: [`del-monte-grass-map.osm`](../artifacts/deer-reference/sources/del-monte-grass-map.osm), small primary map extract at longitude −121.877..−121.872, latitude 36.588..36.593.
- Exact new request URLs, saved-file retrieval times and SHA-256 checksums: [`source-requests.json`](../artifacts/deer-reference/sources/source-requests.json).

OpenStreetMap data is © OpenStreetMap contributors, [ODbL 1.0](https://www.openstreetmap.org/copyright). These are map-derived placement references, not certified surveyed boundaries. Asset triangle/draw counts and browser behavior belong in the implementation review once measured; this reference study does not claim them as passed.
