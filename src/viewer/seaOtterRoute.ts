import { CatmullRomCurve3, Euler, MathUtils, Vector3 } from 'three';
import { getSeaOtterModel } from '../models/sea-otter/createSeaOtterModel';
import type { FishModel } from '../models/types';
import type { SeaOtterPose } from '../models/habitat/sea-otter/definition';
import type { DemoHabitat } from './demoRoute';

export type SeaOtterActivity = 'cycle' | 'surface' | 'swim';
export type SeaOtterRouteStage = 'float' | 'groom' | 'dive' | 'swim' | 'resurface';
/** Exhibit choreography, not measured behavioral time budgets or swimming speeds. */
export const SEA_OTTER_CYCLE = { seconds: 100, surfaceSeconds: 70, diveEnd: 76, swimEnd: 92 } as const;
const smooth = (value: number) => { const t = MathUtils.clamp(value, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
type RouteModel = Pick<FishModel, 'root' | 'getState' | 'setMotionOwner'>;
export interface SeaOtterRouteOptions {
  tankSize: { readonly width: number; readonly height: number; readonly depth: number };
  index?: number; radius?: number; habitat?: DemoHabitat; start?: number;
  speed?: { readonly slow: number; readonly fast: number };
}

/** Shared Tank/Demo placement owner: root waterline rests on the real surface,
 * with room for exposed head/feet but full horizontal and bottom clearance. */
export function createSeaOtterRoute(model: RouteModel, options: SeaOtterRouteOptions) {
  const otter = getSeaOtterModel(model.root);
  if (!otter) throw new TypeError('The surface route requires a sea otter adapter');
  const { tankSize, index = 0 } = options;
  const radius = options.radius ?? model.root.userData.lengthMeters * .9 + .08;
  if (![tankSize.width, tankSize.height, tankSize.depth, radius].every(n => Number.isFinite(n) && n > 0)) throw new RangeError('Invalid sea otter tank dimensions');
  const waterline = tankSize.height / 2, envelope = new Vector3(radius, radius, radius), envelopeCenter = new Vector3();
  const clearanceX = tankSize.width / 2 - radius - .25, clearanceZ = tankSize.depth / 2 - radius - .25;
  const maxSafeDepth = tankSize.height - radius - .25, maxDepth = Math.min(2.4, maxSafeDepth);
  if (clearanceX <= 0 || clearanceZ <= 0 || maxDepth <= radius) throw new RangeError('Sea otter does not fit the tank');
  const habitat = options.habitat ?? { level: waterline, wave: 0, width: .78, depth: .72 };
  if (![habitat.width, habitat.depth].every(n => Number.isFinite(n) && n > 0 && n <= 1)
    || ![habitat.centerX ?? 0, habitat.centerZ ?? 0].every(n => Number.isFinite(n) && Math.abs(n) < 1)) throw new RangeError('Invalid sea otter habitat');
  const speed = options.speed ?? { slow: .055, fast: .65 };
  if (![speed.slow, speed.fast].every(n => Number.isFinite(n) && n >= 0)) throw new RangeError('Invalid sea otter travel speed');
  const cx = clearanceX * (habitat.centerX ?? 0), cz = clearanceZ * (habitat.centerZ ?? 0);
  const rx = (clearanceX - Math.abs(cx)) * habitat.width, rz = (clearanceZ - Math.abs(cz)) * habitat.depth;
  const reverse = index % 3 === 1 ? -1 : 1;
  const curve = new CatmullRomCurve3(Array.from({ length: 24 }, (_, i) => {
    const a = i / 24 * Math.PI * 2 * reverse;
    return new Vector3(cx + Math.cos(a) * rx, waterline, cz + Math.sin(a) * rz);
  }), true, 'centripetal');
  curve.arcLengthDivisions = 512;
  const length = curve.getLength();
  let distance = MathUtils.euclideanModulo(options.start ?? (.15 + index * .61803398875), 1) * length;
  let time = 0, depth = 0, activity: SeaOtterActivity = 'cycle', stage: SeaOtterRouteStage = 'float';
  let transitionTime = 4, transitionDepth = 0, lastPose: SeaOtterPose | undefined;
  const position = new Vector3(), tangent = new Vector3(), rotation = new Euler(0, 0, 0, 'YZX');
  const mayPlace = () => { const s = model.getState(); return !s.disposed && s.lifeState === 'alive' && s.motionOwner === 'path'; };
  function profile() {
    const cycle = MathUtils.euclideanModulo(time, SEA_OTTER_CYCLE.seconds);
    if (activity === 'surface') { stage = cycle % 45 < 30 ? 'float' : 'groom'; return 0; }
    if (activity === 'swim') { stage = 'swim'; return maxDepth; }
    if (cycle < 45) { stage = 'float'; return 0; }
    if (cycle < 70) { stage = 'groom'; return 0; }
    if (cycle < 76) { stage = 'dive'; return maxDepth * smooth((cycle - 70) / 6); }
    if (cycle < 92) { stage = 'swim'; return maxDepth; }
    stage = 'resurface'; return maxDepth * (1 - smooth((cycle - 92) / 8));
  }
  function apply() {
    curve.getPointAt(distance / length, position); curve.getTangentAt(distance / length, tangent).normalize();
    position.y = waterline - depth;
    rotation.set(0, Math.atan2(tangent.z, -tangent.x), 0, 'YZX');
    model.root.position.copy(position); model.root.rotation.copy(rotation);
    // Local rig owns pitch/roll. Turn belly-up before reaching the surface.
    const pose: SeaOtterPose = stage === 'resurface' ? (depth < maxDepth * .65 ? 'float' : 'swim') : stage;
    if (pose !== lastPose) { otter!.setOtterPose(pose, pose === 'dive' ? 1.1 : 2.4); lastPose = pose; }
  }
  const initial = model.getState();
  if (!initial.disposed && initial.lifeState === 'alive' && initial.motionOwner !== 'physics') { model.setMotionOwner('path'); apply(); }
  return {
    curve, length, radius, envelope, envelopeCenter, habitat, surfaceAware: true as const,
    surfaceEnvelope: { waterline, aboveSurfaceMeters: radius, belowSurfaceMeters: radius, maximumRootDepth: maxSafeDepth, cruiseRootDepth: maxDepth },
    update(dt: number, _blend = 0) {
      if (!mayPlace() || !Number.isFinite(dt) || dt <= 0) return;
      const step = Math.min(dt, .1), priorDepth = depth; time += step; transitionTime += step;
      depth = MathUtils.lerp(transitionDepth, profile(), smooth(transitionTime / 4));
      const submerged = MathUtils.clamp((depth + priorDepth) / (2 * maxDepth), 0, 1);
      distance = MathUtils.euclideanModulo(distance + step * MathUtils.lerp(speed.slow, speed.fast, submerged), length); apply();
    },
    /** Activity changes blend depth and roll without immediately moving a root. */
    setActivity(next: SeaOtterActivity) {
      if (!['cycle', 'surface', 'swim'].includes(next)) throw new RangeError('Unknown sea otter activity');
      if (model.getState().disposed || next === activity) return;
      activity = next; transitionDepth = depth; transitionTime = 0;
      if (next === 'cycle') time = depth > maxDepth / 2 ? 80 : 0;
    },
    getActivity: () => activity,
    getPhase: () => ({ stage, time, cycleTime: MathUtils.euclideanModulo(time, SEA_OTTER_CYCLE.seconds), depth }),
    getDistance: () => distance,
    resume() {
      const state = model.getState(); if (state.disposed || state.lifeState !== 'alive' || state.motionOwner === 'physics') return;
      // Explicit host re-acquisition: recover nearest lane and preserve height.
      let best = Infinity, nearest = distance;
      for (let i = 0; i < 512; i++) {
        curve.getPointAt(i / 512, position);
        const d = (position.x - model.root.position.x) ** 2 + (position.z - model.root.position.z) ** 2;
        if (d < best) { best = d; nearest = i / 512 * length; }
      }
      // An externally placed animal can be deeper than the authored cruise.
      // Preserve that safe height while blending toward the activity target.
      distance = nearest; depth = MathUtils.clamp(waterline - model.root.position.y, 0, maxSafeDepth);
      transitionDepth = depth; transitionTime = 0; model.setMotionOwner('path'); apply();
    },
  };
}
