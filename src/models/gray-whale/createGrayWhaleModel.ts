import { Bone, Mesh, Skeleton, SkinnedMesh } from 'three';
import { createModelAssembly } from '../shared/assembly';
import { createToonMaterial } from '../shared/style';
import { batchFish } from '../shared/fish/batches';
import { createCreatureMotion } from '../shared/creatureMotion';
import type { FishPhysicsDescriptor, Point3 } from '../types';
import { GRAY_WHALE as W } from './definition';
import { buildGrayWhale } from './components';

export function createGrayWhaleModel({lengthMeters=W.lengthMeters,seed=Math.floor(Math.random()*2**32)}:{lengthMeters?:number;seed?:number}={}){
  if(!Number.isFinite(lengthMeters)||lengthMeters<=0)throw new Error('Whale length must be positive metres');
  if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw new Error('Whale seed must be uint32');
  const a=createModelAssembly(W.id),material=createToonMaterial({vertexColors:true,rim:false});
  buildGrayWhale(a,material,lengthMeters,seed);batchFish(a);
  const rig=a.addPart('rig');
  const front=new Bone();front.name='front-body';rig.add(front);
  const rear=new Bone();rear.name='rear-body';rear.position.x=.20*lengthMeters;front.add(rear);
  const flukes=new Bone();flukes.name='horizontal-flukes';flukes.position.x=.16*lengthMeters;rear.add(flukes);
  const skeleton=new Skeleton([front,rear,flukes]),surface=a.parts.get('surface')!,source=surface.children[0] as Mesh;
  const skin=new SkinnedMesh(source.geometry,source.material);skin.name='gray-whale:body-flippers-and-flukes';surface.remove(source);surface.add(skin);
  a.root.updateMatrixWorld(true);skin.bind(skeleton);
  skin.geometry.computeBoundingBox();skin.geometry.computeBoundingSphere();
  skin.boundingBox=skin.geometry.boundingBox!.clone().expandByScalar(lengthMeters*.12);
  skin.boundingSphere=skin.geometry.boundingSphere!.clone();skin.boundingSphere.radius+=lengthMeters*.12;
  const point=(x:number,y=0,z=0):Point3=>[x*lengthMeters,y*lengthMeters,z*lengthMeters];
  const physics:FishPhysicsDescriptor={colliders:[{shape:'capsule',axis:'x',center:point(-.08),radius:lengthMeters*.118,halfLength:lengthMeters*.27}],centerOfMass:point(-.09),anchors:{mouth:point(-.49,-.015),grip:point(-.08,.10)}};
  a.root.userData={units:'metres',speciesId:W.id,lengthMeters,seed,source:W.source,sizeBasis:W.sizeBasis,budget:W.budget,inspectionOnly:true,inspectionSizeMeters:[lengthMeters,lengthMeters*.34,lengthMeters*.46],animation:'three-bone vertical fluke stroke',sourceParts:['body','pectoral fins','dorsal hump and knuckles','horizontal flukes','mouth','blowholes','barnacle hints','live/caught eyes']};
  a.parts.get('caught-details')!.visible=false;
  return createCreatureMotion({...a,physics},W.motion,(phase,blend,caught)=>{
    const stroke=caught?0:Math.sin(phase)*(.045+blend*.060);
    rear.rotation.z=stroke;flukes.rotation.z=caught?0:Math.sin(phase-.46)*(.115+blend*.11);
    a.parts.get('head-details')!.visible=!caught;a.parts.get('caught-details')!.visible=caught;
  },()=>skeleton.dispose());
}
