import { Bone, Box3, Group, Quaternion, Skeleton, SkinnedMesh, Sphere, Vector3 } from 'three';
import { createToonMaterial } from '../../shared/style';
import { defineGeometryLods } from '../../shared/lod/geometry';
import { disposeObject } from '../../props/primitives';
import { DEER, DEER_BONE_NAMES, DEER_PARENTS, DEER_POSES, deerDimensions, deerPivots, type DeerPose, type DeerVariant } from './definition';
import { buildDeerGeometry } from './geometry';
import { applyDeerPose, deerStride, type DeerPoseOptions } from './motion';

export interface DeerOptions { variant?: DeerVariant; seed?: number; pose?: DeerPose }
export interface DeerUpdateOptions extends DeerPoseOptions { reducedMotion?: boolean }
const models = new WeakMap<Group, DeerModel>();
const validPose = (pose: DeerPose) => { if (!DEER_POSES.includes(pose)) throw new RangeError('Unknown deer pose'); };

export function createDeer({ variant = 'adult', seed = Math.floor(Math.random() * 2 ** 32), pose = 'idle' }: DeerOptions = {}) {
  const dimensions = deerDimensions(variant); validPose(pose);
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('Deer seed must be uint32');
  const root = new Group(); root.name = variant === 'fawn' ? 'Black-tailed deer · spotted fawn' : 'Black-tailed deer · adult doe';
  const geometry = buildDeerGeometry(variant, seed, 'near');
  defineGeometryLods(geometry, () => ({ mid: buildDeerGeometry(variant, seed, 'mid'), far: buildDeerGeometry(variant, seed, 'far') }));
  const mesh = new SkinnedMesh(geometry, createToonMaterial({ vertexColors: true, rim: false, name: 'black-tailed-deer-matte' }));
  mesh.name = 'deer-one-skinned-batch'; mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
  const pivots = deerPivots(variant), bones = DEER_BONE_NAMES.map((name, i) => { const b = new Bone(); b.name = 'deer-' + name; b.position.copy(pivots[i]); if (DEER_PARENTS[i] >= 0) b.position.sub(pivots[DEER_PARENTS[i]]); return b; });
  bones.forEach((b, i) => { if (i) bones[DEER_PARENTS[i]].add(b); else mesh.add(b); }); root.updateMatrixWorld(true);
  const skeleton = new Skeleton(bones); mesh.bind(skeleton);
  const f = variant === 'fawn';
  geometry.boundingBox = new Box3(new Vector3(f ? -.27 : -.37, -.07, f ? -.78 : -1.12), new Vector3(f ? .27 : .37, f ? 1.20 : 1.76, f ? .57 : .87));
  geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new Sphere()); mesh.boundingBox = geometry.boundingBox.clone(); mesh.boundingSphere = geometry.boundingSphere.clone();
  const physics = {
    colliders: [{ shape: 'capsule', axis: 'z', radius: f ? .16 : .25, halfLength: f ? .19 : .32, center: [0, dimensions.bodyY, 0] }],
    anchors: { feet: [0, 0, 0], chest: pivots[1].toArray(), head: pivots[2].toArray(), mouth: [0, f ? .854 : 1.205, f ? -.589 : -.939] },
    basis: 'Metre-scale coarse torso capsule. Host owns placement, ground contacts, authority and future physics; detail selection never changes these proxies.',
  };
  root.userData = { assetId: f ? 'black-tailed-fawn' : 'black-tailed-deer', species: DEER.species, variant, sex: f ? 'unspecified' : 'female', units: 'metres', seed,
    lengthMeters: dimensions.lengthMeters, heightMeters: dimensions.heightMeters, shoulderHeightMeters: dimensions.shoulderHeightMeters,
    source: DEER.localSource, sizeBasis: DEER.sizeBasis, budget: DEER.budget, sourceParts: geometry.userData.sourceParts, physics, inspectionHeadingRadians: Math.PI,
    motion: { poses: DEER_POSES, walkingSpeedMetersPerSecond: dimensions.walkSpeedMetersPerSecond, gallopSpeedMetersPerSecond: dimensions.gallopSpeedMetersPerSecond, placement: 'In-place local rig. Host supplies travel and terrain orientation.' } };
  let time = 0, stridePhase = 0, currentPose = pose, speed: number | undefined, gaitBlend: number | undefined, disposed = false, blendElapsed = 0, blendDuration = 0;
  const from = bones.map(b => ({ position: b.position.clone(), quaternion: new Quaternion(), scale: b.scale.clone() }));
  function sample() { applyDeerPose(bones, pivots, variant, time, { pose: currentPose, speed, gaitBlend, stridePhase }); }
  function setPose(next: DeerPose, transitionSeconds = .3) {
    validPose(next); if (disposed || next === currentPose) return;
    currentPose = next; blendElapsed = 0; blendDuration = Number.isFinite(transitionSeconds) ? Math.max(0, transitionSeconds) : 0;
    if (blendDuration) for (let i = 0; i < bones.length; i++) { from[i].position.copy(bones[i].position); from[i].quaternion.copy(bones[i].quaternion); from[i].scale.copy(bones[i].scale); }
    else sample();
  }
  function update(dt: number, options: DeerUpdateOptions = {}) {
    if (disposed || !Number.isFinite(dt) || dt <= 0 || options.reducedMotion) return;
    if (options.pose) setPose(options.pose);
    if (options.speed !== undefined && Number.isFinite(options.speed)) speed = Math.max(0, options.speed);
    if (options.gaitBlend !== undefined && Number.isFinite(options.gaitBlend)) gaitBlend = Math.max(0, Math.min(1, options.gaitBlend));
    time += dt;
    if (currentPose === 'walk' || currentPose === 'gallop') stridePhase += dt * deerStride(variant, currentPose, speed, gaitBlend).hz;
    sample();
    if (blendDuration > 0) {
      blendElapsed += dt; const u = Math.min(1, blendElapsed / blendDuration), mix = u * u * (3 - 2 * u);
      for (let i = 0; i < bones.length; i++) { bones[i].position.lerp(from[i].position, 1 - mix); bones[i].quaternion.slerp(from[i].quaternion, 1 - mix); bones[i].scale.lerp(from[i].scale, 1 - mix); }
      if (u === 1) blendDuration = 0;
    }
  }
  /** Deterministic seek, useful for canonical world clocks and asset inspection.
   * update() integrates cadence smoothly when speed changes; seek can receive an
   * authoritative stridePhase in cycles to preserve that exact traveled phase. */
  function poseAt(at: number, options: DeerPoseOptions = {}) {
    if (disposed || !Number.isFinite(at) || at < 0) return;
    if (options.pose) { validPose(options.pose); currentPose = options.pose; }
    time = at; speed = options.speed; gaitBlend = options.gaitBlend; blendDuration = 0;
    stridePhase = options.stridePhase ?? time * deerStride(variant, currentPose, speed, gaitBlend).hz; sample();
  }
  const result = { root, mesh, rig: { bones, pivots, skeleton }, dimensions, physics, update, setPose, poseAt,
    get pose() { return currentPose; }, get time() { return time; }, get stridePhase() { return stridePhase; },
    dispose() { if (disposed) return; disposeObject(root); } };
  models.set(root, result); sample();
  geometry.addEventListener('dispose', () => { if (disposed) return; disposed = true; models.delete(root); skeleton.dispose(); });
  return result;
}

export type DeerModel = ReturnType<typeof createDeer>;
export const getDeer = (root: Group) => models.get(root);
export function updateDeer(root: Group, dt: number, options?: DeerUpdateOptions) { models.get(root)?.update(dt, options); }
export function setDeerPose(root: Group, pose: DeerPose, transitionSeconds = .3) { models.get(root)?.setPose(pose, transitionSeconds); }
