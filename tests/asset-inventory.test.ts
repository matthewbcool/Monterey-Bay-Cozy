import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import inventory from '../src/data/scene-asset-inventory.json';
import {propCollection} from '../src/models/props/catalogue';
import {PROP_SCALE,PROP_BUDGETS,SIZE_REFERENCES} from '../src/models/props/dimensions';
import {createFurnitureSource,createFurniture,furnitureIds} from '../src/models/props/furniture';
import {Box3,Mesh,Vector3} from 'three';
import {disposeObject} from '../src/models/props/primitives';

test('catalog IDs, size provenance and budgets cannot silently diverge',()=>{
 const ids=propCollection.map(e=>e.id);assert.equal(new Set(ids).size,ids.length);
 for(const record of [PROP_SCALE,PROP_BUDGETS,SIZE_REFERENCES])assert.deepEqual(Object.keys(record).sort(),[...ids].sort());
 for(const e of propCollection)assert(e.category&&e.description);
});
test('scene inventory has unique records, real sources and valid library links',()=>{
 assert.equal(new Set(inventory.entries.map(e=>e.id)).size,inventory.entries.length);
 for(const e of inventory.entries){assert(e.category&&e.notes&&e.sources.length);for(const p of e.sources)assert(existsSync(p),p);for(const id of e.libraryIds)assert(propCollection.some(p=>p.id===id),id);}
 for(const e of inventory.nonAssetSources)assert(existsSync(e.source)&&e.reason,e.source);
});
test('viewer geometry owners have an asset-family record or an explicit infrastructure reason',()=>{
 const covered=new Set([...inventory.entries.flatMap(e=>e.sources),...inventory.nonAssetSources.map(e=>e.source)]);
 function walk(dir:string){for(const e of readdirSync(dir,{withFileTypes:true})){const path=join(dir,e.name);if(e.isDirectory())walk(path);else if(path.endsWith('.ts')&&/\bnew (?:Mesh|InstancedMesh|\w+Geometry)\s*\(|\b(?:box|cylinder|sphere|tube|mesh|finishStaticAsset)\(/.test(readFileSync(path,'utf8')))assert(covered.has(path),`Classify geometry owner ${path} in scene-asset-inventory.json`);}}
 walk('src/viewer');
});
for(const id of furnitureIds)test(`${id}: catalog batching preserves scene-source shape and triangles`,()=>{
 const source=createFurnitureSource(id),asset=createFurniture(id);
 const size=(root:typeof source)=>new Box3().setFromObject(root).getSize(new Vector3());
 const count=(root:typeof source)=>{let n=0;root.traverse(o=>{if(o instanceof Mesh)n+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});return n;};
 assert(size(source).distanceTo(size(asset))<1e-6);assert.equal(count(source),count(asset));assert.equal(asset.children.length,1);disposeObject(source);disposeObject(asset);
});
