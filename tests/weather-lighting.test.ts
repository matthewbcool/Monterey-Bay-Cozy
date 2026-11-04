import assert from 'node:assert/strict';
import {test} from 'node:test';
import {BoxGeometry, BufferAttribute, Color, Group, Mesh, MeshToonMaterial, Vector3} from 'three';
import {STYLE} from '../src/models/shared/style';
import {applyNodeStyle, createNodeStyleEnvironment, RIM, toNodeToon} from '../src/viewer/nodeStyle';
import {createWater} from '../src/viewer/water';
import {MeshBasicNodeMaterial, NodeMaterial} from 'three/webgpu';
import {vec3} from 'three/tsl';
import {createTunaModel} from '../src/models/tuna/createTunaModel';
import {createKelpGreenlingModel} from '../src/models/kelp-greenling/createKelpGreenlingModel';

test('workbench rim environments isolate cached materials and release their shared source only once',()=>{
  const source=new MeshToonMaterial(),gym=createNodeStyleEnvironment(),studio=createNodeStyleEnvironment();
  let disposed=0;source.addEventListener('dispose',()=>disposed++);
  let state='one';source.customProgramCacheKey=()=>state;
  const defaultMaterial=toNodeToon(source),gymMaterial=toNodeToon(source,true,gym),studioMaterial=toNodeToon(source,true,studio);
  assert.equal(toNodeToon(source,true,gym),gymMaterial,'shared source stays shared inside one environment');
  assert.notEqual(defaultMaterial,gymMaterial);assert.notEqual(gymMaterial,studioMaterial);
  gym.sun.value.set(1,-1,0).normalize();gym.color.value.set('#546491');gym.strength.value=.03;gym.paintExposure.value=.08;
  assert(studio.sun.value.equals(STYLE.sun.direction));assert(RIM.sun.value.equals(STYLE.sun.direction));
  assert(studio.color.value.equals(STYLE.sun.color));assert.equal(studio.strength.value,.38);assert.equal(studio.paintExposure.value,1);assert.equal(RIM.paintExposure.value,1);
  state='many';assert.equal(gymMaterial.customProgramCacheKey(),'many','dynamic material keys survive conversion');
  gym.reset();assert(gym.sun.value.equals(STYLE.sun.direction));assert(gym.color.value.equals(STYLE.sun.color));assert.equal(gym.strength.value,.38);assert.equal(gym.paintExposure.value,1);
  gymMaterial.dispose();gymMaterial.dispose();assert.equal(disposed,0);
  studioMaterial.dispose();assert.equal(disposed,0);defaultMaterial.dispose();assert.equal(disposed,1);
  const recreated=toNodeToon(source,true,gym);assert.notEqual(recreated,gymMaterial);recreated.dispose();
});

test('scene styling reuses one environment and leaves other scenes on their own uniforms',()=>{
  const geometry=new BoxGeometry(),source=new MeshToonMaterial(),gymEnvironment=createNodeStyleEnvironment();
  const gym=new Group(),studio=new Group();gym.add(new Mesh(geometry,source),new Mesh(geometry,source));studio.add(new Mesh(geometry,source));
  const gymMaterials=applyNodeStyle(gym,true,gymEnvironment),studioMaterials=applyNodeStyle(studio);
  assert.equal(gymMaterials.size,1);assert.equal(studioMaterials.size,1);
  assert.equal((gym.children[0] as Mesh).material,(gym.children[1] as Mesh).material);
  assert.notEqual((gym.children[0] as Mesh).material,(studio.children[0] as Mesh).material);
  for(const material of gymMaterials)assert.equal(material.userData.styleEnvironment,gymEnvironment);
  for(const material of studioMaterials)assert.equal(material.userData.styleEnvironment,RIM);
  for(const material of [...gymMaterials,...studioMaterials])material.dispose();geometry.dispose();
});

test('ocean weather uniforms are local, copied safely, resettable and do not alter harbor or tank water',()=>{
  const ocean=createWater({width:20,depth:20,segments:2,profile:'open',refract:false});
  const secondOcean=createWater({width:20,depth:20,segments:2,profile:'open',refract:false});
  const harbor=createWater({width:20,depth:20,segments:2}),tank=createWater({width:20,depth:20,segments:2,tank:true,profile:'open'});
  const environment={sunDirection:new Vector3(1,-1,0),skyZenith:new Color('#101a38'),skyHorizon:new Color('#28324e'),lightLevel:.12};
  const positions=Array.from(ocean.root.geometry.getAttribute('position').array);
  try{
    for(const water of [ocean,harbor,tank])water.setEnvironment(environment);
    assert.equal(ocean.uniforms.lightLevel.value,.12);assert(ocean.uniforms.sun.value.equals(environment.sunDirection.clone().normalize()));
    environment.skyZenith.set('#ffffff');assert.notEqual(ocean.uniforms.skyZenith.value.getHex(),environment.skyZenith.getHex(),'caller colors cannot mutate the ocean');
    for(const water of [secondOcean,harbor,tank]){assert.equal(water.uniforms.lightLevel.value,1);assert(water.uniforms.sun.value.equals(STYLE.sun.direction));assert(water.uniforms.skyZenith.value.equals(STYLE.dome.zenith));}
    ocean.setEnvironment({...environment,lightLevel:Infinity});assert.equal(ocean.uniforms.lightLevel.value,.12);
    ocean.resetEnvironment();assert.equal(ocean.uniforms.lightLevel.value,1);assert(ocean.uniforms.sun.value.equals(STYLE.sun.direction));assert(ocean.uniforms.skyZenith.value.equals(STYLE.dome.zenith));
    assert.deepEqual(Array.from(ocean.root.geometry.getAttribute('position').array),positions);
  }finally{for(const water of [ocean,secondOcean,harbor,tank])water.dispose();}
});


test('ocean atmospheric fog is opt-in, isolated, copied and cleared without shader or geometry rebuilds',()=>{
  const ocean=createWater({width:20,depth:20,segments:2,profile:'open',refract:false});
  const harbor=createWater({width:20,depth:20,segments:2}),tank=createWater({width:20,depth:20,segments:2,tank:true,profile:'open'});
  const environment={sunDirection:STYLE.sun.direction.clone(),skyZenith:STYLE.dome.zenith.clone(),skyHorizon:STYLE.dome.horizon.clone(),lightLevel:1};
  const fog={fogColor:new Color('#bac8cb'),fogNear:30,fogFar:240};
  const graph=ocean.material.colorNode,position=ocean.root.geometry.getAttribute('position');assert(position instanceof BufferAttribute);const version=position.version;
  try{
    assert.equal(ocean.uniforms.fogEnabled.value,0);
    for(const water of [ocean,harbor,tank])water.setEnvironment({...environment,...fog});
    assert.equal(ocean.uniforms.fogEnabled.value,1);assert.equal(ocean.uniforms.fogNear.value,30);assert.equal(ocean.uniforms.fogFar.value,240);
    assert.equal(harbor.uniforms.fogEnabled.value,0);assert.equal(tank.uniforms.fogEnabled.value,0);
    const color=ocean.uniforms.fogColor.value.clone();fog.fogColor.set('#000000');assert(ocean.uniforms.fogColor.value.equals(color));
    ocean.setEnvironment(environment);assert.equal(ocean.uniforms.fogEnabled.value,0,'ordinary daylight updates clear earlier weather fog');
    ocean.setEnvironment({...environment,...fog});ocean.resetEnvironment();assert.equal(ocean.uniforms.fogEnabled.value,0);
    for(const invalid of [{fogNear:20,fogFar:20},{fogNear:-1,fogFar:240},{fogNear:20,fogFar:Infinity}]){
      ocean.setEnvironment({...environment,...fog,...invalid});assert.equal(ocean.uniforms.fogEnabled.value,0);
    }
    assert.equal(ocean.material.colorNode,graph);assert.equal(position.version,version);
  }finally{for(const water of [ocean,harbor,tank])water.dispose();}
});


test('paint exposure binds both custom and converted fish without touching unlit atmosphere materials',()=>{
  const environment=createNodeStyleEnvironment(),tuna=createTunaModel(),greenling=createKelpGreenlingModel();
  const skyMaterial=new MeshBasicNodeMaterial(),skyBase=vec3(.2,.3,.4);skyMaterial.colorNode=skyBase;skyMaterial.userData={styleBase:skyBase,rim:false};
  const geometry=new BoxGeometry(),sky=new Mesh(geometry,skyMaterial);
  try{
    applyNodeStyle(tuna.root,false,environment);applyNodeStyle(greenling.root,false,environment);applyNodeStyle(sky,false,environment);
    const graphs=new Map<NodeMaterial,unknown>();
    for(const root of [tuna.root,greenling.root])root.traverse(o=>{
      if(!(o instanceof Mesh)||!(o.material instanceof NodeMaterial))return;
      const material=o.material;assert.equal(material.userData.styleEnvironment,environment);assert(material.colorNode);graphs.set(material,material.colorNode);
      if(material.userData.toon==='tuna-cel'){assert.notEqual(material.colorNode,material.userData.styleBase);assert.equal(material.userData.rimApplied,false);}
    });
    environment.paintExposure.value=.07;
    for(const [material,graph] of graphs)assert.equal(material.colorNode,graph,'day/night changes only uniforms');
    assert.equal(skyMaterial.colorNode,skyBase);assert.equal(skyMaterial.userData.styleEnvironment,undefined);
    applyNodeStyle(tuna.root,true,environment);tuna.root.traverse(o=>{if(o instanceof Mesh&&o.material instanceof NodeMaterial)assert.equal(o.material.userData.rimApplied,o.material.userData.rim!==false);});
  }finally{tuna.dispose();greenling.dispose();geometry.dispose();skyMaterial.dispose();}
});


test('opaque open ocean precedes translucent creatures; refracting harbor and tank keep their passes',()=>{
  const ocean=createWater({width:4,depth:4,segments:2,profile:'open',refract:false});
  const harbor=createWater({width:4,depth:4,segments:2}),tank=createWater({width:4,depth:4,segments:2,tank:true});
  try{
    assert.equal(ocean.material.transparent,false);assert.equal(ocean.material.depthWrite,true);
    assert.equal(harbor.material.transparent,true);assert.equal(tank.material.transparent,true);assert.equal(tank.material.depthWrite,false);
    ocean.setRefraction(true);assert.equal(ocean.material.transparent,true);
    ocean.setRefraction(false);assert.equal(ocean.material.transparent,false);
    harbor.setRefraction(false);assert.equal(harbor.material.transparent,true,'harbor volume retains its ordered pass');
  }finally{for(const water of [ocean,harbor,tank])water.dispose();}
});

test('caustics reset on leaving the gym and their environment owns its generated texture',()=>{
  const env=createNodeStyleEnvironment(),other=createNodeStyleEnvironment();env.caustics.enabled=true;
  const source=new MeshToonMaterial(),material=toNodeToon(source,false,env);
  assert(env.caustics.map);assert.equal(other.caustics.map,undefined);
  let released=0;env.caustics.map.addEventListener('dispose',()=>released++);
  env.caustics.illumination.value=.8;env.reset();assert.equal(env.caustics.illumination.value,0);
  material.dispose();assert.equal(released,0,'materials borrow the environment texture');
  env.dispose();env.dispose();assert.equal(released,1,'one environment teardown releases one field');
});
