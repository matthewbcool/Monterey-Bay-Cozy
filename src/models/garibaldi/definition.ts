import type { FishDesign } from '../shared/fish/design';

/** Adult orange phase. Nominal size and swim tuning are artistic choices. */
export const GARIBALDI = {
  id: 'garibaldi', lengthMeters: .28,
  sizeBasis: 'Representative 28 cm adult; not a measured specimen. MBA lists a 35.6 cm maximum.',
  source: 'https://www.montereybayaquarium.org/es/animales-y-el-oceano/animales-de-la-a-a-la-z/jaqueta-garibaldi',
  profile: [
    [-.5, -.012, .0001, .0001], [-.474, .002, .044, .028], [-.42, .025, .102, .046],
    [-.32, .029, .182, .070], [-.18, .015, .216, .082], [0, .004, .202, .076],
    [.16, .006, .151, .056], [.28, .008, .077, .036], [.36, .008, .037, .022], [.39, .008, .028, .017],
  ],
  segments: [24, 14], eye: [-.397, .057, .025], gillX: -.28,
  pectoral: [-.23, -.022], dorsalPivot: [-.07, .210],
  motion: { slowHz: .65, fastHz: 1.9, slowBend: .035, fastBend: .095, slowTail: .13, fastTail: .29, fastDorsal: .94, pectoralOpen: .52 },
  budget: { triangles: 1600, drawCalls: 2 },
} as const satisfies FishDesign;
