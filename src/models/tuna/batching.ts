import { BufferGeometry, Float32BufferAttribute, Matrix3, Matrix4, Mesh } from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ModelAssembly } from '../shared/assembly';
import { TunaCelMaterial, type TunaSwimUniforms } from './toon';

export const TUNA_HINGES=['tail','dorsal-primary','pectoral-far','pectoral-near'] as const;
/** Bake shape and paint once. Four tiny rigid transforms preserve the existing fin motion exactly. */
export function batchTuna(a:ModelAssembly,swim:TunaSwimUniforms){
  a.visual.updateWorldMatrix(true,true);
  const inverse=a.visual.matrixWorld.clone().invert();
  const hinges=TUNA_HINGES.map(name=>{const group=a.parts.get(name)!;group.updateMatrix();return {group,bind:group.matrix.clone().invert()};});
  const transforms=Array.from({length:5},()=>new Matrix4()),normals=Array.from({length:5},()=>new Matrix3());
  const material=new TunaCelMaterial({color:'#ffffff',vertexColors:true,matte:false,bend:true,swim,batched:{transforms,normals}});
  const buckets=new Map<string,BufferGeometry[]>([['body',[]],['head-details',[]],['caught-details',[]]]);
  const meshes:Mesh[]=[],oldMaterials=new Set<TunaCelMaterial>();
  for(const [id,group] of a.parts){
    const bucket=buckets.get(id==='head-details'||id==='caught-details'?id:'body')!;
    const joint=TUNA_HINGES.indexOf(id as typeof TUNA_HINGES[number])+1;
    group.traverse(o=>{
      if(!(o instanceof Mesh))return;meshes.push(o);
      const source=o.material as TunaCelMaterial;oldMaterials.add(source);
      const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();
      g.applyMatrix4(new Matrix4().multiplyMatrices(inverse,o.matrixWorld));g.deleteAttribute('uv');
      const n=g.attributes.position.count,colors=new Float32Array(n*3),mask=new Float32Array(n),joints=new Float32Array(n);
      const tint=source.uniforms.baseColor.value,paint=g.attributes.color;
      for(let i=0;i<n;i++){
        colors[i*3]=tint.r*(paint?paint.getX(i):1);colors[i*3+1]=tint.g*(paint?paint.getY(i):1);colors[i*3+2]=tint.b*(paint?paint.getZ(i):1);
        mask[i]=source.uniforms.matte.value;joints[i]=joint;
      }
      g.setAttribute('color',new Float32BufferAttribute(colors,3));g.setAttribute('fishMatte',new Float32BufferAttribute(mask,1));g.setAttribute('tunaJoint',new Float32BufferAttribute(joints,1));bucket.push(g);
    });
  }
  meshes.forEach(m=>{m.removeFromParent();m.geometry.dispose();});oldMaterials.forEach(m=>m.dispose());
  for(const [id,pieces] of buckets){
    const merged=mergeGeometries(pieces,false)!;pieces.forEach(g=>g.dispose());
    const geometry=mergeVertices(merged,1e-7);merged.dispose();geometry.computeBoundingBox();geometry.computeBoundingSphere();
    // Include the complete sweep of hinged fins and the existing tail wave for conservative culling.
    geometry.boundingSphere!.radius+=.65;
    const mesh=new Mesh(geometry,material);mesh.name='tuna:'+id;a.parts.get(id)!.add(mesh);
  }
  material.userData.tunaBatched=true;
  return {material,transforms,normals,sync(){
    hinges.forEach(({group,bind},i)=>{group.updateMatrix();transforms[i+1].multiplyMatrices(group.matrix,bind);normals[i+1].getNormalMatrix(transforms[i+1]);});
  }};
}
export type TunaBatch=ReturnType<typeof batchTuna>;
