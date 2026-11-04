import { Color, ConeGeometry } from 'three';
import type { MeshToonMaterial } from 'three';
import type { ModelAssembly } from '../shared/assembly';
import type { BodyPaint } from '../shared/fish/design';
import { addFishFin } from '../shared/fish/fins';
import { bellyAt, flankAt, skinGeometry, solidColor } from '../shared/fish/geometry';
import { SHEEPHEAD as S } from './definition';

const charcoal = new Color('#303c40'), red = new Color('#b65449'), coral = new Color('#d88369'), chin = new Color('#e7dbc1');
export const paintSheephead: BodyPaint = (x, h, _side, out) => {
  // The broad red midriff and black ends identify the male color phase.
  out.copy(x < -.235 || x > .225 ? charcoal : red);
  if (x >= -.235 && x <= .225) out.lerp(coral, Math.max(0, .2-h) * .5);
  out.multiplyScalar(1-Math.max(0,h)*.12);
  if (x < -.32 && h < -.30) out.lerp(chin, Math.min(1, (-h - .30) * 3.4));
};

export function buildSheepheadFins(a: ModelAssembly, material: MeshToonMaterial, length: number) {
  const upper = (x: number) => bellyAt(S.profile, x, 0, 1) - .012;
  const lower = (x: number, z = 0) => bellyAt(S.profile, x, z) + .012;
  const dorsal: [number, number][] = [[-.285, upper(-.285)]];
  for (let i = 0; i < 10; i++) {
    const x = -.28 + i * .04;
    dorsal.push([x, upper(x) + .057], [x + .022, upper(x + .022) + .030]);
  }
  dorsal.push([.17, .186], [.225, .152], [.30, upper(.30)]);
  for (const x of [.22, .12, .02, -.08, -.18]) dorsal.push([x, upper(x)]);
  addFishFin(a, 'dorsal', dorsal, material, '#8e574f', length, { dorsalBase: .19 });
  addFishFin(a, 'tail', [[.353, .043], [.482, .108], [.50, .081], [.50, -.065], [.477, -.093], [.35, -.021]], material, '#344447', length);
  addFishFin(a, 'anal', [[.01, lower(.01)], [.085, -.207], [.205, -.160], [.285, lower(.285)], [.15, lower(.15)]], material, '#9e6558', length);
  for (const side of [-1, 1]) {
    const [x, y] = S.pectoral, z = flankAt(S.profile, x, y, side) - side * .005;
    addFishFin(a, `pectoral-${side}`, [[x - .01, y + .025], [x + .074, y + .004], [x + .16, y - .058], [x + .17, y - .098], [x + .126, y - .134], [x + .060, y - .104], [x, y - .02]], material, '#ce9b62', length, { z, bone: side === 1 ? 4 : 5, depth: .006 });
    const pz = side * .048;
    addFishFin(a, `pelvic-${side}`, [[-.18, lower(-.18, pz)], [-.105, -.218], [-.015, -.179], [-.08, lower(-.08, pz)]], material, '#ad6c59', length, { z: pz });
  }
}

/** Tiny canines share the head/body batch; no separate jaw rig or draw. */
export function buildSheepheadTeeth(a: ModelAssembly, material: MeshToonMaterial, length: number) {
  const group = a.addPart('canines');
  for (const side of [-1, 1]) for (const [x, y, height] of [[-.480, -.026, .022], [-.457, -.024, .014]]) {
    const z = flankAt(S.profile, x, y, side);
    const tooth = new ConeGeometry(.005, height, 4).translate(x, y, z);
    solidColor(tooth, '#e9dfc6'); skinGeometry(tooth, 0); tooth.scale(length, length, length);
    a.addMesh(group, tooth, material, `canine-${side}-${x}`);
  }
}
