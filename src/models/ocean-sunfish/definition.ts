import type { Outline, Section } from '../shared/fish/design';

/** Artistic proportions in fractions of snout-to-clavus length, not a measured specimen. */
export const SUNFISH = {
  id: 'ocean-sunfish', lengthMeters: 1.2,
  sizeBasis: 'Representative 1.2 m snout-to-clavus design; an artistic size, not a measured individual or species maximum.',
  source: 'https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/ocean-sunfish',
  motionSource: 'https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0003446',
  profile: [
    [-.487, -.008, .041, .025], [-.462, .010, .116, .052], [-.405, .014, .218, .073],
    [-.31, .008, .300, .101], [-.18, .004, .349, .116], [-.025, 0, .360, .110],
    [.105, 0, .339, .092], [.23, -.006, .302, .065], [.31, -.008, .262, .035], [.355, -.008, .234, .012],
  ] as readonly Section[],
  segments: [28, 16] as const, eye: [-.388, .078, .029] as const,
  dorsalPivot: [.15, .287, 0] as const, analPivot: [.15, -.293, 0] as const,
  clavusPivot: [.30, -.008, 0] as const, pectoral: [-.25, -.04] as const,
  // Broad roots overlap the body; the last three outline points close within the skin.
  dorsal: [[.047, .298], [.10, .434], [.18, .651], [.258, .770], [.296, .750], [.286, .667], [.245, .464], [.251, .270], [.16, .283]] as Outline,
  anal: [[.045, -.292], [.10, -.422], [.18, -.628], [.252, -.746], [.290, -.734], [.286, -.650], [.250, -.445], [.251, -.270], [.16, -.279]] as Outline,
  clavus: [[.258, .268], [.340, .279], [.397, .240], [.412, .198], [.449, .162], [.444, .123], [.480, .084], [.466, .043], [.5, .006], [.477, -.035], [.491, -.078], [.461, -.116], [.464, -.155], [.424, -.186], [.409, -.231], [.349, -.269], [.258, -.273], [.30, -.13], [.318, 0], [.30, .14]] as Outline,
  motion: { slowHz: .40, fastHz: .82, slowStroke: .32, fastStroke: .52, slowFeather: .10, fastFeather: .17 },
  budget: { triangles: 1800, drawCalls: 2 },
} as const;
