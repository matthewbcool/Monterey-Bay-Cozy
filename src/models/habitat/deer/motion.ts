import type { Bone, Vector3 } from 'three';
import { DEER_LEGS, DEER_PARENTS, type DeerPose, type DeerVariant } from './definition';

export interface DeerPoseOptions { pose?: DeerPose; speed?: number; gaitBlend?: number; stridePhase?: number }
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const smooth = (x: number) => x * x * (3 - 2 * x);
const walkOffsets = [0, .5, .75, .25], runOffsets = [0, .08, .50, .58];
export function deerStride(variant: DeerVariant, pose: DeerPose, speed?: number, gaitBlend?: number) {
  const f = variant === 'fawn', run = clamp(Number.isFinite(gaitBlend) ? gaitBlend! : pose === 'gallop' ? 1 : 0, 0, 1), walkSpeed = f ? .65 : .8;
  const velocity = clamp(Number.isFinite(speed) ? speed! : pose === 'gallop' ? f ? 2.4 : 3.2 : walkSpeed, 0, 6);
  const duty = .66 * (1 - run) + .34 * run, maxStride = f ? .25 : .36;
  const hz = Math.max((1.35 + run * .9) * Math.sqrt(velocity / walkSpeed), velocity * duty / maxStride, .01);
  return { run, velocity, duty, hz, stride: velocity * duty / hz };
}

/** Solve each two-segment leg to its ground contact. Hoof bones counter-rotate
 * so support feet stay flat while upper/lower limbs bend. No buffers or world
 * transforms are changed; the host supplies physical travel and terrain pose. */
export function applyDeerPose(bones: Bone[], pivots: Vector3[], variant: DeerVariant, time: number, options: DeerPoseOptions = {}) {
  const pose = options.pose ?? 'idle', f = variant === 'fawn';
  for (let i = 0; i < bones.length; i++) { bones[i].rotation.set(0, 0, 0); bones[i].scale.set(1, 1, 1); bones[i].position.copy(pivots[i]); if (DEER_PARENTS[i] >= 0) bones[i].position.sub(pivots[DEER_PARENTS[i]]); }
  const moving = pose === 'walk' || pose === 'gallop', gait = deerStride(variant, pose, options.speed, options.gaitBlend), phase = options.stridePhase ?? time * gait.hz;
  const cycle = phase * Math.PI * 2;
  let bob = Math.sin(time * 1.8) * .0015;
  if (moving) bob = (f ? -.014 : -.025) * (1 - gait.run) + (f ? -.025 : -.045) * gait.run + Math.sin(cycle * 2) * (f ? .004 : .006) + Math.sin(cycle) * gait.run * (f ? .005 : .009);
  if (pose === 'eat') bob = f ? -.020 : -.035;
  bones[0].position.y = bob;
  bones[1].rotation.x = pose === 'eat' ? -2.2 + Math.sin(time * 1.3) * .018 : moving ? -.10 - gait.run * .13 + Math.sin(cycle) * .025 : Math.sin(time * .8) * .018;
  bones[2].rotation.x = pose === 'eat' ? .63 + Math.sin(time * 4.5) * .022 : moving ? .06 + gait.run * .10 : .025 * Math.sin(time * .63);
  bones[2].rotation.y = pose === 'idle' ? Math.sin(time * .36) * .075 : pose === 'eat' ? Math.sin(time * .7) * .025 : 0;
  bones[3].rotation.x = -.12 + Math.sin(time * 1.1) * .055 + (moving ? gait.run * .23 : 0);
  for (let i = 16; i <= 17; i++) { const s = i === 16 ? -1 : 1, flick = Math.max(0, Math.sin(time * .63 + i)) ** 16; bones[i].rotation.z = s * (.06 + flick * .17); bones[i].rotation.y = s * Math.sin(time * .8 + i) * .045; }
  for (let leg = 0; leg < DEER_LEGS.length; leg++) {
    const joint = DEER_LEGS[leg], hip = pivots[joint], knee = pivots[joint + 1], foot = pivots[joint + 2];
    let z = foot.z, y = foot.y;
    if (moving && gait.velocity > .001) {
      const offset = walkOffsets[leg] * (1 - gait.run) + runOffsets[leg] * gait.run, t = ((phase + offset) % 1 + 1) % 1;
      if (t < gait.duty) z += (t / gait.duty - .5) * gait.stride;
      else { const swing = (t - gait.duty) / (1 - gait.duty); z += (.5 - smooth(swing)) * gait.stride; y += Math.sin(Math.PI * swing) ** 1.4 * (f ? .055 + .070 * gait.run : .075 + .105 * gait.run); }
    }
    const hipY = hip.y + bob, dy = y - hipY, dz = z - hip.z;
    const upper = hip.distanceTo(knee), lower = knee.distanceTo(foot), rawDistance = Math.hypot(dy, dz), distance = clamp(rawDistance, Math.abs(upper - lower) + 1e-6, upper + lower - 1e-6);
    const along = (upper * upper - lower * lower + distance * distance) / (2 * distance), bend = Math.sqrt(Math.max(0, upper * upper - along * along));
    // Both carpal and hock silhouettes retain their modest rearward bend.
    const unitY = dy / rawDistance, unitZ = dz / rawDistance, kneeY = hipY + unitY * along + unitZ * bend, kneeZ = hip.z + unitZ * along - unitY * bend;
    const upperAngle = Math.atan2(kneeZ - hip.z, kneeY - hipY) - Math.atan2(knee.z - hip.z, knee.y - hip.y);
    const lowerAngle = Math.atan2(z - kneeZ, y - kneeY) - Math.atan2(foot.z - knee.z, foot.y - knee.y) - upperAngle;
    bones[joint].rotation.x = upperAngle; bones[joint + 1].rotation.x = lowerAngle; bones[joint + 2].rotation.x = -upperAngle - lowerAngle;
  }
}
