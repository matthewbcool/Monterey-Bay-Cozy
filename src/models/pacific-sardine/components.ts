import { countershade } from '../shared/fish/paint';
import { CircleGeometry, Color } from 'three';
import type { MeshToonMaterial } from 'three';
import type { ModelAssembly } from '../shared/assembly';
import { addFishFin } from '../shared/fish/fins';
import { bellyAt, flankAt, skinGeometry, solidColor } from '../shared/fish/geometry';
import type { BodyPaint } from '../shared/fish/design';
import { SARDINE } from './definition';

const back = new Color('#285963'), shoulder = new Color('#608e94'), silver = new Color('#a8c5d0'), belly = new Color('#d2e0db');
export const paintSardine: BodyPaint = (_x, height, _side, out) => {
  countershade(out,height,back,shoulder,silver,belly);
};
export function buildSardineFins(a: ModelAssembly, material: MeshToonMaterial, length: number) {
  const fin = '#608b89', lower = (x: number, z = 0) => bellyAt(SARDINE.profile, x, z) + .010;
  addFishFin(a, 'tail', [[.345, .021], [.495, .103], [.472, .047], [.414, .009], [.472, -.033], [.5, -.088], [.345, -.004]], material, '#477c80', length);
  addFishFin(a, 'dorsal', [[-.065, .061], [-.03, .168], [.015, .134], [.10, .064], [.13, .050]], material, fin, length, { dorsalBase: .067 });
  addFishFin(a, 'anal', [[.15, lower(.15)], [.23, -.068], [.31, -.028], [.29, lower(.29)]], material, fin, length);
  for (const side of [-1, 1]) {
    const label = side === 1 ? 'near' : 'far', [x, y] = SARDINE.pectoral;
    const z = flankAt(SARDINE.profile, x, y, side) - side * .003;
    addFishFin(a, 'pectoral-' + label, [[x - .008, y + .012], [x + .155, y - .065], [x + .090, y - .058], [x + .005, y - .006]], material, fin, length, { z, bone: side === 1 ? 4 : 5 });
    const pz = side * .017, px = .012;
    addFishFin(a, 'pelvic-' + label, [[px, lower(px, pz)], [.070, -.109], [.105, -.084], [.065, lower(.065, pz)]], material, fin, length, { z: pz });
  }
}
/** Conforming spots add only 112 triangles and share the body material/draw. */
export function buildSardineSpots(a: ModelAssembly, material: MeshToonMaterial, length: number) {
  const group = a.addPart('flank-spots');
  for (const side of [-1, 1]) for (let i = 0; i < 7; i++) {
    const x = -.235 + i * .064, y = .024 - i * .0011, r = .009 - i * .00035;
    const geometry = new CircleGeometry(r, 8).rotateY(side < 0 ? Math.PI : 0).translate(x, y, 0);
    const p = geometry.attributes.position;
    for (let j = 0; j < p.count; j++) p.setZ(j, flankAt(SARDINE.profile, p.getX(j), p.getY(j), side));
    geometry.computeVertexNormals(); solidColor(geometry, '#294953'); skinGeometry(geometry); geometry.scale(length, length, length);
    a.addMesh(group, geometry, material, `${side === 1 ? 'near' : 'far'}-spot-${i + 1}`);
  }
}
