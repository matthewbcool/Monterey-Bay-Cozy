import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Mesh,MeshToonMaterial,Raycaster,Vector3} from 'three';
import {createGiantSeaBassModel} from '../src/models/giant-sea-bass/createGiantSeaBassModel';
import {GIANT_SEA_BASS as B} from '../src/models/giant-sea-bass/definition';
import {buildSeaBassFins,seaBassPaint} from '../src/models/giant-sea-bass/components';
import {buildSeaBassFace} from '../src/models/giant-sea-bass/face';
import {createModelAssembly,disposeModelResources} from '../src/models/shared/assembly';
import {buildFishBody} from '../src/models/shared/fish/body';
import {createFishMaterial} from '../src/models/shared/fish/materials';
import {bellyAt,flankAt} from '../src/models/shared/fish/geometry';
import {mulberry32} from '../src/models/shared/random';

test('Sea bass has bounded seeded variation, baked flank spots and two draws in both life states',()=>{
  for(let seed=0;seed<60;seed++){
    const m=createGiantSeaBassModel({seed});assert.equal(m.root.userData.seed,seed);
    for(const state of ['alive','caught'] as const){
      m.setLifeState(state);let triangles=0,draws=0;
      m.root.traverseVisible(o=>{if(o instanceof Mesh){
        draws++;triangles+=o.geometry.index!.count/3;
        assert.ok(o.material instanceof MeshToonMaterial&&o.material.userData.paintedFish);
        for(const name of Object.keys(o.geometry.attributes))assert.ok(Array.from(o.geometry.getAttribute(name).array).every(Number.isFinite));
      }});
      assert.equal(draws,2);assert.equal(triangles,state==='alive'?2180:1992);assert.ok(triangles<=B.budget.triangles);
    }
    m.dispose();
  }
  const a=createGiantSeaBassModel({seed:42}),b=createGiantSeaBassModel({seed:42}),c=createGiantSeaBassModel({seed:7});
  const colors=(m:typeof a)=>(m.parts.get('surface')!.children[0] as Mesh).geometry.attributes.color.array;
  assert.deepEqual(colors(a),colors(b));assert.notDeepEqual(colors(a),colors(c));
  // Body pigment has meaningful contrast independent of dark eye/gill geometry.
  const assembly=createModelAssembly('pigment'),material=createFishMaterial();
  buildFishBody(assembly,B,material,seaBassPaint(mulberry32(42)),1);
  const p=(assembly.parts.get('body')!.children[0] as Mesh).geometry.attributes.color;
  const green=Array.from({length:p.count},(_,i)=>p.getY(i));
  assert.ok(Math.max(...green)-Math.min(...green)>.15);
  disposeModelResources(assembly.root);[a,b,c].forEach(m=>m.dispose());
  for(const seed of [-1,.5,NaN,2**32])assert.throws(()=>createGiantSeaBassModel({seed}));
});

test('Sea bass lower fins overlap the actual body and pectoral roots remain attached to its head bone',()=>{
  const a=createModelAssembly('attachment'),material=createFishMaterial();
  buildFishBody(a,B,material,seaBassPaint(mulberry32(42)),1);buildSeaBassFins(a,B,material,1);buildSeaBassFace(a,B,material,1);
  a.root.updateMatrixWorld(true);const body=a.parts.get('body')!.children[0] as Mesh,ray=new Raycaster();
  for(const side of [-1,1]){
    const z=side*.049;
    for(const x of [-.20,-.07]){
      const y=bellyAt(B.profile,x,z)+.012;ray.set(new Vector3(x,-1,z),new Vector3(0,1,0));
      const hit=ray.intersectObject(body)[0];assert.ok(hit&&y>hit.point.y+.002,'pelvic roots must be buried');
    }
    const [x,y]=B.pectoral,pz=flankAt(B.profile,x,y,side)-side*.009;
    ray.set(new Vector3(x,y,side),new Vector3(0,0,-side));const hit=ray.intersectObject(body)[0];
    assert.ok(hit&&side*(hit.point.z-pz)>.002,'pectoral root must be under the flank');
    const mesh=a.parts.get(`pectoral-${side}`)!.children[0] as Mesh,weights=mesh.geometry.attributes.skinWeight;
    assert.ok(Array.from({length:weights.count},(_,i)=>weights.getX(i)).some(w=>w===1),'root stays fully body-weighted');
    assert.ok(Array.from({length:weights.count},(_,i)=>weights.getY(i)).some(w=>w===1),'fan reaches its fin bone');
  }
  const details=a.parts.get('jaw-and-gills')!;assert.equal(details.children.length,5);
  for(const side of [-1,1]){
    const seam=details.children.find(o=>o.name===`jaw-and-gills:gill-cover-${side}`) as Mesh;
    assert.ok(seam instanceof Mesh);
    const p=seam.geometry.attributes.position,index=seam.geometry.index!,center=new Vector3(),vertex=new Vector3();
    for(let i=0;i<index.count;i+=3){
      center.set(0,0,0);for(let j=0;j<3;j++)center.add(vertex.fromBufferAttribute(p,index.getX(i+j)));center.divideScalar(3);
      ray.set(new Vector3(center.x,center.y,side),new Vector3(0,0,-side));const hit=ray.intersectObject(body)[0];
      assert.ok(hit,'gill rim must remain over the cheek surface');
      const gap=side*(center.z-hit.point.z);
      assert.ok(gap>0&&gap<.006,`gill rim must stay visible and close to body: ${gap}`);
    }
  }
  for(const group of ['eyes','eyes-caught'])assert.ok(a.parts.get(group)!.children.length>0);
  disposeModelResources(a.root);
});
