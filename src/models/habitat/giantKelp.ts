import { BufferGeometry, CatmullRomCurve3, ConeGeometry, Float32BufferAttribute, Group, OctahedronGeometry, SphereGeometry, TubeGeometry, Vector3 } from 'three';
import { mat, mesh } from '../props/primitives';
import { finishStaticAsset } from '../shared/staticAsset';

/** Giant kelp (Macrocystis pyrifera), stylized. Anatomy follows the Monterey Bay Aquarium species page:
 * a branching holdfast on rock, flexible stem-like stipes, a gas-filled bladder at the base of each
 * leaf-like blade, fronds that reach the surface and spread into a canopy, and a splitting growth tip.
 * Counts, spacing, blade size and colors are artistic choices.
 */
export interface GiantKelpOptions {
  /** Seafloor-to-surface height in metres. Real plants reach ~30 m; scenes may use shallower water. */
  height?: number;
  /** Fronds rising from the holdfast. Omit for a random 2–4 (more in deeper water). */
  fronds?: number;
  /** Mean length of mature fronds lying along the surface canopy, in metres (each frond varies). */
  canopy?: number;
  /** Mean vertical spacing between blade/bladder pairs, in metres (each station jitters ±25%). */
  bladeSpacing?: number;
  /** Blade density multiplier along the surface canopy (1 = same spacing as upright fronds). */
  canopyDensity?: number;
  /** Share of fronds that are still juvenile and stop below the surface (0–1). */
  juvenile?: number;
  /** Omit for a new random plant on every call; pass a seed to reproduce one (stored in userData.seed). */
  seed?: number;
}

export const KELP_COLORS = { holdfast: '#5b4724', stipe: '#73642b', bladder: '#b89c48', blade: '#8c7a35', canopy: '#a38b3b', tip: '#9c8a3a' } as const;
const GOLDEN = 2.399963229728653;

function random(seed: number) { let s = seed >>> 0 || 1; return () => (s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909), (s >>> 0) / 4294967296); }

/** Lanceolate blade ribbon with ruffled margins: `segments` × 2 triangles, double-sided at render. */
function blade(base: Vector3, direction: Vector3, side: Vector3, length: number, width: number, ruffle: number, segments = 5) {
  const vertices: number[] = [], indices: number[] = [], normal = new Vector3().crossVectors(direction, side).normalize(), p = new Vector3();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, w = Math.sin(Math.PI * Math.min(1, t * 1.15)) * width * (1 - .35 * t) + .004;
    // Droop: blades stream outward, then sag toward their tips.
    const along = p.copy(base).addScaledVector(direction, t * length).addScaledVector(normal, -t * t * length * .18);
    const wave = (i % 2 ? 1 : -1) * ruffle * Math.sin(Math.PI * t);
    for (const s of [-1, 1]) {
      const q = along.clone().addScaledVector(side, s * w).addScaledVector(normal, wave * s);
      vertices.push(q.x, q.y, q.z);
    }
  }
  for (let i = 0; i < segments; i++) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(vertices, 3)); g.setIndex(indices); g.computeVertexNormals();
  return g;
}

export function createGiantKelp({ height = 6, fronds, canopy = 1.1, bladeSpacing = .42, canopyDensity = 2, juvenile = .3, seed = Math.floor(Math.random() * 2 ** 31) }: GiantKelpOptions = {}) {
  const rand = random(seed), root = new Group(); root.name = 'Giant kelp';
  const between = (a: number, b: number) => a + (b - a) * rand();
  const materials = Object.fromEntries(Object.entries(KELP_COLORS).map(([k, c]) => [k, mat(c, 1)])) as Record<keyof typeof KELP_COLORS, ReturnType<typeof mat>>;
  // Holdfast: a tangle of branching haptera gripping the rock, plus a low central knot. Spread varies per plant.
  const spread = between(.8, 1.25), hapteraCount = 5 + Math.floor(rand() * 4);
  mesh(root, 'Holdfast knot', new SphereGeometry(.13 * spread, 6, 2, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, between(.55, .85), 1), materials.holdfast);
  for (let i = 0; i < hapteraCount; i++) {
    const a = i * GOLDEN + between(-.4, .4), r = (.14 + rand() * .14) * spread, cone = new ConeGeometry(between(.024, .038), r * 1.3, 4, 1, true); // open: base sits in the knot
    cone.rotateZ(Math.PI / 2 + between(.4, .75)); cone.rotateY(-a); cone.translate(Math.cos(a) * r * .55, .03, Math.sin(a) * r * .55);
    mesh(root, 'Holdfast haptera', cone, materials.holdfast);
  }
  const surfaceY = height - .04, up = new Vector3(0, 1, 0);
  const frondCount = fronds ?? Math.min(4, 2 + Math.floor(rand() * (height > 4 ? 3 : 2)));
  for (let f = 0; f < frondCount; f++) {
    const a = f * GOLDEN + between(-.5, .5), lean = between(.08, .32);
    const drift = new Vector3(Math.cos(a), 0, Math.sin(a));
    // Frond 0 always reaches the canopy; others may be juveniles that stop partway up.
    const young = f > 0 && rand() < juvenile, reach = young ? between(.4, .85) : 1;
    // Stipe: rises with a randomized S-curve, then (if mature) lies along the surface as canopy.
    const points: Vector3[] = [], curl = between(.9, 1.8), swayAmount = between(.07, .2), swayPhase = rand() * Math.PI * 2;
    const topY = young ? .08 + (surfaceY - .08) * reach : surfaceY;
    const rise = Math.max(.5, topY), steps = Math.max(3, Math.ceil(rise / 1.2));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, sway = Math.sin(t * Math.PI * curl + swayPhase) * swayAmount * Math.min(1, height / 3);
      points.push(new Vector3().addScaledVector(drift, .05 + t * lean * rise * .35 + sway).setY(.08 + t * (topY - .08)));
    }
    const top = points[points.length - 1], frondCanopy = young ? 0 : canopy * between(.55, 1.4);
    // Canopy fronds meander across the water instead of running straight.
    const across = new Vector3(-drift.z, 0, drift.x), meander = between(-.45, .45), bendPhase = rand() * 3;
    for (let i = 1; i <= 4 && frondCanopy > 0; i++) {
      const t = i / 4;
      points.push(top.clone().addScaledVector(drift, frondCanopy * t).addScaledVector(across, frondCanopy * (meander * t * t + Math.sin(t * 3 + bendPhase) * .12)).setY(surfaceY + Math.sin(i * 1.7 + a) * .015));
    }
    const curve = new CatmullRomCurve3(points), length = curve.getLength();
    mesh(root, 'Stipe', new TubeGeometry(curve, Math.max(6, Math.ceil(length / .5)), between(.009, .013), 4, false), materials.stipe);
    // One blade per gas bladder, spiralling around the frond at jittered spacing.
    // Canopy blades crowd closer than upright ones, so the surface mat reads as a mat.
    const stations: number[] = [], tangent = new Vector3(), side = new Vector3(), out = new Vector3();
    for (let d = between(.2, .4); d < length - .25;) {
      stations.push(d);
      const inCanopy = curve.getPointAt(d / length).y > surfaceY - .1;
      d += (inCanopy ? bladeSpacing / canopyDensity : bladeSpacing) * between(.75, 1.25);
    }
    const twist = rand() * Math.PI * 2;
    for (let i = 0; i < stations.length; i++) {
      const u = stations[i] / length, at = curve.getPointAt(u); curve.getTangentAt(u, tangent);
      // Blades near the waterline float flat with the canopy instead of poking through the surface.
      const inCanopy = at.y > surfaceY - .55, angle = i * GOLDEN + twist + between(-.35, .35);
      out.set(Math.cos(angle), 0, Math.sin(angle)).addScaledVector(tangent, -tangent.dot(out)).normalize();
      const bulb = between(.85, 1.2), bladder = new OctahedronGeometry(1, 0); bladder.scale(.022 * bulb, .034 * bulb, .022 * bulb);
      bladder.lookAt(tangent); bladder.translate(at.x + out.x * .02, at.y + out.y * .02, at.z + out.z * .02);
      mesh(root, 'Gas bladder (pneumatocyst)', bladder, materials.bladder);
      // Upright blades angle outward and upward; canopy blades fan flat over the water.
      const lift = between(.5, .8);
      const direction = inCanopy ? out.clone().addScaledVector(tangent, between(.3, .7)).setY(-.04).normalize() : out.clone().multiplyScalar(1 - lift * .4).addScaledVector(up, lift).normalize();
      side.crossVectors(direction, inCanopy ? up : tangent).normalize();
      const size = between(.7, 1.2), width = between(.8, 1.15);
      mesh(root, inCanopy ? 'Canopy blade' : 'Blade', blade(at.clone().addScaledVector(out, .03), direction, side, .56 * size, .08 * size * width, between(.008, .018)), inCanopy ? materials.canopy : materials.blade);
    }
    // Growing tip: a curved scimitar blade splitting into small new blades.
    const end = curve.getPointAt(1); curve.getTangentAt(1, tangent);
    side.crossVectors(tangent, up).normalize(); if (side.lengthSq() < .1) side.set(1, 0, 0);
    for (const [turn, scale] of [[0, 1], [between(.35, .6), .45], [-between(.3, .55), .4]] as const)
      mesh(root, 'Growing tip blade', blade(end, tangent.clone().addScaledVector(side, turn).normalize(), side, .3 * scale * between(.8, 1.2), .03, .008, 4), materials.tip);
  }
  const plant = finishStaticAsset(root, 'giant-kelp', [1, 1, 1], { doubleSided: true });
  Object.assign(plant.userData, { seed, fronds: frondCount, heightMetres: height });
  return plant;
}
