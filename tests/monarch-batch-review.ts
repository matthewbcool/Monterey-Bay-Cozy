import { Color, DirectionalLight, HemisphereLight, Matrix4, PerspectiveCamera, Scene, Vector3 } from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { createMonarchBatch } from '../src/models/habitat/monarch-butterfly/createMonarchBatch';
import { createLodController } from '../src/models/shared/lod/controller';
import { STYLE } from '../src/models/shared/style';
import { applyNodeStyle } from '../src/viewer/nodeStyle';

/** Isolated fixture: same material/style/controller as the library, no scenery in measured draws. */
export async function reviewMonarchBatch(forceWebGL=false) {
  const renderer=new WebGPURenderer({antialias:true,forceWebGL});
  renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(1);document.body.append(renderer.domElement);await renderer.init();
  const scene=new Scene();scene.background=new Color('#315757');
  const sun=new DirectionalLight(STYLE.sun.color,STYLE.sun.intensity);sun.position.copy(STYLE.sun.direction);
  scene.add(sun,new HemisphereLight(STYLE.sky.color,STYLE.sky.ground,STYLE.sky.intensity));
  const batch=createMonarchBatch({count:32,capacity:256,seed:42}),lod=createLodController();
  scene.add(batch.root);applyNodeStyle(batch.root);await lod.register(batch.root);
  const camera=new PerspectiveCamera(40,innerWidth/innerHeight,.005,100);
  const center=new Vector3();
  function frame(side=false){batch.bounds.getCenter(center);const size=batch.bounds.getSize(new Vector3());const distance=Math.max(.2,size.length()*1.65);camera.position.copy(center).add(new Vector3(side?1:.4,side?.2:1,side?.2:.55).normalize().multiplyScalar(distance));camera.lookAt(center);camera.updateMatrixWorld(true);}
  async function render(){scene.updateMatrixWorld(true);lod.update(camera,innerHeight,0,true);await renderer.compileAsync(scene,camera);renderer.info.reset();renderer.render(scene,camera);return {...renderer.info.render};}
  frame();await render();
  return {renderer,scene,camera,batch,lod,frame,render,Matrix4,Vector3};
}
