import { Vector3 } from 'three';

export type GullSex = 'male' | 'female';
export type GullPose = 'flight' | 'standing' | 'walking' | 'pooping';
export const GULL_POSES: readonly GullPose[] = ['flight', 'standing', 'walking', 'pooping'];
export const GULL = {
  species: 'Larus occidentalis',
  lengthRangeMeters: [.56, .66], wingspanRangeMeters: [1.20, 1.44],
  source: 'https://www.allaboutbirds.org/guide/Western_Gull/id',
  sexSource: 'https://www.audubon.org/field-guide/bird/western-gull',
  localSource: 'https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/western-gull',
  sizeBasis: 'Cornell combined-sex adult range. Male 65 cm / female 59.8 cm are selected examples within overlapping real sizes, not sex-specific averages. Adult plumage is alike; the female model uses an authored cream/lavender palette for visual distinction.',
  // Authored timing, not a biological measurement. The host owns travel/physics.
  wingbeatHz: 2.3, glideCycleSeconds: 8, walkHz: 1.45, walkSpeedMetersPerSecond: .38,
  poopDurationSeconds: 1.7,
  budget: { triangles: 400, drawCalls: 1 },
} as const;

export function gullDimensions(sex: GullSex) {
  if (sex !== 'male' && sex !== 'female') throw new RangeError('Unknown gull sex');
  const scale = sex === 'male' ? 1 : .92;
  return { scale, lengthMeters: .65 * scale, wingspanMeters: 1.37 * scale };
}

/** Absolute bind coordinates, +Y up, -Z forward. Root remains an unscaled placement anchor. */
export function gullPivots(sex: GullSex) {
  const { scale } = gullDimensions(sex);
  return [
    [0, 0, 0], [-.065, .34, -.055], [.065, .34, -.055],
    [-.365, .34, -.005], [.365, .34, -.005],
    [-.052, .23, .025], [.052, .23, .025], [0, .30, .19],
    [0, .39, -.17], [0, .23, .20],
  ].map(p => new Vector3(...p as [number, number, number]).multiplyScalar(scale));
}

export const GULL_BONE_NAMES = ['body', 'left-shoulder', 'right-shoulder', 'left-wrist', 'right-wrist', 'left-leg', 'right-leg', 'tail', 'head', 'droplet'] as const;
export const GULL_PARENTS = [-1, 0, 0, 1, 2, 0, 0, 0, 0, 0] as const;
