import {MeshBasicNodeMaterial} from 'three/webgpu';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,BoxGeometry,Group,Mesh,Raycaster,Vector3} from 'three';
import {createTank} from '../src/viewer/tank';
import {TANK_SIZE} from '../src/viewer/swimPath';
import {submergedDistance,TANK_WATER_BUDGET} from '../src/viewer/openSea/waterLook';
import {VISITOR_BUDGET} from '../src/models/visitors/definition';
import {createCausticTexture} from '../src/viewer/openSea/caustics';
import {createTunaModel} from '../src/models/tuna/createTunaModel';
import {applyNodeStyle} from '../src/viewer/nodeStyle';

test('Optical path counts water only, including cameras inside and beside the tank',()=>{
  const size={width:10,height:6,depth:8};
  assert.ok(Math.abs(submergedDistance(new Vector3(0,0,20),new Vector3(0,0,0),size)-4)<1e-10);
  assert.ok(Math.abs(submergedDistance(new Vector3(0,0,200),new Vector3(0,0,0),size)-4)<1e-10);
  assert.equal(submergedDistance(new Vector3(0,0,2),new Vector3(0,0,-2),size),4);
  assert.equal(submergedDistance(new Vector3(0,0,20),new Vector3(0,0,10),size),0);
  assert.equal(submergedDistance(new Vector3(6,0,20),new Vector3(6,0,-20),size),0);
  assert.equal(submergedDistance(new Vector3(),new Vector3(),size),0);
  assert.ok(Math.abs(submergedDistance(new Vector3(10,0,10),new Vector3(),size)-Math.sqrt(32))<1e-10);
});
test('Generated caustic field is deterministic, mipmapped, periodic at its seams, and bounded',()=>{
  const a=createCausticTexture(),b=createCausticTexture(),pixels=a.image.data!;
  assert.deepEqual(pixels,b.image.data);assert.equal(pixels.byteLength,TANK_WATER_BUDGET.textureBytes);assert.ok(a.generateMipmaps);
  let sum=0,bright=0,seam=0,neighbour=0;
  for(let i=0;i<256*256;i++){sum+=Number(pixels[i*4]);if(pixels[i*4]>160)bright++;assert.equal(pixels[i*4+3],255);}
  for(let i=0;i<256;i++){
    seam+=Math.abs(Number(pixels[(i*256)*4])-Number(pixels[(i*256+255)*4]));
    seam+=Math.abs(Number(pixels[i*4])-Number(pixels[(255*256+i)*4]));
    for(let j=0;j<255;j++)neighbour+=Math.abs(Number(pixels[(i*256+j)*4])-Number(pixels[(i*256+j+1)*4]));
  }
  assert.ok(sum/(256*256)>15&&sum/(256*256)<80);assert.ok(bright>1000&&bright<15000);
  assert.ok(seam/512<neighbour/(256*255)*2,'Wrapping has no exceptional bright seam');a.dispose();b.dispose();
});
test('Tank light enclosure has a visible surface from above and below with twelve immutable triangles and one draw',()=>{
  const tank=createTank(),water=tank.water,mesh=water.enclosure;
  const size=new Box3().setFromObject(water.root).getSize(new Vector3());
  assert.ok(Math.abs(size.x-TANK_SIZE.width)<1e-5);assert.equal(size.y,TANK_SIZE.height);assert.equal(size.z,TANK_SIZE.depth);
  assert.equal((mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3,12);
  water.root.updateMatrixWorld(true);
  for(const sign of [-1,1]){
    const hits=new Raycaster(new Vector3(.17,TANK_SIZE.height/2+sign,.23),new Vector3(0,-sign,0)).intersectObject(water.root,true);
    assert.equal(hits[0]?.object,mesh,'Surface is visible from either medium');
    assert.ok(Math.abs(hits[0].point.y-TANK_SIZE.height/2)<1e-7);
    assert.equal(hits[0].face!.normal.y,sign);
  }
  assert.equal(mesh.receiveShadow,true);assert.equal(mesh.castShadow,false);assert.equal(mesh.geometry.groups.length,0);assert.equal(water.root.children.length,1);assert.deepEqual(tank.root.scale.toArray(),[1,1,1]);
  const before=Array.from(mesh.geometry.attributes.position.array),textureVersion=water.field.version;
  tank.update(12);assert.equal(water.uniforms.time.value,12);tank.update(12);tank.update(NaN);tank.update(5);assert.equal(water.uniforms.time.value,12);
  assert.deepEqual(Array.from(mesh.geometry.attributes.position.array),before);assert.equal(water.field.version,textureVersion);
  let draws=0,triangles=0;tank.root.traverseVisible(o=>{if(o instanceof Mesh){draws++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});
  assert.equal(draws,4);assert.ok(triangles<=96+VISITOR_BUDGET.triangles,'Water, surround, floor and visitor budgets');
  let textureDisposals=0;water.field.addEventListener('dispose',()=>textureDisposals++);tank.dispose();tank.dispose();assert.equal(textureDisposals,1);
});
test('Creature water lighting preserves the shared style graph and does not double-wrap a material',()=>{
  const tank=createTank(),fish=createTunaModel();applyNodeStyle(fish.root);
  const materials=new Set<any>();fish.root.traverse(o=>{if(o instanceof Mesh)materials.add(o.material);});
  const base=[...materials].map(m=>m.colorNode);tank.shadeCreature(fish.root);const outputs=[...materials].map(m=>m.outputNode);
  assert.ok(outputs.every(Boolean));tank.shadeCreature(fish.root);
  [...materials].forEach((m,i)=>{assert.equal(m.colorNode,base[i]);assert.equal(m.outputNode,outputs[i]);assert.equal(m.userData.tankWater,true);});
  fish.dispose();tank.dispose();
});

test('Window frame stays clear of the water at all four front edges',()=>{
  const tank=createTank(),{width:w,height:h,depth:d}=TANK_SIZE;
  try{
    tank.root.updateMatrixWorld(true);
    const frame=tank.gallery.getObjectByName('viewing-window-surround')!;
    const frameBounds=new Box3().setFromObject(frame),waterBounds=new Box3().setFromObject(tank.water.root);
    assert.ok(frameBounds.min.z-waterBounds.max.z>=.019,'At least 19 mm separates dry frame and water');
    for(const inset of [.01,.1,.3]){
      const z=d/2-inset;
      for(const [origin,direction] of [
        [[.17,-h/2+.5,z],[0,-1,0]],[[.17,h/2-.5,z],[0,1,0]],
        [[w/2-.5,.17,z],[1,0,0]],[[-w/2+.5,.17,z],[-1,0,0]],
      ]){
        const hits=new Raycaster(new Vector3(...origin),new Vector3(...direction)).intersectObject(tank.root,true);
        assert.equal(hits[0]?.object,tank.water.enclosure,'Water is the first visible surface inside the opening');
        const coplanar=hits.filter(hit=>Math.abs(hit.distance-hits[0].distance)<1e-4);
        assert.ok(coplanar.every(hit=>hit.object===tank.water.enclosure),'No solid frame face shares the water depth');
      }
    }
  }finally{tank.dispose();}
});

test('Tank casts opaque silhouettes while translucent tissue does not become a solid shadow',()=>{
  const tank=createTank(),root=new Group();
  const opaque=new Mesh(new BoxGeometry(),new MeshBasicNodeMaterial());
  const tissue=new Mesh(new BoxGeometry(),new MeshBasicNodeMaterial({transparent:true,opacity:.3}));
  root.add(opaque,tissue);tank.shadeCreature(root);
  assert.equal(opaque.castShadow,true);assert.equal(tissue.castShadow,false);
  assert.equal(opaque.receiveShadow,true);
  for(const mesh of [opaque,tissue]){mesh.geometry.dispose();mesh.material.dispose();}
  tank.dispose();
});
