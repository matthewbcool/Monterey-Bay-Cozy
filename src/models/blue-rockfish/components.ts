import { countershade } from '../shared/fish/paint';
import { Color } from 'three';
import type { MeshToonMaterial } from 'three';
import type { ModelAssembly } from '../shared/assembly';
import { addFishFin } from '../shared/fish/fins';
import { bellyAt, flankAt } from '../shared/fish/geometry';
import type { BodyPaint, Outline } from '../shared/fish/design';
import { BLUE_ROCKFISH as R } from './definition';

const back = new Color('#344f68'), flank = new Color('#597a90'), belly = new Color('#9eafa7'), mottle = new Color('#2b4354');
const shoulder=back.clone().lerp(flank,.55);
export const paintRockfish: BodyPaint = (x, h, side, out) => {
  countershade(out,h,back,shoulder,flank,belly);
  // Broad deterministic clouding, not an external texture or a repeating scale mesh.
  const cloud = Math.sin(x * 35 + h * 7 + Math.sin(h * 13)) * Math.cos(h * 11 + x * 11 + side);
  if (h > -.65) out.lerp(mottle, Math.max(0, cloud) * .22);
};
export function buildRockfishFins(a: ModelAssembly, material: MeshToonMaterial, length: number) {
  const fin = '#476278', lower = (x: number, z = 0) => bellyAt(R.profile, x, z) + .014;
  const upper = (x: number) => bellyAt(R.profile, x, 0, 1) - .012;
  // A connected membrane carries the spiny silhouette; no separate object per spine.
  const spines: [number, number][] = [[-.29, upper(-.29)]];
  for (let i = 0; i < 13; i++) {
    const x = -.28 + i * .028, base = upper(x);
    spines.push([x + .006, base + .083 - i * .0019], [x + .027, base + .026]);
  }
  spines.push([.115, upper(.115)], [.01, upper(.01)], [-.12, upper(-.12)]);
  addFishFin(a, 'spiny-dorsal', spines, material, fin, length, { dorsalBase: .145 });
  addFishFin(a, 'soft-dorsal', [[.095, upper(.095)], [.16, .178], [.22, .180], [.265, .148], [.31, .074], [.285, upper(.285)]], material, fin, length);
  addFishFin(a, 'tail', [[.348, .045], [.482, .104], [.500, .083], [.489, .012], [.500, -.060], [.482, -.082], [.348, -.020]], material, fin, length);
  addFishFin(a, 'anal', [[.095, lower(.095)], [.14, -.197], [.20, -.195], [.285, -.083], [.27, lower(.27)]], material, fin, length);
  for (const side of [-1, 1]) {
    const name = side === 1 ? 'near' : 'far', [x, y] = R.pectoral;
    const z = flankAt(R.profile, x, y, side) - side * .005;
    const fan: Outline = [[x - .006, y + .021], [x + .09, y - .012], [x + .192, y - .067], [x + .190, y - .109], [x + .151, y - .132], [x + .105, y - .126], [x + .045, y - .078], [x, y - .019]];
    addFishFin(a, 'pectoral-' + name, fan, material, '#52758a', length, { z, bone: side === 1 ? 4 : 5, depth: .006 });
    const pz = side * .040, px = -.14;
    addFishFin(a, 'pelvic-' + name, [[px, lower(px, pz)], [-.07, -.215], [.015, -.195], [-.055, lower(-.055, pz)]], material, fin, length, { z: pz });
  }
}
