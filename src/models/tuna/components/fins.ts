import { ExtrudeGeometry, Shape } from 'three';
import type { ModelAssembly } from '../../shared/assembly';
import { TUNA_GEOMETRY } from '../definition';
import { paintFin, type TunaMaterials } from '../materials';
import { bodySurfaceY } from '../profile';

function extrudeFin(shape: Shape, depth = .045, small = false) {
  return new ExtrudeGeometry(shape, {
    depth, bevelEnabled: false, curveSegments: small ? 3 : 6,
  }).translate(0, 0, -depth / 2);
}

function tailShape() {
  const shape = new Shape();
  shape.moveTo(-.08, -.10);
  shape.bezierCurveTo(.22, -.18, .32, -1.10, .91, -1.37);
  shape.bezierCurveTo(.69, -.91, .58, -.39, .36, 0);
  shape.bezierCurveTo(.59, .45, .77, 1.03, .93, 1.37);
  shape.bezierCurveTo(.36, 1.27, .28, .30, -.08, .10);
  shape.closePath();
  return shape;
}

function sweptFin(length: number, height: number) {
  const shape = new Shape();
  shape.moveTo(-.07, -.045);
  shape.bezierCurveTo(.15 * length, .28 * height, .33 * length, .96 * height, length, height);
  shape.bezierCurveTo(.63 * length, .88 * height, .37 * length, .42 * height, .52 * length, -.025);
  shape.closePath();
  return shape;
}

function sickleFin(sign: number) {
  const shape = new Shape();
  shape.moveTo(-.07, -.04 * sign);
  shape.bezierCurveTo(.17, .24 * sign, .50, .39 * sign, .95, .34 * sign);
  shape.bezierCurveTo(.63, .31 * sign, .54, .08 * sign, .30, -.18 * sign);
  shape.closePath();
  return shape;
}

/** All fin shapes and their roots; lower roots follow the actual elliptical belly. */
export function buildTunaFins(assembly: ModelAssembly, materials: TunaMaterials) {
  const { addPart, addMesh } = assembly;
  const lower = TUNA_GEOMETRY.lowerFins;
  const tail = addPart('tail', [2.63, .36, 0]);
  addMesh(tail, paintFin(extrudeFin(tailShape(), .065)), materials.fin);
  tail.scale.y = .93;

  const dorsal = addPart('dorsal-primary', [-.68, .99, 0]);
  addMesh(dorsal, paintFin(extrudeFin(sweptFin(1.06, .43))), materials.fin);
  const secondary = addPart('dorsal-secondary', [.65, bodySurfaceY(.65, 0, 1) - .02, 0]);
  addMesh(secondary, paintFin(extrudeFin(sickleFin(1))), materials.fin);

  const anal = addPart('anal', [lower.anal.x, bodySurfaceY(lower.anal.x, 0, -1) + lower.anal.inset, 0]);
  addMesh(anal, paintFin(extrudeFin(sickleFin(-1))), materials.fin);
  anal.scale.set(...lower.anal.scale);

  for (const side of [-1, 1]) {
    const name = side === 1 ? 'near' : 'far';
    const pectoral = addPart(`pectoral-${name}`, [-1.46, -.12, side * .555]);
    const shape = new Shape();
    shape.moveTo(-.03, .10);
    shape.bezierCurveTo(.43, -.20, .82, -.28, 1.43, -.12);
    shape.bezierCurveTo(.78, -.12, .37, .025, 0, .12);
    shape.closePath();
    addMesh(pectoral, paintFin(extrudeFin(shape, .042)), materials.fin);
    pectoral.rotation.y = -side * .20;

    const { x, sideOffset, inset, length, height } = lower.pelvic;
    const z = side * sideOffset;
    const pelvic = addPart(`pelvic-${name}`, [x, bodySurfaceY(x, z, -1) + inset, z]);
    addMesh(pelvic, paintFin(extrudeFin(sweptFin(length, height), .03)), materials.fin);
  }

  for (const side of [1, -1] as const) {
    const finlets = addPart(side === 1 ? 'finlets-top' : 'finlets-bottom');
    for (let i = 0; i < 8; i++) {
      const x = 1.15 + i * .19, size = .10 - i * .0055;
      const fin = addMesh(finlets, extrudeFin(sweptFin(size * .96, side * size), .022, true), materials.gold, `finlet-${i + 1}`);
      const inset = side === -1 ? lower.finlets.inset : .025;
      fin.position.set(x, bodySurfaceY(x, 0, side) - side * inset, 0);
    }
  }
}
