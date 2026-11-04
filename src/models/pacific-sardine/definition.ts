import type { FishDesign } from '../shared/fish/design';
import { DEFAULT_SCHOOLING, type SchoolingTraits } from '../shared/school/schooling';

export const SARDINE = {
  id: 'pacific-sardine', lengthMeters: .25,
  sizeBasis: 'Representative 25 cm adult design; not a measured specimen. Aquarium documents up to 38 cm.',
  source: 'https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/pacific-sardine',
  profile: [
    [-.5, 0, .0001, .0001], [-.47, .001, .024, .014], [-.40, .004, .047, .027],
    [-.30, .002, .064, .039], [-.16, 0, .076, .043], [0, .002, .073, .039],
    [.14, .006, .056, .030], [.25, .008, .032, .018], [.34, .009, .014, .010], [.385, .009, .007, .004],
  ],
  segments: [24, 16], eye: [-.418, .012, .018], gillX: -.32,
  pectoral: [-.285, -.013], dorsalPivot: [.015, .067],
  motion: { slowHz: 1.15, fastHz: 3.1, slowBend: .09, fastBend: .16, slowTail: .23, fastTail: .40, fastDorsal: .78, pectoralOpen: .42 },
  budget: { triangles: 2400, drawCalls: 2 },
} as const satisfies FishDesign;

/** Artistic schooling traits. Sardines form dense, polarized schools of similar-sized fish;
 * spacing and spread are stylized choices, not measurements. Cruise matches the tank catalogue. */
export const SARDINE_SCHOOLING: SchoolingTraits = { ...DEFAULT_SCHOOLING, spacing: .65, shape: [2.2, .8, .9], flex: { bend: .2, breathe: .08 }, sizeSpread: .1, cruise: { slow: .18, fast: .72 } };
