import { Bone, Box3, Group, Skeleton, SkinnedMesh, Sphere, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createToonMaterial } from '../../shared/style';
import { defineGeometryLods, type LodLevel } from '../../shared/lod/geometry';
import { buildMonarchBody } from './body';
import { buildMonarchWings } from './wings';
import { MONARCH, type MonarchPose } from './definition';
import { applyMonarchPose } from './motion';

const states = new WeakMap<Group, { pose: MonarchPose; time: number; bones: Bone[] }>();
const poses = new Set<MonarchPose>(['flight','perched','basking']);
export interface MonarchOptions { wingspanMeters?: number; seed?: number; pose?: MonarchPose }

export function createMonarchButterfly({ wingspanMeters = MONARCH.wingspanMeters, seed = Math.floor(Math.random()*2**32), pose = 'flight' }: MonarchOptions = {}) {
  if (!Number.isFinite(wingspanMeters) || wingspanMeters<=0) throw new Error('Monarch wingspan must be positive metres');
  if (!Number.isInteger(seed) || seed<0 || seed>0xffffffff) throw new Error('Monarch seed must be uint32');
  if (!poses.has(pose)) throw new Error('Unknown monarch pose');
  const root = new Group(); root.name = 'Monarch butterfly';
  const build = (detail: LodLevel) => {
    const body = buildMonarchBody(wingspanMeters,detail), wings = buildMonarchWings({seed,wingspanMeters,detail});
    const combined = mergeGeometries([body,wings])!; body.dispose(); wings.dispose();
    combined.name = `monarch-body-and-four-wings-${detail}`; combined.computeBoundingBox(); combined.computeBoundingSphere(); return combined;
  };
  const geometry = build('near');
  defineGeometryLods(geometry,()=>({mid:build('mid'),far:build('far')}));
  const mesh = new SkinnedMesh(geometry, createToonMaterial({vertexColors:true,rim:false,name:'monarch-matte-pigment'}));
  mesh.name = 'monarch-one-skinned-batch'; mesh.castShadow = true;
  const unit = wingspanMeters/100, bones = ['thorax','fore-left','fore-right','hind-left','hind-right'].map(name=>{const bone=new Bone();bone.name=`monarch-${name}`;return bone;});
  for(let i=1;i<5;i++){bones[i].position.set((i%2===0?1:-1)*1.5*unit,0,i<3?0:unit);bones[0].add(bones[i]);}
  mesh.add(bones[0]);root.add(mesh);root.updateMatrixWorld(true);
  const skeleton = new Skeleton(bones); mesh.bind(skeleton);
  // Fixed flight envelope: no per-frame bounds scan, frustum clipping or wing/plinth intersection.
  mesh.boundingBox = new Box3(new Vector3(-.51,-.51,-.34).multiplyScalar(wingspanMeters),new Vector3(.51,.51,.37).multiplyScalar(wingspanMeters));
  mesh.boundingSphere = new Sphere(new Vector3(), wingspanMeters*.64);
  root.userData = {
    assetId: MONARCH.id, species: MONARCH.species, units:'metres', seed, wingspanMeters,
    wingspanRangeMeters:[...MONARCH.wingspanRangeMeters], source:MONARCH.source, sizeBasis:MONARCH.sizeBasis, budget:MONARCH.budget,
    sourceParts:['head','thorax','abdomen','clubbed-antennae','six-legs','forewings','hindwings','vein-cells','marginal-spots','ventral-pigment'],
    physics:{colliders:[{shape:'capsule',radius:2.5*unit,halfLength:11*unit,axis:'z',center:[0,-.5*unit,1.5*unit]}],anchors:{perch:[0,-5*unit,0],grip:[0,0,0]},basis:'Coarse body only; wings excluded. No flight dynamics, mass or collisions are simulated.'},
  };
  states.set(root,{pose,time:0,bones});applyMonarchPose(bones,pose,0);
  // Generic object disposal releases the active LOD family; the source event also owns the rig.
  geometry.addEventListener('dispose',()=>{if(states.delete(root))skeleton.dispose();});
  return root;
}

/** Host owns pause and translation. Rest/basking remain still even when update is called. */
export function updateMonarchButterfly(root: Group, dt: number) {
  const state=states.get(root);if(!state||state.pose!=='flight'||!Number.isFinite(dt)||dt<=0)return;
  state.time+=dt;applyMonarchPose(state.bones,state.pose,state.time);
}
export function setMonarchPose(root: Group, pose: MonarchPose) {
  if(!poses.has(pose))throw new Error('Unknown monarch pose');
  const state=states.get(root);if(!state)return;state.pose=pose;state.time=0;applyMonarchPose(state.bones,pose,0);
}
export function getMonarchState(root: Group) {
  const state=states.get(root);return state?{pose:state.pose,time:state.time,wingAngles:state.bones.slice(1).map(b=>b.rotation.z)}:undefined;
}
