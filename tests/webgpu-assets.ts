import { AmbientLight, Box3, Color, DirectionalLight, PerspectiveCamera, Scene, Vector3, WebGPURenderer } from 'three/webgpu';
import {propCollection} from '../src/models/props/catalogue';
import {disposeObject} from '../src/models/props/primitives';

export async function checkAssetBackend(forceWebGL=false){
 const renderer=new WebGPURenderer({antialias:true,forceWebGL});renderer.setSize(1100,780);document.body.append(renderer.domElement);
 await renderer.init();
 const scene=new Scene();scene.background=new Color('#193e48');scene.add(new AmbientLight(0xffffff,2));const sun=new DirectionalLight(0xffffff,3);sun.position.set(-4,10,7);scene.add(sun);
 const objects=propCollection.map((entry,i)=>{const root=entry.create();const bounds=new Box3().setFromObject(root);root.position.set((i%3-1)*4,-bounds.min.y,Math.floor(i/3)*5-2.5);scene.add(root);return root;});
 const camera=new PerspectiveCamera(42,1100/780,.05,100);camera.position.set(13,14,19);camera.lookAt(new Vector3(0,1,0));
 await renderer.renderAsync(scene,camera);
 const result={backend:renderer.backend.constructor.name,forceWebGL,render:{...renderer.info.render},modelCount:objects.length};
 // Leave the frame available for the browser screenshot; caller owns cleanup.
 return {result,dispose(){objects.forEach(disposeObject);renderer.dispose();}};
}
