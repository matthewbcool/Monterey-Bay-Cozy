import { BufferGeometry, Float32BufferAttribute } from 'three';
import data from '../../data/lovers-point-elevation.json';
import { recreationGrades, recreationHeight, splitRecreationSurface } from './recreationGrade';
import type { GymPoint } from '../avatarController';

/** NAVD88 metres, unscaled. This is a cached DEM, never a runtime network query.
 * The bay's static display level is an authored reference, not a tide reading. */
export const GYM_WATER_LEVEL = 1;
export const GYM_GROUND_CLEARANCE = .045;
export const ELEVATION_GRID = data.grid;
const g = data.grid;
const gradedValues = recreationGrades(g, data.values);
const value = (x: number, z: number) => gradedValues[z * g.columns + x];

/** Same two planes per grid cell used by drapeGeometry. No bilinear/render mismatch. */
export function groundHeight(x: number, z: number): number {
  const u = Math.max(0, Math.min(g.columns - 1.000001, (x - g.minX) / g.stepX));
  const v = Math.max(0, Math.min(g.rows - 1.000001, (z - g.minZ) / g.stepZ));
  const i = Math.floor(u), j = Math.floor(v), a = u - i, b = v - j;
  const h00 = value(i, j), h11 = value(i + 1, j + 1);
  const base = a >= b
    ? h00 + a * (value(i + 1, j) - h00) + b * (h11 - value(i + 1, j))
    : h00 + b * (value(i, j + 1) - h00) + a * (h11 - value(i, j + 1));
  return recreationHeight(x,z,base);
}

function clip(points: GymPoint[], distance: (p: GymPoint) => number): GymPoint[] {
  const result: GymPoint[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length], da = distance(a), db = distance(b);
    if (da >= -1e-8) result.push(a);
    if (da * db < 0) { const t = da / (da - db); result.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]); }
  }
  return result;
}

/** Cut a flat polygon/ribbon at the DEM triangle edges, then lift it. This keeps
 * footprint X/Z exact and decals coincident with the physical ground everywhere,
 * including between source vertices. Build-time only; disposes the flat input. */
export function drapeGeometry(source: BufferGeometry): BufferGeometry {
  const p = source.getAttribute('position'), index = source.index;
  const vertices: number[] = [], indices: number[] = [], lookup = new Map<string, number>();
  const offset = p.getY(0);
  function emit(poly: GymPoint[]) {
    if (poly.length < 3) return;
    const ids = poly.map(([x, z]) => {
      const key = `${x.toFixed(6)},${z.toFixed(6)}`;
      let id = lookup.get(key);
      if (id === undefined) { id = vertices.length / 3; lookup.set(key, id); vertices.push(x, groundHeight(x, z) + offset, z); }
      return id;
    });
    for (let k = 1; k < ids.length - 1; k++) {
      const a = poly[0], b = poly[k], c = poly[k + 1];
      const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (Math.abs(cross) < 1e-8) continue;
      indices.push(ids[0], cross < 0 ? ids[k] : ids[k + 1], cross < 0 ? ids[k + 1] : ids[k]);
    }
  }
  const count = index?.count ?? p.count;
  for (let k = 0; k < count; k += 3) {
    const tri = [0, 1, 2].map(n => { const i = index ? index.getX(k + n) : k + n; return [p.getX(i), p.getZ(i)] as GymPoint; });
    const x0 = Math.floor((Math.min(...tri.map(v => v[0])) - g.minX) / g.stepX), x1 = Math.floor((Math.max(...tri.map(v => v[0])) - g.minX) / g.stepX);
    const z0 = Math.floor((Math.min(...tri.map(v => v[1])) - g.minZ) / g.stepZ), z1 = Math.floor((Math.max(...tri.map(v => v[1])) - g.minZ) / g.stepZ);
    for (let j = z0; j <= z1; j++) for (let i = x0; i <= x1; i++) {
      const x = g.minX + i * g.stepX, z = g.minZ + j * g.stepZ;
      let cell = clip(tri, p => p[0] - x); cell = clip(cell, p => x + g.stepX - p[0]);
      cell = clip(cell, p => p[1] - z); cell = clip(cell, p => z + g.stepZ - p[1]);
      if (cell.length < 3) continue;
      const diagonal = (p: GymPoint) => (p[0] - x) / g.stepX - (p[1] - z) / g.stepZ;
      for(const triangle of [clip(cell, diagonal),clip(cell, p => -diagonal(p))])if(triangle.length>=3)
        for(const patch of splitRecreationSurface(triangle))emit(patch);
    }
  }
  const result = new BufferGeometry(); result.setAttribute('position', new Float32BufferAttribute(vertices, 3)); result.setIndex(indices); result.computeVertexNormals(); source.dispose(); return result;
}

/** Close the coast and the authored inland crop down below display water. */
export function terrainSkirt(points: readonly GymPoint[]): BufferGeometry {
  const vertices: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length], count = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3);
    for (let k = 0; k < count; k++) {
      const x = a[0] + (b[0] - a[0]) * k / count, z = a[1] + (b[1] - a[1]) * k / count;
      const xx = a[0] + (b[0] - a[0]) * (k + 1) / count, zz = a[1] + (b[1] - a[1]) * (k + 1) / count;
      const y = groundHeight(x, z), yy = groundHeight(xx, zz);
      vertices.push(x,y,z, xx,yy,zz, xx,-3,zz, x,y,z, xx,-3,zz, x,-3,z);
    }
  }
  const result = new BufferGeometry(); result.setAttribute('position', new Float32BufferAttribute(vertices, 3)); result.computeVertexNormals(); return result;
}
