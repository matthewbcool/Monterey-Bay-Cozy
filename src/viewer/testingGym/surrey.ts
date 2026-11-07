import {Vector3} from 'three';
import {createSurrey} from '../../models/props/surrey';
import {disposeObject} from '../../models/props/primitives';
import {canStandAt,type GymBounds,type GymCollider} from '../avatarController';

/** Kinematic bicycle steering. Simulation owns the metre-scale root; LOD owns
 * only render geometry. Inputs and root/crank state can later be replicated. */
export function createGymSurrey(floor:(x:number,z:number)=>number,bounds:GymBounds,colliders:GymCollider[]){
  const model=createSurrey(),root=model.root,up=new Vector3(0,1,0);
  let speed=0,disposed=false;
  root.position.set(3.1178,floor(3.1178,94.8854),94.8854);
  root.rotation.y=Math.atan2(63.083,30.879);
  // Pedestrians collide with the parked/moving vehicle; it ignores its own proxy.
  const obstacle:Extract<GymCollider,{kind:'circle'}>={kind:'circle',x:root.position.x,z:root.position.z,radius:1.1};
  colliders.push(obstacle);
  const obstacles=()=>colliders.filter(c=>c!==obstacle);
  function valid(x:number,z:number,yaw:number){
    const others=obstacles(),c=Math.cos(yaw),s=Math.sin(yaw),base=floor(x,z);
    // The enclosing circle catches thin obstacles between sample points. Nine
    // terrain samples reject curbs/cliffs; ≤15 cm travel per step avoids tunneling.
    if(!Number.isFinite(base)||base<1.25||!canStandAt(x,z,bounds,others,1.39))return false;
    for(const lx of [-.72,0,.72])for(const lz of [-1.15,0,1.15]){
      const px=x+c*lx+s*lz,pz=z-s*lx+c*lz;
      if(!canStandAt(px,pz,bounds,others,.12)||Math.abs(floor(px,pz)-base)>.25)return false;
    }
    return true;
  }
  return {
    ...model,get speed(){return speed;},stop(){speed=0;},valid,
    update(dt:number,throttle:number,steer:number){
      if(disposed||!Number.isFinite(dt+throttle+steer)||dt<=0)return;
      dt=Math.min(dt,.05);throttle=Math.max(-1,Math.min(1,throttle));steer=Math.max(-1,Math.min(1,steer));
      speed+=(throttle*(throttle<0?1:3)-speed)*(1-Math.exp(-3*dt));
      const yaw=root.rotation.y+speed/1.56*Math.tan(steer*.45)*dt;
      const x=root.position.x+Math.sin(yaw)*speed*dt,z=root.position.z+Math.cos(yaw)*speed*dt;
      if(valid(x,z,yaw)){
        root.position.set(x,floor(x,z),z);root.rotation.y=yaw;obstacle.x=x;obstacle.z=z;
        model.animate(speed*dt,steer);
      }else speed=0;
    },
    exit(){
      for(const side of [-1,1]){
        const x=root.position.x+Math.cos(root.rotation.y)*1.6*side,z=root.position.z-Math.sin(root.rotation.y)*1.6*side;
        if(canStandAt(x,z,bounds,obstacles(),.3)&&Math.abs(floor(x,z)-root.position.y)<.3)return new Vector3(x,floor(x,z)+.045,z);
      }
      return undefined;
    },
    seat(out:Vector3){return out.set(-.3,.9,-.48).applyAxisAngle(up,root.rotation.y).add(root.position);},
    dispose(){if(disposed)return;disposed=true;const index=colliders.indexOf(obstacle);if(index>=0)colliders.splice(index,1);root.removeFromParent();disposeObject(root);},
  };
}
