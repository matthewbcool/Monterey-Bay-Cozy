import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {createWater, sampleWater} from '../src/viewer/water';
import {createTestingGym} from '../src/viewer/testingGym';

test('ocean wake follows actual rowboat travel and clears at the dock without changing surface geometry',()=>{
  const gym=createTestingGym();
  try {
    const positions=Array.from(gym.water.root.geometry.attributes.position.array);
    gym.update(0);assert.equal(gym.water.uniforms.wakeStrength.value,0);
    for(let i=0;i<120;i++)gym.vessel.update(1/60,{throttle:1,steer:0,fast:true});
    gym.update(2);
    assert(gym.water.uniforms.wakeStrength.value>.7);
    assert.equal(gym.water.uniforms.wakePosition.value.x,gym.boat.position.x-gym.water.root.position.x);
    assert.equal(gym.water.uniforms.wakePosition.value.y,gym.boat.position.z-gym.water.root.position.z);
    const water=sampleWater(gym.boat.position.x-gym.water.root.position.x,gym.boat.position.z-gym.water.root.position.z,2);
    assert.equal(gym.vessel.surfaceHeight,water.height,'Shading changes must not alter CPU buoyancy');
    gym.vessel.reset();gym.update(2);assert.equal(gym.water.uniforms.wakeStrength.value,0);
    assert.deepEqual(Array.from(gym.water.root.geometry.attributes.position.array),positions);
  }finally{gym.dispose();}
});
test('wake reverses with travel, remains bounded, and invalid poses cannot contaminate shader uniforms',()=>{
  const water=createWater({width:10000,depth:10000,segments:20,profile:'open',refract:false});
  try {
    water.setWake(5,-9,Math.PI/2,-1.6);assert.equal(water.uniforms.wakeStrength.value,.5);
    assert(Math.abs(water.uniforms.wakeDirection.value.x+1)<1e-8);
    water.setWake(5,-9,0,20);assert.equal(water.uniforms.wakeStrength.value,1);
    water.setWake(NaN,Infinity,0,3);assert.equal(water.uniforms.wakeStrength.value,0);
    assert(water.uniforms.wakePosition.value.toArray().every(Number.isFinite));
    assert.equal(water.refraction,false);assert.equal(water.root.geometry.index!.count/3,800);
  }finally{water.dispose();}
});
