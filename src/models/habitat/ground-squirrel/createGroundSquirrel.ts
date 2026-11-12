import {Color,Group,InstancedMesh,Matrix4,Mesh} from 'three';
import {createToonMaterial} from '../../shared/style';
import {defineGeometryLods} from '../../shared/lod/geometry';
import {disposeObject} from '../../props/primitives';
import {SQUIRREL,SQUIRREL_POSES,type SquirrelPose} from './definition';
import {buildSquirrelGeometry} from './geometry';
const models=new WeakMap<Group,ReturnType<typeof createGroundSquirrel>>(),batches=new WeakMap<Group,ReturnType<typeof createSquirrelBatch>>();
function geometry(seed:number){const g=buildSquirrelGeometry('near',seed);defineGeometryLods(g,()=>({mid:buildSquirrelGeometry('mid',seed),far:buildSquirrelGeometry('far',seed)}));return g;}
function validateSeed(seed:number){if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw new RangeError('Squirrel seed must be uint32');}
function validPose(pose:SquirrelPose){if(!SQUIRREL_POSES.includes(pose))throw new RangeError('Unknown squirrel pose');}
export function squirrelWeights(out:number[],pose:SquirrelPose,time:number){
 out.fill(0);if(pose==='alert')return out;
 const a=pose==='forage'?0:2,w=.5+.5*Math.sin(time*(pose==='forage'?5:18));out[a]=w;out[a+1]=1-w;return out;
}
export function createGroundSquirrel({seed=Math.floor(Math.random()*2**32),pose='alert' as SquirrelPose}={}){
 validateSeed(seed);validPose(pose);const root=new Group(),mesh=new Mesh(geometry(seed),createToonMaterial({vertexColors:true,rim:false,name:'ground-squirrel-matte'}));
 root.name='California ground squirrel';mesh.name='squirrel-one-morph-batch';root.add(mesh);mesh.castShadow=mesh.receiveShadow=true;
 root.userData={inspectionHeadingRadians:Math.PI,assetId:'california-ground-squirrel',units:'metres',seed,lengthMeters:SQUIRREL.lengthMeters,heightMeters:SQUIRREL.heightMeters,sourceParts:mesh.geometry.userData.sourceParts,requestedBy:SQUIRREL.requestedBy,physics:{colliders:[{shape:'capsule',axis:'y',radius:.055,halfLength:.10,center:[0,.155,0]}],anchors:{feet:[0,0,0],head:[0,.278,-.007]},ownership:'Host owns root placement; render morphs and LOD never move physics.'}};
 let time=0,disposed=false;
 const result={root,mesh,get pose(){return pose;},setPose(next:SquirrelPose){validPose(next);pose=next;squirrelWeights(mesh.morphTargetInfluences!,pose,time);},update(dt:number){if(disposed||!Number.isFinite(dt)||dt<=0)return;time+=Math.min(dt,.1);squirrelWeights(mesh.morphTargetInfluences!,pose,time);},dispose(){if(disposed)return;disposed=true;models.delete(root);disposeObject(root);}};
 mesh.geometry.addEventListener('dispose',()=>{disposed=true;models.delete(root);});models.set(root,result);result.setPose(pose);return result;
}
/** Per-slot morph weights and matrices share one GPU draw, including distance LOD. */
export function createSquirrelBatch({count=8,seed=734}:{count?:number;seed?:number}={}){
 if(!Number.isInteger(count)||count<1||count>32)throw new RangeError('Squirrel batch count must be 1–32');validateSeed(seed);
 const root=new Group(),g=geometry(seed),mesh=new InstancedMesh(g,createToonMaterial({vertexColors:true,rim:false,name:'squirrel-group-matte'}),count),sample=new Mesh(g,mesh.material);
 mesh.morphTargetInfluences=sample.morphTargetInfluences;
 root.name='Ground squirrel group';mesh.name='squirrel-instanced-morph-group';root.add(mesh);mesh.castShadow=mesh.receiveShadow=true;
 const weights=Array.from({length:count},()=>[0,0,0,0]),target=[0,0,0,0];
 const poses:SquirrelPose[]=Array.from({length:count},(_,i)=>SQUIRREL_POSES[i%3]);let time=0,disposed=false;
 for(let i=0;i<count;i++){mesh.setMatrixAt(i,new Matrix4().makeTranslation((i%4)*.55,0,Math.floor(i/4)*.65));mesh.setColorAt(i,new Color().setScalar(.9+(i%5)*.04));squirrelWeights(sample.morphTargetInfluences!,poses[i],i*.73);mesh.setMorphAt(i,sample);}
 mesh.computeBoundingBox();mesh.computeBoundingSphere();
 root.userData={inspectionHeadingRadians:Math.PI,assetId:'california-ground-squirrel',instanceCount:count,units:'metres',seed,count,requestedBy:SQUIRREL.requestedBy};
 const result={root,mesh,count,setPose(pose:SquirrelPose){validPose(pose);poses.fill(pose);},setSlotPose(slot:number,pose:SquirrelPose){validPose(pose);if(slot<0||slot>=count||!Number.isInteger(slot))throw new RangeError('Invalid squirrel slot');poses[slot]=pose;},
 update(dt:number){if(disposed||!Number.isFinite(dt)||dt<0)return;time+=Math.min(dt,.1);for(let i=0;i<count;i++){squirrelWeights(target,poses[i],time+i*.73);const alpha=dt===0?1:1-Math.exp(-9*dt);for(let j=0;j<4;j++){weights[i][j]+=(target[j]-weights[i][j])*alpha;sample.morphTargetInfluences![j]=weights[i][j];}mesh.setMorphAt(i,sample);}mesh.morphTexture!.needsUpdate=true;},
 dispose(){if(disposed)return;disposeObject(root);}};
 g.addEventListener('dispose',()=>{if(disposed)return;disposed=true;batches.delete(root);mesh.dispose();});batches.set(root,result);return result;
}
export function animateGroundSquirrel(root:Group,dt:number){(models.get(root)??batches.get(root))?.update(dt);}
export function setGroundSquirrelPose(root:Group,pose:SquirrelPose){(models.get(root)??batches.get(root))?.setPose(pose);}
