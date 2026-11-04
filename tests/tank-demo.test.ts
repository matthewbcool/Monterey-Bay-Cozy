import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Mesh, Vector3, type BufferAttribute } from 'three';
import type { FishModel } from '../src/models/types';
import { fishCollection } from '../src/models/catalogue';
import { createTankDemo, DEMO_BUDGET, DEMO_POPULATION } from '../src/viewer/tankDemo';
import { modelStats } from '../src/viewer/modelStats';
import { TANK_SIZE } from '../src/viewer/swimPath';

const half=new Vector3(TANK_SIZE.width/2,TANK_SIZE.height/2,TANK_SIZE.depth/2);
test('Demo includes its explicit population at physical scale while excluding the gray whale',()=>{
  const demo=createTankDemo();
  try{
    const counts:Record<string,number>={};
    for(const {speciesId,model} of demo.members){
      counts[speciesId]=(counts[speciesId]??0)+('count' in model?model.count:1);
      assert.deepEqual(model.root.scale.toArray(),[1,1,1]);
      assert.equal(model.getState().lifeState,'alive');assert.equal(model.getState().motionOwner,'path');
    }
    assert.deepEqual(Object.keys(counts),fishCollection.filter(e=>DEMO_POPULATION[e.id]!==undefined).map(e=>e.id));
    assert.equal(counts['gray-whale'],undefined);
    assert.deepEqual(counts,DEMO_POPULATION);assert.equal(counts['great-white-shark'],1);assert.equal(counts['green-sea-turtle'],2);
    const school=demo.members.find(m=>m.speciesId==='pacific-sardine')!.model;
    assert.equal('count' in school&&school.count,256);assert.equal(modelStats(school.root).model.drawCalls,1);
    assert.equal(demo.count,292);assert.equal(demo.speciesCount,15);
    const stats=modelStats(demo.root);assert.ok(stats.model.drawCalls<=DEMO_BUDGET.drawCalls);assert.ok(stats.model.triangles<=DEMO_BUDGET.triangles);
  }finally{demo.dispose();}
});

test('Every complete demo route keeps its animated bounds inside the tank and the population fills all three dimensions',()=>{
  const demo=createTankDemo(),point=new Vector3(),occupied=new Box3();
  try{
    const initial=new Box3().setFromPoints(demo.members.map(m=>m.model.root.position));
    const size=initial.getSize(new Vector3());assert.ok(size.x>17&&size.y>4&&size.z>7,`Initial span ${size.toArray()}`);
    for(const {model,route,speciesId} of demo.members){
      const coverage=new Box3();
      for(let i=0;i<=1000;i++){
        route.curve.getPointAt(i/1000,point);coverage.expandByPoint(point);occupied.expandByPoint(point);
        for(const axis of ['x','y','z'] as const){
          if(axis==='y'&&'surfaceAware' in route){
            assert.equal(speciesId,'southern-sea-otter');
            assert.ok(Math.abs(point.y-half.y)<1e-7,'The surface lane matches the real waterline');
            assert.ok(point.y-route.surfaceEnvelope.maximumRootDepth-route.envelope.y>-half.y+.2,'Dive envelope clears the floor');
          }else assert.ok(Math.abs(point[axis]+route.envelopeCenter[axis])+route.envelope[axis]<=half[axis]-(speciesId==='giant-pacific-octopus'&&axis==='y'?0:.20),`${speciesId} ${axis}: ${point[axis]} + ${route.radius}`);
        }
      }
      if(['tuna','pacific-sardine','chinook-salmon','great-white-shark'].includes(speciesId))assert.ok(coverage.getSize(new Vector3()).x>16,`${speciesId} traverses the exhibit width`);
      if(['lingcod','kelp-greenling'].includes(speciesId))assert.ok(coverage.max.y<-2.3,`${speciesId} stays near the bottom`);
      if(speciesId==='green-sea-turtle')assert.ok(coverage.min.y>1.4,`${speciesId} favors upper water`);
      if(speciesId==='garibaldi')assert.ok(Math.abs(coverage.getCenter(new Vector3()).x)>5,`${speciesId} holds a side territory`);
      // Animation and path controllers preserve public metre scale.
      assert.deepEqual(model.root.scale.toArray(),[1,1,1]);
    }
    const span=occupied.getSize(new Vector3());assert.ok(span.x>22&&span.y>5&&span.z>8.9,`Route span ${span.toArray()}`);
  }finally{demo.dispose();}
});

test('Demo animates independent routes, honors invalid time and external ownership, and disposes each resource once',()=>{
  const demo=createTankDemo(),versions=new Map<object,number>(),disposals=new Map<object,number>();
  demo.root.traverse(o=>{if(o instanceof Mesh){
    versions.set(o.geometry.attributes.position,(o.geometry.attributes.position as BufferAttribute).version);
    for(const r of [o.geometry,...(Array.isArray(o.material)?o.material:[o.material])])if(!disposals.has(r)){disposals.set(r,0);r.addEventListener('dispose',()=>disposals.set(r,disposals.get(r)!+1));}
  }});
  const snapshot=()=>demo.members.map(({model})=>[model.root.position.toArray(),model.getState().phase]);
  const start=snapshot();for(const dt of [0,-1,NaN,Infinity])demo.update(dt);assert.deepEqual(snapshot(),start);
  const held=demo.members[0].model;held.setMotionOwner('physics');const fixed=held.root.position.clone();
  for(let i=0;i<60;i++)demo.update(1/60);
  assert.deepEqual(held.root.position.toArray(),fixed.toArray());
  for(let i=1;i<demo.members.length;i++)assert.notDeepEqual(demo.members[i].model.root.position.toArray(),start[i][0]);
  assert.ok(new Set(demo.members.map(m=>m.tempo.toFixed(3))).size>demo.members.length/2,'groups have independent base paces');
  for(const {model} of demo.members){assert.equal(model.getState().mode,'slow');assert.equal(model.getState().blend,0);}
  demo.root.traverse(o=>{if(o instanceof Mesh)assert.equal((o.geometry.attributes.position as BufferAttribute).version,versions.get(o.geometry.attributes.position));});
  demo.dispose();demo.dispose();demo.update(1);
  for(const n of disposals.values())assert.equal(n,1);
  for(const {model} of demo.members)assert.equal(model.getState().disposed,true);
  assert.equal(demo.root.parent,null);
});


test('Tuna and blue rockfish move as coordinated, unscaled schools with independently animated specimens',()=>{
  const demo=createTankDemo();
  try{
    for(const id of ['tuna','blue-rockfish']){
      const group=demo.members.find(m=>m.speciesId===id)!.model;
      assert.ok('specimens' in group);
      assert.equal(group.specimens.length,DEMO_POPULATION[id]);
      const start=group.specimens.map(m=>m.root.position.clone());
      for(let i=0;i<120;i++)group.update(1/60);
      for(let i=0;i<group.specimens.length;i++){
        const model:FishModel=group.specimens[i];assert.deepEqual(model.root.scale.toArray(),[1,1,1]);
        assert.notDeepEqual(model.root.position.toArray(),start[i].toArray());
        assert.ok(group.bounds.containsPoint(model.root.position));
        const heading=new Vector3(-1,0,0).applyQuaternion(model.root.quaternion);
        assert.ok(heading.x<-.7,'school members face their common direction of travel');
      }
      assert.ok(new Set(group.specimens.map(m=>m.getState().phase)).size>1,'tails retain different animation phases');
    }
  }finally{demo.dispose();}
});
