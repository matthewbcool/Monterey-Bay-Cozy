import type { FishDesign } from '../shared/fish/design';

/** Adult male color phase; dimensions and motion are artistic, not a measured specimen. */
export const SHEEPHEAD = {
  id: 'california-sheephead', lengthMeters: .55,
  sizeBasis: 'Representative 55 cm male design; not a measured specimen. Monterey Bay Aquarium lists a 91 cm maximum.',
  source: 'https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/california-sheephead',
  profile: [
    [-.5, -.027, .0001, .0001], [-.481, -.010, .037, .033], [-.445, .020, .091, .058],
    [-.385, .051, .140, .083], [-.30, .043, .157, .100], [-.19, .014, .164, .106],
    [-.04, .002, .159, .095], [.12, .006, .122, .072], [.26, .009, .067, .043],
    [.35, .010, .039, .028], [.39, .01, .030, .021],
  ],
  segments: [28, 16], eye: [-.401, .064, .023], gillX: -.27,
  pectoral: [-.225, -.015], dorsalPivot: [-.09, .169],
  motion: { slowHz: .58, fastHz: 1.65, slowBend: .045, fastBend: .12, slowTail: .14, fastTail: .31, fastDorsal: .90, pectoralOpen: .50 },
  budget: { triangles: 2000, drawCalls: 2 },
} as const satisfies FishDesign;
