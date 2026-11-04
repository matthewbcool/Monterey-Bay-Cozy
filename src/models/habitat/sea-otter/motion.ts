import type { Bone, Vector3 } from 'three';
import { SEA_OTTER_PARENTS, type SeaOtterPose } from './definition';

export interface SeaOtterPoseOptions { pose?: SeaOtterPose; speed?: number }
const smooth = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
/** Speed controls local stroke cadence only, not placement. Timings
 * are authored animation choices, not measured species swimming speeds. */
export function seaOtterStrokeRate(speed = .65) { return .95 + Math.max(0, Math.min(2, Number.isFinite(speed) ? speed : .65)) * .60; }

/** Bone-only visual motion. Float is deliberately quiet; the rear feet and
 * flexible pelvis provide propulsion, while small front hands tuck or groom. */
export function applySeaOtterPose(bones: Bone[], pivots: Vector3[], pose: SeaOtterPose, time: number, strokePhase: number, actionTime = time, scale = 1) {
  for (let i = 0; i < bones.length; i++) { bones[i].position.copy(pivots[i]); if (SEA_OTTER_PARENTS[i] >= 0) bones[i].position.sub(pivots[SEA_OTTER_PARENTS[i]]); bones[i].rotation.set(0, 0, 0); bones[i].scale.set(1, 1, 1); }
  const stroke = strokePhase * Math.PI * 2, swim = pose === 'swim' || pose === 'dive', diving = pose === 'dive' ? smooth(actionTime / 1.6) : 0;
  const underwater = pose === 'swim' ? 1 : pose === 'dive' ? smooth((actionTime - .2) / 1.2) : 0;
  const pitch = pose === 'dive' ? -.85 * Math.sin(diving * Math.PI) - .22 * diving : Math.sin(time * .53) * .008;
  // The dark round torso keeps its continuous skin untwisted. Forward head
  // posture and hands beneath the chest distinguish underwater cruising from
  // the supine floating pose without a destructive 180-degree neck twist.
  bones[0].rotation.set(pitch, 0, Math.sin(time * .41) * .009 * (1 - underwater));
  bones[1].rotation.x = swim ? Math.sin(stroke - .4) * .035 - diving * .06 : Math.sin(time * .75) * .008;
  bones[2].rotation.x = swim ? Math.sin(stroke + .35) * .075 : Math.sin(time * .60) * .009;
  bones[3].rotation.x = pose === 'groom' ? Math.sin(time * 1.3) * .035 : swim ? -.45 * underwater + Math.sin(stroke - .7) * .018 : Math.sin(time * .47) * .018;
  bones[3].rotation.y = pose === 'float' ? Math.sin(time * .33) * .026 : 0;
  bones[4].rotation.x = swim ? Math.sin(stroke + .8) * .13 - diving * .24 : Math.sin(time * .55) * .025;
  bones[11].rotation.x = swim ? Math.sin(stroke + 1.25) * .10 : Math.sin(time * .55 + .5) * .018;
  bones[3].position.y -= .025 * underwater * scale;
  for (let side = 0; side < 2; side++) {
    const sign = side === 0 ? -1 : 1, arm = side + 5, paw = side + 7, foot = side + 9;
    bones[arm].rotation.x = swim ? .42 + Math.sin(stroke) * .012 : .40 + Math.sin(time * .55 + side) * .008;
    bones[arm].rotation.z = sign * (.04 + (Math.PI - .04) * underwater);
    bones[arm].position.x *= 1 - .25 * underwater;
    bones[arm].position.y -= .185 * underwater * scale;
    bones[paw].rotation.x = -bones[arm].rotation.x * .7;
    bones[paw].rotation.z = -sign * .12;
    if (pose === 'groom') {
      const reach = smooth(.5 + .5 * Math.sin(time * 1.6 + side * Math.PI));
      bones[arm].rotation.x = .40 - reach * 1.82;
      bones[arm].rotation.z = sign * (.04 - reach * .07);
      bones[paw].rotation.x = -.12 + reach * .40;
      bones[paw].rotation.z = -sign * (.12 + reach * .18);
    }
    // Broad flippers stroke together with a slight offset, rather than acting
    // as front flippers. Slow floating keeps them raised and slightly splayed.
    bones[foot].rotation.x = swim ? .08 + Math.sin(stroke + side * .18) * .55 + diving * .12 : -.20 + Math.sin(time * .6 + side * .35) * .035;
    bones[foot].rotation.y = sign * (swim ? .08 + Math.sin(stroke + .55) * .16 : .07);
    bones[foot].rotation.z = sign * (swim ? Math.sin(stroke - .4) * .10 : .06);
  }
}
