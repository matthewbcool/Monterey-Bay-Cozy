import { BufferGeometry, Color, Float32BufferAttribute, MathUtils, Uint16BufferAttribute } from 'three';
import type { Section } from './design';

/** Piecewise smooth interpolation keeps proportions in the species' own definition. */
export function sectionAt(profile: readonly Section[], x: number) {
  let i = 0;
  while (i < profile.length - 2 && x > profile[i + 1][0]) i++;
  const a = profile[Math.max(0, i - 1)], b = profile[i], c = profile[i + 1], d = profile[Math.min(profile.length - 1, i + 2)];
  const t = MathUtils.clamp((x - b[0]) / (c[0] - b[0]), 0, 1);
  const cubic = (j: number) => .5 * (2 * b[j] + (-a[j] + c[j]) * t + (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * t * t + (-a[j] + 3 * b[j] - 3 * c[j] + d[j]) * t * t * t);
  return { y: cubic(1), depth: Math.max(.0001, cubic(2)), width: Math.max(.0001, cubic(3)) };
}
export function bellyAt(profile: readonly Section[], x: number, z = 0, side = -1) {
  const p = sectionAt(profile, x);
  return p.y + side * p.depth * Math.sqrt(Math.max(0, 1 - (z / p.width) ** 2));
}
export function flankAt(profile: readonly Section[], x: number, y: number, side: number) {
  const p = sectionAt(profile, x);
  return side * (p.width * Math.sqrt(Math.max(0, 1 - ((y - p.y) / p.depth) ** 2)) + .0015);
}
export function solidColor(geometry: BufferGeometry, color: string) {
  const c = new Color(color), colors = new Float32Array(geometry.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i += 3) { colors[i] = c.r; colors[i + 1] = c.g; colors[i + 2] = c.b; }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry;
}
/** Indices 0-2 bend the body; 3 folds dorsal tips; 4/5 hinge the pectorals. */
export function skinGeometry(geometry: BufferGeometry, bone?: number, dorsalBase?: number) {
  if(!geometry.hasAttribute('fishMatte'))geometry.setAttribute('fishMatte',new Float32BufferAttribute(new Float32Array(geometry.attributes.position.count),1));
  const positions = geometry.attributes.position, indices: number[] = [], weights: number[] = [];
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const first = x < .29 ? 0 : 1;
    const blend = x < .29 ? MathUtils.clamp((x - .05) / .24, 0, 1) : MathUtils.clamp((x - .29) / .09, 0, 1);
    if (bone !== undefined) { indices.push(bone, 0, 0, 0); weights.push(1, 0, 0, 0); }
    else {
      const tip = dorsalBase === undefined ? 0 : MathUtils.clamp((positions.getY(i) - dorsalBase - .015) / .065, 0, 1);
      indices.push(first, first + 1, 3, 0); weights.push((1 - blend) * (1 - tip), blend * (1 - tip), tip, 0);
    }
  }
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(indices, 4));
  geometry.setAttribute('skinWeight', new Float32BufferAttribute(weights, 4));
  return geometry;
}
