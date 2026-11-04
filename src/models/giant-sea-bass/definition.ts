import type { FishDesign } from '../shared/fish/design';

/** Adult grey phase; photo-guided proportions, not a measured specimen. */
export const GIANT_SEA_BASS = {
  id:'giant-sea-bass', lengthMeters:1.5,
  source:'https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/giant-sea-bass',
  sizeBasis:'Selected 1.5 m adult specimen. Monterey Bay Aquarium reports a 2.3 m maximum; the 1 m lower guide endpoint is an authoring choice.',
  profile:[
    [-.491,-.045,.035,.040],[-.47,-.033,.055,.065],[-.42,-.016,.085,.090],
    [-.35,.001,.116,.108],[-.25,.016,.131,.113],[-.13,.023,.145,.110],
    [.01,.023,.145,.096],[.14,.013,.126,.076],[.26,.002,.085,.050],
    [.34,-.005,.048,.032],[.395,-.005,.039,.027],
  ],
  segments:[32,18], eye:[-.391,.035,.013], gillX:-.245,
  pectoral:[-.235,-.035], dorsalPivot:[-.08,.17],
  // Slow reef cruising and a stronger fast stroke; rates remain artistic.
  motion:{slowHz:.42,fastHz:1.15,slowBend:.045,fastBend:.12,slowTail:.16,fastTail:.34,fastDorsal:.95,pectoralOpen:.58},
  budget:{triangles:2200,drawCalls:2},
} as const satisfies FishDesign;
