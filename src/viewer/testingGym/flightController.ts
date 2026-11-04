import { Object3D, Vector3 } from 'three';
import { touchesFootprint, type GymPoint, type AvatarInput, type GymBounds } from '../avatarController';
export const OTTER_FLIGHT = { cruise: 18, boost: 42, climb: 12, ceiling: 180, response: 5, clearance: .12, underwaterCruise: 4, underwaterBoost: 8, underwaterClimb: 3 } as const;
export interface FlightObstacle { minX:number;maxX:number;minZ:number;maxZ:number;top:number;footprint?:readonly GymPoint[] }
/** Serializable movement intent, finite bounded steps, no animation or DOM ownership. */
export function createFlightController(root:Object3D,bounds:GymBounds,floor:(x:number,z:number)=>number,obstacles:readonly FlightObstacle[]=[],water:(x:number,z:number)=>number|undefined=()=>undefined,canLand:(x:number,z:number)=>boolean=()=>true){
  const velocity=new Vector3();let active=false;
  const wet=()=>{const y=water(root.position.x,root.position.z);return y!==undefined&&root.position.y+.6<y;};
  const overlaps=(b:FlightObstacle,x:number,z:number)=>x>b.minX-.4&&x<b.maxX+.4&&z>b.minZ-.4&&z<b.maxZ+.4&&(!b.footprint||touchesFootprint(x,z,b.footprint,.4));
  const result={submerged:false,flying:false,speed:0,verticalVelocity:0,altitude:0,landed:false,blocked:false};
  const valid=(x:number,z:number,y:number)=>x>=bounds.minX&&x<=bounds.maxX&&z>=bounds.minZ&&z<=bounds.maxZ&&Number.isFinite(floor(x,z))&&floor(x,z)<=y+.03&&!obstacles.some(b=>overlaps(b,x,z)&&y<b.top+.3);
  return {get active(){return active;},stop(){active=false;velocity.set(0,0,0);},launch(){active=true;velocity.set(0,0,0);root.position.y=Math.max(root.position.y,floor(root.position.x,root.position.z))+.35;},
    update(dt:number,input:AvatarInput){
      result.landed=false;result.blocked=false;if(!active||!Number.isFinite(dt)||dt<=0)return result;dt=Math.min(dt,.05);
      const x=Number.isFinite(input.x)?input.x:0,z=Number.isFinite(input.z)?input.z:0,n=Math.max(1,Math.hypot(x,z)),speed=wet()?(input.run?OTTER_FLIGHT.underwaterBoost:OTTER_FLIGHT.underwaterCruise):(input.run?OTTER_FLIGHT.boost:OTTER_FLIGHT.cruise),k=1-Math.exp(-OTTER_FLIGHT.response*dt);
      velocity.x+=(x/n*speed-velocity.x)*k;velocity.z+=(z/n*speed-velocity.z)*k;
      velocity.y+=((Number(input.jump===true)-Number(input.dive===true))*(wet()?OTTER_FLIGHT.underwaterClimb:OTTER_FLIGHT.climb)-velocity.y)*k;
      const steps=Math.max(1,Math.ceil(velocity.length()*dt/.25)),s=dt/steps;
      for(let i=0;i<steps;i++){
        const xx=root.position.x+velocity.x*s,zz=root.position.z+velocity.z*s;
        if(valid(xx,root.position.z,root.position.y))root.position.x=xx;else{velocity.x=0;result.blocked=true;}
        if(valid(root.position.x,zz,root.position.y))root.position.z=zz;else{velocity.z=0;result.blocked=true;}
        const ground=floor(root.position.x,root.position.z),surface=obstacles.reduce((h,b)=>overlaps(b,root.position.x,root.position.z)?Math.max(h,b.top+.4):h,ground);
        root.position.y=Math.max(surface+OTTER_FLIGHT.clearance,Math.min(OTTER_FLIGHT.ceiling,root.position.y+velocity.y*s));
        if(root.position.y>=OTTER_FLIGHT.ceiling)velocity.y=Math.min(0,velocity.y);
        // Seabed contact stays powered; only dry ground transfers to the walking controller.
        if(input.dive&&root.position.y<=ground+.13&&ground>1.1&&water(root.position.x,root.position.z)===undefined&&surface===ground&&canLand(root.position.x,root.position.z)){active=false;velocity.set(0,0,0);result.landed=true;break;}
      }
      result.submerged=wet();result.speed=Math.hypot(velocity.x,velocity.z);result.verticalVelocity=velocity.y;result.flying=active;result.altitude=root.position.y-floor(root.position.x,root.position.z);
      if(result.speed>.1){const heading=Math.atan2(velocity.x,velocity.z),delta=Math.atan2(Math.sin(heading-root.rotation.y),Math.cos(heading-root.rotation.y));root.rotation.y+=delta*k;}
      return result;
    },getState(){return {flying:active,submerged:wet(),position:root.position.toArray(),velocity:velocity.toArray(),altitude:result.altitude};}};
}
