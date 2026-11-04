import type { Bone } from 'three';
import { MONARCH, type MonarchPose } from './definition';

const smooth = (x: number) => { const t = Math.max(0, Math.min(1,x)); return t*t*(3-2*t); };
/** Four thorax hinges, no vertex writes or world motion. A gentle glide breaks up the wingbeats. */
export function applyMonarchPose(bones: Bone[], pose: MonarchPose, time: number) {
  const cycle = time % MONARCH.glideCycleSeconds;
  const glide = smooth((cycle-3.65)/.4) * (1-smooth((cycle-4.65)/.5));
  const phase = time * Math.PI * 2 * MONARCH.wingbeatHz;
  const angle = pose==='perched' ? 1.43 : pose==='basking' ? .09 : .12 + .95 * Math.sin(phase) * (1-glide*.92);
  const hind = pose==='flight' ? .12 + .84*Math.sin(phase-.13)*(1-glide*.92) : angle;
  for (let i=1;i<5;i++) {
    const side = i%2===0 ? 1 : -1;
    bones[i].rotation.set(0, pose==='flight' ? side*.025*Math.sin(phase-.2)*(1-glide) : 0, side*(i<3?angle:hind));
  }
}
