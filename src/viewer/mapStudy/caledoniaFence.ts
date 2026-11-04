import { BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, Vector3 } from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import data from '../../data/caledonia-park.json';
import { createToonMaterial } from '../../models/shared/style';
import { defineGeometryLods, type LodLevel } from '../../models/shared/lod/geometry';
import type { GymCollider, GymPoint } from '../avatarController';
import { segmentCollider } from '../testingGym/parkFurniture';

export const CALEDONIA_PARK_BOUNDARY = data.features.find(f => f.id === 'way/871779748')!.points.map(p => [p[0], p[1]] as GymPoint);
export const CALEDONIA_FENCE = { heightMeters: 1.8, gateWidthMeters: 2.4, wirePitchMeters: 1.2, splitZ: 220 } as const;
export const CALEDONIA_FENCE_SOURCE = 'https://files.cityofpacificgrove.org/Document_Center/Departments/Public%20Works/Buildings%20%26%20Grounds/Parks%20Maintenance/Parks%20Inventory.pdf';

export function containsCaledoniaPark(x: number, z: number) {
  const p = CALEDONIA_PARK_BOUNDARY; let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++)
    if ((p[i][1] > z) !== (p[j][1] > z) && x < (p[j][0] - p[i][0]) * (z - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) inside = !inside;
  return inside;
}

const edges = CALEDONIA_PARK_BOUNDARY.map((a, i) => {
  const b = CALEDONIA_PARK_BOUNDARY[(i + 1) % CALEDONIA_PARK_BOUNDARY.length];
  return { a, b, length: Math.hypot(b[0] - a[0], b[1] - a[1]), start: 0 };
});
let perimeterMeters = 0;
for (const edge of edges) { edge.start = perimeterMeters; perimeterMeters += edge.length; }
const atDistance = (distance: number): GymPoint => {
  const s = (distance % perimeterMeters + perimeterMeters) % perimeterMeters;
  const edge = edges.find(e => s < e.start + e.length) ?? edges[edges.length - 1], t = (s - edge.start) / edge.length;
  return [edge.a[0] + (edge.b[0] - edge.a[0]) * t, edge.a[1] + (edge.b[1] - edge.a[1]) * t];
};

export interface CaledoniaParkEntrance {
  id: string; center: GymPoint; inside: GymPoint; outside: GymPoint; widthMeters: number; boundaryDistanceMeters: number; sourcePathIds: string[];
}

/** Five cached footways meet actual park vertices. The historical city inventory
 * independently records five pedestrian gates. Widths and current gate leaves
 * are not surveyed; keep the access routes open without claiming exact hardware. */
function mappedEntrances(): CaledoniaParkEntrance[] {
  const result: CaledoniaParkEntrance[] = [];
  for (const path of data.paths.filter(p => ['footway', 'path', 'pedestrian'].includes(p.kind))) for (const point of path.points) {
    let best: { distance: number; along: number } | undefined;
    for (const e of edges) {
      const dx = e.b[0] - e.a[0], dz = e.b[1] - e.a[1], t = Math.max(0, Math.min(1, ((point[0] - e.a[0]) * dx + (point[1] - e.a[1]) * dz) / e.length ** 2));
      const distance = Math.hypot(point[0] - e.a[0] - t * dx, point[1] - e.a[1] - t * dz);
      if (!best || distance < best.distance) best = { distance, along: e.start + t * e.length };
    }
    if (!best || best.distance > .02) continue;
    const center = atDistance(best.along), existing = result.find(e => Math.hypot(e.center[0] - center[0], e.center[1] - center[1]) < .2);
    if (existing) { if (!existing.sourcePathIds.includes(path.id)) existing.sourcePathIds.push(path.id); continue; }
    const before = atDistance(best.along - .6), after = atDistance(best.along + .6), length = Math.hypot(after[0] - before[0], after[1] - before[1]);
    let nx = -(after[1] - before[1]) / length, nz = (after[0] - before[0]) / length;
    if (!containsCaledoniaPark(center[0] + nx * .7, center[1] + nz * .7)) { nx = -nx; nz = -nz; }
    result.push({ id: '', center, inside: [center[0] + nx * 2, center[1] + nz * 2], outside: [center[0] - nx * 2, center[1] - nz * 2],
      widthMeters: CALEDONIA_FENCE.gateWidthMeters, boundaryDistanceMeters: best.along, sourcePathIds: [path.id] });
  }
  return result.sort((a, b) => a.boundaryDistanceMeters - b.boundaryDistanceMeters).map((e, i) => ({ ...e, id: `caledonia-park-gate-${i + 1}` }));
}
export const CALEDONIA_PARK_ENTRANCES = mappedEntrances();
export interface FenceRun { a: GymPoint; b: GymPoint; cell: 'north' | 'south' }

function fenceRuns(): FenceRun[] {
  const result: FenceRun[] = [];
  for (const edge of edges) {
    const cuts = [edge.start, edge.start + edge.length];
    for (const entrance of CALEDONIA_PARK_ENTRANCES) for (const delta of [-entrance.widthMeters / 2, entrance.widthMeters / 2]) {
      const s = entrance.boundaryDistanceMeters + delta;
      if (s > edge.start && s < edge.start + edge.length) cuts.push(s);
    }
    const cross = (CALEDONIA_FENCE.splitZ - edge.a[1]) / (edge.b[1] - edge.a[1]);
    if (cross > 0 && cross < 1) cuts.push(edge.start + cross * edge.length);
    cuts.sort((a, b) => a - b);
    for (let i = 1; i < cuts.length; i++) {
      const mid = (cuts[i - 1] + cuts[i]) / 2;
      if (CALEDONIA_PARK_ENTRANCES.some(e => Math.abs(mid - e.boundaryDistanceMeters) < e.widthMeters / 2)) continue;
      const a = atDistance(cuts[i - 1]), b = atDistance(cuts[i]);
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 1e-5) result.push({ a, b, cell: (a[1] + b[1]) / 2 < CALEDONIA_FENCE.splitZ ? 'north' : 'south' });
    }
  }
  return result;
}

/** The perimeter is its own two spatial batches, so distance can remove the
 * diamond weave instead of retaining it inside a large terrain/material batch.
 * Terrain/collision use canonical Gym metres; only render X receives map scale. */
export function createCaledoniaFence(heightAt: (x: number, z: number) => number, mapXScale = 1) {
  const root = new Group(), runs = fenceRuns(), colliders: GymCollider[] = [];
  const flightObstacles: (Extract<GymCollider, { kind: 'box' }> & { top: number })[] = [];
  root.name = 'Caledonia Park · complete perimeter fence';
  root.userData = { assetId: 'caledonia-park-fence', source: CALEDONIA_FENCE_SOURCE, boundarySource: 'OSM way/871779748', perimeterMeters,
    basis: 'Whole-park enclosure from city inventory and user correction. Five pedestrian gate locations from cached footway/boundary contacts; 2.4 m openings and uniform 1.8 m height are estimates. Two historic utility gates are not located or modeled.' };
  const height = CALEDONIA_FENCE.heightMeters;
  const at = (a: GymPoint, b: GymPoint, t: number, y = 0) => {
    const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t; return new Vector3(x, heightAt(x, z) + y, z);
  };
  for (const run of runs) {
    const n = Math.ceil(Math.hypot(run.b[0] - run.a[0], run.b[1] - run.a[1]) / 3);
    for (let i = 0; i < n; i++) {
      const a = at(run.a, run.b, i / n), b = at(run.a, run.b, (i + 1) / n), middle = at(run.a, run.b, (i + .5) / n);
      const c = segmentCollider([a.x, a.z], [b.x, b.z], .09, Math.max(a.y, b.y, middle.y) + height);
      colliders.push(c); flightObstacles.push({ ...c, top: c.top! });
    }
  }
  for (const cell of ['north', 'south'] as const) {
    const cellRuns = runs.filter(r => r.cell === cell);
    function build(detail: LodLevel) {
      // Deliberately sparse wire and support rhythm: the park silhouette is the
      // asset, not hundreds of tiny hardware pieces. Corners/gate posts remain.
      const vertices: number[] = [], posts = new Set<string>(), postSpacing = detail === 'far' ? 12 : 6;
      const triangle = (a: Vector3, b: Vector3, c: Vector3) => vertices.push(a.x * mapXScale, a.y, a.z, b.x * mapXScale, b.y, b.z, c.x * mapXScale, c.y, c.z);
      const rod = (a: Vector3, b: Vector3, radius: number) => {
        const axis = b.clone().sub(a).normalize(), u = new Vector3(Math.abs(axis.y) > .9 ? 1 : 0, Math.abs(axis.y) > .9 ? 0 : 1, 0).cross(axis).normalize(), v = axis.clone().cross(u);
        const ring = (p: Vector3) => Array.from({ length: 3 }, (_, i) => p.clone().addScaledVector(u, Math.cos(i * Math.PI * 2 / 3) * radius).addScaledVector(v, Math.sin(i * Math.PI * 2 / 3) * radius));
        const aa = ring(a), bb = ring(b);
        for (let i = 0; i < 3; i++) { const j = (i + 1) % 3; triangle(aa[i], bb[i], aa[j]); triangle(aa[j], bb[i], bb[j]); }
      };
      const wire = (a: Vector3, b: Vector3, normal: Vector3) => {
        const offset = b.clone().sub(a).cross(normal).normalize().multiplyScalar(.008), aa = a.clone().add(offset), ab = a.clone().sub(offset), ba = b.clone().add(offset), bb = b.clone().sub(offset);
        triangle(aa, ba, ab); triangle(ab, ba, bb);
      };
      for (const { a, b } of cellRuns) {
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(length / postSpacing);
        for (let i = 0; i <= n; i++) {
          const p = at(a, b, i / n), key = `${p.x.toFixed(5)},${p.z.toFixed(5)}`;
          if (!posts.has(key)) { posts.add(key); rod(p, p.clone().add(new Vector3(0, height, 0)), .035); }
          if (i === n) continue;
          for (const y of detail === 'far' ? [height] : [.14, height]) rod(at(a, b, i / n, y), at(a, b, (i + 1) / n, y), .024);
        }
        if (detail !== 'near') continue;
        const h = height - .22, normal = new Vector3(-(b[1] - a[1]) / length, 0, (b[0] - a[0]) / length);
        for (const sign of [-1, 1]) for (let t = -h; t < length; t += CALEDONIA_FENCE.wirePitchMeters) {
          const low = Math.max(0, t), high = Math.min(length, t + h); if (high - low < 1e-6) continue;
          const y = (d: number) => sign > 0 ? .11 + d - t : height - .11 - d + t;
          wire(at(a, b, low / length, y(low)), at(a, b, high / length, y(high)), normal);
        }
      }
      const raw = new BufferGeometry(); raw.setAttribute('position', new Float32BufferAttribute(vertices, 3)); raw.computeVertexNormals();
      const geometry = mergeVertices(raw, 1e-6); raw.dispose(); geometry.name = `caledonia-fence-${cell}-${detail}`;
      geometry.computeBoundingBox(); geometry.computeBoundingSphere(); return geometry;
    }
    const geometry = build('near'); defineGeometryLods(geometry, () => ({ mid: build('mid'), far: build('far') }));
    const mesh = new Mesh(geometry, createToonMaterial({ color: '#758b8b', rim: false, side: DoubleSide, name: `caledonia-fence-${cell}-matte` }));
    mesh.name = `Caledonia park fence · ${cell}`; mesh.castShadow = mesh.receiveShadow = true; mesh.userData.caledoniaFence = true; root.add(mesh);
  }
  return { root, runs, colliders, flightObstacles, entrances: CALEDONIA_PARK_ENTRANCES, boundary: CALEDONIA_PARK_BOUNDARY, contains: containsCaledoniaPark };
}
