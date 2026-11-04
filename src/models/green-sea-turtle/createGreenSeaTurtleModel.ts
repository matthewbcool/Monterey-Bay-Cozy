import { Bone, Mesh, Skeleton, SkinnedMesh } from 'three';
import { createModelAssembly } from '../shared/assembly';
import { createToonMaterial } from '../shared/style';
import { batchFish } from '../shared/fish/batches';
import { createCreatureMotion } from '../shared/creatureMotion';
import type { FishPhysicsDescriptor, Point3 } from '../types';
import { GREEN_TURTLE as T } from './definition';
import { buildTurtle } from './components';

export function createGreenSeaTurtleModel({lengthMeters=T.lengthMeters,seed=Math.floor(Math.random()*2**32)}:{lengthMeters?:number;seed?:number}={}){
 if(!Number.isFinite(lengthMeters)||lengthMeters<=0)throw new Error('Turtle length must be positive metres');
 if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw new Error('Turtle seed must be uint32');
 const a=createModelAssembly(T.id),material=createToonMaterial({vertexColors:true,rim:false});
 buildTurtle(a,material,lengthMeters,seed);batchFish(a);
 const body=new Bone();body.name='body';const rig=a.addPart('rig');rig.add(body);
 const flippers=T.pivots.map((pivot,i)=>{const b=new Bone();b.name=['front-near','front-far','rear-near','rear-far'][i];b.position.set(pivot[0],pivot[1],pivot[2]).multiplyScalar(lengthMeters);body.add(b);return b;});
 const skeleton=new Skeleton([body,...flippers]),group=a.parts.get('surface')!,source=group.children[0] as Mesh;
 const skin=new SkinnedMesh(source.geometry,source.material);skin.name='turtle-shell-body-and-flippers';group.remove(source);group.add(skin);a.root.updateMatrixWorld(true);skin.bind(skeleton);
 skin.geometry.computeBoundingBox();skin.geometry.computeBoundingSphere();skin.boundingBox=skin.geometry.boundingBox!.clone().expandByScalar(lengthMeters*.25);skin.boundingSphere=skin.geometry.boundingSphere!.clone();skin.boundingSphere.radius+=lengthMeters*.25;
 const point=(x:number,y=0,z=0):Point3=>[x*lengthMeters,y*lengthMeters,z*lengthMeters];
 const physics:FishPhysicsDescriptor={colliders:[{shape:'capsule',axis:'x',center:point(.025),radius:.22*lengthMeters,halfLength:.14*lengthMeters}],centerOfMass:point(.025),anchors:{mouth:point(-.49,.012),grip:point(0,.13)}};
 a.root.userData={units:'metres',speciesId:T.id,lengthMeters,shellLengthMeters:lengthMeters*.79,seed,source:T.source,sizeBasis:T.sizeBasis,budget:T.budget,inspectionSizeMeters:[lengthMeters,lengthMeters*.55,lengthMeters*1.26],animation:'five-bone flipper propulsion',sourceParts:['carapace-plastron','shell-scutes','head-scales','head-neck-beak','front-flippers','rear-flippers','tail','eyes','eyes-caught']};
 return createCreatureMotion({...a,physics},T.motion,(phase,blend,caught)=>{
   // Harmonic downstroke and softer recovery; front flippers feather through the stroke.
   const wave=Math.sin(phase)+.22*Math.sin(2*phase);
   const stroke=caught?-.12:.10+wave*(.44+blend*.20),feather=caught?0:Math.cos(phase-.35)*(.14+blend*.12);
   flippers.forEach((bone,i)=>{const side=i%2===0?1:-1,rear=i>=2;bone.rotation.set(side*(rear?stroke*.18:stroke),side*feather*(rear?.25:1),0);});
   a.parts.get('head-details')!.visible=!caught;a.parts.get('caught-details')!.visible=caught;
 },()=>skeleton.dispose());
}
