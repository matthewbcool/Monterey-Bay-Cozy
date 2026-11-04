import test from 'node:test';
import assert from 'node:assert/strict';
import {buildingHeight,project} from '../src/viewer/mapStudy';
import data from '../src/data/monterey-map.json';
test('Map projection keeps metre scale and east/north directions',()=>{
  const origin:[number,number]=[-121.9,36.63];
  assert.equal(project(origin,origin).length(),0);
  const north=project([-121.9,36.631],origin),east=project([-121.899,36.63],origin);
  assert.ok(north.y>111&&north.y<112&&east.x>89&&east.x<90);
});
test('Measured map tags remain distinguishable from artistic height estimates',()=>{
  assert.deepEqual(buildingHeight({height:'12'}),{height:12,basis:'height'});
  assert.deepEqual(buildingHeight({height:'10 ft'}),{height:3.048,basis:'height'});
  assert.deepEqual(buildingHeight({'building:levels':'4'}),{height:12,basis:'levels'});
  assert.deepEqual(buildingHeight({height:'unknown'}),{height:6,basis:'default'});
});
test('Study includes the stitched aquarium footprint and preserves the four user points',()=>{
  assert.equal(data.boundary.length,4);
  const aquarium=data.buildings.find(b=>b.tags.name==='Monterey Bay Aquarium');
  assert.ok(aquarium&&aquarium.rings[0].length>4);
  assert.equal(aquarium.tags.height,'12');
  assert.equal(data.omittedBuildingFeatures,1);
});
