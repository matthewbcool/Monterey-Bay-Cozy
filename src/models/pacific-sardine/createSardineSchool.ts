import { Box3, DynamicDrawUsage, Group, InstancedMesh, type Material, MathUtils, Matrix4, Mesh, Sphere, Vector3 } from 'three';
import type { FishModel } from '../types';
import type { FishOptions } from '../shared/fish/design';
import { createFishMaterial } from '../shared/fish/materials';
import { bakeSchoolGeometry, geometryBytes, SCHOOL_POSES_PER_CYCLE } from '../shared/fish/schoolGeometry';
import { createPacificSardineModel } from './createPacificSardineModel';
import { createSchooling } from '../shared/school/schooling';
import { SARDINE, SARDINE_SCHOOLING } from './definition';

export interface SardineSchoolOptions extends FishOptions { count?: number; capacity?: number }
export interface SardineSchool extends Omit<FishModel, 'physics' | 'parts'> {
  readonly capacity: number;
  readonly count: number;
  /** Local extent for camera framing/culling; no individual fish is scaled to fit. */
  readonly bounds: Box3;
  readonly batches: { alive: InstancedMesh; caught: InstancedMesh };
  setCount(count: number): void;
  /** Render slot, not a persistent fish ID. The last slot moves into the removed slot. */
  takeFish(index: number): FishModel;
  /** Uniform size of a render slot relative to the nominal length (fish 0 is 1). */
  sizeAt(index: number): number;
}

/** Shared geometry + per-instance morph weights, one visible draw for the entire school. */
export function createSardineSchool({ count = 48, capacity = 256, lengthMeters = SARDINE.lengthMeters }: SardineSchoolOptions = {}): SardineSchool {
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 256) throw new RangeError('School capacity must be 1–256');
  function validateCount(value: number) {
    if (!Number.isInteger(value) || value < 0 || value > capacity) throw new RangeError(`School count must be 0–${capacity}`);
  }
  validateCount(count);
  const source = createPacificSardineModel({ lengthMeters });
  let geometry: ReturnType<typeof bakeSchoolGeometry>;
  try { geometry = bakeSchoolGeometry(source, SARDINE); } finally { source.dispose(); }
  const material = createFishMaterial(), root = new Group(), visual = new Group();
  root.name = 'pacific-sardine-school'; visual.name = 'school-instances'; root.add(visual);
  const alive = new InstancedMesh(geometry.alive, material, capacity);
  const caught = new InstancedMesh(geometry.caught, material, capacity);
  alive.name = 'sardine-school:swimming'; caught.name = 'sardine-school:caught';
  for (const mesh of [alive, caught]) { mesh.instanceMatrix.setUsage(DynamicDrawUsage); visual.add(mesh); }
  // Initialize the weight texture at full capacity before reducing the draw count.
  const weightCarrier = new Mesh(geometry.alive, material), weights = weightCarrier.morphTargetInfluences!;
  alive.setMorphAt(capacity - 1, weightCarrier);
  // r180's node renderer reads this array for a one-instance draw. Keep slot 0 mirrored.
  alive.morphTargetInfluences = weights;
  material.customProgramCacheKey = () => `sardine-school:${alive.count > 1 ? 'many' : 'one'}`;
  const formation = createSchooling(capacity, lengthMeters, SARDINE_SCHOOLING);
  // Fish turn within the school, so pad every axis by the half-length of the largest fish.
  const bounds = new Box3(), sphere = new Sphere(), padding = lengthMeters * .65;
  const worldMatrix = new Matrix4(), unscale = new Vector3();
  let mode: 'slow' | 'fast' = 'slow', lifeState: 'alive' | 'caught' = 'alive';
  let motionOwner: 'external' | 'path' | 'physics' = 'external', disposed = false, blend = 0, phase = 0;
  const motion = SARDINE.motion, samples = SCHOOL_POSES_PER_CYCLE;
  root.userData = { units: 'metres', speciesId: SARDINE.id, lengthMeters, sizeBasis: SARDINE.sizeBasis, source: SARDINE.source,
    animation: 'instanced shared morph cycles', budget: { drawCalls: 1, trianglesPerFish: (geometry.alive.index?.count??geometry.alive.attributes.position.count)/3, maxCount: 256 },
    sharedGeometryBytes: geometryBytes(geometry.alive) + geometryBytes(geometry.caught), poseSamples: samples * 2 };

  function updateBounds() {
    formation.bounds(bounds, padding);
    if (!count) bounds.set(new Vector3(), new Vector3());
    bounds.getBoundingSphere(sphere);
    for (const mesh of [alive, caught]) { mesh.boundingBox = bounds.clone(); mesh.boundingSphere = sphere.clone(); }
  }
  function pose() {
    const dead = lifeState === 'caught';
    // r180 selects its node morph source at compile time for one vs many instances.
    // Flag the material the meshes actually render, which a node-style renderer may have replaced.
    if ((alive.count > 1) !== (count > 1)) for (const mesh of [alive, caught]) (mesh.material as Material).needsUpdate = true;
    alive.count = caught.count = count; alive.visible = !dead && count > 0; caught.visible = dead && count > 0;
    const mesh = dead ? caught : alive;
    for (let i = count - 1; i >= 0; i--) {
      mesh.setMatrixAt(i, formation.pose(i, dead));
      if (dead) continue;
      const frame = formation.phase[i] / (Math.PI * 2) * samples;
      const first = Math.floor(frame), next = (first + 1) % samples, fraction = frame - first;
      weights.fill(0);
      weights[first] = (1 - fraction) * (1 - blend); weights[next] = fraction * (1 - blend);
      weights[first + samples] = (1 - fraction) * blend; weights[next + samples] = fraction * blend;
      alive.setMorphAt(i, weightCarrier);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (!dead) alive.morphTexture!.needsUpdate = true;
  }
  function setCount(next: number) {
    if (disposed) return; validateCount(next); count = next;
    formation.reset(count); updateBounds(); pose();
  }
  function update(dt: number) {
    if (disposed || lifeState === 'caught' || !count || !Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, .1);
    const target = mode === 'fast' ? 1 : 0, decay = Math.exp(-4 * dt);
    const integratedBlend = target * dt + (blend - target) * (1 - decay) / 4;
    const phaseStep = (motion.slowHz * dt + (motion.fastHz - motion.slowHz) * integratedBlend) * Math.PI * 2;
    phase = (phase + phaseStep) % (Math.PI * 2);
    blend = target + (blend - target) * decay; formation.update(dt, blend, phaseStep); pose();
  }
  function takeFish(index: number) {
    if (disposed) throw new Error('School is disposed');
    if (!Number.isInteger(index) || index < 0 || index >= count) throw new RangeError('Fish slot is outside the school');
    // The individual is rebuilt at its own length; its root keeps the host's scale, not the instance size.
    const size = formation.scale[index], model = createPacificSardineModel({ lengthMeters: lengthMeters * size });
    visual.updateWorldMatrix(true, false);
    (lifeState === 'caught' ? caught : alive).getMatrixAt(index, worldMatrix);
    worldMatrix.premultiply(visual.matrixWorld);
    worldMatrix.decompose(model.root.position, model.root.quaternion, unscale);
    model.root.scale.copy(unscale).divideScalar(size);
    model.setSwimMode(mode, true); model.setLifeState('caught');
    formation.remove(index, count - 1); count--; updateBounds(); pose();
    return model;
  }
  function dispose() {
    if (disposed) return; disposed = true;
    alive.dispose(); caught.dispose(); geometry.alive.dispose(); geometry.caught.dispose();
    new Set<Material>([material, alive.material as Material, caught.material as Material]).forEach(m => m.dispose()); root.removeFromParent();
  }
  setCount(count);
  return { root, visual, bounds, batches: { alive, caught }, capacity, get count() { return count; }, setCount, update, takeFish, dispose,
    sizeAt: (index: number) => formation.scale[index],
    setSwimMode(next, immediate = false) { if (disposed) return; if (next !== 'slow' && next !== 'fast') throw new Error(`Unknown swim mode: ${next}`); mode = next; if (immediate) blend = next === 'fast' ? 1 : 0; pose(); },
    setLifeState(next) { if (disposed) return; if (next !== 'alive' && next !== 'caught') throw new Error(`Unknown fish state: ${next}`); lifeState = next; pose(); },
    setMotionOwner(next) { if (disposed) return; if (!['external', 'path', 'physics'].includes(next)) throw new Error(`Unknown motion owner: ${next}`); motionOwner = next; },
    getState: () => ({ mode, lifeState, motionOwner, disposed, blend, phase, frequency: lifeState === 'caught' ? 0 : MathUtils.lerp(motion.slowHz, motion.fastHz, blend), finExtension: lifeState === 'caught' ? .88 : MathUtils.lerp(1, motion.fastDorsal, blend) }),
  };
}
