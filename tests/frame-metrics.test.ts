import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createFrameMetrics} from '../src/viewer/frameMetrics';
test('steady rendered cadence reports FPS and near-zero variation',()=>{
 const m=createFrameMetrics();assert.equal(m.sample(0,2),null);let result;
 for(let i=1;i<=61;i++){const next=m.sample(i*1000/60,2);if(next)result=next;}
 assert(result);assert(Math.abs(result.fps-60)<1e-8);assert(Math.abs(result.meanMs-1000/60)<1e-8);assert(result.deviationMs<1e-6);assert.equal(result.workMs,2);
});
test('variation is population standard deviation, with independent CPU work',()=>{
 const m=createFrameMetrics(40);m.sample(0,0);m.sample(10,2);const result=m.sample(40,6)!;
 assert.equal(result.fps,50);assert.equal(result.meanMs,20);assert.equal(result.deviationMs,10);assert.equal(result.worstMs,30);assert.equal(result.workMs,4);assert.equal(result.frames,2);
});
test('long stalls are not hidden by simulation dt clamping',()=>{
 const m=createFrameMetrics();m.sample(0,0);m.sample(16,2);const result=m.sample(1516,30)!;assert.equal(result.worstMs,1500);assert.equal(result.slowFrames,1);assert(result.fps<2);
});
test('pause reset excludes inactive time and releases the previous measurement window',()=>{
 const m=createFrameMetrics(40);m.sample(0,1);m.sample(20,1);m.reset();assert.equal(m.sample(30000,4),null);m.sample(30020,4);const result=m.sample(30040,4)!;assert.equal(result.fps,50);assert.equal(result.worstMs,20);assert.equal(result.workMs,4);
});
test('invalid samples and repeated timestamps cannot produce non-finite statistics',()=>{
 const m=createFrameMetrics(20);m.sample(0,0);assert.equal(m.sample(NaN,1),null);assert.equal(m.sample(0,2),null);assert.equal(m.sample(10,Infinity),null);const result=m.sample(20,-1)!;assert.equal(result.fps,50);assert.equal(result.workMs,0);assert.equal(result.deviationMs,0);
});
