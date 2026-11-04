import { BufferGeometry, Float32BufferAttribute, Group, MeshStandardMaterial, ShapeUtils, SphereGeometry, Vector2 } from 'three';
import { box, mat, mesh } from '../primitives';
import { finishStaticAsset } from '../../shared/staticAsset';

type Point = readonly [number, number];

/** Front silhouette of one raised granite wing, in metres relative to its root.
 * The reverse and wing opening are inferred from the user's single photograph. */
const WING: readonly Point[] = [
  [.015, 0], [.02, .15], [.065, .265], [.12, .35], [.205, .45], [.295, .55], [.385, .655],
  [.42, .69], [.442, .682], [.45, .65], [.444, .61], [.425, .555], [.39, .49], [.43, .40], [.42, .35],
  [.37, .29], [.41, .24], [.38, .19], [.31, .13], [.27, .07], [.19, .03],
  [.13, -.03], [.06, -.04],
];

// Carved openings, with deliberately broad stone ribs between their tapered lobes.
// These are holes in the front shell with walls and pale recessed floors, not decals.
const PANELS: readonly (readonly Point[])[] = [
  [[.055, .16], [.14, .32], [.29, .51], [.414, .655], [.37, .47], [.24, .28], [.10, .14]],
  [[.15, .105], [.23, .24], [.38, .44], [.405, .40], [.35, .285], [.24, .16]],
  [[.17, .04], [.225, .105], [.35, .225], [.37, .23], [.315, .155], [.235, .08]],
  [[.075, -.015], [.10, .016], [.155, .035], [.175, .032], [.15, .01], [.10, -.017]],
];

/** Closed shell and recessed floors. The back sweep gives each folded wing depth. */
function wingGeometry(side: number) {
  const points = WING.map(([x, y]) => new Vector2(x, y));
  // One corner-cut pass softens each carved leaf without high radial tessellation.
  const holes = PANELS.map(panel => panel.flatMap(([x, y], index) => {
    const [nextX, nextY] = panel[(index + 1) % panel.length];
    return [new Vector2(x * .84 + nextX * .16, y * .84 + nextY * .16), new Vector2(x * .16 + nextX * .84, y * .16 + nextY * .84)];
  }));
  const vertices: number[] = [], indices: number[] = [], floors: number[] = [], floorIndices: number[] = [];
  const depth = (x: number, front: boolean) => .065 - x * .40 + (front ? .045 : -.045);
  const addPoint = (target: number[], x: number, y: number, z: number) => target.push(side * x * .92, 1.06 + y, z);
  for (const point of [...points, ...holes.flat()]) addPoint(vertices, point.x, point.y, depth(point.x, true));
  const back = vertices.length / 3;
  for (const [x, y] of WING) addPoint(vertices, x, y, depth(x, false));
  const n = WING.length;
  for (const triangle of ShapeUtils.triangulateShape(points, holes)) indices.push(...triangle);
  for (const [a, b, c] of ShapeUtils.triangulateShape(points, [])) indices.push(c + back, b + back, a + back);
  for (let a = 0; a < n; a++) {
    const b = (a + 1) % n;
    indices.push(a, b, a + back, b, b + back, a + back);
  }
  let opening = n;
  for (const panel of holes) {
    const center = panel.reduce((sum, point) => sum.add(point), new Vector2()).multiplyScalar(1 / panel.length);
    const inner = panel.map(point => point.clone().sub(center).multiplyScalar(.78).add(center));
    const wall = vertices.length / 3, floor = floors.length / 3;
    for (const point of inner) {
      const z = depth(point.x, true) - .024;
      addPoint(vertices, point.x, point.y, z); addPoint(floors, point.x, point.y, z);
    }
    // Hole walls face toward the opening, the opposite of the external edge wall.
    for (let a = 0; a < panel.length; a++) {
      const b = (a + 1) % panel.length;
      indices.push(opening + a, wall + a, opening + b, opening + b, wall + a, wall + b);
    }
    for (const [a, b, c] of ShapeUtils.triangulateShape(inner, [])) floorIndices.push(a + floor, b + floor, c + floor);
    opening += panel.length;
  }
  function geometry(position: number[], faces: number[]) {
    if (side < 0) for (let i = 0; i < faces.length; i += 3) [faces[i + 1], faces[i + 2]] = [faces[i + 2], faces[i + 1]];
    const result = new BufferGeometry();
    result.setAttribute('position', new Float32BufferAttribute(position, 3));
    result.setIndex(faces); result.computeVertexNormals(); return result;
  }
  return { shell: geometry(vertices, indices), recesses: geometry(floors, floorIndices) };
}

function addSupport(root: Group, granite: MeshStandardMaterial, carved: MeshStandardMaterial) {
  box(root, 'Ground slab', [.63, .055, .55], granite, [0, .0275, 0]);
  box(root, 'Granite pedestal', [.49, .99, .43], granite, [0, .54, 0]);
  const neck = new BufferGeometry();
  neck.setAttribute('position', new Float32BufferAttribute([
    -.16, 1.025, -.12, .16, 1.025, -.12, .16, 1.025, .12, -.16, 1.025, .12,
    -.085, 1.235, -.065, .085, 1.235, -.065, .085, 1.235, .095, -.085, 1.235, .095,
  ], 3));
  neck.setIndex([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 5, 1, 0, 4, 5, 1, 6, 2, 1, 5, 6, 2, 7, 3, 2, 6, 7, 3, 4, 0, 3, 7, 4]);
  neck.computeVertexNormals(); mesh(root, 'Flared stone neck', neck, carved);
}

/** Gordon Newell's Monarch Butterfly, interpreted as a small static game prop.
 * Total height 1.75 m is provisional, not a measured survey of the original. */
export function createButterflyStatue(): Group {
  const root = new Group(); root.name = 'Monarch Butterfly statue';
  const granite = mat('#78817f'), wing = mat('#343e40'), carved = mat('#8c9690');
  addSupport(root, granite, carved);
  for (const side of [-1, 1]) {
    const name = side < 0 ? 'Left' : 'Right', geometry = wingGeometry(side);
    mesh(root, `${name} carved wing`, geometry.shell, wing);
    mesh(root, `${name} pale recessed panels`, geometry.recesses, carved);
  }
  const body = mesh(root, 'Butterfly center body', new SphereGeometry(1, 6, 4), wing, 0, 1.22, .075);
  body.scale.set(.055, .135, .07);
  return finishStaticAsset(root, 'butterfly-statue', [1, 1, 1], { rim: false });
}
