export type MapPoint = readonly [number, number];

/** Includes the boundary so an original coast line does not double the detailed shore. */
export function withinPolygon(point: MapPoint, polygon: readonly MapPoint[]): boolean {
  const [x, z] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j], b = polygon[i], dx = b[0] - a[0], dz = b[1] - a[1];
    const length = Math.hypot(dx, dz);
    if (length > 0 && Math.abs((x - a[0]) * dz - (z - a[1]) * dx) / length < 1e-5
      && x >= Math.min(a[0], b[0]) - 1e-5 && x <= Math.max(a[0], b[0]) + 1e-5
      && z >= Math.min(a[1], b[1]) - 1e-5 && z <= Math.max(a[1], b[1]) + 1e-5) return true;
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

/** Build-time clipping for a concave detail patch. Crossing paths keep both ends;
 * only their covered portions disappear when the detailed park is visible. */
export function splitSegmentAtPolygon(a: MapPoint, b: MapPoint, polygon: readonly MapPoint[]) {
  const inside: [MapPoint, MapPoint][] = [], outside: [MapPoint, MapPoint][] = [];
  const dx = b[0] - a[0], dz = b[1] - a[1];
  if (Math.hypot(dx, dz) < 1e-8) return { inside, outside };
  const cuts = [0, 1];
  for (let i = 0; i < polygon.length; i++) {
    const c = polygon[i], d = polygon[(i + 1) % polygon.length], ex = d[0] - c[0], ez = d[1] - c[1];
    const denominator = dx * ez - dz * ex;
    if (Math.abs(denominator) < 1e-10) continue;
    const cx = c[0] - a[0], cz = c[1] - a[1];
    const t = (cx * ez - cz * ex) / denominator, u = (cx * dz - cz * dx) / denominator;
    if (t > 1e-8 && t < 1 - 1e-8 && u >= -1e-8 && u <= 1 + 1e-8) cuts.push(t);
  }
  cuts.sort((x, y) => x - y);
  const at = (t: number): MapPoint => [a[0] + dx * t, a[1] + dz * t];
  for (let i = 1; i < cuts.length; i++) {
    if (cuts[i] - cuts[i - 1] < 1e-8) continue;
    const group = withinPolygon(at((cuts[i] + cuts[i - 1]) / 2), polygon) ? inside : outside;
    group.push([at(cuts[i - 1]), at(cuts[i])]);
  }
  return { inside, outside };
}
