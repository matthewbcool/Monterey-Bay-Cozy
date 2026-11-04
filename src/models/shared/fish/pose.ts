import { MathUtils, type Bone } from 'three';
import type { FishDesign } from './design';

/** The live rig and school pose baker use the same fin attachments and bend. */
export function poseFish(bones: readonly Bone[], motion: FishDesign['motion'], phase: number, blend: number, activity = 1, caught = false, pectoralPhase = phase * .6) {
  const [, middle, tail, dorsal, near, far] = bones;
  middle.rotation.y = Math.sin(phase - .65) * MathUtils.lerp(motion.slowBend, motion.fastBend, blend) * activity;
  tail.rotation.y = Math.sin(phase - 1.35) * MathUtils.lerp(motion.slowTail, motion.fastTail, blend) * activity;
  dorsal.scale.y = caught ? .88 : MathUtils.lerp(1, motion.fastDorsal, blend);
  const opening = caught ? .12 : MathUtils.lerp(motion.pectoralOpen, .035, blend);
  const flutter = Math.sin(pectoralPhase) * .045 * (1 - blend) * activity;
  near.rotation.y = -opening; far.rotation.y = opening;
  near.rotation.x = flutter; far.rotation.x = -flutter;
}
