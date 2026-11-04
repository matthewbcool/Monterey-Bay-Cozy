import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createEcologyService, ECOLOGY_DATA, ECOLOGY_REEF, habitatAt, habitatSuitability, planPopulation, validateEcologyData, type EcologyDataset, type HabitatContext } from '../src/data/ecology';
const service=createEcologyService();
function fixture():EcologyDataset {
 const h=ECOLOGY_DATA.hauls[0];
 return {...ECOLOGY_DATA,hauls:[{...h,id:'a',time:'2019-05-01T00:00:00Z'},{...h,id:'b',time:'2020-06-01T00:00:00Z'}],observations:[{haul:0,speciesId:'blue-rockfish',lifeStage:'Y',count:4},{haul:1,speciesId:'blue-rockfish',lifeStage:'Y',count:0}]};
}
test('NOAA cache is joined, bounded and backed by exact retained response checksums',()=>{
 validateEcologyData(ECOLOGY_DATA);
 assert.equal(ECOLOGY_DATA.hauls.length,127);assert.equal(ECOLOGY_DATA.observations.length,635);
 for(const [key,file] of Object.entries(ECOLOGY_DATA.source.files))assert.equal(createHash('sha256').update(readFileSync(`artifacts/ecology/sources/${key}.csv`)).digest('hex'),file.sha256);
 assert.ok(ECOLOGY_DATA.observations.some(r=>r.count===0));assert.ok(ECOLOGY_DATA.observations.some(r=>r.count>0));
 assert.ok(ECOLOGY_DATA.observations.filter(r=>r.speciesId==='blue-rockfish').every(r=>r.lifeStage==='Y'));
 assert.ok(gzipSync(JSON.stringify(ECOLOGY_DATA)).length<20000);
});
test('explicit non-detection, missing stage, unsurveyed month and outside coverage stay distinct',()=>{
 const d=fixture(),s=createEcologyService(d),h=d.hauls[0],q=(extra={})=>s.query(h.longitude,h.latitude,{speciesId:'blue-rockfish',lifeStage:'Y',...extra});
 assert.equal(q().status,'detected');assert.equal(q().detectionFraction,.5);
 assert.equal(q({year:2020}).status,'not-detected');assert.equal(q({year:2020}).explicitZeroRows,1);
 assert.equal(q({lifeStage:'A'}).status,'not-recorded');assert.equal(q({month:1}).status,'no-survey');
 assert.equal(s.query(0,0,{speciesId:'blue-rockfish'}).status,'outside-coverage');
 assert.equal(q().relativeAbundance,null);assert.equal(q().populationEstimate,null);
});
test('life stages and calendar filters never turn juvenile observations into older fish or seasonal absence',()=>{
 const d=fixture(),s=createEcologyService(d),h=d.hauls[0];
 assert.equal(s.query(h.longitude,h.latitude,{speciesId:'blue-rockfish',lifeStage:'A'}).detectedHauls,0);
 assert.equal(s.query(h.longitude,h.latitude,{speciesId:'blue-rockfish',month:6}).status,'not-detected');
 assert.equal(s.query(h.longitude,h.latitude,{speciesId:'blue-rockfish',year:2021}).status,'no-survey');
 assert.throws(()=>s.query(h.longitude,h.latitude,{speciesId:'blue-rockfish',month:NaN}));
 assert.throws(()=>s.query(h.longitude,h.latitude,{speciesId:'blue-rockfish',month:13}));
});
test('grid cells are stable in metres and include exact cache edges without aliasing invalid points',()=>{
 const [w,s,e,n]=ECOLOGY_DATA.bounds;
 for(const [x,y] of [[w,s],[e,n],[w,n],[e,s]])assert.ok(service.cellAt(x,y));
 assert.equal(service.cellAt(NaN,n),null);assert.equal(service.cellAt(w-.001,n),null);
 assert.equal(new Set(service.cells.map(c=>c.id)).size,service.cells.length);
 const c=service.cells[0];assert.ok(Math.abs((c.bounds[3]-c.bounds[1])*6371008.8*Math.PI/180-2000)<.001);
});
test('malformed, duplicate and dangling survey rows fail rather than silently becoming zeros',()=>{
 for(const mutate of [(d:EcologyDataset)=>d.observations.push({...d.observations[0]}),(d:EcologyDataset)=>d.observations[0].haul=99,(d:EcologyDataset)=>d.observations[0].count=-1,(d:EcologyDataset)=>d.hauls[0].longitude=NaN]){const d=fixture();mutate(d);assert.throws(()=>createEcologyService(d));}
});
const reefContext:HabitatContext={isWater:true,habitat:'kelp-reef',bottomDepthMeters:8,basis:'Explicit test/game sampler; not NOAA abundance'};
test('habitat rules require water and known depth, with separate pelagic and reef constraints',()=>{
 assert.equal(habitatSuitability('blue-rockfish',{...reefContext,habitat:'unknown'}),0);
 assert.ok(habitatSuitability('blue-rockfish',reefContext)>0);
 assert.equal(habitatSuitability('lingcod',{...reefContext,bottomDepthMeters:null}),0);
 assert.equal(habitatSuitability('lingcod',{...reefContext,isWater:false}),0);
 assert.ok(habitatSuitability('pacific-sardine',{...reefContext,habitat:'unknown',bottomDepthMeters:1000})>0);
 assert.equal(habitatAt(0,0).isWater,false);
 assert.equal(habitatAt(-121.92,36.62).isWater,false);
});
test('population recipes are reproducible, bounded and explicitly inferred at the unsurveyed Gym reef',()=>{
 const options={...ECOLOGY_REEF,seed:6256,allowHabitatInference:true,contextAt:()=>reefContext,maxIndividuals:40,maxGroups:4};
 const a=planPopulation(service,options),b=planPopulation(service,options);
 assert.deepEqual(a,b);assert.ok(a.individualCount>0&&a.individualCount<=40);assert.ok(a.groups.length<=4);
 assert.equal(a.individualCount,a.groups.reduce((n,g)=>n+g.count,0));assert.equal(a.countsAre,'authored-game-representatives');
 for(const g of a.groups){assert.ok(habitatAt(g.longitude,g.latitude).isWater);assert.ok(g.depthMeters>.4&&g.depthMeters<8);assert.equal(g.lifeStage,'A');assert.equal(g.basis,'inferred-habitat');assert.equal(g.habitat.basis,reefContext.basis);}
 assert.notDeepEqual(a,planPopulation(service,{...options,seed:123}));
 assert.equal(planPopulation(service,{...options,allowHabitatInference:false}).individualCount,0);
 assert.equal(planPopulation(service,{...options,maxIndividuals:0}).individualCount,0);
 assert.equal(planPopulation(service,{...options,longitude:0,latitude:0}).individualCount,0);
 assert.throws(()=>planPopulation(service,{...options,seed:NaN}));assert.throws(()=>planPopulation(service,{...options,maxIndividuals:NaN}));
 assert.throws(()=>planPopulation(service,{...options,lifeStage:'Y'}));
});
