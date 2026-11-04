/** Provisional site-scale estimates from the user's Oct 25 lawn/Beach House photograph.
 * Municipal IDs locate the grove; the panorama cannot uniquely identify every trunk or
 * establish absolute height. Values below are art-direction estimates, not survey data.
 * Keep source X/Z in lovers-point-trees.json unchanged. See docs/coastal-trees.md.
 */
export const TREE_SCALE_STUDY = {
  reference: 'User-supplied park photograph; not redistributed in the public source release',
  date: '2026-10-25',
  anchor: 'Beach House and lawn-side cypress grove; retain municipal positions relative to mapped buildings',
  heightUncertaintyMetres: 3,
  heights: {
    4828: 15, // Behind/northwest of the Beach House, near the road.
    4829: 20,
    4832: 18,
    4835: 16,
    4852: 22, // Large isolated lawn-side tree in the right/foreground of the reference.
    4854: 13, // Southern side of the lawn grove, east of the Beach House.
    4855: 14,
    4856: 17,
    4857: 16,
    4858: 18,
    4859: 20,
    4860: 21,
    4861: 14,
    4864: 12,
  } as Readonly<Record<number,number>>,
} as const;
