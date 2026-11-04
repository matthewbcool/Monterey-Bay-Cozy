/** Player-triggered gull flight. World paths and landing checks stay independent
 * of camera LOD; the existing rig supplies blended wings/feet without new draws. */
import { CubicBezierCurve3, Group, Vector3 } from 'three';
import { setGullPose, updateWesternGull } from '../../models/habitat/western-gull/createWesternGull';

export const GULL_ESCAPE = { scareRadius: 3, verticalRange: 1.8, landingClearance: 3.2 } as const;
export interface GullPlayer { position: Vector3; enabled: boolean }
export interface GullEscapeWorld {
  groundHeight(x:number,z:number):number;
  canLandAt?(x:number,z:number):boolean;
  isWater?(x:number,z:number):boolean;
  surfaceY:number;
}
const ease=(t:number)=>t*t*(3-2*t);
const wrap=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));

export function createGullEscape(root:Group,home:Vector3,seed:number,world:GullEscapeWorld,player:GullPlayer){
  const target=new Vector3(),direction=new Vector3(),point=new Vector3(),circleCenter=new Vector3();
  const curve=new CubicBezierCurve3(new Vector3(),new Vector3(),new Vector3(),new Vector3());curve.arcLengthDivisions=64;
  const state={phase:'grounded' as 'grounded'|'departing'|'circling'|'landing',target,departures:0};
  let age=0,duration=1,land=false,circleAngle=0,retry=0,cooldown=0,settled=false;
  const distanceToPlayer=(x:number,z:number)=>player.enabled?Math.hypot(x-player.position.x,z-player.position.z):Infinity;
  function canLand(x:number,z:number){
    if(world.isWater?.(x,z)||world.canLandAt?.(x,z)===false||distanceToPlayer(x,z)<GULL_ESCAPE.landingClearance)return false;
    const h=world.groundHeight(x,z);
    if(!Number.isFinite(h)||h<world.surfaceY+.06)return false;
    // Do not perch across a steep bank or a stair edge.
    return Math.abs(world.groundHeight(x-.18,z)-h)<.07&&Math.abs(world.groundHeight(x+.18,z)-h)<.07&&Math.abs(world.groundHeight(x,z-.18)-h)<.07&&Math.abs(world.groundHeight(x,z+.18)-h)<.07;
  }
  function clearRoute(x:number,z:number){
    for(let j=1;j<=12;j++){
      const u=j/12,px=root.position.x+(x-root.position.x)*u,pz=root.position.z+(z-root.position.z)*u;
      if(!world.isWater?.(px,pz)&&world.canLandAt?.(px,pz)===false)return false;
    }
    return true;
  }
  function chooseLanding(){
    const away=player.enabled?Math.atan2(root.position.x-player.position.x,root.position.z-player.position.z):Math.atan2(root.position.x-home.x,root.position.z-home.z);
    // Deterministic fan, biased away from the player; no unbounded search or navigation graph.
    for(const radius of [9+(seed%3),7,12])for(const turn of [0,.38,-.38,.76,-.76,1.15,-1.15,1.52,-1.52]){
      const angle=away+turn,x=root.position.x+Math.sin(angle)*radius,z=root.position.z+Math.cos(angle)*radius;
      if(canLand(x,z)&&clearRoute(x,z)&&Math.abs(world.groundHeight(x,z)-world.groundHeight(root.position.x,root.position.z))<2){target.set(x,world.groundHeight(x,z)+.02,z);return true;}
    }
    if(state.phase!=='grounded'&&canLand(home.x,home.z)&&clearRoute(home.x,home.z)){target.copy(home);return true;}
    return false;
  }
  function plan(){
    land=chooseLanding();
    if(!land){
      direction.set(root.position.x-player.position.x,0,root.position.z-player.position.z);
      if(!player.enabled||direction.lengthSq()<1e-6)direction.set(-Math.sin(root.rotation.y),0,-Math.cos(root.rotation.y));
      direction.normalize();target.copy(root.position).addScaledVector(direction,7);
      target.y=Math.max(root.position.y+3,world.groundHeight(target.x,target.z)+3,world.surfaceY+4);
      // The holding circle can extend six metres around this endpoint. Climb
      // before entering it, including when escaping a beach below a steep bank.
      for(let sample=0;sample<16;sample++){const a=sample/16*Math.PI*2;target.y=Math.max(target.y,world.groundHeight(target.x+Math.cos(a)*6,target.z+Math.sin(a)*6)+3);}
    }
    curve.v0.copy(root.position);curve.v3.copy(target);
    let ceiling=Math.max(root.position.y,target.y);
    for(let i=1;i<12;i++){const t=i/12;ceiling=Math.max(ceiling,world.groundHeight(root.position.x+(target.x-root.position.x)*t,root.position.z+(target.z-root.position.z)*t));}
    curve.v1.copy(root.position).lerp(target,.2);curve.v1.y=ceiling+3.2;
    curve.v2.copy(root.position).lerp(target,.8);curve.v2.y=ceiling+3.2;
    curve.updateArcLengths();duration=Math.max(3.2,curve.getLength()/3.2);age=0;
    if(state.phase==='grounded'){setGullPose(root,'flight',.32);state.departures++;}
    state.phase='departing';
  }
  function face(dt:number){
    const yaw=Math.atan2(-direction.x,-direction.z),pitch=Math.max(-.55,Math.min(.55,Math.atan2(direction.y,Math.hypot(direction.x,direction.z))));
    root.rotation.order='YXZ';root.rotation.y+=wrap(yaw-root.rotation.y)*(1-Math.exp(-9*dt));
    root.rotation.x+=(pitch-root.rotation.x)*(1-Math.exp(-7*dt));root.rotation.z*=Math.exp(-7*dt);
  }
  return { ...state, get phase(){return state.phase;},get departures(){return state.departures;},target,
    /** Returns true while airborne or completing the landing pose. */
    update(dt:number){
      cooldown=Math.max(0,cooldown-dt);
      if(state.phase==='grounded'){
        if(player.enabled&&!cooldown&&Math.abs(player.position.y-root.position.y)<=GULL_ESCAPE.verticalRange&&distanceToPlayer(root.position.x,root.position.z)<=GULL_ESCAPE.scareRadius){plan();}
        else if(settled){updateWesternGull(root,dt);age+=dt;if(age>.45)settled=false;return true;}
        else return false;
      }
      if(state.phase==='circling'){
        circleAngle+=dt*.65;root.position.set(circleCenter.x+Math.cos(circleAngle)*3,circleCenter.y+.2*Math.sin(circleAngle*1.7),circleCenter.z+Math.sin(circleAngle)*3);
        direction.set(-Math.sin(circleAngle),.11*Math.cos(circleAngle*1.7),Math.cos(circleAngle));face(dt);updateWesternGull(root,dt);
        retry-=dt;if(retry<=0){retry=4;if(chooseLanding())plan();}return true;
      }
      if(land&&age/duration>.45&&!canLand(target.x,target.z)){plan();}
      age+=dt;const t=Math.min(1,age/duration),u=ease(t);
      curve.getPointAt(u,point);curve.getTangentAt(u,direction);root.position.copy(point);face(dt);updateWesternGull(root,dt);
      if(land&&t>.72)state.phase='landing';
      if(t>=1){
        if(land&&canLand(target.x,target.z)){
          home.copy(target);root.position.copy(home);root.rotation.x=root.rotation.z=0;
          setGullPose(root,'standing',.38);state.phase='grounded';settled=true;age=0;cooldown=.65;
        }else{
          // A short airborne holding circle, then retry a clear landing. Never snap home under a player.
          direction.set(-Math.sin(root.rotation.y),0,-Math.cos(root.rotation.y));
          circleAngle=Math.atan2(-direction.x,direction.z);circleCenter.copy(root.position).add(new Vector3(-Math.cos(circleAngle)*3,0,-Math.sin(circleAngle)*3));
          circleCenter.y-=.2*Math.sin(circleAngle*1.7);
          state.phase='circling';retry=2;
        }
      }
      return true;
    },
  };
}
