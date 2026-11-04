import { BufferGeometry, Float32BufferAttribute, Shape, ShapeGeometry, Vector2 } from 'three';
import type { GymPoint } from '../avatarController';

export function points2D(points: number[][]): GymPoint[] { return points.map(([x, z]) => [x, z]); }
export function polygon(points: readonly GymPoint[]) { return new Shape(points.map(([x, z]) => new Vector2(x, -z))); }
export function surface(points: readonly GymPoint[], y = 0) {
  const g = new ShapeGeometry(polygon(points)); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); return g;
}
export function ribbon(points: readonly GymPoint[], width: number, y: number) {
  const v: number[] = [], edges: number[][] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i], a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
    const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len * width / 2, nz = dx / len * width / 2;
    edges.push([p[0] - nx, p[1] - nz, p[0] + nx, p[1] + nz]);
  }
  for (let i = 1; i < edges.length; i++) {
    const a = edges[i - 1], b = edges[i];
    v.push(a[0], y, a[1], a[2], y, a[3], b[2], y, b[3], a[0], y, a[1], b[2], y, b[3], b[0], y, b[1]);
  }
  const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(v, 3)); g.computeVertexNormals(); return g;
}
