import { BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Matrix4, Mesh, MeshStandardMaterial } from 'three';
import { createToonMaterial } from './style';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Bake static procedural components into metre-scale geometry and two toon batches (matte and metal).
 * Source builders keep meaningful names; runtime vertices carry their colors.
 * Do not use across independently animated parts: batch each motion group separately.
 */
export function finishStaticAsset(root:Group,id:string,metresPerDesignUnit:readonly[number,number,number],{rim=true,doubleSided=false}:{rim?:boolean;doubleSided?:boolean}={}){
  root.updateMatrixWorld(true);
  const inverse=root.matrixWorld.clone().invert(),scale=new Matrix4().makeScale(...metresPerDesignUnit);
  const buckets=new Map<'matte'|'metal',BufferGeometry[]>(),originals=new Set<BufferGeometry>(),materials=new Set<MeshStandardMaterial>();
  const sourceParts:string[]=[];
  root.traverse(object=>{
    if(!(object instanceof Mesh))return;
    if(Array.isArray(object.material)||!(object.material instanceof MeshStandardMaterial))throw new Error('Static asset batching requires single standard materials');
    const material=object.material,key=material.metalness>.1?'metal':'matte';
    const geometry=object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone();
    geometry.applyMatrix4(new Matrix4().multiplyMatrices(scale,new Matrix4().multiplyMatrices(inverse,object.matrixWorld)));
    geometry.deleteAttribute('uv');
    const colors=new Float32Array(geometry.attributes.position.count*3);
    for(let i=0;i<colors.length;i+=3){colors[i]=material.color.r;colors[i+1]=material.color.g;colors[i+2]=material.color.b;}
    geometry.setAttribute('color',new Float32BufferAttribute(colors,3));
    if(!buckets.has(key))buckets.set(key,[]);buckets.get(key)!.push(geometry);
    originals.add(object.geometry);materials.add(material);sourceParts.push(object.name);
  });
  root.clear();
  for(const [key,geometries] of buckets){
    const combined=mergeGeometries(geometries);if(!combined)throw new Error('Incompatible static asset geometry');
    const material=createToonMaterial({vertexColors:true,metal:key==='metal',name:`${id}-${key}`,rim,side:doubleSided?DoubleSide:undefined});
    const mesh=new Mesh(combined,material);mesh.name=`${id}-${key}-batch`;mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
    geometries.forEach(g=>g.dispose());
  }
  originals.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
  root.userData={assetId:id,units:'metres',authoring:'procedural TypeScript',sourceParts};
  return root;
}
