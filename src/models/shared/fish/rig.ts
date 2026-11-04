import { Bone, Group, MathUtils, Mesh, Skeleton, SkinnedMesh } from 'three';
import type { FishLifeState, FishModel, FishMotionOwner, Point3, SwimMode } from '../../types';
import { disposeModelResources, type ModelAssembly } from '../assembly';
import type { FishDesign } from './design';
import { flankAt } from './geometry';
import { poseFish } from './pose';
import { batchFish } from './batches';

/** Merge palette geometry, then use standard GPU skinning. No custom shader or vertex uploads. */
export function finishFish(assembly: ModelAssembly, design: FishDesign, length: number): FishModel {
  batchFish(assembly);
  const { root, visual, parts } = assembly, rig = assembly.addPart('rig');
  function bone(name: string, x: number, y = 0, z = 0, parent: Bone | Group = rig) {
    const node = new Bone(); node.name = name; node.position.set(x * length, y * length, z * length); parent.add(node); return node;
  }
  const head = bone('head', 0), middle = bone('mid-body', .08, 0, 0, head), tail = bone('tail', .25, 0, 0, middle);
  const dorsal = bone('dorsal', ...design.dorsalPivot, 0, head);
  const [px, py] = design.pectoral, pz = flankAt(design.profile, px, py, 1) - .003;
  const near = bone('pectoral-near', px, py, pz, head), far = bone('pectoral-far', px, py, -pz, head);
  const skeleton = new Skeleton([head, middle, tail, dorsal, near, far]);
  const batch = parts.get('surface')!, source = batch.children[0] as Mesh;
  const skin = new SkinnedMesh(source.geometry, source.material); skin.name = `${design.id}:body-and-fins`;
  batch.remove(source); batch.add(skin);
  root.updateMatrixWorld(true); skin.bind(skeleton);
  // Fixed conservative bounds avoid per-frame CPU skinning for culling.
  skin.geometry.computeBoundingBox(); skin.geometry.computeBoundingSphere();
  skin.boundingBox = skin.geometry.boundingBox!.clone().expandByScalar(length * .22);
  skin.boundingSphere = skin.geometry.boundingSphere!.clone(); skin.boundingSphere.radius += length * .22;
  const point = (x: number, y = 0, z = 0): Point3 => [x * length, y * length, z * length];
  const radius = Math.max(...design.profile.map(p => p[2])) * length;
  const physics = {
    colliders: [{ shape: 'capsule' as const, axis: 'x' as const, center: point(-.065), radius, halfLength: Math.max(.1 * length, .43 * length - radius) }],
    centerOfMass: point(-.12), anchors: { mouth: point(-.496, -.004), grip: point(-.12) },
  };
  root.userData = { units: 'metres', lengthMeters: length, sizeBasis: design.sizeBasis, source: design.source, speciesId: design.id, animation: 'six-bone GPU skinning', budget: design.budget };
  let mode: SwimMode = 'slow', lifeState: FishLifeState = 'alive', motionOwner: FishMotionOwner = 'external';
  let phase = 0, blend = 0, activity = 1, disposed = false;
  const m = design.motion;
  function pose() {
    poseFish(skeleton.bones, m, phase, blend, activity, lifeState === 'caught');
  }
  function setSwimMode(next: SwimMode, immediate = false) {
    if (disposed) return;
    if (next !== 'slow' && next !== 'fast') throw new Error(`Unknown swim mode: ${next}`);
    mode = next; if (immediate) blend = next === 'fast' ? 1 : 0; pose();
  }
  function setLifeState(next: FishLifeState) {
    if (disposed) return;
    if (next !== 'alive' && next !== 'caught') throw new Error(`Unknown fish state: ${next}`);
    if (next === lifeState) return;
    lifeState = next; activity = 0;
    parts.get('head-details')!.visible = next === 'alive'; parts.get('caught-details')!.visible = next === 'caught'; pose();
  }
  function setMotionOwner(next: FishMotionOwner) {
    if (disposed) return;
    if (!['external', 'path', 'physics'].includes(next)) throw new Error(`Unknown motion owner: ${next}`);
    motionOwner = next;
  }
  function update(dt: number) {
    if (disposed || lifeState === 'caught' || !Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, .1);
    const target = mode === 'fast' ? 1 : 0, decay = Math.exp(-4 * dt);
    const integratedBlend = target * dt + (blend - target) * (1 - decay) / 4;
    phase = (phase + (m.slowHz * dt + (m.fastHz - m.slowHz) * integratedBlend) * Math.PI * 2) % (Math.PI * 2);
    blend = target + (blend - target) * decay; activity = 1 - (1 - activity) * Math.exp(-6 * dt); pose();
  }
  function dispose() { if (disposed) return; disposed = true; skeleton.dispose(); disposeModelResources(root); parts.clear(); }
  parts.get('caught-details')!.visible = false; pose();
  return { root, visual, parts, physics, update, setSwimMode, setLifeState, setMotionOwner, dispose,
    getState: () => ({ mode, lifeState, motionOwner, disposed, blend, phase, frequency: lifeState === 'caught' ? 0 : MathUtils.lerp(m.slowHz, m.fastHz, blend), finExtension: dorsal.scale.y }) };
}
