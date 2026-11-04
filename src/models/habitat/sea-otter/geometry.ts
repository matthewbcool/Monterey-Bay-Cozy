import { BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, Matrix4, Quaternion, SphereGeometry, Uint16BufferAttribute, Vector3 } from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../../shared/random';
import type { LodLevel } from '../../shared/lod/geometry';
import { seaOtterDimensions } from './definition';

type Point = readonly [number, number, number];
type Ring = readonly [z: number, y: number, radiusX: number, radiusY: number];
const PROFILE: readonly Ring[] = [
  [-.575, .13, 0, 0], [-.56, .145, .080, .080], [-.525, .155, .135, .123], [-.475, .145, .160, .150],
  [-.425, .115, .150, .145], [-.385, .075, .118, .118], [-.335, .025, .127, .125],
  [-.25, .005, .165, .145], [-.11, 0, .19, .165], [.06, -.005, .19, .17],
  [.20, -.01, .175, .155], [.31, -.015, .125, .12], [.375, -.025, .065, .075], [.405, -.035, 0, 0],
];
const clamp = (x: number) => Math.max(0, Math.min(1, x));

/** A single continuous weighted head/neck/torso surface carries the silhouette.
 * Broad paint fields replace fur maps; only the face and moving appendages are
 * separate source components, merged into the same opaque draw before return. */
export function buildSeaOtterGeometry(lengthMeters: number, seed: number, detail: LodLevel) {
  const { scale } = seaOtterDimensions(lengthMeters), random = mulberry32(seed), near = detail === 'near', far = detail === 'far';
  const coat = new Color('#615246').multiplyScalar(.95 + random() * .10), head = new Color('#bcb5a0').multiplyScalar(.96 + random() * .08), cream = new Color('#d5cdb9'), black = new Color('#2b302e'), web = new Color('#50483e');
  const parts: BufferGeometry[] = [], names: string[] = [];
  function add(name: string, g: BufferGeometry, bone: number, color: Color, weight?: (p: Vector3) => [number, number, number], paint?: (p: Vector3) => Color) {
    g.deleteAttribute('uv'); if (!g.index) g.setIndex(Array.from({ length: g.attributes.position.count }, (_, i) => i));
    const positions = g.attributes.position, colors: number[] = [], joints: number[] = [], weights: number[] = [], p = new Vector3();
    for (let i = 0; i < positions.count; i++) {
      p.fromBufferAttribute(positions, i); const c = paint ? paint(p) : color, w = weight ? weight(p) : [bone, bone, 0];
      colors.push(c.r, c.g, c.b); joints.push(w[0], w[1], 0, 0); weights.push(1 - w[2], w[2], 0, 0);
    }
    g.setAttribute('color', new Float32BufferAttribute(colors, 3)); g.setAttribute('skinIndex', new Uint16BufferAttribute(joints, 4)); g.setAttribute('skinWeight', new Float32BufferAttribute(weights, 4)); parts.push(g); names.push(name);
  }
  function poly(name: string, points: Point[], faces: number[][], bone: number, color: Color) {
    const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(points.flat(), 3)); g.setIndex(faces.flat()); g.computeVertexNormals(); add(name, g, bone, color);
  }
  function ellipsoid(name: string, center: Point, radius: Point, bone: number, color: Color, segments: number, rings: number) {
    const g = new SphereGeometry(1, segments, rings); g.scale(...radius); g.translate(...center); add(name, g, bone, color);
  }
  function rod(name: string, a: Point, b: Point, radiusA: number, radiusB: number, bone: number) {
    const start = new Vector3(...a), end = new Vector3(...b), delta = end.clone().sub(start), g = new CylinderGeometry(radiusB, radiusA, delta.length(), near ? 6 : far ? 3 : 4, 1, true);
    g.applyMatrix4(new Matrix4().compose(start.add(end).multiplyScalar(.5), new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), delta.normalize()), new Vector3(1, 1, 1))); add(name, g, bone, coat);
  }
  function forearm(side: number, bone: number) {
    // A short folded elbow replaces the old straight cylinder. It shares the
    // existing arm hinge; the wrist remains independent for facial grooming.
    const points = far ? [[side * .095, .11, -.33], [side * .055, .205, -.225]] : [[side * .095, .11, -.33], [side * .12, .14, -.245], [side * .055, .205, -.225]];
    const centers = points.map(p => new Vector3(...p as [number, number, number])), segments = near ? 6 : far ? 3 : 4;
    const positions: number[] = [], indices: number[] = [], up = new Vector3(0, 1, 0), rotation = new Quaternion(), radial = new Vector3(), tangent = new Vector3();
    for (let j = 0; j < centers.length; j++) {
      tangent.copy(centers[Math.min(centers.length - 1, j + 1)]).sub(centers[Math.max(0, j - 1)]).normalize(); rotation.setFromUnitVectors(up, tangent);
      const radius = j === 0 ? .035 : j === centers.length - 1 ? .027 : .033;
      for (let i = 0; i < segments; i++) { const angle = i * Math.PI * 2 / segments; radial.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius).applyQuaternion(rotation).add(centers[j]); positions.push(...radial.toArray()); }
    }
    for (let j = 0; j < centers.length - 1; j++) for (let i = 0; i < segments; i++) { const n = (i + 1) % segments, a = j * segments + i, b = j * segments + n; indices.push(a, a + segments, b, b, a + segments, b + segments); }
    const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(positions, 3)); g.setIndex(indices); g.computeVertexNormals(); add('compact-forearm', g, bone, coat);
  }
  function surface(profile: readonly Ring[], segments: number) {
    const positions: number[] = [], indices: number[] = [];
    for (const [z, y, rx, ry] of profile) for (let i = 0; i < segments; i++) { const t = i * Math.PI * 2 / segments; positions.push(Math.sin(t) * rx, y + Math.cos(t) * ry, z); }
    for (let j = 0; j < profile.length - 1; j++) for (let i = 0; i < segments; i++) {
      const n = (i + 1) % segments, a = j * segments + i, b = j * segments + n, c = a + segments, d = b + segments;
      if (profile[j][2]) indices.push(a, c, b); if (profile[j + 1][2]) indices.push(b, c, d);
    }
    const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(positions, 3)); g.setIndex(indices); g.computeVertexNormals(); return g;
  }
  const chosen = near ? PROFILE : (far ? [0, 3, 6, 8, 9, 11, 13] : [0, 1, 2, 3, 4, 5, 6, 8, 9, 11, 12, 13]).map(i => PROFILE[i]);
  const pigment = new Color(), body = surface(chosen, near ? 12 : far ? 6 : 8);
  // Project facial attachments onto this level's actual triangles. A low-poly
  // skull does not lie on its ideal ellipsoid, especially near the snout tip.
  const headSurfaceY = (x: number, z: number) => {
    const p = body.attributes.position, indices = body.index!; let height = -Infinity;
    for (let i = 0; i < indices.count; i += 3) {
      const a = indices.getX(i), b = indices.getX(i + 1), c = indices.getX(i + 2), ax = p.getX(a), az = p.getZ(a), bx = p.getX(b), bz = p.getZ(b), cx = p.getX(c), cz = p.getZ(c);
      const denominator = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(denominator) < 1e-10) continue;
      const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / denominator, v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / denominator, w = 1 - u - v;
      if (u >= -1e-7 && v >= -1e-7 && w >= -1e-7) height = Math.max(height, u * p.getY(a) + v * p.getY(b) + w * p.getY(c));
    }
    if (!Number.isFinite(height)) throw new Error('Sea otter face attachment is outside its skull'); return height;
  };
  add('continuous-head-neck-chest-belly-rump', body, 0, coat,
    p => p.z < -.29 ? [1, 3, clamp((-.29 - p.z) / .09)] : p.z < -.10 ? [0, 1, clamp((-.10 - p.z) / .19)] : [0, 2, clamp((p.z - .04) / .24)],
    p => pigment.copy(coat).lerp(head, clamp((-.30 - p.z) / .10)));

  // Modest paired whisker pads and a blunt broad nose, with the face directed
  // upward in the floating frame. No thin whiskers or separate fur cards.
  const muzzleY = headSurfaceY(.032, -.54) + .009;
  for (const s of [-1, 1]) ellipsoid('cream-muzzle-lobe', [s * .032, muzzleY, -.54], [.037, .027, .036], 3, cream, near ? 7 : far ? 4 : 5, near ? 4 : far ? 2 : 3);
  poly('broad-dark-nose', [[-.033, muzzleY + .023, -.545], [.033, muzzleY + .023, -.545], [0, muzzleY + .030, -.575], [0, muzzleY + .008, -.553], [0, muzzleY + .037, -.547]],
    far ? [[0, 4, 2], [4, 1, 2], [0, 2, 3], [1, 3, 2]] : [[0, 4, 2], [4, 1, 2], [0, 2, 3], [1, 3, 2], [0, 3, 4], [1, 4, 3]], 3, black);
  for (const s of [-1, 1]) {
    const eyeX = s * .078, eyeZ = -.49, eyeY = headSurfaceY(eyeX, eyeZ);
    if (near) ellipsoid('small-dark-eye', [eyeX, eyeY + .002, eyeZ], [.012, .010, .013], 3, black, 5, 3);
    else {
      const base = [[eyeX - .012, eyeZ - .009], [eyeX + .012, eyeZ - .009], [eyeX, eyeZ + .013]];
      const points: Point[] = base.map(([x, z]) => [x, headSurfaceY(x, z) - .002, z]); points.push([eyeX, eyeY + .006, eyeZ]);
      poly('small-dark-eye', points, [[1, 0, 3], [2, 1, 3], [0, 2, 3], [0, 1, 2]], 3, black);
    }
    // Tiny rounded ears sit partly inside the head coat instead of standing tall.
    if (far) {
      const faces = [[0, 1, 2], [0, 3, 1], [1, 3, 2], [0, 2, 3]];
      if (s > 0) for (const face of faces) face.reverse(); // Mirroring reverses the oriented volume.
      poly('small-ear-silhouette', [[s * .12, .083, -.44], [s * .158, .105, -.43], [s * .14, .137, -.415], [s * .118, .085, -.39]], faces, 3, head);
    }
    else ellipsoid('small-rounded-ear', [s * .133, .105, -.419], [.029, .032, .030], 3, head, near ? 6 : 4, 3);
    const arm = s < 0 ? 5 : 6, paw = s < 0 ? 7 : 8;
    forearm(s, arm);
    ellipsoid('curled-front-paw', [s * .055, .205, -.225], [.037, .029, .044], paw, coat, near ? 8 : far ? 4 : 6, near ? 4 : far ? 2 : 3);

    // The outer fifth toe is the longest: each rear foot is a wide asymmetric
    // fan, clearly larger than the compact front hand and separate from the tail.
    const outline = far ? [[.085, .36], [.145, .355], [.295, .565], [.12, .515]] : near ? [[.085, .36], [.145, .355], [.245, .437], [.295, .565], [.235, .551], [.17, .529], [.105, .49]] : [[.085, .36], [.145, .355], [.255, .46], [.295, .565], [.19, .54], [.105, .49]];
    const points: Point[] = [], faces: number[][] = [], n = outline.length;
    for (const h of [1, -1]) for (const [x, z] of outline) points.push([s * x, .015 + (z - .355) * .17 + h * .012, z]);
    const top = (a: number, b: number, c: number) => { const aa = points[a], bb = points[b], cc = points[c], y = (bb[2] - aa[2]) * (cc[0] - aa[0]) - (bb[0] - aa[0]) * (cc[2] - aa[2]); faces.push(y > 0 ? [a, b, c] : [a, c, b]); };
    for (let i = 1; i < n - 1; i++) { top(0, i, i + 1); const f = faces[faces.length - 1]; faces.push([f[2] + n, f[1] + n, f[0] + n]); }
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; if (s > 0) faces.push([i, j, i + n], [j, j + n, i + n]); else faces.push([i, i + n, j], [j, i + n, j + n]); }
    poly('large-webbed-hind-foot', points, faces, s < 0 ? 9 : 10, web);
    rod('embedded-hind-ankle', [s * .095, -.015, .29], [s * .118, .017, .375], near ? .047 : .042, .035, s < 0 ? 9 : 10);
  }
  const tailProfile: Ring[] = far ? [[.30, -.035, 0, 0], [.34, -.035, .054, .035], [.49, -.045, .028, .024], [.575, -.05, 0, 0]] : [[.29, -.035, 0, 0], [.34, -.035, .055, .036], [.43, -.04, .043, .030], [.51, -.047, .023, .022], [.575, -.05, 0, 0]];
  add('thick-tapered-tail', surface(tailProfile, near ? 8 : far ? 4 : 6), 4, coat, p => [4, 11, clamp((p.z - .43) / .09)]);
  let offset = 0; const ranges = parts.map((g, i) => { const range = { name: names[i], start: offset, count: g.index!.count }; offset += range.count; return range; });
  const merged = mergeGeometries(parts)!; parts.forEach(p => p.dispose()); const result = mergeVertices(merged, 1e-7); merged.dispose(); result.scale(scale, scale, scale);
  result.name = `southern-sea-otter-${detail}`; result.userData.sourceParts = names; result.userData.partRanges = ranges; result.computeBoundingBox(); result.computeBoundingSphere(); return result;
}
