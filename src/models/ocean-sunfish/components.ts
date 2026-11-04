import { countershade } from '../shared/fish/paint';
import { CatmullRomCurve3, CircleGeometry, Color, MathUtils, Mesh, TorusGeometry, TubeGeometry, Vector3 } from 'three';
import type { BufferGeometry, MeshToonMaterial } from 'three';
import type { ModelAssembly } from '../shared/assembly';
import { addFishFin } from '../shared/fish/fins';
import { buildFishEyes } from '../shared/fish/face';
import { flankAt, skinGeometry, solidColor } from '../shared/fish/geometry';
import type { BodyPaint } from '../shared/fish/design';
import { SUNFISH as S } from './definition';

const back = new Color('#617b7c'), flank = new Color('#91a6a0'), belly = new Color('#c9cfb9'), cloud = new Color('#5c7778');
const shoulder=back.clone().lerp(flank,.55);
export const paintSunfish: BodyPaint = (x, h, side, out) => {
  countershade(out,h,back,shoulder,flank,belly);
  const patch = Math.sin(x * 31 + h * 9 + Math.sin(h * 17)) * Math.cos(h * 15 - x * 8 + side * .6);
  out.lerp(cloud, Math.max(0, patch) * .18);
};

/** Lock the embedded root to the body; transition to the fin bone along its span. */
function attachFin(a: ModelAssembly, name: string, bone: number, length: number, axis: 'x' | 'y', sign = 1) {
  const geometry = (a.parts.get(name)!.children[0] as Mesh).geometry;
  const p = geometry.attributes.position, indices = geometry.attributes.skinIndex, weights = geometry.attributes.skinWeight;
  for (let i = 0; i < p.count; i++) {
    const distance = (axis === 'x' ? p.getX(i) : p.getY(i)) * sign / length;
    const influence = MathUtils.smoothstep(distance, axis === 'x' ? .285 : .29, axis === 'x' ? .385 : .45);
    indices.setXYZW(i, 0, bone, 0, 0); weights.setXYZW(i, 1 - influence, influence, 0, 0);
  }
}

export function buildSunfishFins(a: ModelAssembly, material: MeshToonMaterial, length: number) {
  addFishFin(a, 'dorsal', S.dorsal, material, '#647f7b', length, { bone: 0, depth: .012 });
  addFishFin(a, 'anal', S.anal, material, '#718b83', length, { bone: 0, depth: .012 });
  addFishFin(a, 'clavus', S.clavus, material, '#82978a', length, { bone: 0, depth: .020 });
  attachFin(a, 'dorsal', 1, length, 'y'); attachFin(a, 'anal', 2, length, 'y', -1); attachFin(a, 'clavus', 3, length, 'x');
  for (const side of [-1, 1]) {
    const [x, y] = S.pectoral, z = flankAt(S.profile, x, y, side) - side * .005;
    addFishFin(a, `pectoral-${side === 1 ? 'near' : 'far'}`, [[x - .012, y + .016], [x + .073, y + .01], [x + .142, y - .021], [x + .161, y - .060], [x + .143, y - .089], [x + .092, y - .078], [x + .032, y - .037], [x - .010, y - .012]], material, '#839a8e', length, { z, bone: side === 1 ? 4 : 5, depth: .009 });
  }
}

export function buildSunfishFace(a: ModelAssembly, material: MeshToonMaterial, length: number) {
  buildFishEyes(a, S, material, length, '#c4c9a9');
  const marks = a.addPart('face-marks');
  function add(geometry: BufferGeometry, color: string, name: string) {
    solidColor(geometry, color); skinGeometry(geometry, 0); geometry.scale(length, length, length); a.addMesh(marks, geometry, material, name);
  }
  // A small open beak, instead of the long jaw line used by the other fish.
  add(new TorusGeometry(.030, .007, 4, 12).scale(.78, 1, 1).rotateY(-Math.PI / 2).translate(-.493, -.008, 0), '#bcc4ad', 'beak-rim');
  add(new CircleGeometry(.026, 12).scale(.78, 1, 1).rotateY(-Math.PI / 2).translate(-.495, -.008, 0), '#283f40', 'mouth-opening');
  for (const side of [-1, 1]) {
    const points = [[-.273, .022], [-.263, -.004], [-.265, -.031], [-.28, -.052]].map(([x, y]) => new Vector3(x, y, flankAt(S.profile, x, y, side)));
    add(new TubeGeometry(new CatmullRomCurve3(points), 6, .0028, 3, false), '#3b5454', `gill-${side}`);
  }
}
