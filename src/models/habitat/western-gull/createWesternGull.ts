import { Bone, Box3, Group, Quaternion, Skeleton, SkinnedMesh, Sphere, Vector3 } from 'three';
import { createToonMaterial } from '../../shared/style';
import { defineGeometryLods } from '../../shared/lod/geometry';
import { buildGullGeometry } from './geometry';
import { GULL, GULL_BONE_NAMES, GULL_PARENTS, GULL_POSES, gullDimensions, gullPivots, type GullPose, type GullSex } from './definition';
import { applyGullPose } from './motion';

export interface GullOptions { sex?: GullSex; seed?: number; pose?: GullPose }
interface GullState { sex: GullSex; pose: GullPose; time: number; bones: Bone[]; pivots: Vector3[]; scale: number; transition?: { duration:number; elapsed:number; from:{position:Vector3;quaternion:Quaternion;scale:Vector3}[] } }
const states = new WeakMap<Group, GullState>();

export function createWesternGull({ sex='male', seed=Math.floor(Math.random()*2**32), pose='flight' }: GullOptions={}) {
  const dimensions=gullDimensions(sex);
  if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw new RangeError('Gull seed must be uint32');
  if(!GULL_POSES.includes(pose))throw new RangeError('Unknown gull pose');
  const root=new Group();root.name=`Western gull · ${sex}`;
  const geometry=buildGullGeometry({sex,seed,detail:'near'});
  defineGeometryLods(geometry,()=>({mid:buildGullGeometry({sex,seed,detail:'mid'}),far:buildGullGeometry({sex,seed,detail:'far'})}));
  const mesh=new SkinnedMesh(geometry,createToonMaterial({vertexColors:true,rim:false,name:'western-gull-matte'}));
  mesh.name='gull-one-skinned-batch';mesh.castShadow=true;root.add(mesh);
  const pivots=gullPivots(sex),bones=GULL_BONE_NAMES.map((name,i)=>{const b=new Bone();b.name=`gull-${name}`;b.position.copy(pivots[i]);if(GULL_PARENTS[i]>=0)b.position.sub(pivots[GULL_PARENTS[i]]);return b;});
  bones.forEach((b,i)=>{if(i)bones[GULL_PARENTS[i]].add(b);else mesh.add(b);});root.updateMatrixWorld(true);
  const skeleton=new Skeleton(bones);mesh.bind(skeleton);
  // One fixed envelope covers strokes, folded wings, walk and the short drop.
  // No CPU skin scans each frame, including camera/frustum/LOD work.
  const s=dimensions.scale;
  geometry.boundingBox=new Box3(new Vector3(-.72,0,-.38).multiplyScalar(s),new Vector3(.72,.86,.34).multiplyScalar(s));
  geometry.boundingSphere=new Sphere(new Vector3(0,.34,0).multiplyScalar(s),.83*s);
  mesh.boundingBox=geometry.boundingBox.clone();mesh.boundingSphere=geometry.boundingSphere.clone();
  root.userData={assetId:`western-gull-${sex}`,species:GULL.species,units:'metres',seed,sex,...dimensions,inspectionHeadingRadians:Math.PI,
    source:GULL.source,sizeBasis:GULL.sizeBasis,budget:GULL.budget,
    sourceParts:['mantle','breast','neck','head','bill-and-red-mark','eyes','inner-wings','primary-wings','white-wing-mirrors','tail','legs-and-webbed-feet','reusable-droplet'],
    physics:{colliders:[{shape:'capsule',axis:'z',radius:.10*s,halfLength:.12*s,center:[0,.30*s,.025*s]}],
      anchors:{perch:[0,0,0],grip:[0,.30*s,0],bill:[0,.424*s,-.36*s],vent:[0,.23*s,.20*s]},
      basis:'Coarse rigid body proxy in metres. Wings/feet omitted; placement, flight, contacts and authority belong to the host, independent of LOD.'},
    motion:{walkingSpeedMetersPerSecond:GULL.walkSpeedMetersPerSecond,placement:'Walk in place; host applies travel. Flight is a local flap/glide cycle. Poop is a bounded one-shot local preview.'}};
  const state:GullState={sex,pose,time:0,bones,pivots,scale:s};states.set(root,state);applyGullPose(bones,pivots,pose,0,s);
  geometry.addEventListener('dispose',()=>{if(states.delete(root))skeleton.dispose();});return root;
}

/** Optional pose blending is local rig animation; the world still owns the root.
 * Snapshot only on an action change, never rebuild geometry during a transition. */
export function setGullPose(root:Group,pose:GullPose,transitionSeconds=0) {
  if(!GULL_POSES.includes(pose))throw new RangeError('Unknown gull pose');
  const state=states.get(root);if(!state)return;
  state.transition=Number.isFinite(transitionSeconds)&&transitionSeconds>0?{duration:transitionSeconds,elapsed:0,from:state.bones.map(b=>({position:b.position.clone(),quaternion:b.quaternion.clone(),scale:b.scale.clone()}))}:undefined;
  state.pose=pose;state.time=0;
  if(state.transition)return;
  applyGullPose(state.bones,state.pivots,pose,0,state.scale);
}
export function updateWesternGull(root:Group,dt:number) {
  const state=states.get(root);if(!state||!Number.isFinite(dt)||dt<=0||(state.pose==='standing'&&!state.transition))return;
  if(state.pose!=='standing')state.time+=dt;
  if(state.pose==='pooping'&&state.time>=GULL.poopDurationSeconds){state.pose='standing';state.time=0;}
  applyGullPose(state.bones,state.pivots,state.pose,state.time,state.scale);
  if(state.transition){
    const t=state.transition;t.elapsed+=dt;const u=Math.min(1,t.elapsed/t.duration),mix=u*u*(3-2*u);
    state.bones.forEach((bone,i)=>{const from=t.from[i];bone.position.lerp(from.position,1-mix);bone.quaternion.slerp(from.quaternion,1-mix);bone.scale.lerp(from.scale,1-mix);});
    if(u===1)state.transition=undefined;
  }
}
export function getGullState(root:Group) {
  const s=states.get(root);return s?{sex:s.sex,pose:s.pose,time:s.time,poopActive:s.bones[9].scale.x>0,wingAngles:[s.bones[1].rotation.z,s.bones[2].rotation.z]}:undefined;
}
