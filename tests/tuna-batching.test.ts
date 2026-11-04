import assert from 'node:assert/strict';
import test from 'node:test';
import { Matrix3, Matrix4, Mesh, Vector3 } from 'three';
import { createModelAssembly } from '../src/models/shared/assembly';
import { buildTunaBody } from '../src/models/tuna/components/body';
import { buildTunaFace } from '../src/models/tuna/components/face';
import { buildTunaFins } from '../src/models/tuna/components/fins';
import { TUNA_BATCHES, TUNA_DEFORMING_PARTS, TUNA_PHYSICS } from '../src/models/tuna/definition';
import { createTunaMaterials } from '../src/models/tuna/materials';
import { attachTunaMotion, swimWave } from '../src/models/tuna/motion';
import { batchTuna } from '../src/models/tuna/batching';
import { TunaCelMaterial } from '../src/models/tuna/toon';

function assembly() {
  const a=createModelAssembly('tuna'),m=createTunaMaterials({});
  buildTunaBody(a,m);buildTunaFins(a,m);buildTunaFace(a,m);
  for(const b of TUNA_BATCHES)a.batchParts(b.components,b.name,{discardUVs:true});
  return {a,m};
}

test('Tuna batching preserves every source triangle, pigment and moving hinge across swim/caught poses',()=>{
  const original=assembly(),optimized=assembly();
  const batch=batchTuna(optimized.a,optimized.m.skin.uniforms);
  const oldFish=attachTunaMotion(original.a.root,original.a.visual,original.a.parts,TUNA_PHYSICS);
  const newFish=attachTunaMotion(optimized.a.root,optimized.a.visual,optimized.a.parts,TUNA_PHYSICS,batch);
  const bucket=(id:string)=>id==='head-details'||id==='caught-details'?id:'body';
  const sources=new Map<string,{id:string,mesh:Mesh}[]>();
  for(const [id,g] of original.a.parts)g.traverse(o=>{
    if(o instanceof Mesh){const key=bucket(id);if(!sources.has(key))sources.set(key,[]);sources.get(key)!.push({id,mesh:o});}
  });
  const expected=new Vector3(),actual=new Vector3(),tint=new Vector3(),normal=new Vector3();
  const transform=new Matrix4(),normalMatrix=new Matrix3();
  for(const pose of ['slow','fast','caught','slow'] as const){
    for(const fish of [oldFish,newFish]){
      fish.setLifeState(pose==='caught'?'caught':'alive');fish.setSwimMode(pose==='fast'?'fast':'slow',true);
      for(let i=0;i<31;i++)fish.update(1/60);
      fish.visual.updateWorldMatrix(true,true);
    }
    for(const [key,pieces] of sources){
      const target=(optimized.a.parts.get(key)!.children[0] as Mesh).geometry;
      let offset=0;
      for(const {id,mesh} of pieces){
        const g=mesh.geometry,source=mesh.material as TunaCelMaterial,count=g.index?.count??g.attributes.position.count;
        transform.copy(mesh.matrixWorld);normalMatrix.getNormalMatrix(transform);
        for(let i=0;i<count;i++){
          const from=g.index?.getX(i)??i,to=target.index!.getX(offset+i);
          expected.fromBufferAttribute(g.attributes.position,from).applyMatrix4(transform);
          actual.fromBufferAttribute(target.attributes.position,to);
          const joint=target.attributes.tunaJoint.getX(to),state=oldFish.getState();
          if(joint){
            actual.applyMatrix4(batch.transforms[joint]);
            normal.fromBufferAttribute(target.attributes.normal,to).applyMatrix3(batch.normals[joint]).normalize();
            const sourceNormal=new Vector3().fromBufferAttribute(g.attributes.normal,from).applyMatrix3(normalMatrix).normalize();
            assert.ok(normal.distanceTo(sourceNormal)<1e-5,`${pose} ${id}: normal follows hinge and dorsal scale`);
          }else actual.z+=swimWave(actual.x,state.phase,state.blend)*batch.material.uniforms.swimActive.value;
          if((TUNA_DEFORMING_PARTS as readonly string[]).includes(id))expected.z+=swimWave(expected.x,state.phase,state.blend)*source.uniforms.swimActive.value;
          assert.ok(actual.distanceTo(expected)<2e-6,`${pose} ${id}: source pose preserved`);
          const c=source.uniforms.baseColor.value,p=g.attributes.color;
          tint.set(c.r*(p?p.getX(from):1),c.g*(p?p.getY(from):1),c.b*(p?p.getZ(from):1));
          actual.fromBufferAttribute(target.attributes.color,to);
          assert.ok(actual.distanceTo(tint)<1e-6,`${id}: paint preserved`);
          assert.equal(target.attributes.fishMatte.getX(to),source.uniforms.matte.value);
        }
        offset+=count;
      }
      assert.equal(target.index!.count,offset,'No lost or duplicated triangles');
    }
  }
  oldFish.dispose();newFish.dispose();
});
