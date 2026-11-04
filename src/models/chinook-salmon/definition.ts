import type { FishDesign } from '../shared/fish/design';

/** Ocean-phase (bright silver) adult; dimensions and motion are artistic, not a measured specimen. */
export const CHINOOK_SALMON = {
  id: 'chinook-salmon', lengthMeters: .80,
  sizeBasis: 'Representative 80 cm ocean-phase adult; not a measured specimen. NOAA Fisheries lists about 3 ft (~0.9 m) length and 40 lb weight, up to 120 lb.',
  source: 'https://www.fisheries.noaa.gov/species/chinook-salmon-protected',
  localSource: 'https://ceqanet.lci.ca.gov/2025030879',
  idSource: 'https://wdfw.wa.gov/sites/default/files/2024-08/pacific-salmon-id-card-2024-4.pdf',
  // Streamlined fusiform body: pointed snout, deepest just ahead of the dorsal, thick peduncle.
  profile: [
    [-.5, -.012, .0001, .0001], [-.478, -.007, .022, .017], [-.44, .000, .050, .034],
    [-.37, .008, .078, .050], [-.27, .011, .097, .059], [-.14, .010, .104, .061],
    [.00, .008, .095, .055], [.14, .006, .073, .041], [.26, .004, .045, .026],
    [.34, .004, .030, .018], [.385, .004, .029, .016],
  ],
  segments: [27, 16], eye: [-.427, .021, .016], gillX: -.345,
  pectoral: [-.325, -.058], dorsalPivot: [-.07, .102],
  motion: { slowHz: .85, fastHz: 2.30, slowBend: .040, fastBend: .10, slowTail: .16, fastTail: .34, fastDorsal: .92, pectoralOpen: .42 },
  budget: { triangles: 2000, drawCalls: 2 },
} as const satisfies FishDesign & { localSource: string; idSource: string };
