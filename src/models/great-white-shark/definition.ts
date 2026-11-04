import type { FishDesign } from '../shared/fish/design';

/** Refined from Great-white-shark-facts-1.jpg: broad low head and long taper.
 * Total length is snout to upper tail tip; hidden sections remain stylized, not measured. */
export const GREAT_WHITE = {
  id: 'great-white-shark', lengthMeters: 4,
  source: 'https://www.floridamuseum.ufl.edu/discover-fish/species-profiles/white-shark/',
  sizeBasis: 'Representative 4 m total length; artistic specimen. Reference span runs from male maturity near 3.5 m to an estimated 6 m maximum, not a typical adult range.',
  profile: [
    [-.5,-.003,.001,.001],[-.478,-.001,.017,.026],[-.442,.002,.032,.049],
    [-.385,.005,.056,.075],[-.30,.007,.076,.090],[-.20,.006,.086,.096],
    [-.08,.004,.082,.084],[.06,.003,.065,.061],[.18,.004,.044,.038],
    [.29,.006,.023,.020],[.35,.007,.014,.012],[.38,.008,.012,.010],
  ],
  segments: [30,16], eye: [-.418,.006,.0075], gillX: -.28,
  pectoral: [-.24,-.042], dorsalPivot: [-.10,.09],
  // Cartilaginous fins stay extended: builders weight the first dorsal/pectorals to the head.
  // Broader rear-body/tail sweep at the same cadence; the anterior body stays steady.
  motion: { slowHz:.48, fastHz:1.12, slowBend:.065, fastBend:.13,
    slowTail:.25, fastTail:.40, fastDorsal:1, pectoralOpen:0 },
  budget: { triangles:2000, drawCalls:2 },
} as const satisfies FishDesign;
