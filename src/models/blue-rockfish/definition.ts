import type { FishDesign } from '../shared/fish/design';

export const BLUE_ROCKFISH = {
  id: 'blue-rockfish', lengthMeters: .35,
  sizeBasis: 'Representative 35 cm adult design; not a measured specimen. CDFW documents a 53 cm maximum.',
  source: 'https://wildlife.ca.gov/Fishing/Ocean/Fish-ID/Quiz',
  profile: [
    [-.5, -.011, .0001, .0001], [-.482, .004, .049, .031], [-.42, .024, .092, .057],
    [-.32, .020, .133, .080], [-.18, .009, .159, .092], [0, .004, .158, .084],
    [.16, .007, .114, .063], [.28, .010, .063, .038], [.36, .012, .040, .028], [.395, .012, .026, .019],
  ],
  segments: [32, 16], eye: [-.404, .048, .026], gillX: -.27,
  pectoral: [-.23, -.027], dorsalPivot: [-.07, .145],
  motion: { slowHz: .62, fastHz: 1.9, slowBend: .055, fastBend: .13, slowTail: .17, fastTail: .34, fastDorsal: .88, pectoralOpen: .53 },
  budget: { triangles: 2800, drawCalls: 2 },
} as const satisfies FishDesign;
