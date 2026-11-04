import { createEcologyLayer } from './mapStudy/ecologyLayer';
import { createCaledoniaLabels } from './mapStudy/caledoniaLabels';
import { createCaledoniaArea, caledoniaFootprint, CALEDONIA_BUILDING_IDS } from './mapStudy/caledonia';
import { BufferGeometry, Color, DirectionalLight, ExtrudeGeometry, Float32BufferAttribute, Group, HemisphereLight, LineBasicMaterial, LineSegments, Mesh, PerspectiveCamera, PlaneGeometry, Scene, Shape, ShapeGeometry, Vector2, Vector3, Spherical, Path } from 'three';
import { MeshToonNodeMaterial, WebGPURenderer } from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createToonMaterial, STYLE } from '../models/shared/style';
import { applyNodeStyle } from './nodeStyle';
import { createAquariumInterior } from './aquariumInterior/view';
import { createLiveFeedLayer } from './liveFeedLayer';
import type { FeedLocation } from '../data/liveFeeds';
import { createLodController } from '../models/shared/lod/controller';
import { type LodMode } from '../models/shared/lod/geometry';
import { createLoversPointArea, loversPointFootprint, replacedBuildingIds, resolveParkBuildingElevation } from './mapStudy/loversPoint';
import { createWaterfrontArea, waterfrontFootprint, WATERFRONT_BUILDING_IDS } from './mapStudy/waterfront';
import { createMuseumLabels } from './mapStudy/museumLabels';
import { createMuseumArea } from './mapStudy/museum';
import { MUSEUM_ROOMS, MUSEUM_SITE } from '../data/pacificGroveMuseum';
import type { MuseumView } from '../models/locations/pacificGroveMuseum';
import { splitSegmentAtPolygon } from './mapStudy/clip';
import { createBayRegion, BAY_REGION } from './mapStudy/bayRegion';
import { createBayPlaces } from './mapStudy/bayPlaces';
import { createWorldConditionsLayer } from './mapStudy/worldConditionsLayer';
export type GeoPoint=[number,number];
export interface MapData {bounds:[number,number,number,number];boundary:GeoPoint[];downloaded:string;buildings:{id:string;rings:GeoPoint[][];tags:Record<string,string>}[];lines:{kind:string;points:GeoPoint[]}[];omittedBuildingFeatures:number}
/** Local equirectangular study projection: X east, Z south, Y up, units metres.
 * Metres at the reference latitude; regional distortion grows away from it. Not survey-grade. */
export function project(point:GeoPoint,origin:GeoPoint):Vector2 {
  const r=6371008.8,rad=Math.PI/180;
  return new Vector2((point[0]-origin[0])*rad*r*Math.cos(origin[1]*rad),(point[1]-origin[1])*rad*r);
}
export function buildingHeight(tags:Record<string,string>){
  const parse=(s:string|undefined)=>s?.match(/^\s*(\d+(?:\.\d+)?)\s*(m|ft)?\s*$/i);
  const h=parse(tags.height);if(h&&Number(h[1])>0)return {height:Number(h[1])*(h[2]?.toLowerCase()==='ft'?.3048:1),basis:'height'};
  const floors=Number(tags['building:levels']);if(Number.isFinite(floors)&&floors>0)return {height:floors*3,basis:'levels'};
  return {height:6,basis:'default'};
}
function shape(rings:GeoPoint[][],origin:GeoPoint){
  const outer=rings[0].map(p=>project(p,origin)),s=new Shape(outer);
  for(const ring of rings.slice(1))s.holes.push(new Path(ring.map(p=>project(p,origin))));
  return s;
}
export async function createMapStudy(host:HTMLElement){
  const abort=new AbortController();let active=true,disposed=false;
  host.innerHTML=`<div class="map-canvas"></div><div class="map-tools"><h1>Monterey Bay · map study</h1><p class="map-status" role="status">Loading local OSM data…</p><div class="map-buttons"><button data-view="overview" aria-pressed="true">Overview</button><button data-view="local" aria-pressed="false">Local study</button><button data-view="top" aria-pressed="false">Top view</button><button data-view="close" aria-pressed="false">Aquarium</button><button data-view="park" aria-pressed="false">Lovers Point</button><button data-view="caledonia" aria-pressed="false">Caledonia Park · top view</button><button data-view="museum" aria-pressed="false">Natural History Museum</button><button data-view="waterfront" aria-pressed="false">Waterfront extension</button></div><details id="map-museum-tools"><summary>Museum study</summary><label>View <select id="map-museum-floor"><option value="exterior">Exterior</option><option value="ground">Ground floor cutaway</option><option value="upper">Mezzanine cutaway</option></select></label><label>Focus <select id="map-museum-room"><option value="all">Whole site</option>${MUSEUM_ROOMS.filter(r=>!['services','family','passage','workshop'].includes(r.id)).map(r=>`<option value="${r.id}">${r.name}</option>`).join('')}<option value="garden">Native Plant Garden</option></select></label><label><input id="map-museum-plan" type="checkbox"> Plan view</label><label><input id="map-museum-labels" type="checkbox" checked> Room labels</label><p>Room layout follows the museum’s public plans; dimensions and display positions are approximate. <a href="${MUSEUM_SITE.sources.access}" target="_blank" rel="noopener">Floor plans ↗</a></p></details><label><input id="map-seafloor" type="checkbox"> Show regional seafloor</label><label><input id="map-park" type="checkbox" checked> Detailed park &amp; waterfront</label><label>Regional buildings <select id="map-display"><option value="mass">Building massing</option><option value="flat">Footprints</option></select></label><label><input id="map-estimates" type="checkbox" checked> Include estimated heights</label><label><input id="map-wire" type="checkbox"> Wireframe</label><label><input id="map-roads" type="checkbox" checked> Regional roads &amp; paths</label><label><input id="map-boundary" type="checkbox" checked> Original local study boundary</label><details><summary>Data limits &amp; game options</summary><p>Mapped footprints and coastline. Gold buildings have height tags; seafoam uses floor counts × 3 m; muted buildings assume 6 m. The detailed Lovers Point patch reuses the gym’s USGS terrain, mapped beaches and photo-informed scenery at metre scale. Caledonia Park adds a mapped basketball court, playground areas and surrounding streets to the west, with photo-informed furniture and estimated grading. The waterfront extension continues southeast toward the Aquarium using cached OSM routes and USGS terrain. Heights, roofs and planting remain estimates; the full bay uses cached USGS regional terrain, NOAA-derived shoreline, major highways and sourced place points. Seafloor mode shows coarse NOAA ETOPO1 relief. The original local building study retains its comparison plane, with a 600 m terrain transition.</p><p>Regional controls also include extra map footprints touching the park; their floors are raised above the DEM with inferred foundations. The original park buildings keep their authored style. Turn the patch off to compare the original map. There is no surveyed seabed or calibrated live waterline. The outline is your proposed game area, not a legal boundary.</p></details><p class="map-credit">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a> · ODbL · local OSM snapshots · Regional data retrieved Oct 25, 2026 · USGS 3DEP / GNIS / highways · NOAA / CA CDT shoreline · NOAA ETOPO1</p></div><p class="map-legend">Gold: height tag · Seafoam: floor estimate · Muted: 6 m estimate · Coral: proposed boundary<br>Drag to orbit · right-drag / two-finger drag to pan · scroll / pinch to zoom · arrows / + / − / Home when focused</p>`;
  const status=host.querySelector<HTMLElement>('.map-status')!;
  const response=await fetch(new URL('../data/monterey-map.json',import.meta.url));if(!response.ok)throw Error('Could not load the local map data');
  const data=await response.json() as MapData;
  const origin:GeoPoint=[(data.bounds[0]+data.bounds[2])/2,(data.bounds[1]+data.bounds[3])/2];
  const sw=project([data.bounds[0],data.bounds[1]],origin),ne=project([data.bounds[2],data.bounds[3]],origin);
  const width=ne.x-sw.x,depth=ne.y-sw.y;
  const parkFootprint=loversPointFootprint(origin),park=createLoversPointArea(origin),waterfront=createWaterfrontArea(origin),museum=createMuseumArea(origin),coastFootprint=waterfrontFootprint(origin),caledonia=createCaledoniaArea(origin),caledoniaMask=caledoniaFootprint(origin);
  const bay=createBayRegion(origin,[parkFootprint,coastFootprint,caledoniaMask],[sw.x,-ne.y,ne.x,-sw.y]);
  const baySize=bay.bounds.getSize(new Vector3());
  const lod=createLodController();
  const detail=document.createElement('label');detail.innerHTML='Detail <select id="map-lod"><option value="auto">Auto · distance</option><option value="near">Near · LOD 0</option><option value="mid">Mid · LOD 1</option><option value="far">Far · LOD 2</option></select>';
  const lodReadout=document.createElement('p');lodReadout.className='map-lod-status';
  const lodPanel=document.createElement('div');lodPanel.className='map-lod-controls';lodPanel.append(detail,lodReadout);
  host.querySelector('.map-tools')!.append(lodPanel);
  const scene=new Scene();scene.background=new Color('#163c43');
  scene.add(new HemisphereLight(STYLE.sky.color,STYLE.sky.ground,STYLE.sky.intensity));
  const sun=new DirectionalLight(STYLE.sun.color,STYLE.sun.intensity);sun.position.copy(STYLE.sun.direction).multiplyScalar(2000);scene.add(sun);
  const root=new Group();scene.add(root);root.add(caledonia.root,bay.root,park.root,waterfront.root,museum.root);
  const ground=new Mesh(new PlaneGeometry(width,depth),createToonMaterial({color:'#264e50',rim:false}));ground.rotation.x=-Math.PI/2;ground.position.y=-4;root.add(ground);
  const footprintRoot=new Group(),massRoot=new Group();root.add(footprintRoot,massRoot);
  const replacedFlat=new Group(),replacedMass=new Group();footprintRoot.add(replacedFlat);massRoot.add(replacedMass);
  replacedFlat.visible=replacedMass.visible=false;
  const raisedFlat=new Group(),raisedMass=new Group();footprintRoot.add(raisedFlat);massRoot.add(raisedMass);
  raisedFlat.name='Terrain-adjusted regional footprints';raisedMass.name='Terrain-adjusted regional massing and foundations';
  const heights=[0,0,0],meshes:Mesh[]=[];
  const groups:Record<string,{basis:string;replaced:boolean;raised?:boolean;flat:BufferGeometry[];mass:BufferGeometry[];foundations?:BufferGeometry[]}>={};
  for(const b of data.buildings){
    const s=shape(b.rings,origin),h=buildingHeight(b.tags),detailed=replacedBuildingIds.has(b.id)||WATERFRONT_BUILDING_IDS.has(b.id)||CALEDONIA_BUILDING_IDS.has(b.id);
    // Other source footprints can cross the elevated patch. Keep h unchanged,
    // raise their level floor and support it with an explicitly inferred foundation.
    const elevation=detailed?null:resolveParkBuildingElevation(b.rings);
    const replaced=detailed||elevation!==null,key=h.basis+(replaced?'-park':'');
    const bucket=groups[key]??(groups[key]={basis:h.basis,replaced,flat:[],mass:[]});
    heights[['height','levels','default'].indexOf(h.basis)]++;
    const flat=new ShapeGeometry(s);flat.rotateX(-Math.PI/2);flat.translate(0,.6,0);bucket.flat.push(flat);
    const mass=new ExtrudeGeometry(s,{depth:h.height,bevelEnabled:false,steps:1,curveSegments:1});mass.rotateX(-Math.PI/2);bucket.mass.push(mass);
    if(elevation!==null){
      const key=h.basis+'-raised',raised=groups[key]??(groups[key]={basis:h.basis,replaced:false,raised:true,flat:[],mass:[],foundations:[]});
      raised.flat.push(flat.clone().translate(0,elevation,0));raised.mass.push(mass.clone().translate(0,elevation,0));
      const foundation=new ExtrudeGeometry(s,{depth:elevation,bevelEnabled:false,steps:1,curveSegments:1});foundation.rotateX(-Math.PI/2);raised.foundations!.push(foundation);
    }
  }
  for(const bucket of Object.values(groups)){
    const {basis,replaced,raised}=bucket;
    for(const mode of ['flat','mass'] as const){
      if(!bucket[mode].length)continue;
      const geometry=mergeGeometries(bucket[mode],false)!;bucket[mode].forEach(g=>g.dispose());
      const material=createToonMaterial({color:basis==='height'?'#e9ca83':basis==='levels'?'#9dc8b1':'#6f8580',rim:false});
      const mesh=new Mesh(geometry,material);mesh.userData.basis=basis;
      (raised?(mode==='flat'?raisedFlat:raisedMass):replaced?(mode==='flat'?replacedFlat:replacedMass):(mode==='flat'?footprintRoot:massRoot)).add(mesh);meshes.push(mesh);
    }
    if(bucket.foundations?.length){
      const geometry=mergeGeometries(bucket.foundations,false)!;bucket.foundations.forEach(g=>g.dispose());
      const foundation=new Mesh(geometry,createToonMaterial({color:'#707c70',rim:false}));foundation.name='Inferred foundation at detailed terrain edge';foundation.userData.basis=basis;
      raisedMass.add(foundation);meshes.push(foundation);
    }
  }
  footprintRoot.visible=false;
  const coveredLines:LineSegments[]=[];
  function lines(points:GeoPoint[][],color:string,y:number,replacePark=false){
    const positions:number[]=[],covered:number[]=[];
    for(const line of points)for(let i=1;i<line.length;i++){
      const a=project(line[i-1],origin),b=project(line[i],origin);
      // Keep downloaded ways extending beyond the rectangular study out of the preview.
      if(Math.abs(a.x)>width/2+.001||Math.abs(a.y)>depth/2+.001||Math.abs(b.x)>width/2+.001||Math.abs(b.y)>depth/2+.001)continue;
      if(replacePark){
        const pieces=splitSegmentAtPolygon([a.x,-a.y],[b.x,-b.y],parkFootprint);
        for(const [start,end]of pieces.outside){const region=splitSegmentAtPolygon(start,end,coastFootprint);for(const [a,b]of region.outside){const district=splitSegmentAtPolygon(a,b,caledoniaMask);for(const [u,v]of district.outside)positions.push(u[0],y,u[1],v[0],y,v[1]);for(const [u,v]of district.inside)covered.push(u[0],y,u[1],v[0],y,v[1]);}for(const [a,b]of region.inside)covered.push(a[0],y,a[1],b[0],y,b[1]);}
        for(const [start,end]of pieces.inside)covered.push(start[0],y,start[1],end[0],y,end[1]);
      }else positions.push(a.x,y,-a.y,b.x,y,-b.y);
    }
    const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));
    const l=new LineSegments(g,new LineBasicMaterial({color}));root.add(l);
    if(covered.length){const old=new BufferGeometry();old.setAttribute('position',new Float32BufferAttribute(covered,3));const replacement=new LineSegments(old,new LineBasicMaterial({color}));replacement.visible=false;l.add(replacement);coveredLines.push(replacement);}
    return l;
  }
  const roads=lines(data.lines.filter(l=>l.kind==='road').map(l=>l.points),'#799993',.8,true);
  const localCoast=lines(data.lines.filter(l=>l.kind==='coast').map(l=>l.points),'#a8d9d0',1,true);localCoast.visible=false;
  const boundary=lines([[...data.boundary,data.boundary[0]]],'#ef9679',35);
  // Ground-level footprint of the user's actual quadrilateral, distinct from the downloaded rectangle.
  const boundaryFill=new Mesh(new ShapeGeometry(shape([data.boundary],origin)),createToonMaterial({color:'#365f57',rim:false}));boundaryFill.rotation.x=-Math.PI/2;boundaryFill.position.y=-2;root.add(boundaryFill);
  applyNodeStyle(root,false);
  const renderer=new WebGPURenderer({antialias:true,forceWebGL:new URLSearchParams(location.search).has('webgl')});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  const mount=host.querySelector<HTMLElement>('.map-canvas')!;mount.append(renderer.domElement);
  renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','Monterey map study. Drag to orbit, right drag to pan, scroll to zoom.');
  const camera=new PerspectiveCamera(45,1,1,20000),controls=new OrbitControls(camera,renderer.domElement);
  const museumLabels=createMuseumLabels(mount,camera,museum),caledoniaLabels=createCaledoniaLabels(mount,camera,origin);
  controls.enableDamping=false;controls.enablePan=true;controls.minDistance=25;controls.maxDistance=12000;controls.maxPolarAngle=Math.PI*.495;
  let bayPlaces:ReturnType<typeof createBayPlaces>|undefined;
  let ecology:ReturnType<typeof createEcologyLayer>|undefined;
  let view='overview';
  function setView(next:string){
    view=next;host.dataset.mapView=next;controls.target.set(0,0,0);
    camera.clearViewOffset();camera.near=1;camera.far=20000;camera.fov=45;camera.updateProjectionMatrix();controls.maxDistance=12000;controls.minDistance=25;
    const d=Math.max(depth,width/camera.aspect)/(2*Math.tan(camera.fov*Math.PI/360))*1.3;
    bayPlaces?.select(next.startsWith('bay:')?next.slice(4):'');
    if(next==='overview'||next==='top'||next.startsWith('bay:')){
      const place=BAY_REGION.places.find(p=>p.id===next.slice(4));
      const target=place?bay.point(place.longitude,place.latitude):bay.bounds.getCenter(new Vector3());
      target.y=place?target.y:0;controls.target.copy(target);
      const tools=host.querySelector<HTMLElement>('.map-tools')!,narrow=mount.clientWidth<700,inset=narrow?Math.min(mount.clientHeight*.42,tools.clientHeight+16):Math.min(360,tools.clientWidth+36);
      const span=place?9000/Math.min(1,camera.aspect):Math.max(baySize.z,baySize.x/camera.aspect),distance=span/(2*Math.tan(camera.fov*Math.PI/360))*1.18*(narrow?mount.clientHeight/(mount.clientHeight-inset):1);
      camera.setViewOffset(mount.clientWidth,mount.clientHeight,narrow?0:-inset/2,narrow?-inset/2:0,mount.clientWidth,mount.clientHeight);
      controls.maxDistance=350000;controls.minDistance=25;camera.near=Math.max(2,distance/12000);camera.far=Math.max(20000,distance*4);
      camera.position.copy(target).add((next==='top'?new Vector3(0,1,.00001):new Vector3(.12,1,.52)).normalize().multiplyScalar(distance));camera.updateProjectionMatrix();
    }else if(next==='caledonia'){
      caledonia.root.visible=park.root.visible=waterfront.root.visible=museum.root.visible=true;bay.setDetailed(true);host.querySelector<HTMLInputElement>('#map-park')!.checked=true;replacedFlat.visible=replacedMass.visible=false;raisedFlat.visible=raisedMass.visible=true;coveredLines.forEach(l=>l.visible=false);
      controls.target.copy(caledonia.center);const distance=Math.max(350,200/camera.aspect)/(2*Math.tan(camera.fov*Math.PI/360));
      camera.position.copy(controls.target).add(new Vector3(0,distance,.001));controls.minDistance=10;camera.near=.5;camera.updateProjectionMatrix();
    }else if(next==='museum'){
      caledonia.root.visible=park.root.visible=waterfront.root.visible=museum.root.visible=true;bay.setDetailed(true);host.querySelector<HTMLInputElement>('#map-park')!.checked=true;replacedFlat.visible=replacedMass.visible=false;raisedFlat.visible=raisedMass.visible=true;coveredLines.forEach(l=>l.visible=false);
      const mode=host.querySelector<HTMLSelectElement>('#map-museum-floor')!.value as MuseumView,room=host.querySelector<HTMLSelectElement>('#map-museum-room')!.value;museum.setView(mode);
      controls.target.copy(museum.point(19,18,2));let span=53;
      const selected=MUSEUM_ROOMS.find(r=>r.id===room);if(selected){const [x0,z0,x1,z1]=selected.rect;controls.target.copy(museum.point((x0+x1)/2,(z0+z1)/2,1));span=Math.max(x1-x0,z1-z0)+6;}else if(room==='garden'){controls.target.copy(museum.point(12,32,1));span=29;}
      const d=span/Math.min(1,camera.aspect)/(2*Math.tan(Math.PI/8))*1.25;controls.minDistance=4;camera.near=.2;const direction=host.querySelector<HTMLInputElement>('#map-museum-plan')!.checked?new Vector3(0,1,-.001):new Vector3(.25,mode==='exterior'?.78:1.7,-1);camera.position.copy(controls.target).add(direction.normalize().multiplyScalar(d));camera.updateProjectionMatrix();host.querySelector<HTMLDetailsElement>('#map-museum-tools')!.open=true;
    }else if(next==='park'||next==='waterfront'){
      const area=next==='park'?park:waterfront;controls.target.copy(area.center);
      const size=area.bounds.getSize(new Vector3());
      const distance=Math.max(size.z,size.x/camera.aspect)/(2*Math.tan(camera.fov*Math.PI/360))*1.5;
      camera.position.copy(controls.target).add(new Vector3(.72,1,.95).normalize().multiplyScalar(distance));
      camera.near=2;camera.updateProjectionMatrix();
    }else if(next==='close'){
      const aquarium=data.buildings.find(b=>b.tags.name==='Monterey Bay Aquarium');
      if(aquarium){const pts=aquarium.rings[0].map(p=>project(p,origin));controls.target.set(pts.reduce((a,p)=>a+p.x,0)/pts.length,0,-pts.reduce((a,p)=>a+p.y,0)/pts.length);}
      camera.position.copy(controls.target).add(new Vector3(180,260,320));
    }else camera.position.copy(controls.target).add(next==='top'?new Vector3(0,d,.01):new Vector3(.35,.95,1).normalize().multiplyScalar(d));
    controls.update();host.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===next)));draw();
  }
  host.querySelectorAll('#map-museum-floor,#map-museum-room,#map-museum-plan,#map-museum-labels').forEach(input=>input.addEventListener('change',()=>setView('museum'),{signal:abort.signal}));
  let interior:ReturnType<typeof createAquariumInterior>|undefined;
  let feeds:ReturnType<typeof createLiveFeedLayer>|undefined;
  let conditions:ReturnType<typeof createWorldConditionsLayer>|undefined;
  let feedFrame:{locations:FeedLocation[];includeCoverage:boolean}|undefined;
  function frameFeedLocations(locations:FeedLocation[],includeCoverage:boolean){
    camera.clearViewOffset();feedFrame={locations,includeCoverage};view='feeds';host.dataset.mapView='feeds';
    const points=locations.map(location=>project([location.longitude,location.latitude],origin));
    if(includeCoverage)points.push(sw,ne);
    const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x));
    const minN=Math.min(...points.map(p=>p.y)),maxN=Math.max(...points.map(p=>p.y));
    const minimumSpan=includeCoverage?500:Math.max(450,locations[0].uncertaintyMeters*2.5);
    const distance=Math.max(maxN-minN, (maxX-minX)/camera.aspect, minimumSpan/Math.min(camera.aspect,1))/(2*Math.tan(Math.PI/8))*1.4;
    controls.maxDistance=Math.max(12000,distance*1.3);controls.minDistance=25;
    controls.target.set((minX+maxX)/2,0,-(minN+maxN)/2);
    camera.near=Math.max(1,distance/5000);camera.far=Math.max(20000,distance*3);camera.fov=45;camera.updateProjectionMatrix();
    camera.position.copy(controls.target).add(new Vector3(0,distance,.01));
    host.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button=>button.setAttribute('aria-pressed','false'));
    controls.update();draw();
  }
  let renderedFrames=0;
  function draw(){if(!disposed&&active){
    bayPlaces?.update(root.visible);
    caledoniaLabels.update(view==='caledonia'&&caledonia.root.visible&&root.visible);
    museumLabels.update(view==='museum'&&museum.root.visible&&root.visible&&museum.view!=='exterior'&&host.querySelector<HTMLInputElement>('#map-museum-labels')!.checked);
    interior?.updateLabels();feeds?.updateLabels();conditions?.updateLabels();ecology?.update();
    lod.update(camera,mount.clientHeight,0,true);renderer.info.reset();renderer.render(scene,camera);renderedFrames++;updateStats();
    const total=lod.stats(scene),detail=lod.stats(park.root);
    lodReadout.textContent=`Visible scene variants · Near / Mid / Far: ${[total.near,total.mid,total.far].map(v=>v.triangles.toLocaleString()).join(' / ')} triangles. Park: ${[detail.near,detail.mid,detail.far].map(v=>v.triangles.toLocaleString()).join(' / ')} triangles, ${detail.near.draws} draws; ${(detail.bytes/1048576).toFixed(2)} MiB across levels. Last frame: ${renderer.info.render.drawCalls} draws / ${renderer.info.render.triangles.toLocaleString()} triangles.`;
  }}
  function resize(){if(!mount.clientWidth||!mount.clientHeight)return;camera.aspect=mount.clientWidth/mount.clientHeight;camera.updateProjectionMatrix();renderer.setSize(mount.clientWidth,mount.clientHeight);if(interior?.enabled)interior.frame();else if(view==='feeds'&&feedFrame)frameFeedLocations(feedFrame.locations,feedFrame.includeCoverage);else setView(view);}
  await renderer.init();
  host.dataset.mapBackend=(renderer.backend as unknown as {isWebGPUBackend?:boolean}).isWebGPUBackend?'webgpu':'webgl2';
  status.textContent=`${(baySize.x/1000).toFixed(1)} × ${(baySize.z/1000).toFixed(1)} km bay overview · ${BAY_REGION.places.length} places\n${data.buildings.length.toLocaleString()} local building parts · ${(width/1000).toFixed(2)} × ${(depth/1000).toFixed(2)} km\n${heights[0]} height tags · ${heights[1]} floor estimates · ${heights[2]} defaults`;
  const baseStatus=status.textContent;
  bayPlaces=createBayPlaces(host,mount,camera,bay,id=>setView('bay:'+id));
  function updateStats(){const current=footprintRoot.visible?footprintRoot:massRoot;let triangles=0,batches=0;current.traverseVisible(o=>{if(o instanceof Mesh){triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;batches++;}});status.textContent=baseStatus+`\n${triangles.toLocaleString()} regional building triangles · ${batches} batches${park.root.visible?' · detailed park':''}`;}
  updateStats();
  interior=createAquariumInterior(host,data,origin,camera,controls,draw,value=>{root.visible=!value;if(value){camera.clearViewOffset();camera.far=2000;camera.updateProjectionMatrix();}feeds?.setMapVisible(!value);conditions?.setMapVisible(!value);ecology?.setMapVisible(!value);conditions?.setActive(active&&!value);host.querySelector(value?'.aquarium-tools':'.map-tools')!.append(lodPanel);resize();});
  scene.add(interior.root);
  await lod.register(scene);
  detail.querySelector('select')!.addEventListener('change',e=>{lod.setMode((e.target as HTMLSelectElement).value as LodMode);draw();},{signal:abort.signal});
  feeds=createLiveFeedLayer({host,mount,camera,bounds:data.bounds,project:point=>project(point,origin),focus:frameFeedLocations,draw});
  conditions=createWorldConditionsLayer({host,mount,camera,bounds:data.bounds,project:point=>project(point,origin),focus:frameFeedLocations,draw});
  ecology=createEcologyLayer({host,mount,camera,project:point=>project(point,origin),unproject:(x,z)=>[origin[0]+x/(6371008.8*Math.PI/180*Math.cos(origin[1]*Math.PI/180)),origin[1]-z/(6371008.8*Math.PI/180)],focus:frameFeedLocations,draw});
  const on=(id:string,fn:()=>void)=>host.querySelector('#'+id)!.addEventListener('change',fn,{signal:abort.signal});
  const checked=(id:string)=>(host.querySelector('#'+id) as HTMLInputElement).checked;
  on('map-seafloor',()=>{const show=checked('map-seafloor');bay.setSeafloor(show);ground.visible=!show;boundaryFill.visible=checked('map-boundary')&&!show;draw();});
  on('map-park',()=>{const show=checked('map-park');bay.setDetailed(show);caledonia.root.visible=museum.root.visible=waterfront.root.visible=park.root.visible=raisedFlat.visible=raisedMass.visible=show;replacedFlat.visible=replacedMass.visible=!show;coveredLines.forEach(line=>line.visible=!show);updateStats();draw();});
  on('map-display',()=>{const flat=(host.querySelector('#map-display') as HTMLSelectElement).value==='flat';footprintRoot.visible=flat;massRoot.visible=!flat;updateStats();draw();});
  on('map-estimates',()=>{meshes.forEach(m=>{m.visible=m.userData.basis==='height'||checked('map-estimates');});updateStats();draw();});
  on('map-wire',()=>{meshes.forEach(m=>{const material=m.material as MeshToonNodeMaterial;material.wireframe=checked('map-wire');material.needsUpdate=true;});draw();});
  on('map-roads',()=>{roads.visible=bay.roads.visible=checked('map-roads');draw();});
  on('map-boundary',()=>{boundary.visible=checked('map-boundary');boundaryFill.visible=checked('map-boundary')&&!checked('map-seafloor');draw();});
  host.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view!),{signal:abort.signal}));
  renderer.domElement.addEventListener('keydown',e=>{
    if(e.key==='Home'){e.preventDefault();if(interior?.enabled)interior.frame();else setView('overview');return;}
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'].includes(e.key))return;e.preventDefault();
    const s=new Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    if(e.key==='ArrowLeft')s.theta-=.12;if(e.key==='ArrowRight')s.theta+=.12;
    if(e.key==='ArrowUp')s.phi=Math.max(.01,s.phi-.1);if(e.key==='ArrowDown')s.phi=Math.min(controls.maxPolarAngle,s.phi+.1);
    if(e.key==='+'||e.key==='=')s.radius=Math.max(controls.minDistance,s.radius*.85);if(e.key==='-')s.radius=Math.min(controls.maxDistance,s.radius/.85);
    camera.position.copy(controls.target).add(new Vector3().setFromSpherical(s));controls.update();draw();
  },{signal:abort.signal});
  controls.addEventListener('change',draw);const observer=new ResizeObserver(resize);observer.observe(mount);resize();
  if(new URLSearchParams(location.search).has('interior'))interior.setEnabled(true);
  else if(new URLSearchParams(location.search).has('feeds')){feeds.open();feeds.frameAll();}
  else if(new URLSearchParams(location.search).has('park'))setView('park');
  if(new URLSearchParams(location.search).has('conditions'))conditions.open();
  return {data,scene,renderer,camera,interior,feeds,conditions,ecology,park,waterfront,museum,caledonia,bay,lod,get renderedFrames(){return renderedFrames;},setActive(value:boolean){active=value;conditions?.setActive(value&&!interior?.enabled);if(active)resize();},dispose(){disposed=true;abort.abort();observer.disconnect();controls.dispose();lod.dispose();ecology?.dispose();conditions?.dispose();feeds?.dispose();bayPlaces?.dispose();museumLabels.dispose();caledoniaLabels.dispose();interior?.dispose();park.dispose();caledonia.dispose();waterfront.dispose();museum.dispose();bay.dispose();root.traverse(o=>{if(o instanceof Mesh||o instanceof LineSegments){o.geometry.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(m=>m.dispose());}});renderer.dispose();host.innerHTML='';}};
}
