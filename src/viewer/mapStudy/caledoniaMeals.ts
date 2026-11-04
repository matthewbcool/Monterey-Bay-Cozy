/** Photo-informed exterior, 700 Jewell Avenue. OSM owns plan placement; heights,
 * hidden elevations and the porch interpretation are authored, not surveyed. */
import { Box3, BufferGeometry, Color, Float32BufferAttribute, Group, Mesh, ShapeUtils, Vector2, Vector3 } from 'three';
import site from '../../data/caledonia-meals-site.json';
import { createToonMaterial } from '../../models/shared/style';
import { defineGeometryLods, type LodLevel } from '../../models/shared/lod/geometry';
import { disposeObject } from '../../models/props/primitives';
import type { GymCollider, GymPoint } from '../avatarController';

export const MEALS_BUILDING_ID = 'way/559348745';
export const MEALS_BUDGET = { near: 1600, mid: 450, far: 180, draws: 1, imageTextures: 0 } as const;
const footprint = site.buildings.find(b => b.id === MEALS_BUILDING_ID)!.rings[0].map(p => [p[0], p[1]] as GymPoint);
// The 2.5 m deep, 8 m wide southeastern projection matches the photographed
// three-bay canopy. The mapped footway and Jewell Avenue lie in front of it.
const a = footprint[11], b = footprint[14], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
const right = [(a[0] - b[0]) / length, (a[1] - b[1]) / length] as const;
const front = [-right[1], right[0]] as const;
const center = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as const;
const local = footprint.map(p => [(p[0] - center[0]) * right[0] + (p[1] - center[1]) * right[1], (p[0] - center[0]) * front[0] + (p[1] - center[1]) * front[1]] as const);
const world = (x: number, z: number): GymPoint => [center[0] + right[0] * x + front[0] * z, center[1] + right[1] * x + front[1] * z];
const colors = Object.fromEntries(Object.entries({ siding: '#8f9a8e', post: '#a3ad9e', recess: '#687a70', shadowSiding: '#77867d', reveal: '#7d897f', roof: '#454d4e', fascia: '#56625e', soffit: '#cccbb5', glass: '#52696b', frame: '#e0ddd0', red: '#9e604a', concrete: '#b5b1a2' }).map(([k, v]) => [k, new Color(v)]));
type Point = readonly [number, number, number];

export function createCaledoniaMeals({ floorAt, xScale = 1 }: { floorAt: (x: number, z: number) => number; xScale?: number }) {
  // The street-side door fixes the level roof/floor datum. The uphill rear DEM
  // must not lift the entry off its forecourt; foundation and posts reach terrain.
  const baseY = floorAt(...world(.64, 0)), bottom = Math.min(...footprint.map(p => floorAt(...p))) - baseY - .25;
  const groundAt = (x: number, z: number) => floorAt(...world(x, z)) - baseY;
  const postFoot = (x: number, z: number, width: number) => Math.min(...[-1, 1].flatMap(dx => [-1, 1].map(dz => groundAt(x + dx * width / 2, z + dz * width / 2)))) - .035;
  const root = new Group(); root.name = 'Meals on Wheels Community Center · 700 Jewell Avenue';
  root.position.set(center[0] * xScale, baseY, center[1]);
  const height = 6.35;

  function build(level: LodLevel) {
    const positions: number[] = [], vertexColors: number[] = [];
    const triangle = (a: Point, b: Point, c: Point, color: Color) => {
      for (const [x, y, z] of [a, b, c]) {
        positions.push((right[0] * x + front[0] * z) * xScale, y, right[1] * x + front[1] * z);
        vertexColors.push(color.r, color.g, color.b);
      }
    };
    const quad = (a: Point, b: Point, c: Point, d: Point, color: Color) => { triangle(a, b, c, color); triangle(a, c, d, color); };
    const box = (x: number, y: number, z: number, w: number, h: number, d: number, color: Color, rise = 0) => {
      const l = x - w / 2, r = x + w / 2, lo = y - h / 2, hi = y + h / 2, back = z - d / 2, face = z + d / 2;
      const faceQuad = (a: Point, b: Point, c: Point, d: Point) => { const p = [a, b, c, d].map(([px, py, pz]) => [px, py + (px - x) * rise / w, pz] as const); quad(p[0], p[1], p[2], p[3], color); };
      faceQuad([l, lo, face], [r, lo, face], [r, hi, face], [l, hi, face]);
      faceQuad([r, lo, back], [l, lo, back], [l, hi, back], [r, hi, back]);
      faceQuad([l, lo, back], [l, lo, face], [l, hi, face], [l, hi, back]);
      faceQuad([r, lo, face], [r, lo, back], [r, hi, back], [r, hi, face]);
      faceQuad([l, hi, face], [r, hi, face], [r, hi, back], [l, hi, back]);
      faceQuad([l, lo, back], [r, lo, back], [r, lo, face], [l, lo, face]);
    };
    const panel = (x: number, y: number, z: number, w: number, h: number, color: Color) => quad([x - w / 2, y - h / 2, z], [x + w / 2, y - h / 2, z], [x + w / 2, y + h / 2, z], [x - w / 2, y + h / 2, z], color);
    // Preserve the mapped shell at every distance. Canopy points 12/13 have a
    // roof and four posts, rather than filling the open porch with a solid wall.
    const shell = local.filter((_, i) => i !== 12 && i !== 13);
    const ring = shell.map(p => new Vector2(p[0], p[1]));
    const ccw = !ShapeUtils.isClockWise(ring);
    for (let i = 0; i < shell.length; i++) {
      const a = shell[i], b = shell[(i + 1) % shell.length];
      const points: Point[] = [[a[0], bottom, a[1]], [b[0], bottom, b[1]], [b[0], 3.18, b[1]], [a[0], 3.18, a[1]]];
      if (ccw) points.reverse();
      quad(points[0], points[1], points[2], points[3], a === local[11] && b === local[14] ? colors.recess : colors.siding);
    }
    // A single opaque roof cap closes the unobserved rear; its topology is
    // deliberately restrained instead of inventing dormers or hidden windows.
    for (const f of ShapeUtils.triangulateShape(ring, [])) {
      const p = f.map(i => shell[i]);
      const area = (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[1][1] - p[0][1]) * (p[2][0] - p[0][0]);
      if (area > 0) p.reverse();
      triangle([p[0][0], 3.18, p[0][1]], [p[1][0], 3.18, p[1][1]], [p[2][0], 3.18, p[2][1]], colors.roof);
    }
    // Main front gable, low wings and the central siding-clad vertical tower.
    // Depth and pitch are explicit estimates; the observed front silhouette is
    // retained even at Far. The gable ends are opaque, with painted glazing.
    const half = 5.15, eave = 3.38, peak = 5.05, rear = -11.5, face = .12;
    quad([-half, eave, face], [0, peak, face], [0, peak, rear], [-half, eave, rear], colors.roof);
    quad([0, peak, face], [half, eave, face], [half, eave, rear], [0, peak, rear], colors.roof);
    triangle([-half, eave, face], [half, eave, face], [0, peak, face], colors.shadowSiding);
    triangle([half, eave, rear], [-half, eave, rear], [0, peak, rear], colors.siding);
    quad([-half, 3.18, face], [half, 3.18, face], [half, eave, face], [-half, eave, face], colors.shadowSiding);
    quad([half, 3.18, rear], [-half, 3.18, rear], [-half, eave, rear], [half, eave, rear], colors.siding);
    quad([-half, 3.18, rear], [-half, 3.18, face], [-half, eave, face], [-half, eave, rear], colors.fascia);
    quad([half, 3.18, face], [half, 3.18, rear], [half, eave, rear], [half, eave, face], colors.fascia);
    box(0, (height + 3.18) / 2, .2, 1.45, height - 3.18, 1.1, colors.siding);
    box(0, 3.4, 1.26, 8.75, .42, 3.05, colors.fascia);
    for (const x of [-3.93, -1.31, 1.31, 3.93]) { const foot = postFoot(x, 2.53, .43); box(x, (3.2 + foot) / 2, 2.53, .43, 3.2 - foot, .43, colors.post); }

    if (level !== 'far') {
      panel(0, 3.4, 2.794, 7.7, .28, colors.roof); // Untextured signboard; text is not fabricated micro-geometry.
      // Matte clerestory triangles: rust borders are supported by the photo.
      for (const s of [-1, 1]) {
        const q: Point[] = [[s * .8, 3.7, .132], [s * 4.38, 3.7, .132], [s * .8, 4.74, .132]];
        if (s < 0) q.reverse(); triangle(q[0], q[1], q[2], colors.red);
        const g: Point[] = [[s * .92, 3.77, .145], [s * 3.91, 3.77, .145], [s * .92, 4.59, .145]];
        if (s < 0) g.reverse(); triangle(g[0], g[1], g[2], colors.glass);
      }
      const window = (x: number, z: number, w: number, h: number, y: number, columns: number, rows: number) => {
        panel(x, y, z + .018, w + .16, h + .16, colors.red);
        panel(x, y, z + .028, w, h, colors.glass);
        const t = level === 'near' ? .075 : .1;
        for (const s of [-1, 1]) { panel(x + s * (w / 2 - t / 2), y, z + .035, t, h, colors.frame); panel(x, y + s * (h / 2 - t / 2), z + .035, w, t, colors.frame); }
        if (level === 'near') {
          for (let i = 1; i < columns; i++) panel(x - w / 2 + w * i / columns, y, z + .04, t, h, colors.frame);
          for (let i = 1; i < rows; i++) panel(x, y - h / 2 + h * i / rows, z + .04, w, t, colors.frame);
        }
      };
      window(-2.64, .01, 1.65, 2.35, 1.47, 2, 3);
      window(.64, .01, 1.34, 2.48, 1.38, 2, 1);
      // The prominent right wing opening uses the true adjacent wall's plane.
      const wing = local[10], joint = local[11], wx = (wing[0] + joint[0]) / 2, wz = (wing[1] + joint[1]) / 2;
      window(wx, wz, 2.8, 1.45, 1.83, 3, 2);
      box(wx, 3.18, wz + .02, Math.abs(wing[0] - joint[0]) + .2, .35, .22, colors.fascia);
      box(0, 3.17, 1.28, 8.3, .06, 2.75, colors.soffit);
    }
    if (level === 'near') {
      // Selective siding reveals explain the material at walking distance;
      // the rear shell is intentionally plain, and no image maps are required.
      for (let y = .35; y < 3.1; y += .3) {
        for (const x of [-3.93, -1.31, 1.31, 3.93]) panel(x, y, 2.747, .43, .018, colors.reveal);
        for (const [x, w] of [[-3.8, .4], [-1.35, .45], [2.5, 1.9]]) panel(x, y, .048, w, .018, colors.reveal);
      }
      for (let y = 3.45; y < height; y += .3) panel(0, y, .752, 1.45, .018, colors.reveal);
      // The white plate emblem is a sparse faceted ring, not signage text.
      for (let i = 0; i < 12; i++) {
        const t = i * Math.PI / 6, n = (i + 1) * Math.PI / 6;
        quad([Math.cos(t) * .42, 5.35 + Math.sin(t) * .42, .764], [Math.cos(n) * .42, 5.35 + Math.sin(n) * .42, .764], [Math.cos(n) * .36, 5.35 + Math.sin(n) * .36, .764], [Math.cos(t) * .36, 5.35 + Math.sin(t) * .36, .764], colors.frame);
      }
      // Short red ramp rails leave a clear central entrance. Their plan is an
      // estimate; independent collision below remains identical at every LOD.
      for (const [left, right] of [[-5.5, -1.5], [1.5, 5.5]]) {
        const a = groundAt(left, 4.15), b = groundAt(right, 4.15);
        for (const x of [left, (left + right) / 2, right]) { const foot = postFoot(x, 4.15, .045), top = a + (b - a) * (x - left) / (right - left) + 1; box(x, (foot + top) / 2, 4.15, .045, top - foot, .045, colors.red); }
        for (const y of [.42, .94]) box((left + right) / 2, (a + b) / 2 + y, 4.15, right - left, .045, .045, colors.red, b - a);
      }
    }
    const geometry = new BufferGeometry(); geometry.name = `caledonia-meals-${level}`;
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3)); geometry.setAttribute('color', new Float32BufferAttribute(vertexColors, 3)); geometry.computeVertexNormals();
    geometry.computeBoundingBox(); geometry.computeBoundingSphere(); return geometry;
  }
  const geometry = build('near'); defineGeometryLods(geometry, () => ({ mid: build('mid'), far: build('far') }));
  const mesh = new Mesh(geometry, createToonMaterial({ vertexColors: true, rim: false, name: 'caledonia-meals-matte' }));
  mesh.name = 'Community center · exterior and entry'; mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
  const boundsOf = (points: readonly GymPoint[]) => ({ minX: Math.min(...points.map(p => p[0])), maxX: Math.max(...points.map(p => p[0])), minZ: Math.min(...points.map(p => p[1])), maxZ: Math.max(...points.map(p => p[1])), footprint: points });
  const buildingBounds = boundsOf(footprint);
  const colliders: GymCollider[] = [{ kind: 'box', ...buildingBounds }];
  for (const [l, r] of [[-5.5, -1.5], [1.5, 5.5]]) colliders.push({ kind: 'box', ...boundsOf([world(l, 4.1), world(r, 4.1), world(r, 4.2), world(l, 4.2)]) });
  root.userData = { assetId: 'caledonia-meals-community-center', units: 'metres', sourceId: MEALS_BUILDING_ID, budget: MEALS_BUDGET, authoring: 'procedural TypeScript', sourcePhoto: 'https://mowcommunitycenter.org/wp-content/uploads/2025/06/PXL_20221202_144239534edit.webp', limits: 'Exact cached OSM plan; southeast entrance inferred from mapped projection and footway. Photo-informed facade; height, pitch, rear roof and ramp dimensions are estimates. Exterior only.' };
  root.updateMatrixWorld(true); const bounds = new Box3().setFromObject(root);
  let disposed = false;
  return { root, sourceId: MEALS_BUILDING_ID, footprint, colliders, flightObstacles: [{ ...buildingBounds, top: baseY + height }], baseY, height, bounds, front, center, entry: new Vector3(...(() => { const p = world(0, 5.6); return [p[0], floorAt(...p), p[1]] as const; })()), dispose() { if (disposed) return; disposed = true; disposeObject(root); } };
}
