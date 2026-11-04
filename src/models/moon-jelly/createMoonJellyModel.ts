import { Group, Mesh } from 'three';
import { createMoonJelly } from '../habitat/moon-jelly/createMoonJelly';
import { MOON_JELLY as J } from '../habitat/moon-jelly/definition';
import { applyJellyPose } from '../habitat/moon-jelly/motion';
import { createCreatureMotion } from '../shared/creatureMotion';
import type { FishPhysicsDescriptor } from '../types';

/** Collection adapter: shared fish controls and placement contract, with jelly-specific anatomy. */
export function createMoonJellyModel({diameterMeters=J.diameterMeters,seed=Math.floor(Math.random()*2**32)}:{diameterMeters?:number;seed?:number}={}){
 const visual=createMoonJelly({diameterMeters,seed}),root=new Group();root.name='moon-jelly';root.add(visual);
 const parts=new Map<string,Group>([['bell-and-organs',visual]]),radius=diameterMeters/2;
 const physics:FishPhysicsDescriptor={colliders:[{shape:'capsule',axis:'x',center:[0,0,0],radius,halfLength:0}],centerOfMass:[0,0,0],anchors:{mouth:[0,diameterMeters*.05,0],grip:[0,0,0]}};
 root.userData={...visual.userData,speciesId:J.id,lengthMeters:diameterMeters,measurementLabel:'Bell diameter',inspectionSizeMeters:[diameterMeters,diameterMeters*.8,diameterMeters],animation:'GPU bell morph',caughtAppearance:'contracted, motionless bell; no invented eyes'};
 const meshes=visual.children.filter((child):child is Mesh=>child instanceof Mesh);
 return createCreatureMotion({root,visual,parts,physics},{slow:J.pulseHz,fast:.8},(phase,_blend,caught)=>{
  applyJellyPose(meshes,phase+(seed%1000)/1000*Math.PI*2,caught);
 });
}
