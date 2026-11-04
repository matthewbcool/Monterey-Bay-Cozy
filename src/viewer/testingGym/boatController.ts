import { Group, Vector3 } from 'three';
import { insidePolygon, type GymPoint } from '../avatarController';
import { sampleWater } from '../water';

/** Authored mooring and landing positions in the gym's metre grid. */
export const GYM_BOAT_BERTH = { x: 77.3, z: -28, yaw: 0, landingX: 74, landingZ: -28 } as const;
export const GYM_BOAT_MOTION = { cruise: 2.2, fast: 3.2, reverse: 1, turn: 1.05, clearance: .35 } as const;

type BoatInput = { throttle: number; steer: number; fast: boolean };
type BoatMotion = { cruise: number; fast: number; reverse: number; turn: number; clearance: number };
type BoatBerth = { x: number; z: number; yaw: number; landingX: number; landingZ: number };
/** Plan-view circles; callers may move them every frame (another boat, a moving hull). */
export type BoatObstacle = { x: number; z: number; radius: number };
const HULL_SAMPLES: readonly GymPoint[] = [
  [0, 0], [-.72, 0], [.72, 0],
  [-.7, -1.8], [.7, -1.8], [-.7, 1.8], [.7, 1.8],
  [0, -1.95], [0, 1.95],
];

function distanceToSegment(x: number, z: number, a: GymPoint, b: GymPoint) {
  const dx = b[0] - a[0], dz = b[1] - a[1], length2 = dx * dx + dz * dz;
  const t = length2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / length2)) : 0;
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
}

/** Small kinematic boat controller (rowboat by default; the dive boat passes its own hull,
 * berth and motion). The placement root owns travel; the visual child owns wave tilt, so a
 * future physics pose can replace the travel controller. */
export function createGymBoatController({ root, visual, coast, land, waterX, waterZ, waterY, obstacles = [],
  berth = GYM_BOAT_BERTH, motion = GYM_BOAT_MOTION, hull = HULL_SAMPLES, tilt = .55, dockRadius = 3.5 }: {
  root: Group; visual: Group; coast: readonly GymPoint[]; land: readonly GymPoint[];
  waterX: number; waterZ: number; waterY: number;
  /** Other hulls in the water, as plan-view circles read on every check. */
  obstacles?: readonly BoatObstacle[];
  berth?: BoatBerth; motion?: BoatMotion; hull?: readonly GymPoint[];
  /** Fraction of the wave slope applied as pitch/roll; heavier hulls tilt less. */
  tilt?: number; dockRadius?: number;
}) {
  let speed = 0, surfaceHeight = 0;
  function canFloatAt(x: number, z: number, yaw: number) {
    if (!Number.isFinite(x + z + yaw)) return false;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (const [localX, localZ] of hull) {
      const px = x + c * localX + s * localZ, pz = z - s * localX + c * localZ;
      if (px < -120 || px > 320 || pz < -230 || pz > 140 || insidePolygon(px, pz, land)) return false;
      for (const o of obstacles) if (Math.hypot(px - o.x, pz - o.z) < o.radius + motion.clearance) return false;
      for (let i = 1; i < coast.length; i++)
        if (distanceToSegment(px, pz, coast[i - 1], coast[i]) < motion.clearance) return false;
    }
    return true;
  }
  function syncSurface(time: number) {
    if (!Number.isFinite(time)) return;
    const wave = sampleWater(root.position.x - waterX, root.position.z - waterZ, time);
    surfaceHeight = wave.height;
    visual.position.y = surfaceHeight;
    const c = Math.cos(root.rotation.y), s = Math.sin(root.rotation.y);
    visual.rotation.x = Math.atan(wave.dx * s + wave.dz * c) * tilt;
    visual.rotation.z = -Math.atan(wave.dx * c - wave.dz * s) * tilt;
  }
  function reset() {
    root.position.set(berth.x, waterY, berth.z);
    root.rotation.set(0, berth.yaw, 0);
    speed = 0; syncSurface(0);
  }
  function update(dt: number, input: BoatInput) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, .05);
    const throttle = Math.max(-1, Math.min(1, Number.isFinite(input.throttle) ? input.throttle : 0));
    const steer = Math.max(-1, Math.min(1, Number.isFinite(input.steer) ? input.steer : 0));
    const target = throttle >= 0 ? throttle * (input.fast ? motion.fast : motion.cruise) : throttle * motion.reverse;
    speed += (target - speed) * (1 - Math.exp(-2.8 * dt));
    if (Math.abs(speed) < .002) speed = 0;
    const nextYaw = root.rotation.y + steer * motion.turn * dt * Math.max(.3, Math.min(1, Math.abs(speed) / 1.2));
    if (canFloatAt(root.position.x, root.position.z, nextYaw)) root.rotation.y = nextYaw;
    const steps = Math.max(1, Math.ceil(Math.abs(speed * dt) / .2));
    for (let i = 0; i < steps; i++) {
      const nextX = root.position.x + Math.sin(root.rotation.y) * speed * dt / steps;
      const nextZ = root.position.z + Math.cos(root.rotation.y) * speed * dt / steps;
      if (!canFloatAt(nextX, nextZ, root.rotation.y)) { speed = 0; break; }
      root.position.x = nextX; root.position.z = nextZ;
    }
  }
  function seatPose(out: Vector3) {
    out.set(root.position.x - Math.sin(root.rotation.y) * .25,
      waterY + surfaceHeight + .03,
      root.position.z - Math.cos(root.rotation.y) * .25);
    return out;
  }
  reset();
  return { root, visual, reset, update, syncSurface, seatPose, canFloatAt,
    landingX: berth.landingX, landingZ: berth.landingZ,
    nearDock() { return Math.hypot(root.position.x - berth.x, root.position.z - berth.z) < dockRadius; },
    get speed() { return speed; }, get heading() { return root.rotation.y; }, get surfaceHeight() { return surfaceHeight; },
  };
}
