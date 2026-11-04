import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Object3D, Vector3 } from 'three';
import { AVATAR_MOVEMENT, AVATAR_SWIMMING, createAvatarController, type AvatarControllerOptions, type AvatarControllerState, type GymBounds } from '../src/viewer/avatarController';
import { createTestingGym } from '../src/viewer/testingGym';

const land: GymBounds = { minX: -10, maxX: 10, minZ: -8, maxZ: 8, walkable: [[-10,-8],[0,-8],[0,8],[-10,8]] };
const ocean: GymBounds = { minX: -12, maxX: 30, minZ: -10, maxZ: 10 };
const ground = (x:number) => 1 - x * .35;
const still = { x: 0, z: 0, run: false, dive: false };
function fixture(options: Partial<AvatarControllerOptions> = {}) {
  const root = new Object3D(), spawn = new Vector3(-2, ground(-2), 0);
  const controller = createAvatarController({ root, spawn, bounds: land, colliders: [], groundHeight: ground, water: { bounds: ocean, surfaceHeight: x => x > 0 ? 1 : undefined }, ...options });
  return { root, controller };
}
function putInWater(controller: ReturnType<typeof createAvatarController>, patch: Partial<AvatarControllerState> = {}) {
  assert(controller.restoreState({ ...controller.getState(), position: [4,0,0], velocity: [0,0], breath: 20, ...patch }));
}
function advance(controller: ReturnType<typeof createAvatarController>, seconds: number, input: {x:number;z:number;run:boolean;dive?:boolean} = still) {
  const steps = Math.round(seconds * 60); let result = controller.update(0, input);
  for (let i = 0; i < steps; i++) result = controller.update(1 / 60, input);
  return result;
}
const close = (a:number,b:number,epsilon=1e-8) => assert(Math.abs(a-b)<epsilon,`${a} != ${b}`);

test('continuous shore crosses polygon seam through dry, wading and swimming states', () => {
  const {root,controller}=fixture(); let sawWade=false,sawSwim=false;
  for(let i=0;i<240;i++){const r=controller.update(1/60,{x:1,z:0,run:true});sawWade ||= r.wading;sawSwim ||= r.swimming;}
  assert(sawWade&&sawSwim);assert(root.position.x>3);close(root.position.y,1-AVATAR_SWIMMING.immersion);assert.equal(controller.getState().breath,20);
  assert(controller.getState().safePosition[0]<0);assert(controller.getState().safePosition[0]<=-AVATAR_MOVEMENT.radius);
});

test('ocean membership bridges a dry terrain strip before positive water depth', () => {
  const {root,controller}=fixture({groundHeight:x=>1.2-x*.35});
  advance(controller,4,{x:1,z:0,run:true});assert(root.position.x>3);assert(controller.getState().swimming);
});

test('water mode threshold and root immersion follow measured floor depth', () => {
  const {root,controller}=fixture();putInWater(controller,{position:[2,99,0]});
  assert(controller.getState().wading);assert(!controller.getState().swimming);close(root.position.y,ground(2));
  putInWater(controller,{position:[2.5,99,0]});assert(controller.getState().swimming);close(root.position.y,.22);
});

test('swimming ignores Shift acceleration and limits diagonal speed', () => {
  for(const run of [false,true]){const {controller}=fixture();putInWater(controller);const r=advance(controller,2,{x:1,z:1,run});assert(r.speed<=AVATAR_SWIMMING.speed+1e-8);assert(r.speed>1.34);close(controller.getState().breath,20);}
});

test('surface swimming never drains; twenty underwater seconds rescue with restored air', () => {
  const {controller,root}=fixture();const safe=root.position.toArray();putInWater(controller);
  let r=advance(controller,30);assert(r.swimming);close(r.breath,20);assert(!r.lowBreath);
  putInWater(controller,{position:[10,0,0],diveDepth:1});
  r=advance(controller,15,{...still,dive:true});close(r.breath,5,1e-7);assert(r.lowBreath);
  r=advance(controller,5,{...still,dive:true});assert(r.rescued);assert(!r.exhausted);assert(!r.submerged);close(r.breath,20);assert.deepEqual(root.position.toArray(),safe);
});

test('surfacing, wading and boarding immediately reset air and allow a fresh dive', () => {
  const {controller}=fixture();
  putInWater(controller,{position:[10,0,0],diveDepth:1,breath:2});
  assert(controller.getState().breath===2);
  putInWater(controller,{position:[10,0,0],diveDepth:0,breath:2,exhausted:true});
  close(controller.getState().breath,20);assert(!controller.getState().exhausted);
  putInWater(controller,{position:[1,0,0],breath:2,exhausted:true});close(controller.getState().breath,20);
  putInWater(controller,{position:[10,0,0],diveDepth:1,breath:2});controller.leaveWater();
  close(controller.getState().breath,20);assert(!controller.getState().swimming);assert.equal(controller.getState().diveDepth,0);
  putInWater(controller,{position:[10,0,0],diveDepth:1});
  const r=advance(controller,1,{...still,dive:true});close(r.breath,19,1e-7);
});

test('swim collision substeps retain thin solid and circular obstacle clearance', () => {
  for(const collider of [{kind:'box' as const,minX:5,maxX:5.02,minZ:-8,maxZ:8},{kind:'circle' as const,x:5.5,z:0,radius:.5}]){
    const {root,controller}=fixture({colliders:[collider]});putInWater(controller);advance(controller,6,{x:1,z:0,run:true});assert(root.position.x<4.73);assert(root.position.x>4.6);assert(controller.getState().swimming);
  }
});

test('swim boundary is larger than land yet finite, and no-water void remains blocked', () => {
  const {root,controller}=fixture();putInWater(controller,{position:[29,0,0]});advance(controller,2,{x:1,z:0,run:true});assert(root.position.x<=30-AVATAR_MOVEMENT.radius);assert(root.position.x>29.6);
  const missing=fixture({water:{bounds:ocean,surfaceHeight:()=>undefined}});advance(missing.controller,5,{x:1,z:0,run:true});assert(missing.root.position.x<0);
  const invalid=fixture({water:{bounds:ocean,surfaceHeight:()=>NaN}});advance(invalid.controller,5,{x:1,z:0,run:true});assert(invalid.root.position.x<0);
});

test('steep shore drops stay blocked, while deep swimmers can cross submerged shelves', () => {
  const cliff=fixture({groundHeight:x=>x<=0?3:-5});advance(cliff.controller,5,{x:1,z:0,run:true});assert(cliff.root.position.x<0);assert(!cliff.controller.getState().swimming);
  const shelf=fixture({groundHeight:x=>x<5?ground(x):-20});putInWater(shelf.controller);advance(shelf.controller,2,{x:1,z:0,run:false});assert(shelf.root.position.x>5);close(shelf.root.position.y,.22);
});

test('walking out of the water recovers breath without changing collision or scale', () => {
  const {root,controller}=fixture();putInWater(controller,{breath:15});advance(controller,5,{x:-1,z:0,run:false});assert(root.position.x<0);assert(!controller.getState().swimming);assert(!controller.getState().wading);
  advance(controller,4);close(controller.getState().breath,20);assert.deepEqual(root.scale.toArray(),[1,1,1]);close(root.position.y,ground(root.position.x));
});

test('state is detached, serializable and preserves breath/safe position on model replacement', () => {
  const {controller}=fixture();putInWater(controller);advance(controller,7,{x:1,z:0,run:false});const state=controller.getState(), saved=JSON.parse(JSON.stringify(state));
  state.position[0]=999;state.safePosition[0]=999;assert(controller.position.x!==999);assert(controller.getState().safePosition[0]!==999);
  const replacement=fixture({state:saved});assert.deepEqual(replacement.controller.getState(),saved);advance(replacement.controller,1);close(replacement.controller.getState().breath,20);
  replacement.controller.reset();close(replacement.controller.getState().breath,20);assert(!replacement.controller.getState().swimming);assert.deepEqual(replacement.root.position.toArray(),[-2,1.7,0]);
});

test('invalid restored location falls back safely and restores breath', () => {
  const {root,controller}=fixture();putInWater(controller,{breath:3});const saved=controller.getState();
  assert(!controller.restoreState({...saved,position:[NaN,0,Infinity],safePosition:[Infinity,0,NaN],velocity:[Infinity,NaN]}));close(controller.getState().breath,20);assert.deepEqual(root.position.toArray(),[-2,1.7,0]);
  assert(!controller.restoreState({version:2}));close(controller.getState().breath,20);
  assert(controller.restoreState({...controller.getState(),breath:999,heading:Infinity,velocity:[99,99]}));close(controller.getState().breath,20);assert(Number.isFinite(root.rotation.y));
});

test('invalid floor samples block movement and a lost safe point falls back to spawn', () => {
  let invalid=false;const {root,controller}=fixture({groundHeight:x=>invalid&&x>-.8?NaN:ground(x)});
  advance(controller,1,{x:1,z:0,run:false});assert(root.position.x>-.8);putInWater(controller,{breath:.05});invalid=true;controller.update(.1,still);assert.deepEqual(root.position.toArray(),[-2,1.7,0]);assert(Number.isFinite(root.position.y));
});

test('long or invalid frames cannot drain a suspended interval or produce nonfinite motion', () => {
  const {root,controller}=fixture();putInWater(controller);controller.update(100,{x:NaN,z:Infinity,run:true});close(controller.getState().breath,20);assert(root.position.toArray().every(Number.isFinite));
  const before=controller.getState();for(const dt of [NaN,Infinity,-1,0])controller.update(dt,{x:1,z:1,run:true});assert.deepEqual(controller.getState(),before);
});

test('legacy land-only and stationary seated controllers preserve their old contract', () => {
  const root=new Object3D(),controller=createAvatarController({root,spawn:new Vector3(0,2,0),bounds:{minX:-5,maxX:5,minZ:-5,maxZ:5},colliders:[{kind:'box',minX:-.5,maxX:.5,minZ:-.5,maxZ:.5}]});
  root.position.set(0,2.3,0);controller.update(.1,still);assert.deepEqual(root.position.toArray(),[0,2.3,0]);assert(!controller.getState().swimming);close(controller.getState().breath,20);
});

test('current Lovers Point swimStart reaches actual water through its continuous beach route', () => {
  const gym=createTestingGym();try{
    const root=new Object3D(),controller=createAvatarController({root,spawn:gym.swimStart,bounds:gym.bounds,colliders:gym.colliders,groundHeight:gym.swimGroundHeight,water:gym.swimming});
    let entered=false;for(let i=0;i<1200;i++){const r=controller.update(1/60,{x:gym.swimDirection.x,z:gym.swimDirection.z,run:true});if(r.swimming){entered=true;break;}}
    assert(entered,'Mapped beach route never entered swimming');assert.equal(controller.getState().breath,20);close(root.position.y,1-AVATAR_SWIMMING.immersion);assert(controller.getState().safePosition[0]>0);
  }finally{gym.dispose();}
});
