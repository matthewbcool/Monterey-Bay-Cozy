import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fishCollection} from '../src/models/catalogue';
import {formatSizeRange,speciesSizeRanges} from '../src/models/sizeRanges';

test('Every selectable species has a sourced range with explicit measurement and evidence basis',()=>{
 assert.deepEqual(fishCollection.map(e=>e.id).sort(),Object.keys(speciesSizeRanges).sort());
 for(const entry of fishCollection){
  const {meters,sources,note,basis}=entry.sizeRange;
  assert.ok(meters.every(n=>Number.isFinite(n)&&n>0),entry.id);
  assert.ok(meters[0]<meters[1],entry.id);assert.ok(sources.length>0,entry.id);
  assert.ok(note.length>40);assert.ok(['published range','reference span','selected range'].includes(basis));
  for(const source of sources)assert.equal(new URL(source.url).protocol,'https:');
 }
});

test('Ranges keep shell, bell and fish lengths distinct and convert inches correctly',()=>{
 assert.equal(formatSizeRange(speciesSizeRanges['green-sea-turtle']),'Shell length range · 91–109 cm');
 assert.equal(formatSizeRange(speciesSizeRanges['moon-jelly']),'Bell diameter range · 5–40 cm');
 assert.equal(formatSizeRange(speciesSizeRanges['chinook-salmon']),'Length range · 76–102 cm');
 assert.equal(formatSizeRange(speciesSizeRanges['giant-pacific-octopus']),'Arm span range · 2–4 m');
 assert.equal(formatSizeRange(speciesSizeRanges.tuna),'Length range · 1.5–3 m');
 assert.equal(formatSizeRange(speciesSizeRanges.lingcod),'Length range · 51–152 cm');
 assert.equal(formatSizeRange(speciesSizeRanges['gray-whale']),'Length range · 11.1–15.2 m');
 assert.ok(speciesSizeRanges.tuna.note.includes('provisional'));
 assert.ok(speciesSizeRanges['california-sheephead'].note.includes('authoring choice'));
});

test('Biological ranges do not silently change model geometry, root scale or physics dimensions',()=>{
 const expected=[1.2,.25,.35,1.2,.55,.35,.8,.28,.85,.25,1.15,4,1.5,3,12,1.2];
 fishCollection.forEach((entry,i)=>{
  const model=entry.create();assert.equal(model.root.userData.lengthMeters,expected[i],entry.id);
  assert.deepEqual(model.root.scale.toArray(),[1,1,1]);
  assert.ok(model.physics.colliders.every(c=>c.radius>0));
  if(entry.id==='green-sea-turtle')assert.ok(Math.abs(model.root.userData.shellLengthMeters-.9085)<1e-8);
  model.dispose();
 });
});
