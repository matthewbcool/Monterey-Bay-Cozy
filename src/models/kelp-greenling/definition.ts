import type { FishDesign } from '../shared/fish/design';

/** Female color phase with golden freckles and yellow-orange fins. */
export const KELP_GREENLING = {
  id: 'kelp-greenling', lengthMeters: .35,
  sizeBasis: 'Representative 35 cm female design; not a measured specimen. ODFW lists a 53 cm maximum.',
  source: 'https://nrimp.dfw.state.or.us/mrp/default.aspx?page=74',
  localSource: 'https://wildlife.ca.gov/Conservation/Marine/Nearshore/1000',
  profile: [
    [-.5, -.010, .0001, .0001], [-.476, -.001, .026, .023], [-.42, .012, .059, .041],
    [-.32, .012, .084, .059], [-.20, .006, .098, .065], [-.04, .003, .100, .060],
    [.12, .004, .083, .048], [.26, .004, .050, .029], [.35, .005, .029, .018], [.39, .005, .022, .014],
  ],
  segments: [28, 14], eye: [-.404, .036, .020], gillX: -.29,
  pectoral: [-.255, -.009], dorsalPivot: [-.07, .094],
  motion: { slowHz: .68, fastHz: 2.05, slowBend: .070, fastBend: .16, slowTail: .18, fastTail: .38, fastDorsal: .86, pectoralOpen: .56 },
  budget: { triangles: 2000, drawCalls: 2 },
} as const satisfies FishDesign & { localSource: string };
