import { MathUtils, Vector3 } from 'three';

// Head to tail: [longitudinal position, centre height, half-depth, half-width].
// Measurements are normalized artistic proportions, not biological dimensions.
export const BODY_PROFILE = [
  [-3.15, -.05, .015, .014], [-2.94, -.06, .20, .16],
  [-2.60, -.035, .45, .32], [-2.12, .015, .71, .46],
  [-1.50, .015, .94, .57], [-.80, .005, 1.085, .635],
  [-.12, .065, 1.03, .59], [.56, .15, .84, .48],
  [1.18, .24, .60, .34], [1.72, .30, .37, .215],
  [2.20, .34, .18, .12], [2.58, .36, .095, .082],
  [2.79, .36, .065, .054], [2.88, .36, .005, .004],
] as const;

function cubic(a: number, b: number, c: number, d: number, t: number) {
  return .5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
}

export function profileAt(x: number) {
  let i = 0;
  while (i < BODY_PROFILE.length - 2 && x > BODY_PROFILE[i + 1][0]) i++;
  const a = BODY_PROFILE[Math.max(0, i - 1)], b = BODY_PROFILE[i];
  const c = BODY_PROFILE[i + 1], d = BODY_PROFILE[Math.min(i + 2, BODY_PROFILE.length - 1)];
  const t = MathUtils.clamp((x - b[0]) / (c[0] - b[0]), 0, 1);
  return { y: cubic(a[1], b[1], c[1], d[1], t) + .04 * cubic(a[2], b[2], c[2], d[2], t), ry: Math.max(.003, .96 * cubic(a[2], b[2], c[2], d[2], t)), rz: Math.max(.003, cubic(a[3], b[3], c[3], d[3], t)) };
}

/** Surface at a lateral offset, rather than assuming a circular cross-section. */
export function bodySurfaceY(x: number, z: number, side: 1 | -1) {
  const profile = profileAt(x);
  const section = Math.sqrt(Math.max(0, 1 - (z / profile.rz) ** 2));
  return profile.y + side * profile.ry * section;
}

/** Surface point used by small face markings, with a tiny anti-z-fighting offset. */
export function faceSurface(x: number, y: number, side: number) {
  const profile = profileAt(x);
  const width = profile.rz * Math.sqrt(Math.max(0, 1 - ((y - profile.y) / profile.ry) ** 2));
  return new Vector3(x, y, side * (width + .012));
}
