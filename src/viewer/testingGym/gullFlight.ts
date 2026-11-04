/** Seeded coastal flight, independent of frame rate, visibility and mesh LOD.
 * Each bird follows its own slowly changing circuit. Metre-space envelopes stay
 * inside broad coastal cells spanning land and water. */
import type { Vector3 } from 'three';
import { mulberry32 } from '../../models/shared/random';

interface GullFlightOptions {
  center: Vector3;
  tangent: Vector3;
  normal: Vector3;
  surfaceY: number;
  altitude: number;
  seed: number;
  count: number;
}

interface GullFlightMember {
  seed: number;
  /** Authored ambient pace, not a measured species flight-speed average. */
  speed: number;
  phase: number;
  direction: number;
  alongRadius: number;
  acrossRadius: number;
  altitudeOffset: number;
  circuitSeconds: number;
}

export const GULL_FLIGHT_ENVELOPE = Object.freeze({ along: 103, across: 53 });

const TAU = Math.PI * 2, ARC_SEGMENTS = 256, END_ROUNDING = Math.tanh(3);

export function createGullFlightRoutes({ center, tangent, normal, surfaceY, altitude, seed, count }: GullFlightOptions) {
  if (!Number.isInteger(count) || count < 1) throw new RangeError('Gull flight routes need a positive bird count');
  // Copy the coordinate frame: caller transforms and inspection cannot change
  // the canonical route after construction. Tangent/normal are unit XZ axes.
  const cx = center.x, cz = center.z, tx = tangent.x, tz = tangent.z, nx = normal.x, nz = normal.z;
  const routes = Array.from({ length: count }, (_, slot) => {
    const memberSeed = (seed + Math.imul(slot + 1, 0x9e3779b9)) >>> 0, random = mulberry32(memberSeed);
    const member: GullFlightMember = {
      seed: memberSeed, speed: 3.2 + random() * .65, phase: random(), direction: random() > .5 ? 1 : -1,
      alongRadius: 65 + random() * 25, acrossRadius: 30 + random() * 15,
      altitudeOffset: (random() - .5) * 3.6, circuitSeconds: 0,
    };
    const alongHarmonic = 1 + random() * 2, acrossHarmonic = .5 + random() * 1.5;
    const phaseA = random() * TAU, phaseN = random() * TAU, phaseY = random() * TAU;
    const morphA = .017 + random() * .012, morphN = .022 + random() * .014;
    const paceFrequency = .035 + random() * .02, heightFrequency = .065 + random() * .035;
    // One small, immutable distance table per bird; no curve objects or sampled
    // waypoints are allocated in the animation loop.
    const arc = new Float64Array(ARC_SEGMENTS + 1);
    let previousA = alongHarmonic * Math.sin(phaseA), previousN = member.acrossRadius + acrossHarmonic * Math.sin(phaseN);
    for (let i = 1; i <= ARC_SEGMENTS; i++) {
      const theta = i / ARC_SEGMENTS * TAU;
      const sine = Math.sin(theta);
      const a = (member.alongRadius - member.acrossRadius) * Math.tanh(3 * sine) / END_ROUNDING + member.acrossRadius * sine + alongHarmonic * Math.sin(theta * 2 + phaseA);
      const n = member.acrossRadius * Math.cos(theta) + acrossHarmonic * Math.sin(theta * 3 + phaseN);
      arc[i] = arc[i - 1] + Math.hypot(a - previousA, n - previousN); previousA = a; previousN = n;
    }
    member.circuitSeconds = arc[ARC_SEGMENTS] / member.speed;
    return { member: Object.freeze(member), arc, length: arc[ARC_SEGMENTS], alongHarmonic, acrossHarmonic, phaseA, phaseN, phaseY, morphA, morphN, paceFrequency, heightFrequency };
  });
  const members = Object.freeze(routes.map(route => route.member));
  return {
    members,
    /** Includes shape morphs and drift, excludes the bird's own wing envelope. */
    envelope: Object.freeze({ ...GULL_FLIGHT_ENVELOPE, minAltitude: surfaceY + altitude - 3.45, maxAltitude: surfaceY + altitude + 3.45 }),
    /** Writes world position and unit travel direction into caller-owned scratch
     * vectors. Arbitrary time seeks produce the same pose, including after sleep. */
    sample(slot: number, time: number, positionOut: Vector3, directionOut: Vector3): number {
      const route = routes[slot];
      if (!route || !Number.isFinite(time)) throw new RangeError('Invalid gull flight slot or time');
      const { member: m, arc, length, alongHarmonic: ha, acrossHarmonic: hn, phaseA: pa, phaseN: pn, phaseY: py, morphA: fa, morphN: fn, paceFrequency: fp, heightFrequency: fy } = route;
      const pacePhase = fp * time + pn;
      const distance = m.phase * length + m.direction * m.speed * (time + .04 / fp * (Math.cos(pn) - Math.cos(pacePhase)));
      const wrapped = ((distance % length) + length) % length;
      let low = 0, high = ARC_SEGMENTS;
      while (high - low > 1) { const middle = (low + high) >>> 1; if (arc[middle] <= wrapped) low = middle; else high = middle; }
      const theta = (low + (wrapped - arc[low]) / (arc[high] - arc[low])) / ARC_SEGMENTS * TAU;
      const sin = Math.sin(theta), cos = Math.cos(theta), sinA = Math.sin(theta * 2 + pa), cosA = Math.cos(theta * 2 + pa), sinN = Math.sin(theta * 3 + pn), cosN = Math.cos(theta * 3 + pn);
      // Rounded ends approximate broad semicircles with smooth joins. A plain
      // thin ellipse would force a fast, mechanical hairpin at each end.
      const rounded = Math.tanh(3 * sin), roundedSlope = 1 - rounded * rounded, straight = m.alongRadius - m.acrossRadius;
      const alongSlope = straight * 3 * roundedSlope / END_ROUNDING + m.acrossRadius;
      const a = straight * rounded / END_ROUNDING + m.acrossRadius * sin + ha * sinA, n = m.acrossRadius * cos + hn * sinN;
      const da = alongSlope * cos + 2 * ha * cosA, dn = -m.acrossRadius * sin + 3 * hn * cosN;
      const dda = -alongSlope * sin - 18 * straight * roundedSlope * rounded / END_ROUNDING * cos * cos - 4 * ha * sinA, ddn = -m.acrossRadius * cos - 9 * hn * sinN;
      const speed = m.speed * (1 + .04 * Math.sin(pacePhase)), acceleration = m.speed * .04 * fp * Math.cos(pacePhase), baseSpeed = Math.hypot(da, dn);
      const thetaRate = m.direction * speed / baseSpeed;
      const thetaAcceleration = m.direction * acceleration / baseSpeed - speed * speed * (da * dda + dn * ddn) / (baseSpeed ** 4);
      const scaleA = 1 + .04 * Math.sin(fa * time + pa), scaleN = 1 + .06 * Math.sin(fn * time + pn);
      const rateA = .04 * fa * Math.cos(fa * time + pa), rateN = .06 * fn * Math.cos(fn * time + pn);
      const accelA = -.04 * fa * fa * Math.sin(fa * time + pa), accelN = -.06 * fn * fn * Math.sin(fn * time + pn);
      const along = a * scaleA + 6 * Math.sin(.037 * time + pa) + 3 * Math.sin(.021 * time + pn);
      const across = n * scaleN + 2.5 * Math.sin(.031 * time + pn) + 1.5 * Math.sin(.019 * time + pa);
      const alongRate = da * thetaRate * scaleA + a * rateA +  .222 * Math.cos(.037 * time + pa) + .063 * Math.cos(.021 * time + pn);
      const acrossRate = dn * thetaRate * scaleN + n * rateN + .0775 * Math.cos(.031 * time + pn) + .0285 * Math.cos(.019 * time + pa);
      const alongAccel = (dda * thetaRate * thetaRate + da * thetaAcceleration) * scaleA + 2 * da * thetaRate * rateA + a * accelA - .008214 * Math.sin(.037 * time + pa) - .001323 * Math.sin(.021 * time + pn);
      const acrossAccel = (ddn * thetaRate * thetaRate + dn * thetaAcceleration) * scaleN + 2 * dn * thetaRate * rateN + n * accelN - .0024025 * Math.sin(.031 * time + pn) - .0005415 * Math.sin(.019 * time + pa);
      const y = surfaceY + altitude + m.altitudeOffset + 1.2 * Math.sin(fy * time + py) + .45 * sin;
      const yRate = 1.2 * fy * Math.cos(fy * time + py) + .45 * cos * thetaRate;
      positionOut.set(cx + tx * along + nx * across, y, cz + tz * along + nz * across);
      const vx = tx * alongRate + nx * acrossRate, vz = tz * alongRate + nz * acrossRate;
      directionOut.set(vx, yRate, vz).normalize();
      const ax = tx * alongAccel + nx * acrossAccel, az = tz * alongAccel + nz * acrossAccel;
      // Bank into the turn without wobbling the silhouette; 20 degrees is enough
      // to read in the game while keeping tight cell-end turns visually gentle.
      return Math.max(-.35, Math.min(.35, Math.atan2(vz * ax - vx * az, 9.81 * Math.hypot(vx, vz))));
    },
  };
}
