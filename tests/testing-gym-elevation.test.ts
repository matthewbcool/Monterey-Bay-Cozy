import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Object3D, Vector3 } from 'three';
import data from '../src/data/lovers-point-elevation.json';
import { groundHeight, drapeGeometry } from '../src/viewer/testingGym/elevation';
import { ACCESS_SURFACES, accessHeight } from '../src/viewer/testingGym/access';
import { surface } from '../src/viewer/testingGym/geometry';
import { createTestingGym } from '../src/viewer/testingGym';
import { createAvatarController } from '../src/viewer/avatarController';

test('cached terrain agrees with independent USGS point checks at key landmarks', () => {
  assert.equal(data.values.length, data.grid.columns * data.grid.rows);
  assert(data.values.every(Number.isFinite));
  assert(data.verticalDatum.includes('NAVD 88'));
  // Independent 1 m source queries, not values copied out of the rendered grid.
  // Resampling/smoothing is deliberately allowed; this is not survey accuracy.
  for(const [x,z,reference] of [[0,0,9.58848],[25,-35,8.55599],[35,60,1.425516],[75,-50,1.577994],[125,-130,10.240975],[-16,38,8.100729],[-10,60,8.031276]])
    assert(Math.abs(groundHeight(x,z)-reference)<.75, `Unexpected terrain drift at ${x},${z}`);
  assert(groundHeight(25,-35)-groundHeight(75,-50)>6, 'The raised lawn must not collapse into a flat beach');
});

test('rendered terrain planes and physical heights agree between all mesh vertices', () => {
  const geometry=drapeGeometry(surface([[-30,-85],[95,-85],[95,105],[-30,105]]));
  const p=geometry.attributes.position,idx=geometry.index!;
  for(let i=0;i<idx.count;i+=3) {
    const a=idx.getX(i),b=idx.getX(i+1),c=idx.getX(i+2);
    const x=(p.getX(a)+p.getX(b)+p.getX(c))/3,z=(p.getZ(a)+p.getZ(b)+p.getZ(c))/3;
    const y=(p.getY(a)+p.getY(b)+p.getY(c))/3;
    assert(Math.abs(y-groundHeight(x,z))<.0001, `Ground mismatch at ${x},${z}`);
  }
  geometry.dispose();
});

test('ground following climbs and descends, resets, and cannot teleport over a wall', () => {
  const root=new Object3D();const bounds={minX:-20,maxX:20,minZ:-20,maxZ:20};
  const height=(x:number)=>x<5?3+x*.15:10;
  const controller=createAvatarController({root,spawn:new Vector3(0,0,0),bounds,colliders:[],groundHeight:height});
  assert.equal(root.position.y,3);
  for(let i=0;i<400;i++)controller.update(1/60,{x:1,z:0,run:true});
  assert(root.position.x<5);assert(root.position.x>4.8);assert.equal(root.position.y,height(root.position.x));
  for(let i=0;i<90;i++)controller.update(1/60,{x:-1,z:0,run:true});
  assert(root.position.y<3.5);assert.equal(root.position.y,height(root.position.x));
  controller.reset();assert.deepEqual(root.position.toArray(),[0,3,0]);
});

test('mapped stairs and concrete pier have stable physical tops in metre coordinates', () => {
  assert(ACCESS_SURFACES.some(s=>s.sourceId==='way/633871947'), 'East-beach stair alignment must be retained');
  assert(ACCESS_SURFACES.some(s=>s.kind==='pier'));
  for(const s of ACCESS_SURFACES) {
    assert(s.height>s.bottom);assert(s.width>0&&s.width<=(s.sourceId==='way/633871934'?4:3.2));
    assert(accessHeight(s.x,s.z)>=s.height-1e-8);
    assert(s.height>=groundHeight(s.x,s.z));
  }
});


test('the equipped avatar can descend the east access, reach casting and climb back', () => {
  const gym=createTestingGym(),root=new Object3D();gym.setRodEquipped(true);
  try {
    const c=createAvatarController({root,spawn:new Vector3(33.1,0,-33.8),bounds:gym.bounds,colliders:gym.colliders,groundHeight:(x,z)=>gym.groundHeight(x,z)+.045});
    const high=root.position.y;
    for(const target of [[56,-57.5],[72,-57.5],[68.6,-49.8],[63,-28],[60,-17.8]]) {
      for(let i=0;i<840;i++) {
        const dx=target[0]-root.position.x,dz=target[1]-root.position.z,d=Math.hypot(dx,dz);
        if(d<.25)break;
        c.update(1/60,{x:dx/d,z:dz/d,run:true});
        assert(Math.abs(root.position.y-gym.groundHeight(root.position.x,root.position.z)-.045)<1e-8);
      }
      assert(Math.hypot(target[0]-root.position.x,target[1]-root.position.z)<.3,`Access blocked before ${target}`);
    }
    assert(high-root.position.y>5,'The route must actually reach the lower beach');
    for(const target of [[63,-28],[68.6,-49.8],[72,-57.5],[56,-57.5],[33.1,-33.8]]) {
      for(let i=0;i<840;i++) {
        const dx=target[0]-root.position.x,dz=target[1]-root.position.z,d=Math.hypot(dx,dz);
        if(d<.25)break;
        c.update(1/60,{x:dx/d,z:dz/d,run:true});
      }
      assert(Math.hypot(target[0]-root.position.x,target[1]-root.position.z)<.3,`Return blocked before ${target}`);
    }
    assert(Math.abs(root.position.y-high)<.2);

  } finally {gym.dispose();}
});
