import type { Bone, Vector3 } from 'three';
import { GULL, type GullPose } from './definition';

const smooth = (a: number, b: number, x: number) => { const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t); };

/** Pure local pose; world position, velocity, collisions and identity belong to
 * the host. Flight math also lives in flockMaterial.ts; keep parity tests. */
export function applyGullPose(bones: Bone[], pivots: Vector3[], pose: GullPose, time: number, scale: number) {
  for (let i=0;i<bones.length;i++) {
    bones[i].rotation.set(0,0,0); bones[i].scale.set(1,1,1); bones[i].position.copy(pivots[i]);
    if(i===3||i===4)bones[i].position.sub(pivots[i-2]);
  }
  bones[9].scale.setScalar(0);
  if(pose==='flight') {
    const cycle=time%GULL.glideCycleSeconds, glide=smooth(3.2,3.8,cycle)*(1-smooth(6.4,7,cycle));
    const phase=time*Math.PI*2*GULL.wingbeatHz;
    for(const side of [-1,1]) {
      const shoulder=side<0?1:2,wrist=side<0?3:4;
      bones[shoulder].rotation.z=side*(.10+Math.sin(phase)*.48*(1-glide*.94));
      bones[wrist].rotation.z=side*Math.sin(phase-.45)*.24*(1-glide*.94);
    }
    bones[5].scale.setScalar(0); bones[6].scale.setScalar(0);
    return;
  }
  // Fold and foreshorten the broad wing panels onto the mantle. Two rigid
  // hinges give a readable closed silhouette without modeling folded feathers.
  for(const side of [-1,1]) {
    const shoulder=side<0?1:2;
    bones[shoulder].rotation.set(0,-side*1.36,-side*.13);
    bones[shoulder].scale.set(.39,1,.48);
    bones[shoulder].position.x+=side*.025*scale;
    bones[shoulder].position.y+=.035*scale;
  }
  if(pose==='walking') {
    const phase=time*Math.PI*2*GULL.walkHz;
    const bob=.003*(1-Math.cos(phase*2))*scale;
    bones[0].position.y=bob;
    for(let i=5;i<=6;i++) {
      const swing=Math.sin(phase+(i===6?Math.PI:0)), angle=.32*swing;
      const lift=.035*Math.max(0,swing)**2;
      bones[i].rotation.x=angle;
      // Support the lowest rigid toe, not only its centre (which lets tilted
      // webbing clip through the ground). Flight has no ground constraints.
      const c=Math.cos(angle),s=Math.sin(angle);
      const lowest=Math.min(.23+c*(.015-.23)-s*(.03-.025),.23+c*(.006-.23)-s*(-.052-.025),.23+c*(.006-.23)-s*(-.04-.025));
      bones[i].position.y+=(.006-lowest+lift)*scale-bob;
    }
    bones[8].rotation.x=Math.sin(phase*2)*.025;
  } else if(pose==='pooping') {
    const effort=smooth(0,.22,time)*(1-smooth(.65,1.05,time));
    bones[7].rotation.x=-effort*.32;
    bones[8].rotation.x=effort*.10;
    // One finite local effect. No emitters, timers, growing arrays or permanent
    // decals. World collision can replace this trajectory through the host.
    const age=time-.40;
    if(age>=0&&age<.72) {
      const flight=Math.min(age,.26), floor=age>.26;
      bones[9].position.y=(floor?.012:.23-.22*flight-2.35*flight*flight)*scale;
      bones[9].position.z=(.20+.12*flight)*scale;
      const fade=1-smooth(.48,.72,age);
      bones[9].scale.set((floor?2.2:.9)*fade,(floor?.20:1.25)*fade,(floor?1.7:.9)*fade);
    }
  }
}
