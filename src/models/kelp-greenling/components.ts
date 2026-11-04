import { countershade } from '../shared/fish/paint';
import { CircleGeometry, Color } from 'three';
import type { MeshToonMaterial } from 'three';
import type { ModelAssembly } from '../shared/assembly';
import type { BodyPaint } from '../shared/fish/design';
import { addFishFin } from '../shared/fish/fins';
import { bellyAt, flankAt, sectionAt, skinGeometry, solidColor } from '../shared/fish/geometry';
import { KELP_GREENLING as G } from './definition';

const back = new Color('#776e50'), flank = new Color('#b0af8f'), belly = new Color('#dedbc0'), gold = new Color('#ac8850');
const shoulder=back.clone().lerp(flank,.55);
export const paintGreenling: BodyPaint = (x, h, side, out) => {
  countershade(out,h,back,shoulder,flank,belly);
  out.lerp(gold, Math.max(0, Math.sin(x * 57 + h * 21) * Math.cos(h * 24 + side)) * .20);
};

export function buildGreenlingFins(a: ModelAssembly, material: MeshToonMaterial, length: number) {
  const upper = (x: number) => bellyAt(G.profile, x, 0, 1) - .009;
  const lower = (x: number, z = 0) => bellyAt(G.profile, x, z) + .010;
  // One long membrane with a central notch, not a tuna's isolated triangular fin.
  const dorsal: [number, number][] = [[-.31, upper(-.31)], [-.29, .142], [-.22, .164], [-.13, .161], [-.04, .147], [.025, .107], [.08, .153], [.16, .139], [.245, .109], [.31, upper(.31)]];
  for (const x of [.24, .14, .04, -.06, -.16, -.25]) dorsal.push([x, upper(x)]);
  addFishFin(a, 'dorsal', dorsal, material, '#b4964b', length, { dorsalBase: .105 });
  addFishFin(a, 'tail', [[.35, .028], [.458, .083], [.49, .066], [.50, .009], [.489, -.048], [.457, -.071], [.35, -.017]], material, '#ba9448', length);
  addFishFin(a, 'anal', [[-.055, lower(-.055)], [.02, -.153], [.17, -.132], [.30, lower(.30)], [.20, lower(.20)], [.07, lower(.07)]], material, '#bba25d', length);
  for (const side of [-1, 1]) {
    const [x, y] = G.pectoral, z = flankAt(G.profile, x, y, side) - side * .004;
    addFishFin(a, `pectoral-${side}`, [[x - .008, y + .015], [x + .075, y + .012], [x + .152, y - .018], [x + .171, y - .057], [x + .151, y - .097], [x + .094, y - .115], [x + .045, y - .084], [x, y - .014]], material, '#d1a54e', length, { z, bone: side === 1 ? 4 : 5 });
    const pz = side * .030;
    addFishFin(a, `pelvic-${side}`, [[-.20, lower(-.20, pz)], [-.12, -.151], [-.048, -.136], [-.10, lower(-.10, pz)]], material, '#c5ac6a', length, { z: pz });
    // Two small skin cirri: a visible brow tuft and a tiny rear tuft.
    for (const x of [-.404, -.35]) {
      const y = bellyAt(G.profile, x, .020, 1) - .004;
      addFishFin(a, `cirrus-${side}-${x}`, [[x - .010, y], [x - .004, y + .024], [x + .009, y + .010], [x + .016, y]], material, '#99814c', length, { z: side * .020, bone: 0, depth: .004 });
    }
  }
}

/** Conforming five-sided freckles follow the skinning weights and share its draw. */
export function buildGreenlingFreckles(a: ModelAssembly, material: MeshToonMaterial, length: number) {
  const group = a.addPart('freckles');
  for (const side of [-1, 1]) for (let i = 0; i < 20; i++) {
    const column = i % 10, row = Math.floor(i / 10), x = -.36 + column * .064 + row * .020;
    const section = sectionAt(G.profile, x), y = section.y + section.depth * (row ? -.22 : .42) + Math.sin(i * 2.7) * .009;
    const r = .006 + (i % 3) * .0015;
    const geometry = new CircleGeometry(r, 5).scale(1.2, .85, 1).rotateZ(i * .7).rotateY(side < 0 ? Math.PI : 0).translate(x, y, 0);
    const p = geometry.attributes.position;
    for (let j = 0; j < p.count; j++) p.setZ(j, flankAt(G.profile, p.getX(j), p.getY(j), side));
    geometry.computeVertexNormals(); solidColor(geometry, i % 3 ? '#a87e3f' : '#947045'); skinGeometry(geometry); geometry.scale(length, length, length);
    a.addMesh(group, geometry, material, `freckle-${side}-${i}`);
  }
}
