import { Box3, Matrix4, Quaternion, Vector3 } from 'three';

/** Species-level schooling traits. Distances are in body lengths unless named in metres.
 * These are artistic parameters shaped by the general structure of real fish schools:
 * spacing near one body length, a few nearest neighbours, and an elongated, flattened group.
 */
export interface SchoolingTraits {
  /** Preferred nearest-neighbour distance, in body lengths. */
  spacing: number;
  /** Envelope proportions along travel (x), height (y) and width (z). Scaled to the population. */
  shape: readonly [number, number, number];
  /** How many nearest neighbours each fish attends to (topological, not metric). */
  neighbours: number;
  /** Uniform size spread: each fish scales within 1 ± sizeSpread (fish 0 stays nominal). */
  sizeSpread: number;
  /** Forward school speed in m/s for slow and fast swimming; used for heading, not placement. */
  cruise: { readonly slow: number; readonly fast: number };
  /** Steering weights. */
  weights: { separation: number; alignment: number; cohesion: number; envelope: number; wander: number };
  /** Envelope bending and breathing, as fractions of its radii. */
  flex: { bend: number; breathe: number };
}

export const DEFAULT_SCHOOLING: SchoolingTraits = {
  spacing: .8, shape: [2.2, .75, 1.1], neighbours: 7, sizeSpread: .1,
  cruise: { slow: .18, fast: .72 },
  weights: { separation: 2.4, alignment: 1.1, cohesion: .35, envelope: 3, wander: .5 },
  flex: { bend: .28, breathe: .1 },
};

const STEP = 1 / 60, TAU = Math.PI * 2, FORWARD = new Vector3(-1, 0, 0);

/** Seeded so a population looks the same on every load and in tests. */
function random(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * Local-frame schooling for an instanced group. The host moves the school root along its
 * route; this owns only each fish's offset, heading, size and tail-rate in that frame.
 * A uniform spatial hash limits candidate comparisons for the k nearest neighbours;
 * crowded cells can still approach quadratic cost. Profile the actual formation.
 * Fish head toward −X. One scene unit is one metre.
 */
export function createSchooling(capacity: number, bodyLength: number, traits: SchoolingTraits = DEFAULT_SCHOOLING, seed = 1) {
  const position = new Float32Array(capacity * 3), velocity = new Float32Array(capacity * 3);
  const heading = new Float32Array(capacity * 4), scale = new Float32Array(capacity), tailRate = new Float32Array(capacity);
  const phase = new Float32Array(capacity), wander = new Float32Array(capacity * 3);
  const rand = random(seed);
  let count = 0, time = 0;
  const radii = new Vector3(), limit = new Vector3();
  const spacing = traits.spacing * bodyLength, maxScale = 1 + traits.sizeSpread;

  // Neighbour search: hash cells sized to the attention radius, rebuilt each step.
  const cellSize = spacing * 2.2, cellOf = new Int32Array(capacity), next = new Int32Array(capacity);
  const buckets = new Map<number, number>();
  const nearIndex = new Int32Array(traits.neighbours), nearDistance = new Float32Array(traits.neighbours);
  const key = (x: number, y: number, z: number) => ((x + 512) * 1024 + (y + 512)) * 1024 + (z + 512);

  function traitsFor(i: number) {
    // Fish 0 is the nominal specimen (seamless single-fish cycle and caught-model size).
    const s = i === 0 ? 1 : 1 + (rand() * 2 - 1) * traits.sizeSpread * (.4 + .6 * rand());
    scale[i] = s; tailRate[i] = 1 / s; // same school speed: smaller fish beat faster
    phase[i] = i === 0 ? 0 : (i * 2.399963229728653) % TAU;
    wander.set([rand() * TAU, .35 + rand() * .5, .25 + rand() * .4], i * 3);
    heading.set([0, 0, 0, 1], i * 4);
  }
  function sizeEnvelope() {
    // Volume per fish ≈ spacing³; an ellipsoid with the trait proportions holds the group.
    const [a, b, c] = traits.shape, volume = Math.max(1, count) * spacing ** 3;
    const k = Math.cbrt(volume / (4 / 3 * Math.PI * a * b * c));
    radii.set(a * k, b * k, c * k).max(new Vector3(spacing, spacing, spacing).multiplyScalar(.5));
    // Hard limit includes breathing and the bending offset, so bounds stay conservative.
    limit.copy(radii).multiplyScalar(1 + traits.flex.breathe);
  }
  function spawn(i: number) {
    // Uniform point in the unit ball, stretched to the envelope.
    let x = 0, y = 0, z = 0;
    do { x = rand() * 2 - 1; y = rand() * 2 - 1; z = rand() * 2 - 1; } while (x * x + y * y + z * z > 1);
    position.set([x * radii.x * .8, y * radii.y * .8, z * radii.z * .8], i * 3); velocity.fill(0, i * 3, i * 3 + 3);
  }
  function reset(next: number) {
    // Existing fish keep their place; new arrivals join inside the new envelope.
    const previous = count; count = next; sizeEnvelope();
    for (let i = previous; i < count; i++) { traitsFor(i); spawn(i); }
    if (count === 1) position.fill(0, 0, 3);
  }
  /** Envelope center line: the school bends like a ribbon and slowly breathes. */
  function centre(x: number, out: Vector3) {
    const u = x / Math.max(1e-6, radii.x);
    return out.set(0, Math.sin(time * .23 + u * 1.3) * radii.y * traits.flex.bend * .5, Math.sin(time * .31 - u * 1.9) * radii.z * traits.flex.bend);
  }
  const p = new Vector3(), q = new Vector3(), v = new Vector3(), force = new Vector3(), sep = new Vector3(), ali = new Vector3(), coh = new Vector3(), mid = new Vector3();
  function nearest(i: number) {
    p.fromArray(position, i * 3); let found = 0;
    const cx = Math.floor(p.x / cellSize), cy = Math.floor(p.y / cellSize), cz = Math.floor(p.z / cellSize);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      for (let j = buckets.get(key(cx + dx, cy + dy, cz + dz)) ?? -1; j >= 0; j = next[j]) {
        if (j === i) continue;
        const d = q.fromArray(position, j * 3).distanceToSquared(p);
        if (found < nearIndex.length) { nearIndex[found] = j; nearDistance[found++] = d; continue; }
        let worst = 0; for (let k = 1; k < found; k++) if (nearDistance[k] > nearDistance[worst]) worst = k;
        if (d < nearDistance[worst]) { nearIndex[worst] = j; nearDistance[worst] = d; }
      }
    }
    return found;
  }
  function step(dt: number, blend: number) {
    time += dt;
    if (count <= 1) return; // a lone fish holds the school origin
    buckets.clear();
    for (let i = 0; i < count; i++) {
      const k = key(Math.floor(position[i * 3] / cellSize), Math.floor(position[i * 3 + 1] / cellSize), Math.floor(position[i * 3 + 2] / cellSize));
      cellOf[i] = k; next[i] = buckets.get(k) ?? -1; buckets.set(k, i);
    }
    const w = traits.weights, maxSpeed = bodyLength * (.25 + .6 * blend), breathe = 1 + Math.sin(time * .19) * traits.flex.breathe;
    for (let i = 0; i < count; i++) {
      p.fromArray(position, i * 3); v.fromArray(velocity, i * 3);
      sep.set(0, 0, 0); ali.set(0, 0, 0); coh.set(0, 0, 0);
      const found = nearest(i);
      for (let n = 0; n < found; n++) {
        const j = nearIndex[n], d = Math.sqrt(nearDistance[n]);
        q.fromArray(position, j * 3);
        if (d < spacing) sep.add(mid.subVectors(p, q).multiplyScalar((spacing - d) / Math.max(d, 1e-4) / spacing));
        ali.add(mid.fromArray(velocity, j * 3)); coh.add(q);
      }
      force.set(0, 0, 0).addScaledVector(sep, w.separation * bodyLength * 4);
      if (found) {
        force.addScaledVector(ali.divideScalar(found).sub(v), w.alignment);
        force.addScaledVector(coh.divideScalar(found).sub(p), w.cohesion);
      }
      // Soft envelope around a bending, breathing ellipsoid (never a box).
      centre(p.x, mid); q.subVectors(p, mid).divide(radii).divideScalar(breathe);
      const e = q.length();
      if (e > .75) force.addScaledVector(q.normalize().multiply(radii), -w.envelope * (e - .75));
      // Personal wander: smooth, per-fish, small.
      const [wp, wf, wa] = [wander[i * 3], wander[i * 3 + 1], wander[i * 3 + 2]];
      force.x += Math.sin(time * wf + wp) * wa * w.wander * bodyLength;
      force.y += Math.sin(time * wf * 1.3 + wp * 2.1) * wa * .4 * w.wander * bodyLength;
      force.z += Math.cos(time * wf * .8 + wp * 1.7) * wa * w.wander * bodyLength;
      v.addScaledVector(force, dt).multiplyScalar(Math.exp(-.8 * dt));
      if (v.length() > maxSpeed) v.setLength(maxSpeed);
      p.addScaledVector(v, dt);
      // Hard limit keeps the conservative bounds honest.
      centre(p.x, mid); q.subVectors(p, mid).divide(limit);
      if (q.length() > 1) p.copy(q.normalize().multiply(limit).add(mid));
      p.toArray(position, i * 3); v.toArray(velocity, i * 3);
    }
  }
  const h = new Vector3(), look = new Quaternion(), bank = new Quaternion(), axis = new Vector3();
  /** Advance with substeps ≤ 1/60 s. `cruise` is the school's forward speed (m/s). */
  function update(dt: number, blend: number, phaseStep: number) {
    const steps = Math.max(1, Math.ceil(dt / STEP));
    for (let s = 0; s < steps; s++) step(dt / steps, blend);
    const cruise = traits.cruise.slow + (traits.cruise.fast - traits.cruise.slow) * blend;
    for (let i = 0; i < count; i++) {
      phase[i] = (phase[i] + phaseStep * tailRate[i]) % TAU;
      // Each fish faces school travel plus its own relative velocity; lateral drift banks it slightly.
      v.fromArray(velocity, i * 3); h.copy(FORWARD).multiplyScalar(cruise).add(v).normalize();
      look.setFromUnitVectors(FORWARD, h);
      bank.setFromAxisAngle(axis.copy(h), Math.max(-.35, Math.min(.35, -v.z / Math.max(cruise, .05) * .6)));
      look.premultiply(bank).toArray(heading, i * 4);
    }
  }
  const pos = new Vector3(), rot = new Quaternion(), size = new Vector3(), matrix = new Matrix4();
  function pose(i: number, straight: boolean) {
    pos.fromArray(position, i * 3); if (straight) rot.identity(); else rot.fromArray(heading, i * 4);
    return matrix.compose(pos, rot, size.setScalar(scale[i]));
  }
  function remove(index: number, last: number) {
    for (const [array, n] of [[position, 3], [velocity, 3], [heading, 4], [scale, 1], [tailRate, 1], [phase, 1], [wander, 3]] as const)
      array.copyWithin(index * n, last * n, last * n + n);
  }
  /** Conservative local bounds: hard envelope + bending + the largest fish at any heading. */
  function bounds(target: Box3, padding: number) {
    const pad = padding * maxScale;
    const bendY = radii.y * traits.flex.bend * .5, bendZ = radii.z * traits.flex.bend;
    target.min.set(-limit.x - pad, -limit.y - bendY - pad, -limit.z - bendZ - pad);
    target.max.set(limit.x + pad, limit.y + bendY + pad, limit.z + bendZ + pad);
    if (count <= 1) { target.min.setScalar(-pad); target.max.setScalar(pad); }
    return target;
  }
  return { position, velocity, scale, phase, get count() { return count; }, get radii() { return radii; }, reset, update, pose, remove, bounds };
}
