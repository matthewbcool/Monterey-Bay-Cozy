import { Vector3 } from 'three';

export type DeerVariant = 'adult' | 'fawn';
export type DeerPose = 'idle' | 'walk' | 'gallop' | 'eat';
export const DEER_POSES: readonly DeerPose[] = ['idle', 'walk', 'gallop', 'eat'];
export const DEER = {
  species: 'Odocoileus hemionus columbianus',
  commonName: 'Columbian black-tailed deer',
  localSource: 'https://www.army.mil/article-amp/263548/presidio_of_monterey_assessing_deer_population_on_post',
  budget: { near: 1200, mid: 600, far: 180, drawCalls: 1 },
  sizeBasis: 'Authored representative adult doe and young spotted fawn. Juvenile proportions and gait timing are artistic, not age-specific biological measurements.',
} as const;

export const DEER_BONE_NAMES = ['body', 'neck', 'head', 'tail', 'front-left-upper', 'front-left-lower', 'front-left-hoof', 'front-right-upper', 'front-right-lower', 'front-right-hoof', 'rear-left-upper', 'rear-left-lower', 'rear-left-hoof', 'rear-right-upper', 'rear-right-lower', 'rear-right-hoof', 'left-ear', 'right-ear'] as const;
export const DEER_PARENTS = [-1, 0, 1, 0, 0, 4, 5, 0, 7, 8, 0, 10, 11, 0, 13, 14, 2, 2] as const;
export const DEER_LEGS = [4, 7, 10, 13] as const;

export function deerDimensions(variant: DeerVariant) {
  if (variant !== 'adult' && variant !== 'fawn') throw new RangeError('Unknown deer variant');
  const fawn = variant === 'fawn';
  return {
    variant, lengthMeters: fawn ? .96 : 1.58, shoulderHeightMeters: fawn ? .58 : .86,
    heightMeters: fawn ? 1.16 : 1.66, widthMeters: fawn ? .35 : .43,
    bodyY: fawn ? .51 : .75, bodyRadius: new Vector3(fawn ? .125 : .20, fawn ? .165 : .245, fawn ? .29 : .47),
    hoofHeight: fawn ? .027 : .04, walkSpeedMetersPerSecond: fawn ? .65 : .8,
    gallopSpeedMetersPerSecond: fawn ? 2.4 : 3.2,
  };
}

/** Absolute bind coordinates. Feet contact y=0; head faces −Z. The fawn has a
 * shorter trunk/muzzle and proportionately larger head, ears and slender legs. */
export function deerPivots(variant: DeerVariant) {
  const f = variant === 'fawn', w = f ? .086 : .135, hipY = f ? .58 : .86, footY = f ? .027 : .04;
  const frontZ = f ? -.18 : -.30, rearZ = f ? .19 : .32;
  const points = [
    [0, 0, 0], [0, f ? .58 : .86, f ? -.18 : -.32], [0, f ? .88 : 1.26, f ? -.36 : -.60], [0, f ? .57 : .83, f ? .20 : .35],
    [-w, hipY, frontZ], [-w, f ? .30 : .43, frontZ + .025], [-w, footY, frontZ - .01],
    [w, hipY, frontZ], [w, f ? .30 : .43, frontZ + .025], [w, footY, frontZ - .01],
    [-w, hipY - .025, rearZ], [-w, f ? .29 : .43, rearZ + (f ? .09 : .14)], [-w, footY, rearZ + .02],
    [w, hipY - .025, rearZ], [w, f ? .29 : .43, rearZ + (f ? .09 : .14)], [w, footY, rearZ + .02],
    [f ? -.075 : -.085, f ? .965 : 1.365, f ? -.33 : -.56], [f ? .075 : .085, f ? .965 : 1.365, f ? -.33 : -.56],
  ];
  return points.map(p => new Vector3(...p as [number, number, number]));
}
