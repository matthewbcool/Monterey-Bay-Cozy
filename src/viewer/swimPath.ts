import type { FishModel } from '../models/types';
import { createSeaOtterRoute } from './seaOtterRoute';
import { CatmullRomCurve3, Euler, MathUtils, Vector3 } from 'three';

export const TANK_SIZE = { width:27.432, height:9, depth:12 } as const;
export const SWIM_SPEED = { slow:.525, fast:1.6 } as const;
export const swimPath = new CatmullRomCurve3([
  new Vector3(-10,0,0),new Vector3(-8,.65,-4.4),new Vector3(0,1,-5),
  new Vector3(8,.2,-4.4),new Vector3(10,-.6,0),new Vector3(7,-.3,4.5),
  new Vector3(0,.35,5),new Vector3(-8,.2,4.4),
].map(point=>point.multiplyScalar(.375)),true,'centripetal');
swimPath.arcLengthDivisions=500;
export const pathLength=swimPath.getLength();

/** Arc-length sampling keeps straight sections and turns at the same speed. */
export function routePose(distance:number){
  const u=MathUtils.euclideanModulo(distance,pathLength)/pathLength;
  const position=swimPath.getPointAt(u),direction=swimPath.getTangentAt(u).normalize();
  const ahead=swimPath.getTangentAt((u+.008)%1);
  const turn=direction.z*ahead.x-direction.x*ahead.z;
  const bank=MathUtils.clamp(turn*1.8,-.15,.15);
  // The model's forward axis is -X. Bank around that axis after yaw/pitch.
  const rotation=new Euler(bank,Math.atan2(direction.z,-direction.x),-Math.asin(direction.y),'YZX');
  return {position,direction,rotation};
}
export function createSwimmer(fish:Pick<FishModel,'root'|'getState'|'setMotionOwner'>,speed:{readonly slow:number;readonly fast:number}=SWIM_SPEED){
  if(fish.root.userData.locomotion==='surface-otter')return createSeaOtterRoute(fish,{tankSize:TANK_SIZE,speed});
  const root=fish.root;
  const inspectionOnly=root.userData.inspectionOnly===true;
  let distance=inspectionOnly?0:pathLength*.64;
  function apply(){
    // A whale can fit at the centre for study but cannot turn within this tank.
    // Its visual rig still swims; the rigid root waits for a world-scale route.
    if(inspectionOnly){root.position.set(0,0,0);root.rotation.set(0,0,0);return;}
    const pose=routePose(distance);
    if(root.userData.locomotion==='crawl-jet'){
      const blend=fish.getState().blend;
      pose.position.y=-TANK_SIZE.height/2+(root.userData.floorOffsetMeters??0)+blend*(1.4+pose.position.y*.25);
      pose.rotation.x*=blend;pose.rotation.z*=blend;
    }
    root.position.copy(pose.position);root.rotation.copy(pose.rotation);
  }
  if(fish.getState().motionOwner!=='physics'){fish.setMotionOwner('path');apply();}
  return {
    update(dt:number,blend:number){
      const state=fish.getState();
      if(state.disposed||state.lifeState!=='alive'||state.motionOwner!=='path'||!Number.isFinite(dt)||dt<=0)return;
      if(inspectionOnly)return;
      const pulse=root.userData.locomotion==='crawl-jet'?1+blend*.42*Math.sin(state.phase):1;
      distance=MathUtils.euclideanModulo(distance+Math.min(dt,.1)*MathUtils.lerp(speed.slow,speed.fast,blend)*pulse,pathLength);apply();
    },
    /** Explicit hand-back after external/physics placement, at the nearest route point. */
    resume(){
      const state=fish.getState();
      if(state.disposed||state.motionOwner==='physics')return;
      if(inspectionOnly){fish.setMotionOwner('path');apply();return;}
      let nearest=0,best=Infinity;const point=new Vector3();
      for(let i=0;i<500;i++){
        swimPath.getPointAt(i/500,point);const delta=point.distanceToSquared(root.position);
        if(delta<best){best=delta;nearest=i/500*pathLength;}
      }
      distance=nearest;fish.setMotionOwner('path');apply();
    },
    getDistance:()=>distance,
  };
}
