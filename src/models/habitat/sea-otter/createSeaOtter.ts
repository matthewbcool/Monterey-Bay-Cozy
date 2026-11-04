import { Bone, Box3, Group, Quaternion, Skeleton, SkinnedMesh, Sphere, Vector3 } from 'three';
import { createToonMaterial } from '../../shared/style';
import { defineGeometryLods } from '../../shared/lod/geometry';
import { disposeObject } from '../../props/primitives';
import { SEA_OTTER, SEA_OTTER_BONE_NAMES, SEA_OTTER_PARENTS, SEA_OTTER_POSES, seaOtterDimensions, seaOtterPivots, type SeaOtterPose } from './definition';
import { buildSeaOtterGeometry } from './geometry';
import { applySeaOtterPose, seaOtterStrokeRate, type SeaOtterPoseOptions } from './motion';
export type { SeaOtterPose } from './definition';

export interface SeaOtterOptions { seed?: number; pose?: SeaOtterPose; lengthMeters?: number }
export interface SeaOtterUpdateOptions extends SeaOtterPoseOptions { reducedMotion?: boolean }
const models = new WeakMap<Group, SeaOtterModel>();
const validatePose = (pose: SeaOtterPose) => { if (!SEA_OTTER_POSES.includes(pose)) throw new RangeError('Unknown sea otter pose'); };

export function createSeaOtter({ seed = Math.floor(Math.random() * 2 ** 32), pose = 'float', lengthMeters = SEA_OTTER.nominalLengthMeters }: SeaOtterOptions = {}) {
  const dimensions = seaOtterDimensions(lengthMeters), s = dimensions.scale; validatePose(pose);
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('Sea otter seed must be uint32');
  const root = new Group(); root.name = 'Southern sea otter';
  const geometry = buildSeaOtterGeometry(lengthMeters, seed, 'near');
  defineGeometryLods(geometry, () => ({ mid: buildSeaOtterGeometry(lengthMeters, seed, 'mid'), far: buildSeaOtterGeometry(lengthMeters, seed, 'far') }));
  const mesh = new SkinnedMesh(geometry, createToonMaterial({ vertexColors: true, rim: false, name: 'southern-sea-otter-matte' }));
  mesh.name = 'sea-otter-one-skinned-batch'; mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
  const pivots = seaOtterPivots(lengthMeters), bones = SEA_OTTER_BONE_NAMES.map((name, i) => { const b = new Bone(); b.name = 'sea-otter-' + name; b.position.copy(pivots[i]); if (SEA_OTTER_PARENTS[i] >= 0) b.position.sub(pivots[SEA_OTTER_PARENTS[i]]); return b; });
  bones.forEach((b, i) => { if (i) bones[SEA_OTTER_PARENTS[i]].add(b); else mesh.add(b); }); root.updateMatrixWorld(true);
  const skeleton = new Skeleton(bones); mesh.bind(skeleton);
  // One fixed envelope covers the full local dive and all hand/flipper strokes.
  // No CPU skin scan, bound rebuild or camera-dependent animation is required.
  geometry.boundingBox = new Box3(new Vector3(-.39, -.72, -.72).multiplyScalar(s), new Vector3(.39, .72, .72).multiplyScalar(s));
  geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new Sphere()); mesh.boundingBox = geometry.boundingBox.clone(); mesh.boundingSphere = geometry.boundingSphere.clone();
  const point = (x: number, y: number, z: number) => [x * s, y * s, z * s];
  const physics = {
    colliders: [{ shape: 'capsule', axis: 'z', radius: .17 * s, halfLength: .24 * s, center: point(0, 0, 0) }],
    anchors: { waterline: point(0, 0, 0), chest: pivots[1].toArray(), head: pivots[3].toArray(), mouth: point(0, .25, -.558), frontPaws: [pivots[7].toArray(), pivots[8].toArray()], hindFeet: [pivots[9].toArray(), pivots[10].toArray()], tail: point(0, -.05, .575) },
    basis: 'Coarse metre-scale torso capsule and bind-frame anchors. Host owns world travel, buoyancy, contacts and multiplayer authority, independently of rendering detail.',
  };
  root.userData = { assetId: SEA_OTTER.assetId, species: SEA_OTTER.species, units: 'metres', seed, lengthMeters, widthMeters: dimensions.widthMeters, heightMeters: dimensions.heightMeters,
    source: SEA_OTTER.source, sizeBasis: SEA_OTTER.sizeBasis, budget: SEA_OTTER.budget, sourceParts: geometry.userData.sourceParts, physics, inspectionHeadingRadians: Math.PI,
    motion: { poses: SEA_OTTER_POSES, placement: 'Belly-up float/groom about root waterline Y=0; underwater cruising with hands beneath the chest and local dive pitch. Host owns translation.' } };
  let time = 0, actionTime = 0, strokePhase = 0, currentPose = pose, speed = .65, disposed = false, blendElapsed = 0, blendDuration = 0;
  const from = bones.map(b => ({ position: b.position.clone(), quaternion: new Quaternion(), targetReference: new Quaternion(), scale: b.scale.clone() }));
  const sample = () => applySeaOtterPose(bones, pivots, currentPose, time, strokePhase, actionTime, s);
  function setPose(next: SeaOtterPose, transitionSeconds = .55) {
    validatePose(next); if (disposed || next === currentPose) return;
    currentPose = next; actionTime = 0; blendElapsed = 0; blendDuration = Number.isFinite(transitionSeconds) ? Math.max(0, transitionSeconds) : 0;
    if (blendDuration > 0) {
      for (let i = 0; i < bones.length; i++) { from[i].position.copy(bones[i].position); from[i].quaternion.copy(bones[i].quaternion); from[i].scale.copy(bones[i].scale); }
      sample();
      for (let i = 0; i < bones.length; i++) {
        const start = from[i], q = bones[i].quaternion, sign = start.quaternion.dot(q) < 0 ? -1 : 1;
        start.targetReference.set(q.x * sign, q.y * sign, q.z * sign, q.w * sign);
        bones[i].position.copy(start.position); q.copy(start.quaternion); bones[i].scale.copy(start.scale);
      }
    } else sample();
  }
  function update(dt: number, options: SeaOtterUpdateOptions = {}) {
    if (disposed || !Number.isFinite(dt) || dt <= 0 || options.reducedMotion) return;
    if (options.pose) setPose(options.pose);
    if (options.speed !== undefined && Number.isFinite(options.speed)) speed = Math.max(0, Math.min(2, options.speed));
    time += dt; actionTime += dt; strokePhase += dt * seaOtterStrokeRate(speed); sample();
    if (blendDuration > 0) {
      blendElapsed += dt; const t = Math.min(1, blendElapsed / blendDuration), mix = t * t * (3 - 2 * t);
      for (let i = 0; i < bones.length; i++) {
        const start = from[i], q = bones[i].quaternion, a = start.quaternion;
        bones[i].position.lerp(start.position, 1 - mix); bones[i].scale.lerp(start.scale, 1 - mix);
        // Fix the chosen side of a near-180-degree limb turn. Re-selecting the
        // shortest path each frame flips the whole skin when quiet sway crosses
        // the antipodal boundary halfway through a surface/underwater blend.
        if (start.targetReference.dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
        const cosine = Math.max(-1, Math.min(1, a.dot(q))), angle = Math.acos(cosine), sine = Math.sin(angle);
        const wa = sine > 1e-6 ? Math.sin((1 - mix) * angle) / sine : 1 - mix, wb = sine > 1e-6 ? Math.sin(mix * angle) / sine : mix;
        q.set(a.x * wa + q.x * wb, a.y * wa + q.y * wb, a.z * wa + q.z * wb, a.w * wa + q.w * wb).normalize();
      }
      if (t === 1) blendDuration = 0;
    }
  }
  /** Absolute deterministic inspection/restore. The host chooses when to seek;
   * ordinary updates preserve continuous stroke phase through speed changes. */
  function poseAt(at: number, options: SeaOtterPoseOptions = {}) {
    if (disposed || !Number.isFinite(at) || at < 0) return;
    if (options.pose) { validatePose(options.pose); currentPose = options.pose; }
    time = actionTime = at; speed = Number.isFinite(options.speed) ? Math.max(0, Math.min(2, options.speed!)) : .65; strokePhase = at * seaOtterStrokeRate(speed); blendDuration = 0; sample();
  }
  const result = { root, mesh, rig: { bones, pivots, skeleton }, dimensions, physics, update, setPose, poseAt,
    get pose() { return currentPose; }, get time() { return time; }, get strokePhase() { return strokePhase; },
    dispose() { if (disposed) return; disposeObject(root); } };
  models.set(root, result); sample();
  geometry.addEventListener('dispose', () => { if (disposed) return; disposed = true; models.delete(root); skeleton.dispose(); });
  return result;
}
export type SeaOtterModel = ReturnType<typeof createSeaOtter>;
export const getSeaOtter = (root: Group) => models.get(root);
export function updateSeaOtter(root: Group, dt: number, options?: SeaOtterUpdateOptions) { models.get(root)?.update(dt, options); }
export function setSeaOtterPose(root: Group, pose: SeaOtterPose, transitionSeconds = .55) { models.get(root)?.setPose(pose, transitionSeconds); }
