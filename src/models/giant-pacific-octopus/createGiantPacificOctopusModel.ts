import { Box3, Mesh, SkinnedMesh, Sphere, Vector3 } from 'three';
import { createModelAssembly } from '../shared/assembly';
import { createCreatureMotion } from '../shared/creatureMotion';
import { batchFish } from '../shared/fish/batches';
import { createFishMaterial } from '../shared/fish/materials';
import type { FishPhysicsDescriptor, Point3 } from '../types';
import { OCTOPUS as O } from './definition';
import { buildBody } from './body';
import { buildArms } from './arms';
import { createOctopusRig } from './rig';

export function createGiantPacificOctopusModel({armSpanMeters=O.spanMeters,seed=Math.floor(Math.random()*2**32)}:{armSpanMeters?:number;seed?:number}={}){
 if(!Number.isFinite(armSpanMeters)||armSpanMeters<=0)throw new RangeError('Octopus arm span must be positive metres');
 if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw new RangeError('Octopus seed must be uint32');
 const a=createModelAssembly(O.id),material=createFishMaterial(),span=armSpanMeters;material.userData.rim=false;
 buildBody(a,material,span,seed);buildArms(a,material,span,seed);const sourceParts=[...a.parts.keys()];batchFish(a);
 const rig=createOctopusRig(span,seed);a.addPart('rig').add(rig.body);
 const group=a.parts.get('surface')!,source=group.children[0] as Mesh,skin=new SkinnedMesh(source.geometry,source.material);skin.name='octopus-mantle-and-eight-arms';group.remove(source);group.add(skin);
 a.root.updateMatrixWorld(true);skin.bind(rig.skeleton);
 // Fixed envelope covers all authored poses; no CPU skin-bound evaluation each frame.
 skin.boundingBox=new Box3(new Vector3(-.53,-.025,-.53).multiplyScalar(span),new Vector3(.56,.24,.53).multiplyScalar(span));
 skin.boundingSphere=new Sphere(new Vector3(0,.06*span,0),.58*span);
 const p=(x:number,y:number,z=0):Point3=>[x*span,y*span,z*span];
 const physics:FishPhysicsDescriptor={colliders:[{shape:'capsule',axis:'x',center:p(-.07,.10),radius:.085*span,halfLength:.065*span}],centerOfMass:p(-.07,.1),anchors:{mouth:p(.035,.035),grip:p(-.09,.18)}};
 a.root.userData={units:'metres',speciesId:O.id,lengthMeters:span,armSpanMeters:span,seed,source:O.source,
  sizeBasis:'Chosen 3 m fully extended arm-span class; current curled pose is smaller. Aquarium reference is 2–4 m or more, not a hard maximum.',
  locomotion:'crawl-jet',floorOffsetMeters:.004*span,inspectionSizeMeters:[span*1.1,span*.55,span*.8],
  budget:O.budget,sourceParts,animation:'74-bone independent arm frames and mantle pulse; procedural crawl and jet poses',
  physicsNote:'Coarse mantle collider only. Arm contact is an authored floor pose, not a soft-body or obstacle solver.'};
 return createCreatureMotion({...a,physics},O.motion,(phase,blend,caught)=>{
  rig.pose(phase,blend,caught);a.parts.get('head-details')!.visible=!caught;a.parts.get('caught-details')!.visible=caught;
 },()=>rig.skeleton.dispose());
}
