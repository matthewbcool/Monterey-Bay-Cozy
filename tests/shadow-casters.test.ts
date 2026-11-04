import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Box3,BoxGeometry,DirectionalLight,Frustum,Mesh,PerspectiveCamera,PlaneGeometry,Scene,Vector3,WebGLCoordinateSystem,WebGPUCoordinateSystem} from 'three';
import {createShadowCasterCulling,shadowCanReach} from '../src/viewer/shadowCasters';

test('shadow culling retains offscreen casters whose projected shadow can enter the view',()=>{
 const camera=new PerspectiveCamera(60,1,1,100);camera.updateMatrixWorld();const frustum=new Frustum().setFromProjectionMatrix(camera.projectionMatrix);
 const box=new Box3(new Vector3(20,-1,-21),new Vector3(22,1,-19));
 assert(!frustum.intersectsBox(box));
 assert(shadowCanReach(box,new Vector3(-1,0,0),30,frustum),'Offscreen tree can cast into visible ground');
 assert(!shadowCanReach(box,new Vector3(1,0,0),30,frustum),'Away-facing shadow cannot contribute');
 assert(!shadowCanReach(box,new Vector3(-1,0,0),1,frustum),'A shadow that ends before the view cannot contribute');
});

test('swept box culling has no false rejections for independently sampled interior points',()=>{
 const camera=new PerspectiveCamera(60,1.4,1,140),frustum=new Frustum().setFromProjectionMatrix(camera.projectionMatrix);
 let seed=42;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/2**32);
 const point=new Vector3();let visible=0,rejected=0;
 for(let i=0;i<400;i++){
  const center=new Vector3((random()-.5)*180,(random()-.5)*100,-random()*180),size=new Vector3(1+random()*10,1+random()*10,1+random()*10),box=new Box3().setFromCenterAndSize(center,size),direction=new Vector3(random()-.5,-random(),random()-.5).normalize();
  const result=shadowCanReach(box,direction,150,frustum);if(!result)rejected++;
  for(let t=0;t<=150;t+=3){point.copy(center).addScaledVector(direction,t);if(frustum.containsPoint(point)){visible++;assert(result);break;}}
 }
 assert(visible>30&&rejected>30,'Fixture exercises both kept and rejected casters');
});

test('per-cascade layers preserve color, keep receiving geometry and clean up replaced casters',()=>{
 for(const coordinateSystem of [WebGLCoordinateSystem,WebGPUCoordinateSystem]){
  const scene=new Scene(),camera=new PerspectiveCamera(50,1,.1,3600);camera.coordinateSystem=coordinateSystem;camera.position.set(0,5,10);camera.lookAt(0,0,-50);camera.updateProjectionMatrix();camera.updateMatrixWorld();
  const ground=new Mesh(new PlaneGeometry(2000,2000));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
  const near=new Mesh(new BoxGeometry(2,6,2));near.position.set(0,3,-10);near.castShadow=true;near.layers.enable(7);scene.add(near);scene.updateMatrixWorld(true);
  const views=Array.from({length:3},()=>({camera:new DirectionalLight().shadow.camera,texel:.1}));views.forEach(v=>v.camera.far=8000);
  const culling=createShadowCasterCulling(),original=near.layers.mask;
  culling.update(scene,camera,new Vector3(.2,1,.1).normalize(),[80/3600,360/3600,1],3600,views);
  assert(near.layers.test(camera.layers),'Color visibility remains unchanged');assert(near.layers.isEnabled(7),'Unrelated layers are preserved');assert(near.layers.isEnabled(1));assert(!near.layers.isEnabled(3),'Near caster cannot shadow distant receivers below the actual ground floor');
  assert.equal(ground.layers.mask,1);assert(culling.getSnapshot().kept[2]<culling.getSnapshot().candidates);
  scene.remove(near);culling.update(scene,camera,new Vector3(0,1,0),[80/3600,360/3600,1],3600,views);assert.equal(near.layers.mask,original);
  culling.dispose();near.geometry.dispose();ground.geometry.dispose();
 }
});
