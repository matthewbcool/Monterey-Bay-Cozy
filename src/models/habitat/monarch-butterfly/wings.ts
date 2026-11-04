import { BufferGeometry, Color, Float32BufferAttribute, ShapeUtils, Uint16BufferAttribute, Vector2 } from 'three';
import { mulberry32 } from '../../shared/random';

type Point = readonly [number, number];
type Polygon = readonly Point[];
type PigmentRegion = { polygon: Polygon; kind: 'orange' | 'cream'; shade: number };
export type MonarchWingDetail = 'near' | 'mid' | 'far';

// Right-wing planforms in millimetres for the representative 100 mm span.
// The forewing's swept apex and the broad scalloped hindwing remain separate
// source components, even though all surfaces merge into one skinned batch.
const FORE_OUTLINE: Polygon = [
  [1.5, 0], [14, -13], [29, -23], [46, -30], [50, -27], [44, -11],
  [36, 3], [26, 13], [17, 11.5], [7, 6], [2, 3],
];
const HIND_OUTLINE: Polygon = [
  [1.5, 1], [12, -2], [25, 3], [33, 11], [34, 18], [31, 25],
  [26, 30], [20, 33], [15, 35], [9, 33], [6, 30], [3, 24], [2, 15],
];
// At distance the four separate lobes carry identity. These smaller polygons
// retain the exact tip span and chord while omitting invisible edge inflections.
const FAR_FORE_OUTLINE: Polygon = [[1.5, 0], [29, -23], [46, -30], [50, -27], [36, 3], [26, 13]];
const FAR_HIND_OUTLINE: Polygon = [[1.5, 1], [25, 3], [34, 18], [26, 30], [15, 35], [6, 30], [2, 15]];

// A connected vein graph divides the orange field. Insetting these regions
// leaves the broad marginal band and narrower branching veins as one charcoal
// surface; there are no coplanar decal meshes or a viceroy-like hindwing bar.
const F_ROOT: Point = FORE_OUTLINE[0], F_A: Point = [27, -12], F_B: Point = [22, 3];
const FORE_CELLS: Polygon[] = [
  [F_ROOT, ...FORE_OUTLINE.slice(1, 4), F_A],
  [F_A, ...FORE_OUTLINE.slice(3, 6)],
  [F_A, ...FORE_OUTLINE.slice(5, 7), F_B],
  [F_B, ...FORE_OUTLINE.slice(6, 9)],
  [F_ROOT, F_A, F_B, ...FORE_OUTLINE.slice(8)],
];
const H_ROOT: Point = HIND_OUTLINE[0], H_A: Point = [18, 13];
const HIND_CELLS: Polygon[] = [
  [H_ROOT, ...HIND_OUTLINE.slice(1, 5), H_A],
  [H_A, ...HIND_OUTLINE.slice(4, 8)],
  [H_A, ...HIND_OUTLINE.slice(7, 11)],
  [H_ROOT, H_A, ...HIND_OUTLINE.slice(10)],
];
const MID_FORE_CELLS: Polygon[] = [[F_ROOT, ...FORE_OUTLINE.slice(1, 6)], [F_ROOT, ...FORE_OUTLINE.slice(5)]];
const MID_HIND_CELLS: Polygon[] = [[H_ROOT, ...HIND_OUTLINE.slice(1, 8)], [H_ROOT, ...HIND_OUTLINE.slice(7)]];

function samePoint(a: Point, b: Point) { return a[0] === b[0] && a[1] === b[1]; }
function insetCell(polygon: Polygon, outline: Polygon, fore: boolean, detail: MonarchWingDetail): Polygon {
  const lines = polygon.map((a, i) => {
    const b = polygon[(i + 1) % polygon.length], dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    const boundary = outline.findIndex((p, j) => samePoint(p, a) && samePoint(outline[(j + 1) % outline.length], b));
    const distance = detail === 'far' ? .9 : boundary === -1 ? .43 : fore && boundary < 3 ? .9 : 2.35;
    return { a: [a[0] - dz / length * distance, a[1] + dx / length * distance] as Point, dx, dz };
  });
  return lines.map((line, i): Point => {
    const previous = lines[(i + lines.length - 1) % lines.length];
    const denominator = previous.dx * line.dz - previous.dz * line.dx;
    if (Math.abs(denominator) < .0001) return line.a;
    const t = ((line.a[0] - previous.a[0]) * line.dz - (line.a[1] - previous.a[1]) * line.dx) / denominator;
    return [previous.a[0] + t * previous.dx, previous.a[1] + t * previous.dz];
  });
}

/** Sparse marginal spots are deliberately polygonal at inspection distance.
 * Small spots become paint shapes through normal LOD instead of extra draws. */
function marginalSpot(outline: Polygon, edge: number, t: number, inset: number, radius: number, corners = 4): Polygon {
  const a = outline[edge], b = outline[(edge + 1) % outline.length];
  const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
  const x = a[0] + dx * t - dz / length * inset, z = a[1] + dz * t + dx / length * inset;
  return Array.from({ length: corners }, (_, i): Point => {
    const angle = i * Math.PI * 2 / corners + .3;
    return [x + Math.cos(angle) * radius, z + Math.sin(angle) * radius];
  });
}

function pigmentRegions(outline: Polygon, cells: Polygon[], fore: boolean, detail: MonarchWingDetail): PigmentRegion[] {
  const regions: PigmentRegion[] = cells.map((polygon, index) => ({ polygon: insetCell(polygon, outline, fore, detail), kind: 'orange', shade: detail === 'far' ? 0 : (index % 3 - 1) * .035 }));
  if (detail === 'far') return regions;
  const sites = fore
    ? detail === 'mid' ? [[3, .5], [4, .15]] : [[3, .5], [4, .15], [5, .5], [6, .5], [7, .5]]
    : detail === 'mid' ? [[7, .5]] : [[4, .5], [6, .5], [7, .5], [8, .5], [10, .5]];
  sites.forEach(([edge, t], index) => {
    const tip = fore && index < 2;
    regions.push({ polygon: marginalSpot(outline, edge, t, tip ? 1.15 : .8, tip ? .8 : .55), kind: 'cream', shade: 0 });
  });
  return regions;
}

/** Four thin, two-sided membranes. Bone 0 is the body, then fore L/R and hind L/R.
 * The opaque reverse faces carry their own pigment; do not use DoubleSide here.
 * All dimensions and skin weights are baked once, outside animation. */
export function buildMonarchWings({ seed, wingspanMeters, detail = 'near' }: { seed: number; wingspanMeters: number; detail?: MonarchWingDetail }) {
  const random = mulberry32(seed ^ 0x4d4f4e41), unit = wingspanMeters / 100;
  const chord = .985 + random() * .03;
  const positions: number[] = [], normals: number[] = [], colors: number[] = [];
  const skinIndices: number[] = [], skinWeights: number[] = [], indices: number[] = [];
  const dorsal = new Color('#e98232'), ventral = new Color('#9e794f'), edge = new Color('#25272b');
  const cream = new Color('#ecdfbd'), reverseCream = new Color('#d9cbac');
  const hue = (random() - .5) * .014;
  dorsal.offsetHSL(hue, 0, 0); ventral.offsetHSL(hue, 0, 0);

  function vertex(p: Point, y: number, side: number, normal: readonly [number, number, number], color: Color, bone: number) {
    const index = positions.length / 3;
    positions.push(p[0] * side * unit, y * unit, p[1] * chord * unit);
    normals.push(...normal); colors.push(color.r, color.g, color.b);
    skinIndices.push(bone, 0, 0, 0); skinWeights.push(1, 0, 0, 0);
    return index;
  }

  function face(outline: Polygon, y: number, side: number, up: number, color: Color, bone: number, holes: Polygon[] = []) {
    // Triangulate a single canonical left-wing orientation and mirror its
    // topology. Re-triangulating mirrored concave holes can choose different
    // earcut bridges around the tiny adjacent marginal spots.
    const contour = outline.map(([x, z]) => new Vector2(-x, z));
    const voids = holes.map(polygon => polygon.map(([x, z]) => new Vector2(-x, z)));
    const triangles = ShapeUtils.triangulateShape(contour, voids), allPoints = [...contour, ...voids.flat()];
    const offset = positions.length / 3;
    [outline, ...holes].forEach(polygon => polygon.forEach(point => vertex(point, y, side, [0, up, 0], color, bone)));
    for (const [a, b, c] of triangles) {
      // X/Z orientation reverses the Y normal relative to the 2D cross product.
      const pa = allPoints[a], pb = allPoints[b], pc = allPoints[c];
      const cross = (pb.y - pa.y) * (pc.x - pa.x) - (pb.x - pa.x) * (pc.y - pa.y);
      if (cross * up * -side > 0) indices.push(offset + a, offset + b, offset + c);
      else indices.push(offset + a, offset + c, offset + b);
    }
  }

  function wing(outline: Polygon, side: number, bone: number, y: number) {
    const thickness = .075, fore = bone < 3;
    // Authored variants remove pattern subdivisions before silhouette and color.
    // Generic seam reduction can retain the black scaffold and erase the orange.
    const cells = detail === 'far' ? [outline] : detail === 'mid' ? fore ? MID_FORE_CELLS : MID_HIND_CELLS : fore ? FORE_CELLS : HIND_CELLS;
    const regions = pigmentRegions(outline, cells, fore, detail);
    for (const up of [1, -1]) {
      const level = up === 1 ? y : y - thickness;
      face(outline, level, side, up, edge, bone, regions.map(region => region.polygon));
      regions.forEach(region => {
        const tint = (region.kind === 'orange' ? up === 1 ? dorsal : ventral : up === 1 ? cream : reverseCream).clone();
        tint.offsetHSL(0, 0, region.shade);
        face(region.polygon, level, side, up, tint, bone);
      });
    }
    // The membrane's microscopic edge wall is intentionally omitted. Separate
    // opaque faces retain front/back paint without spending triangles on an
    // edge that is subpixel at gameplay distance.
  }

  const foreOutline = detail === 'far' ? FAR_FORE_OUTLINE : FORE_OUTLINE;
  const hindOutline = detail === 'far' ? FAR_HIND_OUTLINE : HIND_OUTLINE;
  wing(foreOutline, -1, 1, 0); wing(foreOutline, 1, 2, 0);
  wing(hindOutline, -1, 3, -.33); wing(hindOutline, 1, 4, -.33);
  const geometry = new BufferGeometry();
  geometry.name = 'monarch-four-wing-membranes';
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new Float32BufferAttribute(skinWeights, 4));
  geometry.setIndex(indices); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}
