import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Object3D, Vector3 } from 'three';
import { AVATAR_MOVEMENT, canStandAt, createAvatarController, type GymBounds } from '../src/viewer/avatarController';
import { createTestingGym } from '../src/viewer/testingGym';

const bounds: GymBounds = { minX: -100, maxX: 100, minZ: -100, maxZ: 100 };
test('controller limits diagonal running, preserves metre scale and visual pose ownership', () => {
  const root = new Object3D(), controller = createAvatarController({ root, spawn: new Vector3(0, 2, 0), bounds, colliders: [] });
  let state = controller.update(1 / 60, { x: 1, z: 1, run: true });
  for (let i = 0; i < 120; i++) state = controller.update(1 / 60, { x: 1, z: 1, run: true });
  assert(state.speed <= AVATAR_MOVEMENT.run + .00001); assert(state.speed > 3.4); assert.equal(root.position.y, 2);
  assert(Math.abs(root.position.x - root.position.z) < .00001); assert.deepEqual(root.scale.toArray(), [1,1,1]);
  for (let i = 0; i < 120; i++) state = controller.update(1 / 60, { x: 0, z: 0, run: false });
  assert.equal(state.moving, false); controller.reset(); assert.deepEqual(root.position.toArray(), [0,2,0]);
});

test('controller cannot tunnel through a thin box or leave the coastline polygon', () => {
  const root = new Object3D();
  const region: GymBounds = { minX:-5,maxX:5,minZ:-5,maxZ:5,walkable:[[-4,-4],[4,-4],[4,4],[-4,4]] };
  const colliders = [{ kind:'box' as const,minX:.5,maxX:.55,minZ:-4,maxZ:4 }];
  const controller = createAvatarController({root,spawn:new Vector3(),bounds:region,colliders});
  for(let i=0;i<100;i++) controller.update(.1,{x:1,z:0,run:true});
  assert(root.position.x < .5 - AVATAR_MOVEMENT.radius); assert(canStandAt(root.position.x,root.position.z,region,colliders));
  for(let i=0;i<100;i++) controller.update(.1,{x:-1,z:-1,run:true});
  assert(root.position.x >= -4 + AVATAR_MOVEMENT.radius); assert(root.position.z >= -4 + AVATAR_MOVEMENT.radius);
  assert(canStandAt(root.position.x,root.position.z,region,colliders));
});

test('controller avoids circular objects and ignores invalid input and long suspended frames', () => {
  const root = new Object3D(), colliders = [{kind:'circle' as const,x:1,z:0,radius:.5}];
  const controller=createAvatarController({root,spawn:new Vector3(),bounds,colliders});
  controller.update(100,{x:1,z:0,run:true}); assert(root.position.length()<.5);
  for(let i=0;i<100;i++)controller.update(.1,{x:1,z:0,run:true}); assert(root.position.x<=.22);
  controller.update(.1,{x:NaN,z:Infinity,run:false}); assert(Number.isFinite(root.position.x));
  controller.update(NaN,{x:1,z:1,run:true}); assert(Number.isFinite(root.position.z));
});

test('Lovers Point uses mapped geometry with reachable exercise points and a small draw budget', () => {
  const gym = createTestingGym();
  assert(canStandAt(gym.spawn.x,gym.spawn.z,gym.bounds,gym.colliders));
  for(const interaction of gym.interactions) assert(canStandAt(interaction.position.x,interaction.position.z,gym.bounds,gym.colliders),interaction.id+' approach is obstructed');
  let draws=0,triangles=0;
  gym.root.traverse((object:any)=>{if(object.isMesh){draws++;triangles+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3*(object.isInstancedMesh?object.count:1);}});
  assert(draws<=38,draws+' draws exceeds gym ceiling');assert(triangles<=69472,triangles+' triangles exceeds gym ceiling');
  assert.equal(gym.geography.source,'© OpenStreetMap contributors · ODbL'); assert(gym.bounds.walkable!.length>100);
  assert.equal(new Set(gym.interactions.map(i=>i.id)).size,gym.interactions.length);
  for(const id of ['tackle-box','spinning-rod','rowboat','casting','bat-star']) assert(gym.interactions.some(i=>i.id===id)); assert(!gym.interactions.some(i=>i.id==='bench'));
  for(const id of ['tackle-box','spinning-rod']){const item=gym.interactions.find(i=>i.id===id)!;assert(canStandAt(item.position.x,item.position.z,gym.bounds,gym.colliders));assert(Math.hypot(item.object!.position.x-gym.dock.position.x,item.object!.position.z-gym.dock.position.z)<7);}
  gym.root.traverse(o=>{if(o.userData.singleGroundSurface){assert(o.userData.sourceParts.some((n:string)=>n.startsWith('Mapped footway')));assert(!o.userData.sourceParts.some((n:string)=>/Authored exercise path|ground marker/.test(n)));}});
  gym.dispose(); gym.dispose();
});
