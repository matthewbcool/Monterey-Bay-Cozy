import {Bone,Group,Matrix4,Skeleton,SkinnedMesh} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createToonMaterial} from '../shared/style';
import {VISITORS,VISITOR_BUDGET} from './definition';
import {buildVisitorGeometry} from './geometry';

/** Nine metre-scale visitors, one skin/material/draw. `elapsed` is the host's paused simulation clock. */
export function createGalleryVisitors({span=23.043}:{span?:number}={}) {
  if(!Number.isFinite(span)||span<15)throw Error('Visitor span must be at least 15 metres');
  const root=new Group();root.name='Gallery visitors';
  const fixed=new Bone();fixed.name='planted-feet';root.add(fixed);
  const bones:Bone[]=[fixed];
  const built=VISITORS.map((person,i)=>{
    const placement=new Matrix4().makeRotationY(person.yaw).setPosition(person.x*span,0,person.z);
    const anchor=new Group();anchor.name=`visitor-${i+1}`;anchor.position.set(person.x*span,0,person.z);anchor.rotation.y=person.yaw;root.add(anchor);
    anchor.userData={heightMeters:person.height,pose:person.pose,units:'metres'};
    const spine=new Bone();spine.name=`visitor-${i+1}:spine`;spine.position.y=.51*person.height;anchor.add(spine);
    const head=new Bone();head.name=`visitor-${i+1}:head`;head.position.y=.345*person.height;spine.add(head);
    const arm=new Bone();arm.name=`visitor-${i+1}:arm`;arm.position.set(.112*person.build*person.height,.28*person.height,0);spine.add(arm);
    const indices={spine:bones.length,head:bones.length+1,arm:bones.length+2};bones.push(spine,head,arm);
    return {anchor,spine,head,arm,heightMeters:person.height,geometry:buildVisitorGeometry(person,placement,indices,i)};
  });
  const geometry=mergeGeometries(built.map(p=>p.geometry))!;
  const people=built.map(({geometry,...person})=>{geometry.dispose();return person;});
  const material=createToonMaterial({color:'#14212b',rim:false,name:'gallery-silhouettes'});
  const mesh=new SkinnedMesh(geometry,material);mesh.name='gallery-visitor-silhouettes';root.add(mesh);
  root.updateMatrixWorld(true);const skeleton=new Skeleton(bones);mesh.bind(skeleton);
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  mesh.boundingBox=geometry.boundingBox!.clone().expandByScalar(.035);
  mesh.boundingSphere=geometry.boundingSphere!.clone();mesh.boundingSphere.radius+=.035;
  root.userData={units:'metres',count:people.length,heightsMeters:VISITORS.map(p=>p.height),sizeBasis:'Chosen reference heights, not measurements of real visitors',budget:VISITOR_BUDGET};
  let lastTime=0,disposed=false;
  return {root,mesh,people,skeleton,update(elapsed:number){
    if(disposed||!Number.isFinite(elapsed)||elapsed<lastTime)return;
    lastTime=elapsed;
    people.forEach(({spine,head,arm},i)=>{
      const phase=i*1.71,wave=(period:number)=>Math.sin(elapsed*Math.PI*2/period+phase)-Math.sin(phase);
      // Sub-centimetre posture changes; subtract the initial phase to retain the exact rest pose at t=0.
      spine.rotation.z=.003*wave(19+i*1.2);spine.scale.y=1+.00065*wave(6.5+i*.18);
      head.rotation.y=.012*wave(29+i*1.3);head.rotation.x=.003*wave(23+i);
      arm.rotation.x=.004*wave(21+i*.9);
    });
  },dispose(){
    if(disposed)return;disposed=true;skeleton.dispose();geometry.dispose();mesh.material.dispose();root.removeFromParent();
  }};
}
export type GalleryVisitors=ReturnType<typeof createGalleryVisitors>;
