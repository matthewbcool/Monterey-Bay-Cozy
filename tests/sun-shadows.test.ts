import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DirectionalLight,PerspectiveCamera,Scene,Vector3,WebGLCoordinateSystem,WebGPUCoordinateSystem} from 'three';
import {type NodeBuilder,type NodeFrame} from 'three/webgpu';
import {createSunShadows,GYM_SUN_SHADOWS} from '../src/viewer/sunShadows';

function fixture(tier:'base'|'standard'='standard',coordinateSystem:typeof WebGLCoordinateSystem|typeof WebGPUCoordinateSystem=WebGPUCoordinateSystem){
 const scene=new Scene(),sun=new DirectionalLight(),camera=new PerspectiveCamera(55,16/9,.1,10000);
 camera.coordinateSystem=coordinateSystem;camera.updateProjectionMatrix();scene.add(sun,sun.target);
 const shadows=createSunShadows(sun,camera,tier);
 shadows.update(new Vector3(.4,.8,.3).normalize());
 // setup lazily initializes frusta and helper lights without needing a GPU in numerical tests.
 shadows.node.setup({camera,renderer:{coordinateSystem}} as unknown as NodeBuilder);
 const update=()=>{camera.updateMatrixWorld(true);shadows.node.updateBefore({} as NodeFrame);for(const light of shadows.node.lights)light.shadow!.updateMatrices(light as DirectionalLight);};
 return {scene,sun,camera,shadows,update};
}

test('all view-frustum corners remain inside a shadow map when walking, flying and resizing',()=>{
 for(const coordinateSystem of [WebGLCoordinateSystem,WebGPUCoordinateSystem])for(const tier of ['base','standard'] as const){
  const f=fixture(tier,coordinateSystem);
  try{
   for(const [x,y,z,fov,aspect,zoom] of [[64,12,-10,55,16/9,1],[100,90,100,55,16/9,1],[180,180,180,70,2.4,1],[-400,3,100,55,.46,1],[20,20,100,55,1.5,2]]){
    f.camera.position.set(x,y,z);f.camera.lookAt(0,5,-40);f.camera.fov=fov;f.camera.aspect=aspect;f.camera.zoom=zoom;f.camera.updateProjectionMatrix();f.update();
    f.shadows.node.frustums.forEach((frustum,index)=>{
     const shadowCamera=f.shadows.node.lights[index].shadow!.camera;
     for(const p of [...frustum.vertices.near,...frustum.vertices.far]){
      const projected=p.clone().applyMatrix4(f.camera.matrixWorld).project(shadowCamera);
      assert(Math.abs(projected.x)<=1.002&&Math.abs(projected.y)<=1.002,`Cascade ${index} clips the view: ${projected.toArray()}`);
      assert(projected.z>=-1.002&&projected.z<=1.002,'Shadow depth must cover the receiver');
     }
    });
   }
   const s=f.shadows.getSnapshot();assert.equal(s.cascades,3);assert.equal(s.fade,true);assert.deepEqual(s.splits,[80,360,3600]);
   assert.equal(s.resolution,tier==='base'?1024:2048);
  }finally{f.shadows.dispose();}
 }
});

test('projection changes refit cascades, weather reaches cloned maps, and tiny motion stays on texels',()=>{
 const f=fixture();try{
  f.camera.position.set(50,10,30);f.camera.lookAt(0,0,0);f.update();
  const initial=f.shadows.node.lights.map(l=>l.position.clone());
  // Translation along the sun's right vector leaves the light-space Z unchanged.
  const right=new Vector3(0,1,0).cross(f.sun.position).normalize().multiplyScalar(1e-7);
  f.camera.position.add(right);f.update();
  initial.forEach((p,i)=>assert(p.distanceTo(f.shadows.node.lights[i].position)<1e-5));
  f.sun.shadow.intensity=.31;f.sun.shadow.autoUpdate=false;f.update();
  for(const s of f.shadows.getSnapshot().maps){assert.equal(s.intensity,.31);assert.equal(s.autoUpdate,false);assert(s.normalBias>=s.width/2048);assert(s.far>s.width);}
  f.camera.far=120;f.camera.updateProjectionMatrix();f.update();
  const s=f.shadows.getSnapshot();assert.equal(s.maxDistance,120);assert.deepEqual(s.splits,[30,72,120]);
  assert(GYM_SUN_SHADOWS.splits[2]*.75>2400+180*.65,'Far fade starts behind the clear-weather local fog even at flight ceiling');
 }finally{f.shadows.dispose();}
});

test('all cascade maps and scene helpers are released exactly once, including before first render',()=>{
 const f=fixture();f.update();let disposed=0;
 for(const light of f.shadows.node.lights)light.shadow!.map={dispose(){disposed++;}} as never;
 f.shadows.dispose();f.shadows.dispose();assert.equal(disposed,3);
 assert.equal(f.sun.shadow.shadowNode,undefined);assert.equal(f.scene.children.length,2);
 const sun=new DirectionalLight(),unused=createSunShadows(sun,new PerspectiveCamera(),'base');unused.dispose();unused.dispose();
});
