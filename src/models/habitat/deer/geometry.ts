import { BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, Matrix4, Quaternion, SphereGeometry, Uint16BufferAttribute, Vector3 } from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../../shared/random';
import type { LodLevel } from '../../shared/lod/geometry';
import { DEER_LEGS, deerDimensions, deerPivots, type DeerVariant } from './definition';

type Point = readonly [number, number, number];
const PALETTE = { coat: '#927e66', fawn: '#a17b50', belly: '#c4b69a', spot: '#ddd2b4', black: '#343936', hoof: '#4b4940', ear: '#b69d84' };

/** All anatomy is merged into one matte skin. Pigment is geometry-local vertex
 * paint; fawn spots partition the coat surface, never coplanar decal meshes. */
export function buildDeerGeometry(variant: DeerVariant, seed: number, detail: LodLevel) {
  const d = deerDimensions(variant), pivots = deerPivots(variant), fawn = variant === 'fawn', near = detail === 'near', far = detail === 'far';
  const random = mulberry32(seed), coat = new Color(fawn ? PALETTE.fawn : PALETTE.coat).multiplyScalar(.95 + random() * .10), belly = new Color(PALETTE.belly), spot = new Color(PALETTE.spot);
  const parts: BufferGeometry[] = [], names: string[] = [];
  function add(name: string, geometry: BufferGeometry, bone: number, color: Color | string) {
    geometry.deleteAttribute('uv'); const p = geometry.getAttribute('position'), c = new Color(color), colors: number[] = [], joints: number[] = [], weights: number[] = [];
    for (let i = 0; i < p.count; i++) { colors.push(c.r, c.g, c.b); joints.push(bone, 0, 0, 0); weights.push(1, 0, 0, 0); }
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3)); geometry.setAttribute('skinIndex', new Uint16BufferAttribute(joints, 4)); geometry.setAttribute('skinWeight', new Float32BufferAttribute(weights, 4));
    parts.push(geometry); names.push(name);
  }
  function poly(name: string, points: Point[], faces: number[][], bone: number, color: Color | string) {
    const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(points.flat(), 3)); g.setIndex(faces.flat()); g.computeVertexNormals(); add(name, g, bone, color);
  }
  function ellipsoid(name: string, center: Point, radius: Point, bone: number, color: string | Color, segments: number, rings: number) {
    const g = new SphereGeometry(1, segments, rings); g.scale(...radius); g.translate(...center); add(name, g, bone, color);
  }
  function rod(name: string, a: Vector3, b: Vector3, radiusA: number, radiusB: number, bone: number, color: string | Color, segments: number, closed = false) {
    const delta = b.clone().sub(a), g = new CylinderGeometry(radiusB, radiusA, delta.length(), segments, 1, !closed);
    g.applyMatrix4(new Matrix4().compose(a.clone().add(b).multiplyScalar(.5), new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), delta.normalize()), new Vector3(1, 1, 1))); add(name, g, bone, color);
  }

  // A continuous tapered body, with slightly fuller rump and chest. The fawn's
  // shorter torso is independently proportioned, not a uniformly scaled doe.
  const segments = near ? 12 : far ? 4 : 8, rings = near ? 7 : far ? 4 : 5;
  const rows: Point[][] = [];
  for (let j = 0; j < rings; j++) {
    const latitude = j * Math.PI / (rings - 1), z = -Math.cos(latitude) * d.bodyRadius.z;
    rows.push(Array.from({ length: segments }, (_, i) => { const t = i * Math.PI * 2 / segments, radius = Math.sin(latitude); return [Math.sin(t) * d.bodyRadius.x * radius, d.bodyY + Math.cos(t) * d.bodyRadius.y * radius, z] as const; }));
  }
  const bodyPositions: number[] = [], bodyColors: number[] = [];
  const emit = (a: Point, b: Point, c: Point, color: Color) => { bodyPositions.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) bodyColors.push(color.r, color.g, color.b); };
  for (let j = 0; j < rings - 1; j++) for (let i = 0; i < segments; i++) {
    const n = (i + 1) % segments, a = rows[j][i], b = rows[j][n], c = rows[j + 1][n], e = rows[j + 1][i];
    const color = (a[1] + b[1] + c[1] + e[1]) / 4 < d.bodyY - d.bodyRadius.y * .48 ? belly : coat;
    // Sparse cream spots on both upper flanks, four to eight broad fields at
    // useful distances. Their surface partition cannot flicker in animation.
    const spotted = fawn && !far && j > 0 && j < rings - 2 && (near ? [1, 2, 9, 10].includes(i) && (j + i) % 2 === 0 : [1, 6].includes(i));
    if (spotted) {
      const middle = a.map((v, k) => (v + b[k] + c[k] + e[k]) / 4) as unknown as Point;
      const inner = [a, b, c, e].map(p => p.map((v, k) => middle[k] + (v - middle[k]) * .36) as unknown as Point);
      const outer = [a, b, c, e];
      for (let k = 0; k < 4; k++) { const l = (k + 1) % 4; emit(outer[k], inner[k], inner[l], coat); emit(outer[k], inner[l], outer[l], coat); }
      emit(inner[0], inner[3], inner[2], spot); emit(inner[0], inner[2], inner[1], spot);
    } else {
      if (j > 0) emit(a, e, b, color);
      if (j < rings - 2) emit(b, e, c, color);
    }
  }
  const body = new BufferGeometry(); body.setAttribute('position', new Float32BufferAttribute(bodyPositions, 3)); body.setIndex(Array.from({ length: bodyPositions.length / 3 }, (_, i) => i)); body.computeVertexNormals(); add('continuous-chest-rump-and-belly', body, 0, coat); body.setAttribute('color', new Float32BufferAttribute(bodyColors, 3));

  const neckBase = pivots[1].clone().add(new Vector3(0, -.055, .035));
  rod('tapered-neck', neckBase, pivots[2], fawn ? .085 : .12, fawn ? .060 : .080, 1, coat, near ? 8 : far ? 3 : 5, true);
  ellipsoid('head', [0, fawn ? .915 : 1.295, fawn ? -.392 : -.658], [fawn ? .095 : .115, fawn ? .10 : .125, fawn ? .115 : .16], 2, coat, near ? 8 : far ? 4 : 6, near ? 5 : 3);
  ellipsoid('short-muzzle', [0, fawn ? .865 : 1.225, fawn ? -.492 : -.804], [fawn ? .061 : .075, fawn ? .055 : .074, fawn ? .087 : .125], 2, coat, near ? 7 : far ? 4 : 5, near ? 4 : 3);
  if (!far) {
    ellipsoid('black-nose', [0, fawn ? .854 : 1.205, fawn ? -.568 : -.918], [fawn ? .049 : .062, fawn ? .033 : .038, .021], 2, PALETTE.black, near ? 6 : 4, 3);
    for (const s of [-1, 1]) ellipsoid('dark-eye', [s * (fawn ? .086 : .103), fawn ? .939 : 1.33, fawn ? -.429 : -.710], [fawn ? .012 : .009, fawn ? .018 : .015, fawn ? .018 : .016], 2, PALETTE.black, 4, 3);
  }
  for (const s of [-1, 1]) {
    const joint = s < 0 ? 16 : 17, p = pivots[joint], tip: Point = [s * (fawn ? .16 : .20), fawn ? 1.16 : 1.66, fawn ? -.31 : -.51], w = fawn ? .055 : .063;
    const points: Point[] = [[p.x, p.y, p.z], [p.x - w, p.y + (fawn ? .09 : .13), p.z - .012], tip, [p.x + w, p.y + (fawn ? .09 : .13), p.z - .012], [p.x, p.y + (fawn ? .085 : .12), p.z + .035]];
    poly('large-leaf-ear', points, [[0, 1, 2], [0, 2, 3], [0, 4, 1], [1, 4, 2], [2, 4, 3], [3, 4, 0]], joint, coat);
    if (!far) poly('ear-inner-pigment', [[p.x, p.y + .025, p.z - .014], [p.x - w * .55, p.y + (fawn ? .087 : .125), p.z - .018], [tip[0] * .96, tip[1] - .038, tip[2] - .016], [p.x + w * .55, p.y + (fawn ? .087 : .125), p.z - .018]], [[0, 1, 2], [0, 2, 3]], joint, PALETTE.ear);
  }
  for (const joint of DEER_LEGS) {
    const hip = pivots[joint], knee = pivots[joint + 1], hoof = pivots[joint + 2], rear = joint >= 10;
    // A small shoulder/haunch embeds the moving hip in the faceted trunk.
    // Its centre remains close enough to the pivot to overlap in a full stride.
    ellipsoid(rear ? 'attached-haunch' : 'attached-shoulder', [hip.x, hip.y - (fawn ? .04 : .06), hip.z], [fawn ? .048 : rear ? .078 : .064, fawn ? .085 : .125, fawn ? .065 : .10], joint, coat, near ? 6 : 4, near ? 4 : far ? 2 : 3);
    rod('upper-leg', hip, knee, (fawn ? .034 : .055) * (rear ? 1.18 : 1), fawn ? .018 : .024, joint, coat, near ? 6 : far ? 3 : 4);
    rod('slender-lower-leg', knee, hoof, fawn ? .017 : .023, fawn ? .013 : .018, joint + 1, coat, near ? 5 : far ? 3 : 4);
    const w = fawn ? .021 : .031, h = d.hoofHeight, z = fawn ? .038 : .05;
    if (far) poly('distant-hoof', [[hoof.x - w, 0, hoof.z - z], [hoof.x + w, 0, hoof.z - z], [hoof.x, h * 1.8, hoof.z], [hoof.x, 0, hoof.z + z * .6]], [[0, 2, 1], [0, 3, 2], [1, 2, 3], [0, 1, 3]], joint + 2, PALETTE.hoof);
    else {
      const p: Point[] = [[hoof.x - w, 0, hoof.z - z], [hoof.x + w, 0, hoof.z - z], [hoof.x + w, 0, hoof.z + z * .6], [hoof.x - w, 0, hoof.z + z * .6], [hoof.x - w * .8, h * 1.75, hoof.z - z * .55], [hoof.x + w * .8, h * 1.75, hoof.z - z * .55], [hoof.x + w * .8, h * 1.75, hoof.z + z * .5], [hoof.x - w * .8, h * 1.75, hoof.z + z * .5]];
      poly('hoof', p, [[0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7], [4, 5, 6], [4, 6, 7], [0, 3, 2], [0, 2, 1]], joint + 2, PALETTE.hoof);
    }
  }
  const t = pivots[3], end = fawn ? .37 : .64, w = fawn ? .037 : .052;
  poly('short-black-tail-upper', [[-w, t.y, t.z], [w, t.y, t.z], [0, t.y - .06, end], [0, t.y + .035, t.z + .045]], [[0, 3, 2], [3, 1, 2]], 3, PALETTE.black);
  poly('tail-pale-underside', [[-w, t.y, t.z], [w, t.y, t.z], [0, t.y - .06, end], [0, t.y + .035, t.z + .045], [0, t.y - .025, t.z + .04]], [[0, 2, 4], [4, 2, 1], [0, 4, 3], [3, 4, 1]], 3, PALETTE.belly);
  const merged = mergeGeometries(parts)!; parts.forEach(p => p.dispose()); const result = mergeVertices(merged, 1e-7); merged.dispose();
  result.name = `black-tailed-${variant}-${detail}`; result.userData.sourceParts = names; result.computeBoundingBox(); result.computeBoundingSphere(); return result;
}
