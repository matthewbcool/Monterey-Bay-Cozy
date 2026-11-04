import { InstancedMesh, Mesh, type Object3D } from 'three';

export interface MeshStats { drawCalls:number; triangles:number }
/** Nominal visible mesh submissions in one color pass, before camera culling.
 * Instancing multiplies triangles, not submissions. Scene, shadows, transparent
 * extra passes and postprocessing are outside these model-only counts.
 */
export function modelStats(root:Object3D){
  const model:MeshStats={drawCalls:0,triangles:0};
  root.traverseVisible(object=>{
    if(!(object instanceof Mesh))return;
    const instances=object instanceof InstancedMesh?object.count:1;
    if(instances===0)return;
    const g=object.geometry,total=g.index?.count??g.attributes.position?.count??0;
    const start=g.drawRange.start,end=Math.min(total,start+g.drawRange.count);
    const target=model;
    const groups=Array.isArray(object.material)?g.groups:[{start:0,count:total,materialIndex:0}];
    for(const group of groups){
      const material=Array.isArray(object.material)?object.material[group.materialIndex??0]:object.material;
      if(!material?.visible)continue;
      const count=Math.max(0,Math.min(end,group.start+group.count)-Math.max(start,group.start));
      if(count<3)continue;
      target.drawCalls++;target.triangles+=Math.floor(count/3)*instances;
    }
  });
  return {model};
}
