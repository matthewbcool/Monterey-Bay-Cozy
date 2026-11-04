import { Color, DirectionalLight, HemisphereLight, PerspectiveCamera, Scene, Vector3 } from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { createDeer } from '../src/models/habitat/deer/createDeer';
import type { DeerPose, DeerVariant } from '../src/models/habitat/deer/definition';
import { createLodController } from '../src/models/shared/lod/controller';
import { STYLE } from '../src/models/shared/style';
import { applyNodeStyle } from '../src/viewer/nodeStyle';

/** Explicit production-style poses with no animation loop or scenery overhead. */
export async function reviewDeer(forceWebGL=false){
 const renderer=new WebGPURenderer({antialias:true,forceWebGL});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(1);document.body.append(renderer.domElement);await renderer.init();
 const scene=new Scene();scene.background=new Color('#38636e');
 const sun=new DirectionalLight(STYLE.sun.color,STYLE.sun.intensity);sun.position.copy(STYLE.sun.direction);scene.add(sun,new HemisphereLight(STYLE.sky.color,STYLE.sky.ground,STYLE.sky.intensity));
 const camera=new PerspectiveCamera(40,innerWidth/innerHeight,.01,10000),lod=createLodController();
 let model:ReturnType<typeof createDeer>;
 function frame(profile=false){const h=model.dimensions.heightMeters;camera.position.set(profile?-3.5:-3,h*.8,profile?.05:-3.2);camera.lookAt(0,h*.46,-.1);camera.updateMatrixWorld(true);}
 async function select(variant:DeerVariant){model?.dispose();model=createDeer({variant,seed:42});scene.add(model.root);applyNodeStyle(model.root);await lod.register(model.root);frame();}
 function pose(pose:DeerPose,time=0){model.poseAt(time,{pose});}
 async function render(){scene.updateMatrixWorld(true);model.mesh.skeleton.update();lod.update(camera,innerHeight,0,true);await renderer.compileAsync(scene,camera);renderer.info.reset();renderer.render(scene,camera);const full={...renderer.info.render};model.root.visible=false;renderer.info.reset();renderer.render(scene,camera);const empty={...renderer.info.render};model.root.visible=true;renderer.info.reset();renderer.render(scene,camera);
  return {backend:renderer.backend.constructor.name,stats:lod.stats(model.root),active:lod.inspect(model.root),rendered:{draws:full.drawCalls-empty.drawCalls,triangles:full.triangles-empty.triangles},scene:full,root:model.root.position.toArray(),scale:model.root.scale.toArray()};}
 await select('adult');await render();
 return {renderer,scene,camera,lod,frame,select,pose,render,Vector3,get model(){return model;},dispose(){lod.dispose();model.dispose();renderer.dispose();}};
}
