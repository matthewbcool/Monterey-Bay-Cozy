import { Group, MathUtils } from 'three';
import { createSeaOtter, type SeaOtterOptions, type SeaOtterPose } from '../habitat/sea-otter/createSeaOtter';
import { seaOtterStrokeRate } from '../habitat/sea-otter/motion';
import type { FishLifeState, FishModel, FishMotionOwner, FishPhysicsDescriptor, Point3, SwimMode } from '../types';
import { createCaughtOtterEyes } from './caughtEyes';

const models = new WeakMap<Group, SeaOtterFishModel>();
const fishPoint = (point: readonly number[]): Point3 => [point[2], point[1], -point[0]];

/** Tank lifecycle adapter around the same habitat asset. Rotation converts the
 * habitat's −Z nose to the collection's −X nose without rescaling either rig. */
export function createSeaOtterModel(options: SeaOtterOptions = {}) {
  const otter = createSeaOtter(options), visual = otter.root, root = new Group();
  root.name = 'southern-sea-otter'; visual.rotation.y = Math.PI / 2; root.add(visual);
  let caught: Group;
  try { caught = createCaughtOtterEyes(otter); } catch (error) { otter.dispose(); throw error; }
  const parts = new Map([['body', visual], ['caught-details', caught]]);
  const capsule = otter.physics.colliders[0];
  const physics: FishPhysicsDescriptor = {
    colliders: [{ shape: 'capsule', axis: 'x', center: fishPoint(capsule.center), radius: capsule.radius, halfLength: capsule.halfLength }],
    centerOfMass: [0, 0, 0], anchors: { mouth: fishPoint(otter.physics.anchors.mouth), grip: fishPoint(otter.physics.anchors.chest) },
  };
  root.userData = { ...visual.userData, speciesId: 'southern-sea-otter', locomotion: 'surface-otter', physics, budget: { ...visual.userData.budget, drawCalls: 2 },
    waterlineMeters: 0, followDirection: [.20, .65, 1], inspectionHeadingRadians: 0,
    inspectionSizeMeters: [otter.dimensions.lengthMeters, otter.dimensions.heightMeters, otter.dimensions.widthMeters],
    caughtAppearance: 'Frozen pose with two head-bound X eyes; host owns capture placement.' };
  let mode: SwimMode = 'slow', lifeState: FishLifeState = 'alive', motionOwner: FishMotionOwner = 'external', blend = 0, disposed = false;
  const model = {
    root, visual, parts, physics,
    update(dt: number) {
      if (disposed || lifeState !== 'alive' || !Number.isFinite(dt) || dt <= 0) return;
      dt = Math.min(dt, .1); blend = MathUtils.damp(blend, mode === 'fast' ? 1 : 0, 4, dt);
      otter.update(dt, { speed: MathUtils.lerp(.35, 1.25, blend) });
    },
    setSwimMode(next: SwimMode, immediate = false) {
      if (disposed) return; if (next !== 'slow' && next !== 'fast') throw new RangeError('Unknown swim mode');
      mode = next; if (immediate) blend = next === 'fast' ? 1 : 0;
    },
    setLifeState(next: FishLifeState) {
      if (disposed) return; if (next !== 'alive' && next !== 'caught') throw new RangeError('Unknown life state');
      lifeState = next; caught.visible = next === 'caught';
    },
    setMotionOwner(next: FishMotionOwner) {
      if (disposed) return; if (!['external', 'path', 'physics'].includes(next)) throw new RangeError('Unknown motion owner'); motionOwner = next;
    },
    setOtterPose(pose: SeaOtterPose, transitionSeconds = .8) { if (!disposed && lifeState === 'alive') otter.setPose(pose, transitionSeconds); },
    getOtterPose: () => otter.pose,
    getState: () => ({ mode, lifeState, motionOwner, disposed, blend, phase: otter.strokePhase * Math.PI * 2,
      frequency: lifeState === 'caught' ? 0 : seaOtterStrokeRate(MathUtils.lerp(.35, 1.25, blend)), finExtension: 1 }),
    dispose() { if (disposed) return; otter.dispose(); root.removeFromParent(); parts.clear(); },
  } satisfies FishModel & { setOtterPose(pose: SeaOtterPose, transitionSeconds?: number): void; getOtterPose(): SeaOtterPose };
  otter.mesh.geometry.addEventListener('dispose', () => { disposed = true; models.delete(root); });
  models.set(root, model); return model;
}
export type SeaOtterFishModel = ReturnType<typeof createSeaOtterModel>;
export const getSeaOtterModel = (root: Group) => models.get(root);
