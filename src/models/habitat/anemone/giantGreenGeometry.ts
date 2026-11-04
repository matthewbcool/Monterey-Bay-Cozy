import { BufferGeometry, Color, Float32BufferAttribute, Vector3 } from 'three';
import { defineGeometryLods } from '../../shared/lod/geometry';
import { ANEMONES } from './definition';

/** Authored reductions retain the open centre and thick, bent tentacles. A reef bed starts
 * at the colony level; all variants share the same metre dimensions and seed sequence. */
const DETAILS = {
  near: { radial: 32, rows: [30, 24, 18], sides: 4, bends: [0, .48, .82] },
  colony: { radial: 8, rows: [12, 10, 6], sides: 3, bends: [0, .62] },
  far: { radial: 8, rows: [10, 8, 6], sides: 3, bends: [0, .62] },
  distant: { radial: 8, rows: [8, 6, 4], sides: 3, bends: [0] },
} as const;
type Detail = keyof typeof DETAILS;

function random(seed: number) {
  let s = seed >>> 0 || 1;
  return () => (s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909), (s >>> 0) / 4294967296);
}

function build(seed: number, detail: Detail) {
  const spec = ANEMONES['giant-green'], r = spec.discDiameterMeters / 2, h = spec.columnHeightMeters;
  const quality = DETAILS[detail], rand = random(seed);
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const column = new Color(spec.colors.column), disc = new Color(spec.colors.disc);
  const rootColor = new Color(spec.colors.tentacle), tipColor = new Color(spec.colors.tip), mouth = new Color('#375e47');
  const vertex = (x: number, y: number, z: number, color: Color) => {
    const i = positions.length / 3; positions.push(x, y, z); colors.push(color.r, color.g, color.b); return i;
  };
  const bands: { name: string; start: number; count: number }[] = [];
  // One continuous surface: rounded foot -> stout column -> broad shallow dish -> raised
  // lip -> recessed mouth. Small radial folds are geometry, not coplanar overlay stripes.
  const profile = [[.74, 0], [.83, .20], [.82, .62], [.94, .93], [1, 1], [.68, .97], [.30, .91], [.16, .95], [.08, .84]];
  for (let ring = 0; ring < profile.length; ring++) {
    const [radius, height] = profile[ring];
    for (let i = 0; i < quality.radial; i++) {
      const a = i / quality.radial * Math.PI * 2, wave = Math.cos(a * 12 + seed * .13);
      const isColumn = ring < 4, rr = radius * r * (1 + (isColumn ? .018 : .006) * wave);
      const yy = height * h + (ring > 4 && ring < 8 ? wave * .00065 : 0);
      const c = (isColumn ? column : ring === 8 ? mouth : disc).clone();
      // Subtle olive radial ribs; the crown stays mint with pale, slightly cool tips.
      c.multiplyScalar(1 + wave * (isColumn ? .035 : .065));
      vertex(Math.cos(a) * rr, yy, Math.sin(a) * rr * (ring >= 7 ? .60 : 1), c);
    }
    if (!ring) continue;
    for (let i = 0; i < quality.radial; i++) {
      const a = (ring - 1) * quality.radial + i, b = (ring - 1) * quality.radial + (i + 1) % quality.radial;
      const c = ring * quality.radial + i, d = ring * quality.radial + (i + 1) % quality.radial;
      indices.push(a, c, b, b, c, d);
    }
  }
  const centre = vertex(0, h * .825, 0, mouth);
  for (let i = 0; i < quality.radial; i++) indices.push(centre, 8 * quality.radial + (i + 1) % quality.radial, 8 * quality.radial + i);
  bands.push({ name: 'column-disc-mouth', start: 0, count: indices.length });

  const radial = new Vector3(), around = new Vector3(), cross = new Vector3(), tangent = new Vector3();
  // All levels draw a subset of the same 72 authored tentacles. Random draws for omitted
  // members are still consumed, so retained roots, length, bend and tint stay stable.
  for (let row = 0; row < 3; row++) {
    const count = DETAILS.near.rows[row], kept = new Set(Array.from({ length: quality.rows[row] }, (_, i) => Math.floor(i * count / quality.rows[row])));
    const start = indices.length;
    for (let i = 0; i < count; i++) {
      const a = (i + row * .43) / count * Math.PI * 2 + (rand() - .5) * .07;
      const length = r * [.48, .43, .36][row] * (.86 + rand() * .26);
      const lean = [.48, .30, -.12][row] + (rand() - .5) * .32;
      const width = r * [.095, .091, .082][row] * (.86 + rand() * .22);
      const curl = (rand() - .5) * .36, tint = .94 + rand() * .12;
      if (!kept.has(i)) continue;
      const baseRadius = r * [.95, .83, .70][row], baseY = h * [1, .985, .975][row] - .001;
      radial.set(Math.cos(a), 0, Math.sin(a)); around.set(-Math.sin(a), 0, Math.cos(a));
      const offset = positions.length / 3;
      for (const t of quality.bends) {
        const reach = length * (lean * t + curl * t * t), y = baseY + length * (t - .16 * t * t);
        tangent.copy(radial).multiplyScalar(lean + 2 * curl * t); tangent.y = 1 - .32 * t; tangent.normalize();
        cross.crossVectors(around, tangent).normalize();
        // Fleshy taper: broad basal shoulder, narrowing middle, rounded small tip.
        const radius = width * (1 - .98 * t * t), c = rootColor.clone().lerp(tipColor, t * .88).multiplyScalar(tint);
        for (let side = 0; side < quality.sides; side++) {
          const b = side / quality.sides * Math.PI * 2;
          vertex(radial.x * (baseRadius + reach) + (around.x * Math.cos(b) + cross.x * Math.sin(b)) * radius,
            y + cross.y * Math.sin(b) * radius,
            radial.z * (baseRadius + reach) + (around.z * Math.cos(b) + cross.z * Math.sin(b)) * radius, c);
        }
      }
      for (let ring = 1; ring < quality.bends.length; ring++) for (let side = 0; side < quality.sides; side++) {
        const a = offset + (ring - 1) * quality.sides + side, b = offset + (ring - 1) * quality.sides + (side + 1) % quality.sides;
        const c = a + quality.sides, d = b + quality.sides;
        indices.push(a, c, b, b, c, d);
      }
      const tip = vertex(radial.x * (baseRadius + length * (lean + curl)), baseY + length * .84,
        radial.z * (baseRadius + length * (lean + curl)), tipColor.clone().multiplyScalar(tint));
      const last = offset + (quality.bends.length - 1) * quality.sides;
      for (let side = 0; side < quality.sides; side++) indices.push(last + side, tip, last + (side + 1) % quality.sides);
    }
    bands.push({ name: ['outer-tentacles', 'middle-tentacles', 'inner-tentacles'][row], start, count: indices.length - start });
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
  geometry.name = `anemone:giant-green:${detail}`;
  geometry.userData = { seed, detail, tentacleCount: quality.rows.reduce((n, v) => n + v, 0), sourceParts: bands };
  return geometry;
}

export function buildGiantGreenGeometry(seed: number, colony = false) {
  const geometry = build(seed, colony ? 'colony' : 'near');
  defineGeometryLods(geometry, () => ({ mid: build(seed, colony ? 'far' : 'colony'), far: build(seed, colony ? 'distant' : 'far') }));
  return geometry;
}
