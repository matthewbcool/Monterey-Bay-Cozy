import { Vector3 } from 'three';

export type SeaOtterPose = 'float' | 'swim' | 'groom' | 'dive';
export const SEA_OTTER_POSES: readonly SeaOtterPose[] = ['float', 'swim', 'groom', 'dive'];
export const SEA_OTTER = {
  assetId: 'southern-sea-otter', commonName: 'Southern sea otter', species: 'Enhydra lutris nereis',
  source: 'https://www.sheddaquarium.org/animals/southern-sea-otter',
  localSource: 'https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/sea-otter',
  anatomySource: 'https://wildlife.ca.gov/OSPR/Science/MWVCRC/Sea-Otter-Stranding-Response',
  nominalLengthMeters: 1.2, lengthRangeMeters: [1, 1.5],
  sizeBasis: 'Shedd gives female lengths 1.00–1.40 m and male lengths 1.20–1.50 m; the combined adult interval is 1.00–1.50 m. A 1.20 m nose-to-tail specimen is authored here; proportions, coat and animation timing are stylized estimates, not a sex-specific average.',
  budget: { near: 1500, mid: 700, far: 220, drawCalls: 1 },
} as const;

/** Body/chest/pelvis smoothly share one continuous surface. Front paws have
 * separate wrists; the large hind feet and two tail hinges drive swimming. */
export const SEA_OTTER_BONE_NAMES = ['body', 'chest', 'pelvis', 'head', 'tail', 'left-forearm', 'right-forearm', 'left-paw', 'right-paw', 'left-hind-flipper', 'right-hind-flipper', 'tail-tip'] as const;
export const SEA_OTTER_PARENTS = [-1, 0, 0, 1, 2, 1, 1, 5, 6, 2, 2, 4] as const;

export function seaOtterDimensions(lengthMeters: number = SEA_OTTER.nominalLengthMeters) {
  if (!Number.isFinite(lengthMeters) || lengthMeters < SEA_OTTER.lengthRangeMeters[0] || lengthMeters > SEA_OTTER.lengthRangeMeters[1]) throw new RangeError('Sea otter length must be within 1.00–1.50 metres');
  const scale = lengthMeters / 1.15;
  return { lengthMeters, scale, widthMeters: .59 * scale, heightMeters: .47 * scale, bodyWidthMeters: .38 * scale, waterlineMeters: 0 };
}

/** Belly-up absolute bind frame, +Y up and −Z head/forward. The root's Y=0 is
 * the authored floating waterline; the host owns water contact and translation. */
export function seaOtterPivots(lengthMeters: number = SEA_OTTER.nominalLengthMeters) {
  const { scale } = seaOtterDimensions(lengthMeters);
  return [
    [0, 0, 0], [0, 0, -.20], [0, -.015, .20], [0, .07, -.365], [0, -.035, .32],
    [-.095, .11, -.33], [.095, .11, -.33], [-.055, .205, -.225], [.055, .205, -.225],
    [-.095, -.015, .29], [.095, -.015, .29], [0, -.035, .49],
  ].map(p => new Vector3(...p as [number, number, number]).multiplyScalar(scale));
}
