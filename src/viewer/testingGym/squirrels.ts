import {Matrix4,Quaternion,Vector3} from 'three';
import features from '../../data/lovers-point-features.json';
import {createSquirrelBatch} from '../../models/habitat/ground-squirrel/createGroundSquirrel';
import {canStandAt,type GymBounds,type GymCollider} from '../avatarController';
import {pathStyle} from './pathStyle';
import {mulberry32} from '../../models/shared/random';
const TARGETS=[[89,-108],[94,-103],[98,-104],[108,-117],[113,-115],[117,-123],[126,-126],[112,-124]] as const;
function distance(x:number,z:number,a:readonly number[],b:readonly number[]){const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);}
/** Tiny non-solid wildlife. Root motion is host-owned, never LOD-owned. Eight
 * stable slots share geometry/material/morph data; offscreen groups sleep. */
export function createGymSquirrels(floor:(x:number,z:number)=>number,bounds:GymBounds,colliders:GymCollider[]){
 const batch=createSquirrelBatch({count:8,seed:734}),root=batch.root,random=mulberry32(734);
 const paved=features.paths.filter(p=>['cycleway','footway','steps','path','pedestrian','secondary','residential'].includes(p.highway));
 function safe(x:number,z:number){const y=floor(x,z);return y>1.5&&[[.1,0],[-.1,0],[0,.1],[0,-.1]].every(([dx,dz])=>Math.abs(floor(x+dx,z+dz)-y)<.06)&&canStandAt(x,z,bounds,colliders,.14)&&paved.every(p=>p.points.every((b,i)=>i===0||distance(x,z,p.points[i-1],b)>pathStyle(p).width/2+.3));}
 const animals=TARGETS.map(([tx,tz],i)=>{
  let home:Vector3|undefined;
  for(let r=0;r<=10&&!home;r+=.5)for(let k=0;k<16;k++){const a=k*Math.PI/8,x=tx+Math.cos(a)*r,z=tz+Math.sin(a)*r;if(safe(x,z)){home=new Vector3(x,floor(x,z),z);break;}}
  if(!home)throw new Error('No clear rockside squirrel placement');
  return{id:'lovers-point-squirrel-'+i,home,position:home.clone(),target:home.clone(),heading:random()*Math.PI*2,wait:1+random()*6,pose:'alert' as 'alert'|'forage'|'scurry'};
 });
 const matrix=new Matrix4(),rotation=new Quaternion(),up=new Vector3(0,1,0),normal=new Vector3(),yaw=new Quaternion(),scale=new Vector3(1,1,1),player=new Vector3(Infinity,0,Infinity);
 let active=true,disposed=false;
 function commit(){animals.forEach((a,i)=>{normal.set(-(floor(a.position.x+.1,a.position.z)-floor(a.position.x-.1,a.position.z))/.2,1,-(floor(a.position.x,a.position.z+.1)-floor(a.position.x,a.position.z-.1))/.2).normalize();rotation.setFromUnitVectors(up,normal).multiply(yaw.setFromAxisAngle(up,a.heading));matrix.compose(a.position,rotation,scale);batch.mesh.setMatrixAt(i,matrix);});batch.mesh.instanceMatrix.needsUpdate=true;batch.mesh.computeBoundingBox();batch.mesh.computeBoundingSphere();}
 function choose(a:typeof animals[number],away=false){
  const angle=away?Math.atan2(a.position.x-player.x,a.position.z-player.z):random()*Math.PI*2,radius=away?1.5:.6+random()*1.4;
  const x=a.position.x+Math.sin(angle)*radius,z=a.position.z+Math.cos(angle)*radius;
  if(Math.hypot(x-a.home.x,z-a.home.z)<3&&safe(x,z)&&Math.abs(floor(x,z)-a.position.y)<.25)a.target.set(x,floor(x,z),z);
 }
 commit();batch.update(0);
 return{root,animals,batch,safe,
  setViewer(x:number,z:number,overview=false){active=!overview&&animals.some(a=>Math.hypot(x-a.home.x,z-a.home.z)<65);root.visible=active;},
  setPlayer(x:number,y:number,z:number,enabled=true){player.set(enabled?x:Infinity,y,enabled?z:Infinity);},
  update(dt:number,animate=true){
   if(disposed||!active||!animate||!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.05);
   animals.forEach((a,i)=>{
    const close=a.position.distanceTo(player)<2;
    a.wait-=dt;if(a.wait<=0){a.wait=3+random()*7;if(random()<.5)choose(a);}
    if(close)choose(a,true);
    const dx=a.target.x-a.position.x,dz=a.target.z-a.position.z,d=Math.hypot(dx,dz);
    a.pose=d>.03?'scurry':close?'alert':(i+Math.floor(a.wait))%3?'forage':'alert';
    if(d>.03){const step=Math.min(d,dt*(close?1.0:.32)),x=a.position.x+dx/d*step,z=a.position.z+dz/d*step;
     if(safe(x,z)&&Math.abs(floor(x,z)-a.position.y)<.10){a.position.set(x,floor(x,z),z);a.heading=Math.atan2(-dx,-dz);}else a.target.copy(a.position);
    }
    batch.setSlotPose(i,a.pose);
   });batch.update(dt);commit();
  },
  stats(){return{count:animals.length,active,draws:1,positions:animals.map(a=>a.position.toArray()),poses:animals.map(a=>a.pose)};},
  dispose(){if(disposed)return;disposed=true;batch.dispose();root.removeFromParent();},
 };
}
