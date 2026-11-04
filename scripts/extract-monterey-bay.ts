/** Offline vector clipping and provenance companion to extract-monterey-bay.py. */
import fs from 'node:fs';
import path from 'node:path';
import polygonClipping from 'polygon-clipping';
const [evidence,gridsPath,output]=process.argv.slice(2),read=(name:string)=>JSON.parse(fs.readFileSync(path.join(evidence,name+'.json'),'utf8'));
const bounds=[-122.12,36.55,-121.70,37.03],origin=[-121.89979746181925,36.6279949476303];
const rad=Math.PI/180,R=6371008.8,project=(p:number[])=>[Math.round((p[0]-origin[0])*rad*R*Math.cos(origin[1]*rad)*100)/100,Math.round(-(p[1]-origin[1])*rad*R*100)/100] as [number,number];
const [w,s,e,n]=bounds,rectangle=[[[w,s],[e,s],[e,n],[w,n]]] as polygonClipping.Polygon;
const offshore=read('land'),rings=offshore.features[0].geometry.rings as polygonClipping.Ring[];
const water=polygonClipping.intersection([rings],rectangle),land=polygonClipping.difference(rectangle,water);
const convert=(polys:polygonClipping.MultiPolygon)=>polys.map(p=>p.map(r=>r.slice(0,-1).map(project)));
const roads=read('roads').features.flatMap((f:{attributes:Record<string,string>;geometry:{paths:number[][][]}})=>f.geometry.paths.map(points=>({id:String(f.attributes.OBJECTID),name:f.attributes.PRIME_NAME.trim(),points:points.map(project)})));
const names=['Santa Cruz','Capitola','Aptos','Rio del Mar','Watsonville','Moss Landing','Castroville','Marina','Seaside','Sand City','Monterey','Pacific Grove'];
const all=[...read('places-3').features,...read('places-2').features,...read('places-1').features];
const places=names.map(name=>{
 const feature=all.find(f=>f.attributes.gaz_name===name)||all.find(f=>f.attributes.gaz_name===name+' Census Designated Place');if(!feature)throw Error('Missing place '+name);
 const [longitude,latitude]=feature.geometry.points[0];return {id:name.toLowerCase().replaceAll(' ','-'),name,longitude,latitude,gazetteerId:feature.attributes.gaz_id,featureClass:feature.attributes.gaz_featureclass};
});
const grids=JSON.parse(fs.readFileSync(gridsPath,'utf8'));
const sources=['land','dem','etopo','roads','places-1','places-2','places-3'].map(id=>({id,...read(id+'-request')}));
const result={name:'Monterey Bay regional study',downloaded:'2026-10-25',bounds,origin,land:convert(land),water:convert(water),roads,places,...grids,sources,
 limits:'NOAA-derived cartographic shoreline closes some harbors and estuary channels. USGS coarse regional terrain; ETOPO1 one arc-minute relief. Generalized USGS highways and GNIS place points. Local detailed studies retain their own sources. No regional buildings, navigational accuracy or multiplayer world is claimed.'};
fs.writeFileSync(output,JSON.stringify(result)+'\n');console.log({landPolygons:result.land.length,waterPolygons:result.water.length,shoreVertices:result.land.reduce((n,p)=>n+p.reduce((n,r)=>n+r.length,0),0),roads:roads.length,places:places.length,terrain:result.terrain.columns+'x'+result.terrain.rows,bathy:result.bathy.columns+'x'+result.bathy.rows,bytes:fs.statSync(output).size});
