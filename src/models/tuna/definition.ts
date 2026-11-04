import type { FishPhysicsDescriptor } from '../types';

/** Authoring values in model units. Head is -X, up is +Y, near side is +Z. */
export const TUNA_GEOMETRY = {
  body: { longitudinalSegments: 36, radialSegments: 20 },
  lowerFins: {
    pelvic: { x: -.5, sideOffset: .20, inset: .105, length: .48, height: -.10 },
    anal: { x: .62, inset: .08, scale: [.87, .72, 1] },
    finlets: { inset: .065 },
  },
} as const;

/** Authoring batches before final GPU batching; four named groups remain as fin controls. */
export const TUNA_BATCHES = [
  { name: 'stabilizers', components: ['dorsal-secondary', 'anal', 'pelvic-near', 'pelvic-far'] },
  { name: 'finlets', components: ['finlets-top', 'finlets-bottom'] },
  { name: 'head-details', components: ['eyes', 'gills', 'mouth'] },
  { name: 'caught-details', components: ['eyes-caught', 'caught-gills', 'caught-mouth'] },
] as const;
export const TUNA_DEFORMING_PARTS = ['body', ...TUNA_BATCHES.map(batch => batch.name)] as const;

export const TUNA_PHYSICS = {
  colliders: [{ shape: 'capsule', axis: 'x', center: [-.2, .05, 0], radius: 1.05, halfLength: 2.0 }],
  centerOfMass: [-.7, .05, 0],
  anchors: { mouth: [-3.1, -.05, 0], grip: [-.6, 0, 0] },
} as const satisfies FishPhysicsDescriptor;
