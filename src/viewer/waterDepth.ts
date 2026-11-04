/** Small optical lookup derived once from the world's existing floor sampler.
 * This colors water; collision and scientific provenance still belong to the source terrain.
 * R8 + linear filtering works on both WebGPU and WebGL 2. No mipmaps or per-frame uploads.
 */
import {ClampToEdgeWrapping,DataTexture,LinearFilter,RedFormat,UnsignedByteType} from 'three';
import {clamp,float,min,mix,smoothstep,texture,vec2} from 'three/tsl';
// TSL expression types are incomplete in @types/three.
type N=any;
export interface WaterDepthSource {
 bounds:{minX:number;maxX:number;minZ:number;maxZ:number};
 surfaceY:number;
 floorAt:(x:number,z:number)=>number;
 /** Optical saturation in metres, not the maximum depth of the terrain. */
 maxDepth?:number;
 width?:number;
 height?:number;
}
export function createWaterDepth(source:WaterDepthSource){
 const {bounds,surfaceY,floorAt}=source,width=source.width??256,height=source.height??192,maxDepth=source.maxDepth??32;
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<2||height<2||width>512||height>512||!Number.isFinite(maxDepth)||maxDepth<=0||!Number.isFinite(surfaceY)||!Object.values(bounds).every(Number.isFinite)||bounds.maxX<=bounds.minX||bounds.maxZ<=bounds.minZ)throw new Error('Invalid water depth field');
 const data=new Uint8Array(width*height),spanX=bounds.maxX-bounds.minX,spanZ=bounds.maxZ-bounds.minZ;
 for(let z=0;z<height;z++)for(let x=0;x<width;x++){
  const floor=floorAt(bounds.minX+spanX*x/(width-1),bounds.minZ+spanZ*z/(height-1));
  data[z*width+x]=Math.round(255*(Number.isFinite(floor)?Math.max(0,Math.min(maxDepth,surfaceY-floor))/maxDepth:1));
 }
 const map=new DataTexture(data,width,height,RedFormat,UnsignedByteType);map.name='World seafloor optical depth · R8';
 map.minFilter=map.magFilter=LinearFilter;map.wrapS=map.wrapT=ClampToEdgeWrapping;map.generateMipmaps=false;map.needsUpdate=true;
 return {map,bounds:{...bounds},width,height,maxDepth,bytes:data.byteLength,dispose(){map.dispose();}};
}
export type WaterDepthField=ReturnType<typeof createWaterDepth>;
/** World coordinates keep depth fixed as the camera moves. Texel centres correspond exactly
 * to the CPU sample grid. Blend to optically deep water at the finite data boundary. */
export function waterDepthNode(field:WaterDepthField,worldXZ:N):N{
 const {bounds:b,width,height,maxDepth}=field;
 const uv=worldXZ.sub(vec2(b.minX,b.minZ)).div(vec2(b.maxX-b.minX,b.maxZ-b.minZ));
 const texelUV=clamp(uv,0,1).mul(vec2((width-1)/width,(height-1)/height)).add(vec2(.5/width,.5/height));
 const depth=texture(field.map,texelUV).r.mul(maxDepth);
 const edge=min(min(worldXZ.x.sub(b.minX),float(b.maxX).sub(worldXZ.x)),min(worldXZ.y.sub(b.minZ),float(b.maxZ).sub(worldXZ.y)));
 return mix(float(maxDepth),depth,smoothstep(0,32,edge));
}
