import { countershade } from '../shared/fish/paint';
import { Color } from 'three';
import type { MeshToonMaterial } from 'three';
import type { ModelAssembly } from '../shared/assembly';
import type { BodyPaint } from '../shared/fish/design';
import { addFishFin } from '../shared/fish/fins';
import { bellyAt, flankAt } from '../shared/fish/geometry';
import { GARIBALDI as G } from './definition';

const orange = new Color('#cd6a32'), gold = new Color('#e7a052'), back = new Color('#af5129');
const shoulder=back.clone().lerp(orange,.6);
export const paintGaribaldi: BodyPaint = (_x, h, _side, out) => {
  countershade(out,h,back,shoulder,orange,gold);
};
export function buildGaribaldiFins(a: ModelAssembly, material: MeshToonMaterial, length: number) {
  const upper = (x: number) => bellyAt(G.profile, x, 0, 1) - .014;
  const lower = (x: number, z = 0) => bellyAt(G.profile, x, z) + .014;
  const dorsal: [number, number][] = [[-.30, upper(-.30)]];
  for (let i = 0; i < 8; i++) {
    const x = -.29 + i * .047;
    dorsal.push([x, upper(x) + .050], [x + .025, upper(x + .025) + .029]);
  }
  dorsal.push([.13, .233], [.21, .211], [.29, .135], [.31, upper(.31)]);
  for (const x of [.23, .14, .04, -.06, -.16]) dorsal.push([x, upper(x)]);
  addFishFin(a, 'dorsal', dorsal, material, '#ce7638', length, { dorsalBase: .215 });
  // Two rounded lobes and a shallow cleft give the adult its heart-shaped tail.
  addFishFin(a, 'tail', [[.349, .040], [.448, .117], [.482, .130], [.50, .108], [.493, .058], [.466, .008], [.493, -.042], [.50, -.091], [.482, -.111], [.448, -.100], [.349, -.023]], material, '#d47c3c', length);
  addFishFin(a, 'anal', [[.01, lower(.01)], [.11, -.246], [.21, -.211], [.30, lower(.30)], [.19, lower(.19)]], material, '#cb7136', length);
  for (const side of [-1, 1]) {
    const [x, y] = G.pectoral, z = flankAt(G.profile, x, y, side) - side * .006;
    addFishFin(a, `pectoral-${side}`, [[x-.01,y+.021],[x+.075,y+.009],[x+.16,y-.041],[x+.15,y-.099],[x+.085,y-.114],[x,y-.021]], material, '#e3a253', length, { z, bone: side === 1 ? 4 : 5, depth: .006 });
    const pz = side * .035;
    addFishFin(a, `pelvic-${side}`, [[-.16,lower(-.16,pz)],[-.08,-.270],[-.025,-.234],[-.04,lower(-.04,pz)]], material, '#ce793d', length, { z:pz });
  }
}
