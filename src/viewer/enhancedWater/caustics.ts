/** One additive RGB splat draw: refract the shared waves at three indices of refraction.
 * Area-ratio focusing, with a bounded camera-local atlas and depth-dependent mip blur.
 */
import {AdditiveBlending,DoubleSide,HalfFloatType,InstancedMesh,Matrix4,OrthographicCamera,PlaneGeometry,RenderTarget,Scene,Vector2} from 'three';
import {MeshBasicNodeMaterial} from 'three/webgpu';
import {abs,clamp,dFdx,dFdy,float,instanceIndex,max,mix,normalize,positionLocal,refract,select,smoothstep,texture,uniform,varying,vec3,vec4} from 'three/tsl';
import {waveNode} from '../water';
import type {createWaterMedium} from './medium';
type N=any;
export function createChromaticCaustics(water:any,medium:ReturnType<typeof createWaterMedium>){
 const span=20,resolution=1024,focusDepth=4,segments=192;
 const origin=uniform(new Vector2()),enabled=uniform(1);
 const target=new RenderTarget(resolution,resolution,{type:HalfFloatType,depthBuffer:false});target.texture.name='Enhanced RGB wave caustics';target.texture.generateMipmaps=true;
 const geometry=new PlaneGeometry(span*1.3,span*1.3,segments,segments);
 const material=new MeshBasicNodeMaterial({name:'RGB refracted wave focusing',side:DoubleSide,transparent:true,blending:AdditiveBlending,depthTest:false,depthWrite:false,fog:false});material.forceSinglePass=true;
 const source=positionLocal.xy.add(origin),w=waveNode(source.sub(medium.origin.xz),water.uniforms.time,water.uniforms.chop);
 const n=normalize(vec3(w.y.negate(),1,w.z.negate()));
 const ior=select(instanceIndex.equal(0),float(1.331),select(instanceIndex.equal(1),float(1.333),float(1.337)));
 const ray=refract(water.uniforms.sun.negate(),n,float(1).div(ior));
 const hit=source.add(ray.xz.mul(w.x.add(focusDepth).div(max(.15,ray.y.negate()))));
 material.positionNode=vec3(hit.sub(origin),0);
 const old=varying(source,'causticSource'),landed=varying(hit,'causticLanded');
 const area=(p:N)=>abs(dFdx(p).x.mul(dFdy(p).y).sub(dFdx(p).y.mul(dFdy(p).x)));
 const focus=clamp(area(old).div(max(.000001,area(landed))),0,5);
 const rgb=select(instanceIndex.equal(0),vec3(1,0,0),select(instanceIndex.equal(1),vec3(0,1,0),vec3(0,0,1)));
 material.colorNode=vec4(rgb.mul(focus),1);
 const mesh=new InstancedMesh(geometry,material,3);for(let i=0;i<3;i++)mesh.setMatrixAt(i,new Matrix4());mesh.frustumCulled=false;
 const scene=new Scene();scene.add(mesh);const camera=new OrthographicCamera(-span/2,span/2,span/2,-span/2,.1,10);camera.position.z=1;
 function sample(p:N):N{
  const depth=medium.depth(p),offset=medium.down.xz.mul(float(focusDepth).sub(depth).div(max(.2,medium.down.y.negate())));
  const uv=p.xz.add(offset).sub(origin).div(span).add(.5);
  const edge=max(abs(uv.x.sub(.5)),abs(uv.y.sub(.5)));
  const color=texture(target.texture,uv).level(max(0,depth.sub(3).mul(.3))).rgb;
  return mix(vec3(1),clamp(color,0,5),float(1).sub(smoothstep(.4,.49,edge)).mul(enabled));
 }
 return {target,origin,enabled,sample,triangles:segments*segments*2*3,
  render(renderer:any,position:Vector2){origin.value.set(Math.floor(position.x/2)*2,Math.floor(position.y/2)*2);renderer.setRenderTarget(target);renderer.setClearColor(0,0);renderer.clear();renderer.render(scene,camera);},
  dispose(){geometry.dispose();material.dispose();mesh.dispose();target.dispose();}};
}
