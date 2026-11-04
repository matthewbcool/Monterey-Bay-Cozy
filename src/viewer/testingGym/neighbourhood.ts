import { BufferGeometry, Float32BufferAttribute, Group, ShapeUtils, Vector2 } from 'three';
import data from '../../data/lovers-point-neighbourhood.json';
import { mat, mesh } from '../../models/props/primitives';
import { finishStaticAsset } from '../../models/shared/staticAsset';
import type { GymPoint } from '../avatarController';
import { points2D, ribbon } from './geometry';

/** Authored backdrop choices; the footprints and road lines are OSM, nothing else here is measured. */
export const NEIGHBOURHOOD = {
  cell: 25, reach: 32, sunken: -3, levelMetres: 3, defaultHeight: 5.5, roadWidth: 6, ground: '#a9a688', road: '#8e9990',
  /** Pastel Victorian/cottage walls and two roof tones, read from reference photos (estimates). */
  walls: ['#e6d08a', '#eeece4', '#a9c1cb', '#c9b9a6', '#9aa596'], roofs: ['#4a4d52', '#9a5a45'],
} as const;

function hash(text: string) { let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return h >>> 0; }

/** Houses and streets south of the detailed crop, from the cached regional OSM download
 * (see scripts/extract-lovers-point-neighbourhood.py). One static matte batch. Ground beyond the
 * cached DEM continues at the DEM's edge heights and drops below the bay away from mapped content,
 * so the town never floats or covers open water. No collision: it is outside the playable area. */
export function createNeighbourhood(groundHeight: (x: number, z: number) => number) {
  const source = new Group();
  const anchors: GymPoint[] = [...data.buildings.flatMap(b => points2D(b.points)), ...data.roads.flatMap(r => points2D(r.points))];
  // Ground apron: grid vertices near mapped content sit on the (edge-clamped) DEM; others sink.
  const { cell, reach, sunken } = NEIGHBOURHOOD, [minX, , maxX, cropZ] = data.crop as number[];
  const x0 = -data.radius, x1 = data.radius, z0 = cropZ, z1 = data.radius;
  const columns = Math.ceil((x1 - x0) / cell), rows = Math.ceil((z1 - z0) / cell);
  const near = (x: number, z: number) => anchors.some(([ax, az]) => Math.abs(ax - x) < reach && Math.abs(az - z) < reach);
  const up: boolean[] = [], vertices: number[] = [], indices: number[] = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= columns; i++) {
    const x = x0 + i * cell, z = z0 + j * cell, raised = near(x, z) || (j === 0 && x >= minX && x <= maxX);
    up.push(raised); vertices.push(x, raised ? groundHeight(x, z) : sunken, z);
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
    const a = j * (columns + 1) + i, b = a + 1, c = a + columns + 1, d = c + 1;
    if (up[a] || up[b] || up[c] || up[d]) indices.push(a, c, b, b, c, d);
  }
  const apron = new BufferGeometry(); apron.setAttribute('position', new Float32BufferAttribute(vertices, 3)); apron.setIndex(indices); apron.computeVertexNormals();
  mesh(source, 'Neighbourhood ground · DEM edge heights / authored apron', apron, mat(NEIGHBOURHOOD.ground));
  // Streets: OSM centre lines with an authored width, lifted onto the same ground.
  const asphalt = mat(NEIGHBOURHOOD.road);
  for (const road of data.roads) {
    const geometry = ribbon(points2D(road.points), NEIGHBOURHOOD.roadWidth, 0), position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) position.setY(i, groundHeight(position.getX(i), position.getZ(i)) + .08);
    geometry.computeVertexNormals(); mesh(source, 'Neighbourhood street · OSM line / authored width', geometry, asphalt);
  }
  // Houses: mapped footprints extruded to levels × 3 m, or an authored 5.5 m cottage height.
  const walls = NEIGHBOURHOOD.walls.map(c => mat(c)), roofs = NEIGHBOURHOOD.roofs.map(c => mat(c));
  for (const building of data.buildings) {
    const points = points2D(building.points), h = hash(building.id);
    const levels = Number((building as { levels?: string }).levels), height = Number.isFinite(levels) && levels > 0 ? levels * NEIGHBOURHOOD.levelMetres : NEIGHBOURHOOD.defaultHeight;
    const cx = points.reduce((s, p) => s + p[0], 0) / points.length, cz = points.reduce((s, p) => s + p[1], 0) / points.length;
    const base = Math.min(...points.map(([x, z]) => groundHeight(x, z))), bottom = base - 1.2, top = base + height;
    const side: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length], dx = b[0] - a[0], dz = b[1] - a[1];
      const outward = -dz * ((a[0] + b[0]) / 2 - cx) + dx * ((a[1] + b[1]) / 2 - cz) >= 0;
      const [p, q] = outward ? [a, b] : [b, a];
      side.push(p[0], bottom, p[1], q[0], bottom, q[1], q[0], top, q[1], p[0], bottom, p[1], q[0], top, q[1], p[0], top, p[1]);
    }
    const wall = new BufferGeometry(); wall.setAttribute('position', new Float32BufferAttribute(side, 3)); wall.computeVertexNormals();
    mesh(source, `Neighbourhood house · ${building.id} / mapped footprint`, wall, walls[h % walls.length]);
    const contour = points.map(([x, z]) => new Vector2(x, z)), cap: number[] = [];
    for (const [i, j, k] of ShapeUtils.triangulateShape(contour, [])) {
      const [p, q, r] = [points[i], points[j], points[k]], upward = (q[1] - p[1]) * (r[0] - p[0]) - (q[0] - p[0]) * (r[1] - p[1]) > 0;
      for (const v of upward ? [p, q, r] : [p, r, q]) cap.push(v[0], top, v[1]);
    }
    const roof = new BufferGeometry(); roof.setAttribute('position', new Float32BufferAttribute(cap, 3)); roof.computeVertexNormals();
    mesh(source, `Neighbourhood house · ${building.id} / flat roof`, roof, roofs[(h >>> 3) % roofs.length]);
  }
  const batch = finishStaticAsset(source, 'gym-neighbourhood', [1, 1, 1], { rim: false });
  batch.name = 'Pacific Grove neighbourhood · OSM backdrop'; batch.userData.source = data.source; batch.userData.downloaded = data.downloaded;
  return batch;
}
