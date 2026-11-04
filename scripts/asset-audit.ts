import {Box3, Mesh, Vector3} from 'three';
import {propCollection} from '../src/models/props/catalogue';
import {disposeObject} from '../src/models/props/primitives';
import {createWater} from '../src/viewer/water';
const assets=propCollection.map(entry=>{const root=entry.create();let drawCalls=0,triangles=0;root.traverseVisible(o=>{if(o instanceof Mesh){drawCalls+=Array.isArray(o.material)?o.geometry.groups.length:1;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});const sizeMeters=new Box3().setFromObject(root).getSize(new Vector3()).toArray();disposeObject(root);return {id:entry.id,drawCalls,triangles,sizeMeters};});
const water=createWater({width:48,depth:27,tank:true});const waterTriangles=water.root.geometry.index!.count/3;water.dispose();
console.log(JSON.stringify({assets,waterTriangles},null,2));
