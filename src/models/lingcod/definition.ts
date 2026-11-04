import type { FishDesign } from '../shared/fish/design';

/** Broad head and long taper; olive color morph. No claim of exact specimen reconstruction. */
export const LINGCOD = {
  id: 'lingcod', lengthMeters: .85,
  sizeBasis: 'Representative 85 cm adult; not a measured specimen. MBA lists a 1.5 m maximum.',
  source: 'https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/lingcod',
  profile: [
    [-.5,-.012,.0001,.0001],[-.485,-.004,.036,.050],[-.445,.009,.067,.082],
    [-.36,.015,.086,.096],[-.25,.009,.093,.086],[-.10,.002,.090,.067],
    [.06,.003,.075,.050],[.22,.004,.053,.035],[.34,.005,.028,.021],[.40,.005,.022,.016],
  ],
  segments: [28, 14], eye: [-.387,.062,.018], gillX: -.265,
  pectoral: [-.245,-.022], dorsalPivot: [-.08,.105],
  motion: { slowHz: .42, fastHz: 1.65, slowBend: .035, fastBend: .13, slowTail: .12, fastTail: .33, fastDorsal: .92, pectoralOpen: .65 },
  budget: { triangles: 1800, drawCalls: 2 },
} as const satisfies FishDesign;
