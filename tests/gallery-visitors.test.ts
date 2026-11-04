import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,BufferAttribute,Mesh,Vector3} from 'three';
import {createGalleryVisitors} from '../src/models/visitors/createGalleryVisitors';
import {VISITORS,VISITOR_BUDGET} from '../src/models/visitors/definition';
import {createTank} from '../src/viewer/tank';
import {applyNodeStyle} from '../src/viewer/nodeStyle';

const near=(a:number,b:number,eps=1e-6)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
test('Nine visitors have exact reference heights and grounded feet in one finite indexed draw',()=>{
  const crowd=createGalleryVisitors(),g=crowd.mesh.geometry,ids=g.attributes.visitorId,p=g.attributes.position;
  assert.equal(crowd.people.length,9);assert.equal(VISITORS.filter(p=>p.height<1.4).length,2);
  assert.deepEqual(crowd.root.scale.toArray(),[1,1,1]);assert.deepEqual(crowd.mesh.scale.toArray(),[1,1,1]);
  const meshes:Mesh[]=[];crowd.root.traverse(o=>{if(o instanceof Mesh)meshes.push(o);});
  assert.equal(meshes.length,VISITOR_BUDGET.drawCalls);assert.equal(g.groups.length,0);
  assert.ok(g.index!.count/3<=VISITOR_BUDGET.triangles);console.log('Nine visitors:',g.index!.count/3,'triangles / one draw');
  for(const a of Object.values(g.attributes))assert.ok(Array.from(a.array).every(Number.isFinite));
  for(let id=0;id<VISITORS.length;id++){
    const bounds=new Box3();for(let i=0;i<p.count;i++)if(ids.getX(i)===id)bounds.expandByPoint(new Vector3().fromBufferAttribute(p,i));
    near(bounds.min.y,0);near(bounds.max.y,VISITORS[id].height);near(bounds.getSize(new Vector3()).y,crowd.people[id].heightMeters);
  }
  const w=g.attributes.skinWeight;for(let i=0;i<w.count;i++)near(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i),1);
  crowd.dispose();assert.throws(()=>createGalleryVisitors({span:NaN}));
});
test('Slow idle is bounded, frame-rate independent and leaves feet, placement and vertex buffers unchanged',()=>{
  const crowd=createGalleryVisitors(),g=crowd.mesh.geometry,positions=Array.from(g.attributes.position.array),versions=Object.values(g.attributes).map(a=>(a as BufferAttribute).version);
  const start=Array.from({length:g.attributes.position.count},(_,i)=>new Vector3().fromBufferAttribute(g.attributes.position,i));
  const ids=g.attributes.visitorId,p=new Vector3();let maxTravel=0;
  for(let t=0;t<=120;t+=2.5){
    crowd.update(t);crowd.root.updateMatrixWorld(true);crowd.skeleton.update();
    const heights=Array(9).fill(0);
    for(let i=0;i<start.length;i++){
      crowd.mesh.getVertexPosition(i,p);const d=p.distanceTo(start[i]);maxTravel=Math.max(maxTravel,d);
      assert.ok(d<.025,'Idle stays within 2.5 cm of rest');
      if(start[i].y<.05*VISITORS[ids.getX(i)].height)near(d,0,1e-6);
      heights[ids.getX(i)]=Math.max(heights[ids.getX(i)],p.y);
      assert.ok(crowd.mesh.boundingBox!.containsPoint(p),'Conservative culling bounds contain idle pose');
    }
    heights.forEach((h,i)=>near(h,VISITORS[i].height,.005));
  }
  assert.ok(maxTravel>.003,'Small motion actually occurs');
  assert.deepEqual(Array.from(g.attributes.position.array),positions);assert.deepEqual(Object.values(g.attributes).map(a=>(a as BufferAttribute).version),versions);
  assert.deepEqual(crowd.root.position.toArray(),[0,0,0]);
  const pose=()=>crowd.people.map(p=>[...p.spine.rotation.toArray(),...p.head.rotation.toArray(),...p.arm.rotation.toArray()]);
  const before=pose();crowd.update(120);crowd.update(4);crowd.update(NaN);assert.deepEqual(pose(),before);
  crowd.dispose();crowd.update(130);assert.deepEqual(pose(),before);
  const matrices=[30,60,120].map(fps=>{const c=createGalleryVisitors();for(let frame=0;frame<=fps;frame++)c.update(frame/fps);c.root.updateMatrixWorld(true);c.skeleton.update();const result=Array.from(c.skeleton.boneMatrices);c.dispose();return result;});
  assert.deepEqual(matrices[0],matrices[1]);assert.deepEqual(matrices[0],matrices[2]);
});
test('Gallery puts shoes on its floor in metres, uses the paused tank clock, and disposes upgraded skin resources once',()=>{
  const tank=createTank(),crowd=tank.visitors;applyNodeStyle(tank.root);tank.root.updateMatrixWorld(true);crowd.skeleton.update();
  const floor=tank.gallery.getObjectByName('gallery-floor')!,top=new Box3().setFromObject(floor).max.y;
  near(crowd.root.position.y,top);const p=new Vector3();let low=Infinity;
  for(let i=0;i<crowd.mesh.geometry.attributes.position.count;i++)low=Math.min(low,crowd.mesh.getVertexPosition(i,p).applyMatrix4(crowd.mesh.matrixWorld).y);
  near(low,top);const before=crowd.people[0].head.rotation.y;tank.update(8);assert.notEqual(crowd.people[0].head.rotation.y,before);
  const after=crowd.people[0].head.rotation.y;tank.update(8);tank.update(NaN);tank.update(1);assert.equal(crowd.people[0].head.rotation.y,after);
  crowd.skeleton.computeBoneTexture();const resources=[crowd.mesh.geometry,crowd.mesh.material,crowd.skeleton.boneTexture!];
  const released=resources.map(()=>0);resources.forEach((r,i)=>r.addEventListener('dispose',()=>released[i]++));
  tank.dispose();tank.dispose();assert.deepEqual(released,[1,1,1]);assert.equal(crowd.root.parent,null);
});
