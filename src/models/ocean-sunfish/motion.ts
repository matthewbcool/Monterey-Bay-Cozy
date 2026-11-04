import { Bone, MathUtils, Mesh, Skeleton, SkinnedMesh } from 'three';
import type { FishLifeState, FishModel, FishMotionOwner, Point3, SwimMode } from '../types';
import { disposeModelResources, type ModelAssembly } from '../shared/assembly';
import { batchFish } from '../shared/fish/batches';
import { flankAt } from '../shared/fish/geometry';
import { SUNFISH as S } from './definition';

/** Rigid body; dorsal/anal hydrofoils supply the stroke. The clavus is a small rudder. */
export function finishSunfish(a: ModelAssembly, length: number): FishModel {
  batchFish(a);
  const { root, visual, parts } = a, rig = a.addPart('rig');
  function bone(name: string, position: Point3, parent: Bone | typeof rig = rig) {
    const b = new Bone(); b.name = name; b.position.set(...position).multiplyScalar(length); parent.add(b); return b;
  }
  const body = bone('body', [0, 0, 0]), dorsal = bone('dorsal', S.dorsalPivot, body), anal = bone('anal', S.analPivot, body), clavus = bone('clavus', S.clavusPivot, body);
  const [px, py] = S.pectoral, pz = flankAt(S.profile, px, py, 1) - .005;
  const near = bone('pectoral-near', [px, py, pz], body), far = bone('pectoral-far', [px, py, -pz], body);
  const skeleton = new Skeleton([body, dorsal, anal, clavus, near, far]);
  const batch = parts.get('surface')!, source = batch.children[0] as Mesh;
  const skin = new SkinnedMesh(source.geometry, source.material); skin.name = 'ocean-sunfish:body-and-fins'; batch.remove(source); batch.add(skin);
  root.updateMatrixWorld(true); skin.bind(skeleton);
  skin.geometry.computeBoundingBox(); skin.geometry.computeBoundingSphere();
  skin.boundingBox = skin.geometry.boundingBox!.clone().expandByScalar(length * .25);
  skin.boundingSphere = skin.geometry.boundingSphere!.clone(); skin.boundingSphere.radius += length * .25;
  const point = (x: number, y = 0, z = 0): Point3 => [x * length, y * length, z * length];
  const physics = {
    // Three thin capsules approximate the deep disc without a single over-wide sphere.
    colliders: [
      { shape: 'capsule' as const, axis: 'x' as const, center: point(-.08), radius: .115 * length, halfLength: .30 * length },
      { shape: 'capsule' as const, axis: 'x' as const, center: point(-.07, .225), radius: .10 * length, halfLength: .16 * length },
      { shape: 'capsule' as const, axis: 'x' as const, center: point(-.095, -.225), radius: .10 * length, halfLength: .17 * length },
    ], centerOfMass: point(-.10), anchors: { mouth: point(-.50, -.008), grip: point(-.13, -.06) },
  };
  root.userData = { units: 'metres', speciesId: S.id, lengthMeters: length, sizeBasis: S.sizeBasis, source: S.source, motionSource: S.motionSource,
    inspectionSizeMeters: [length, length * 1.516, length * .45], animation: 'six-bone GPU fin propulsion', budget: S.budget };
  let mode: SwimMode = 'slow', lifeState: FishLifeState = 'alive', motionOwner: FishMotionOwner = 'external', disposed = false;
  let phase = 0, blend = 0, activity = 1;
  function pose() {
    const stroke = Math.sin(phase) * MathUtils.lerp(S.motion.slowStroke, S.motion.fastStroke, blend) * activity;
    const feather = Math.cos(phase) * MathUtils.lerp(S.motion.slowFeather, S.motion.fastFeather, blend) * activity;
    // Mirrored hinges give synchronous lateral strokes on the two opposite fins.
    dorsal.rotation.set(stroke, feather, 0); anal.rotation.set(-stroke, -feather, 0);
    clavus.rotation.y = Math.sin(phase * 2) * .035 * activity;
    const opening = lifeState === 'caught' ? .10 : MathUtils.lerp(.40, .18, blend);
    near.rotation.y = -opening; far.rotation.y = opening;
    near.rotation.x = Math.sin(phase) * .06 * activity; far.rotation.x = -near.rotation.x;
  }
  function setLifeState(next: FishLifeState) {
    if (disposed) return; if (next !== 'alive' && next !== 'caught') throw new Error(`Unknown fish state: ${next}`);
    if (next === lifeState) return;
    lifeState = next; activity = 0; parts.get('head-details')!.visible = next === 'alive'; parts.get('caught-details')!.visible = next === 'caught'; pose();
  }
  function update(dt: number) {
    if (disposed || lifeState === 'caught' || !Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, .1);
    const target = mode === 'fast' ? 1 : 0, decay = Math.exp(-4 * dt), integral = target * dt + (blend - target) * (1 - decay) / 4;
    phase = (phase + (S.motion.slowHz * dt + (S.motion.fastHz - S.motion.slowHz) * integral) * Math.PI * 2) % (Math.PI * 2);
    blend = target + (blend - target) * decay; activity = 1 - (1 - activity) * Math.exp(-6 * dt); pose();
  }
  parts.get('caught-details')!.visible = false; pose();
  return { root, visual, parts, physics, update, setLifeState,
    setSwimMode(next, immediate = false) { if (disposed) return; if (next !== 'slow' && next !== 'fast') throw new Error(`Unknown swim mode: ${next}`); mode = next; if (immediate) blend = next === 'fast' ? 1 : 0; pose(); },
    setMotionOwner(next) { if (disposed) return; if (!['external', 'path', 'physics'].includes(next)) throw new Error(`Unknown motion owner: ${next}`); motionOwner = next; },
    getState: () => ({ mode, lifeState, motionOwner, disposed, phase, blend, frequency: lifeState === 'caught' ? 0 : MathUtils.lerp(S.motion.slowHz, S.motion.fastHz, blend), finExtension: 1 }),
    dispose() { if (disposed) return; disposed = true; skeleton.dispose(); disposeModelResources(root); parts.clear(); },
  };
}
