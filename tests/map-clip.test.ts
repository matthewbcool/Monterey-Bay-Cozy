import test from 'node:test';
import assert from 'node:assert/strict';
import { splitSegmentAtPolygon, withinPolygon, type MapPoint } from '../src/viewer/mapStudy/clip';

const square: MapPoint[] = [[0,0],[10,0],[10,10],[0,10]];
test('Detailed map clipping keeps crossing road ends and removes only the covered span', () => {
  const result = splitSegmentAtPolygon([-5,5],[15,5],square);
  assert.deepEqual(result.inside, [[[0,5],[10,5]]]);
  assert.deepEqual(result.outside, [[[-5,5],[0,5]],[[10,5],[15,5]]]);
  assert.equal(withinPolygon([10,5],square),true);
  assert.deepEqual(splitSegmentAtPolygon([0,0],[10,0],square).outside,[]);
});
test('Concave map patches preserve uncovered inlets and all segment length', () => {
  const polygon: MapPoint[] = [[0,0],[6,0],[6,6],[4,6],[4,2],[2,2],[2,6],[0,6]];
  const result = splitSegmentAtPolygon([-1,4],[7,4],polygon);
  assert.deepEqual(result.inside, [[[0,4],[2,4]],[[4,4],[6,4]]]);
  const length = [...result.inside,...result.outside].reduce((sum,[a,b])=>sum+Math.hypot(b[0]-a[0],b[1]-a[1]),0);
  assert.equal(length,8);
});
test('Map clipping handles tangencies, reversed winding and zero-length routes', () => {
  assert.deepEqual(splitSegmentAtPolygon([-1,1],[1,-1],square).inside,[]);
  assert.deepEqual(splitSegmentAtPolygon([-5,5],[15,5],[...square].reverse()),splitSegmentAtPolygon([-5,5],[15,5],square));
  assert.deepEqual(splitSegmentAtPolygon([2,2],[2,2],square),{inside:[],outside:[]});
});
