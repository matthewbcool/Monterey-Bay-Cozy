import { countershade } from '../shared/fish/paint';
import { CircleGeometry, Color } from 'three';
import type { MeshToonMaterial } from 'three';
import type { ModelAssembly } from '../shared/assembly';
import type { BodyPaint } from '../shared/fish/design';
import { addFishFin } from '../shared/fish/fins';
import { bellyAt, flankAt, sectionAt, skinGeometry, solidColor } from '../shared/fish/geometry';
import { CHINOOK_SALMON as C } from './definition';

// Ocean phase: dark blue-green back, bright silver flanks, white belly. No spawning reds.
const back = new Color('#2b4c4b'), olive = new Color('#4a5a3c'), silver = new Color('#c2ccd0'), belly = new Color('#eef1ec');
const shoulder=back.clone().lerp(silver,.42);
export const paintChinook: BodyPaint = (x, h, _side, out) => {
  countershade(out,h,back,shoulder,silver,belly);
  if (h > .6) out.lerp(olive, (h - .6) * .35 * (.5 + .5 * Math.cos(x * 9)));
};

/** Caudal outline: broad, slightly forked, with the root overlapping the peduncle. */
const TAIL: [number, number][] = [[.352, .024], [.40, .055], [.448, .094], [.488, .121], [.50, .114], [.474, .062], [.457, .004], [.474, -.056], [.50, -.110], [.487, -.118], [.446, -.090], [.40, -.052], [.352, -.022]];
const TAIL_DEPTH = .004;

export function buildChinookFins(a: ModelAssembly, material: MeshToonMaterial, length: number) {
  const upper = (x: number) => bellyAt(C.profile, x, 0, 1) - .008;
  const lower = (x: number, z = 0) => bellyAt(C.profile, x, z) + .008;
  // A single mid-body dorsal with a tall leading edge and a slightly falcate trailing edge.
  const dorsal: [number, number][] = [[-.15, upper(-.15)], [-.115, .166], [-.095, .178], [-.075, .171], [-.045, .136], [-.02, .113], [0, upper(0)]];
  for (const x of [-.05, -.10]) dorsal.push([x, upper(x)]);
  addFishFin(a, 'dorsal', dorsal, material, '#36524f', length, { dorsalBase: .105 });
  // Small fleshy adipose fin between dorsal and tail; body-weighted so it follows the bend.
  addFishFin(a, 'adipose', [[.205, upper(.205)], [.222, .082], [.245, .090], [.262, .080], [.270, upper(.27)], [.24, upper(.24)]], material, '#2f4a48', length, { depth: .005 });
  addFishFin(a, 'tail', TAIL, material, '#3b5652', length, { depth: TAIL_DEPTH });
  addFishFin(a, 'anal', [[.12, lower(.12)], [.15, -.118], [.175, -.120], [.215, -.090], [.25, lower(.25)], [.20, lower(.20)], [.16, lower(.16)]], material, '#c3cbcb', length);
  for (const side of [-1, 1]) {
    const [x, y] = C.pectoral, z = flankAt(C.profile, x, y, side) - side * .004;
    addFishFin(a, `pectoral-${side}`, [[x - .006, y + .012], [x + .05, y + .004], [x + .105, y - .022], [x + .112, y - .036], [x + .07, y - .036], [x + .02, y - .025], [x, y - .012]], material, '#9aa8a8', length, { z, bone: side === 1 ? 4 : 5 });
    const pz = side * .025;
    addFishFin(a, `pelvic-${side}`, [[-.075, lower(-.075, pz)], [-.02, -.128], [.012, -.124], [-.01, lower(-.01, pz)]], material, '#c8cfce', length, { z: pz });
  }
}

/** Deterministic jitter so spots look scattered but every build is identical. */
const jitter = (i: number) => Math.sin(i * 12.9898) * 43758.5453 % 1;

/** Small black spots on the back/upper flanks and on both caudal lobes, merged into the body batch. */
export function buildChinookSpots(a: ModelAssembly, material: MeshToonMaterial, length: number) {
  const group = a.addPart('spots');
  function add(geometry: ReturnType<typeof solidColor>, label: string, color: string) {
    solidColor(geometry, color); skinGeometry(geometry); geometry.scale(length, length, length);
    a.addMesh(group, geometry, material, label);
  }
  for (const side of [-1, 1]) for (let i = 0; i < 18; i++) {
    const column = i % 9, row = Math.floor(i / 9);
    const x = -.37 + column * .084 + row * .036 + jitter(i + 3) * .012, section = sectionAt(C.profile, x);
    const y = section.y + section.depth * (row ? .50 : .78) + jitter(i + 11) * .010;
    const r = .0055 + Math.abs(jitter(i + 23)) * .0025;
    const geometry = new CircleGeometry(r, 5).scale(1.15, .9, 1).rotateZ(i * 1.3).rotateY(side < 0 ? Math.PI : 0).translate(x, y, 0);
    const p = geometry.attributes.position;
    for (let j = 0; j < p.count; j++) p.setZ(j, flankAt(C.profile, p.getX(j), p.getY(j), side));
    geometry.computeVertexNormals();
    add(geometry, `back-spot-${side}-${i}`, '#121c1c');
  }
  // Spots cover both upper and lower caudal lobes, on both faces of the fin.
  const lobe: [number, number][] = [[.392, .030], [.416, .050], [.440, .070], [.462, .084], [.432, .030], [.455, .052]];
  for (const side of [-1, 1]) for (const sign of [1, -1]) lobe.forEach(([x, y], i) => {
    const geometry = new CircleGeometry(.0048 + (i % 2) * .001, 5).rotateZ(i).rotateY(side < 0 ? Math.PI : 0)
      .translate(x, sign * y - (sign < 0 ? .004 : 0), side * (TAIL_DEPTH / 2 + .0007));
    add(geometry, `tail-spot-${side}-${sign}-${i}`, '#151f1f');
  });
}
