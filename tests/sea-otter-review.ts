import { Color, DirectionalLight, HemisphereLight, PerspectiveCamera, Scene, Vector3 } from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { createSeaOtter } from '../src/models/habitat/sea-otter/createSeaOtter';
import type { SeaOtterPose } from '../src/models/habitat/sea-otter/definition';
import { createLodController } from '../src/models/shared/lod/controller';
import { STYLE } from '../src/models/shared/style';
import { applyNodeStyle } from '../src/viewer/nodeStyle';

/** Deterministic production-material fixture; no timers or scenery draws. */
export async function reviewSeaOtter(forceWebGL=false){
 const renderer=new WebGPURenderer({antialias:true,forceWebGL});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(1);document.body.append(renderer.domElement);await renderer.init();
 const scene=new Scene();scene.background=new Color('#38636e');
 const sun=new DirectionalLight(STYLE.sun.color,STYLE.sun.intensity);sun.position.copy(STYLE.sun.direction);scene.add(sun,new HemisphereLight(STYLE.sky.color,STYLE.sky.ground,STYLE.sky.intensity));
 const camera=new PerspectiveCamera(38,innerWidth/innerHeight,.01,10000),lod=createLodController();
 const model=createSeaOtter({seed:42});scene.add(model.root);applyNodeStyle(model.root);await lod.register(model.root);
 function frame(view='three-quarter'){
  const positions:Record<string,[number,number,number]>={'three-quarter':[-1.65,1.8,-1.7],profile:[-2.4,.55,0],top:[0,2.7,.001],underside:[0,-2.7,.001],face:[-.6,.85,-1.2]};
  camera.position.set(...positions[view]);camera.lookAt(0,0,view==='face'?-.3:0);camera.updateMatrixWorld(true);
 }
 function pose(pose:SeaOtterPose,time=0){model.poseAt(time,{pose});}
 async function render(){scene.updateMatrixWorld(true);model.mesh.skeleton.update();camera.updateMatrixWorld(true);lod.update(camera,innerHeight,0,true);await renderer.compileAsync(scene,camera);renderer.info.reset();renderer.render(scene,camera);const full={...renderer.info.render};model.root.visible=false;renderer.info.reset();renderer.render(scene,camera);const empty={...renderer.info.render};model.root.visible=true;renderer.info.reset();renderer.render(scene,camera);
  return {backend:renderer.backend.constructor.name,stats:lod.stats(model.root),active:lod.inspect(model.root),rendered:{draws:full.drawCalls-empty.drawCalls,triangles:full.triangles-empty.triangles},scene:full,root:model.root.position.toArray(),scale:model.root.scale.toArray()};}
 frame();await render();
 return {renderer,scene,camera,lod,frame,pose,render,model,Vector3,dispose(){lod.dispose();model.dispose();renderer.dispose();}};
}
