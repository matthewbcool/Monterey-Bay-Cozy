import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,Vector3} from 'three';
import {createPoolGate} from '../src/viewer/testingGym/poolGate';
import {createTestingGym} from '../src/viewer/testingGym';
import {canStandAt,createAvatarController} from '../src/viewer/avatarController';
import {groundHeight,drapeGeometry} from '../src/viewer/testingGym/elevation';
import {surface} from '../src/viewer/testingGym/geometry';
import {RECREATION_TERRACE,RECREATION_TRAIL,RECREATION_RETAINING} from '../src/viewer/testingGym/recreationGrade';
import {disposeObject} from '../src/models/props/primitives';
import {createLodController} from '../src/models/shared/lod/controller';

const bounds={minX:-100,maxX:100,minZ:-100,maxZ:130};
test('gate blocks shut, opens one clear passage, and refuses to sweep through an avatar',async()=>{
 const gate=createPoolGate([0,0],[1.65,0],0),lod=createLodController();
 try{
  await lod.register(gate.root);const stats=lod.stats(gate.root);
  assert.equal(stats.near.draws,1);assert(stats.near.triangles<=160);
  const identity=gate.collider;assert(!canStandAt(.825,0,bounds,[identity],.42));
  assert(!gate.toggle(new Vector3(.825,0,0),.42).changed);assert(!gate.open);
  assert(gate.toggle(new Vector3(.825,0,2),.42).changed);assert(gate.open);
  assert.equal(gate.collider,identity);assert(canStandAt(.825,0,bounds,[identity],.42));
  const angle=gate.root.rotation.y;
  assert(!gate.toggle(new Vector3(.7,0,-.7),.42).changed);assert.equal(gate.root.rotation.y,angle);
  assert(gate.toggle(new Vector3(.825,0,2),.42).changed);assert(!gate.open);
  assert(!canStandAt(.825,0,bounds,[identity],.42));
 }finally{lod.dispose();disposeObject(gate.root);}
});

test('pool and volleyball playing surfaces are level while the beach retains its lower elevation',()=>{
 for(const p of [[-16,38],[-21.337,34.782],[-9.611,41.809],[-10,60],[-13.796,75.446],[2.918,69.953]])
  assert(Math.abs(groundHeight(p[0],p[1])-RECREATION_TERRACE.height)<1e-8);
 assert(groundHeight(35,60)<3);assert(groundHeight(25,-35)>8);
});

test('actual controller crosses open gate both ways at default and largest body radii; closed fence and basin remain solid',()=>{
 const gym=createTestingGym({whaleSightingRoll:.99});
 try{
  const gate=gym.poolGate,dx=gate.center.x-gate.hinge[0],dz=gate.center.z-gate.hinge[1],len=Math.hypot(dx,dz),nx=-dz/len,nz=dx/len;
  const at=(n:number)=>new Vector3(gate.center.x+nx*n,groundHeight(gate.center.x+nx*n,gate.center.z+nz*n)+.045,gate.center.z+nz*n);
  assert(gym.flightObstacles.includes(gate.collider as typeof gym.flightObstacles[number]),'Suit and walking collision share the same moving gate');
  for(const radius of [.28,.28*1.8/1.45*1.25]){
   const root=new Group(),controller=createAvatarController({root,spawn:at(2.4),bounds:gym.bounds,colliders:gym.colliders,groundHeight:(x,z)=>gym.groundHeight(x,z)+.045,body:{radius,swimDepth:.85,swimImmersion:.78}});
   const side=()=> (root.position.x-gate.center.x)*nx+(root.position.z-gate.center.z)*nz;
   for(let i=0;i<120;i++)controller.update(1/60,{x:-nx,z:-nz,run:false});assert(side()>.1,'Closed gate must stop walking');
   assert(gate.toggle(at(2.4),radius).changed);
   for(let i=0;i<50;i++)controller.update(1/60,{x:-nx,z:-nz,run:false});assert(side()<-.5,'Open doorway must admit player');
   for(let i=0;i<100;i++)controller.update(1/60,{x:nx,z:nz,run:false});assert(side()>1,'Player must be able to leave');
   assert(gate.toggle(root.position,radius).changed);
  }
  assert(!canStandAt(-16,38,gym.bounds,gym.colliders),'Visible basin retains collision');
  assert(canStandAt(-6.8,73.14,gym.bounds,gym.colliders,.42),'Court apron entrance stays open');
  const ground=gym.root.getObjectByName('gym-ground-surface') as Mesh;
  assert.equal(ground.userData.unpaintedArea,0);assert(ground.userData.sourceParts.some((s:string)=>s.includes('dashed centre')));
 }finally{gym.dispose();}
});

 test('bike trail is level across its full width and the court bank has matching render and collision planes',()=>{
 const a=RECREATION_TRAIL.start,b=RECREATION_TRAIL.end,len=Math.hypot(b[0]-a[0],b[1]-a[1]),tx=(b[0]-a[0])/len,tz=(b[1]-a[1])/len;
 for(let i=0;i<=100;i++)for(const n of [-1.6,0,1.6])assert(Math.abs(groundHeight(a[0]+tx*len*i/100-tz*n,a[1]+tz*len*i/100+tx*n)-RECREATION_TRAIL.height)<1e-7);
 // The inland court wall is approximately person-height in both supplied photos.
 const p=RECREATION_RETAINING.start,q=RECREATION_RETAINING.end,x=(p[0]+q[0])/2,z=(p[1]+q[1])/2,l=Math.hypot(q[0]-p[0],q[1]-p[1]),nx=-(q[1]-p[1])/l,nz=(q[0]-p[0])/l;
 assert(Math.abs(groundHeight(x+nx*.8,z+nz*.8)-groundHeight(x-nx*.1,z-nz*.1)-1.6)<1e-6);
 // No enclosing ridge on the seaward promenade / approach to the beach stairs.
 for(const [x,z] of [[1,58],[3,58],[6,58],[10,56]])assert(groundHeight(x,z)<=8.25+1e-7);
 const geometry=drapeGeometry(surface([[x-2,z-2],[x+2,z-2],[x,z+2]])),pos=geometry.attributes.position,index=geometry.index!;
 try{for(let k=0;k<index.count;k+=3){const ids=[index.getX(k),index.getX(k+1),index.getX(k+2)],cx=ids.reduce((s,i)=>s+pos.getX(i),0)/3,cz=ids.reduce((s,i)=>s+pos.getZ(i),0)/3,y=ids.reduce((s,i)=>s+pos.getY(i),0)/3;assert(Math.abs(groundHeight(cx,cz)-y)<1e-5,'Rendered bank matches the physical floor between vertices');}}
 finally{geometry.dispose();}
 });
