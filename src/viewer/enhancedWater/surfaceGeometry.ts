/** An optional camera-local 16 m patch resolves the existing waves at 12.5 cm spacing.
 * The far coastline mesh remains; fragments choose one surface, avoiding coplanar overdraw.
 * Geometry uploads once. Only the snapped patch origin changes during camera travel.
 */
import {defineGeometryLods} from '../../models/shared/lod/geometry';
import {BufferGeometry,Float32BufferAttribute,PlaneGeometry} from 'three';
export function enhancedSurfaceGeometry(base:BufferGeometry){
 const patch=new PlaneGeometry(16,16,128,128);patch.rotateX(-Math.PI/2);
 const a=base.attributes.position,b=patch.attributes.position,positions=new Float32Array((a.count+b.count)*3),flags=new Float32Array(a.count+b.count);
 positions.set(a.array);positions.set(b.array,a.count*3);flags.fill(1,a.count);
 const ai=base.index?Array.from(base.index.array):Array.from({length:a.count},(_,i)=>i),bi=Array.from(patch.index!.array,i=>i+a.count);
 const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setAttribute('waterPatch',new Float32BufferAttribute(flags,1));geometry.setIndex([...ai,...bi]);geometry.computeBoundingSphere();patch.dispose();
 defineGeometryLods(geometry,()=>({mid:geometry,far:geometry}));
 return geometry;
}
