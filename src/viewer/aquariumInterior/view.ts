import {BufferGeometry, Float32BufferAttribute, LineBasicMaterial, LineSegments, Mesh, PerspectiveCamera, Vector3} from 'three';
import type {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createAquarium} from '../../models/aquarium/createAquarium';
import {AQUARIUM_ANCHOR,AQUARIUM_HEADING,PLACES,TANKS,SOURCES,UPPER_FLOOR,routeTo,tankOutline,waypointPosition,type Floor,type Point} from '../../models/aquarium/layout';
import {applyNodeStyle} from '../nodeStyle';
import {interiorStyles} from './style';
import {project,type MapData,type GeoPoint} from '../mapStudy';

/** UI/camera owner. The procedural factory and navigation graph also work without this viewer. */
export function createAquariumInterior(host:HTMLElement,data:MapData,origin:GeoPoint,camera:PerspectiveCamera,controls:OrbitControls,draw:()=>void,onMode:(active:boolean)=>void){
  const abort=new AbortController(),building=data.buildings.find(b=>b.tags.name==='Monterey Bay Aquarium')!;
  const anchor=project([...AQUARIUM_ANCHOR],origin),c=Math.cos(AQUARIUM_HEADING),s=Math.sin(AQUARIUM_HEADING);
  const outer:Point[]=building.rings[0].map(p=>{const v=project(p,origin),e=v.x-anchor.x,south=-v.y+anchor.y;return [c*e-s*south,-(s*e+c*south)];});
  const model=createAquarium(outer),root=model.root;root.position.set(anchor.x,0,-anchor.y);root.rotation.y=AQUARIUM_HEADING;root.visible=false;root.updateMatrixWorld(true);
  applyNodeStyle(root,false);
  const panel=document.createElement('section');panel.className='aquarium-tools';panel.setAttribute('aria-label','Aquarium interior controls');
  panel.innerHTML=`<style>${interiorStyles}</style><button class="aq-back">← Area map</button><p class="aq-kicker">Monterey Bay Aquarium · layout study</p><h1>Inside the aquarium</h1><p class="aq-intro">Approximate public galleries, anchored to the mapped building. One scene unit = one metre.</p><div class="aq-row"><button data-floor="0" aria-pressed="true">1 · First floor</button><button data-floor="1" aria-pressed="false">2 · Upper floor</button></div><div class="aq-row"><button data-camera="dollhouse" aria-pressed="true">Cutaway</button><button data-camera="plan" aria-pressed="false">Floor plan</button><button data-camera="eye" aria-pressed="false">Visitor view</button></div><label for="aq-destination">Explore an exhibit</label><select id="aq-destination">${PLACES.map(p=>`<option value="${p.id}">${p.name}${p.floor?' · 2F':''}</option>`).join('')}</select><div class="aq-row"><button id="aq-focus">Focus exhibit</button><button id="aq-route" aria-pressed="false">Route from entrance</button></div><p class="aq-route-status" role="status">Choose an exhibit to inspect its placement and scale.</p><div class="aq-row aq-stepper" hidden><button id="aq-prev" aria-label="Previous route stop">← Back</button><span id="aq-stop"></span><button id="aq-next" aria-label="Next route stop">Next →</button></div><h2 class="aq-title"></h2><p class="aq-dimension"></p><p class="aq-evidence"></p><details><summary>How the water moves</summary><div class="aq-flow">Bay intake → Kelp Forest → other exhibits → ocean return</div><p>Schematic flow, based on the aquarium’s published description. Pipe runs, filtration equipment and staff-only rooms have not been located or modeled.</p><a href="${SOURCES.figures}" target="_blank" rel="noopener">Aquarium facts &amp; figures ↗</a></details><details><summary>Scale, sources &amp; limits</summary><p>Gold selection: current exhibit. Blue-green: tank envelopes. Pale floors: inferred visitor space. Grid squares: 10 m. Entrance figure: 1.7 m.</p><p>Tank dimensions identified as published are fixed in metres. Other footprints, corridors, floor heights (5.2 m), doors and route lengths are estimates. Roof openings in OSM are filled as inferred visitor floor; this is not a measured floor plan.</p><p>Open Sea’s full tank volume spans the cutaway; its visitor window is on floor 2. The third-floor overlook, exact stairs, service spaces and detailed exhibit interiors are omitted. Routes demonstrate connectivity, not real-world wayfinding or accessibility.</p><p>Your May 2026 first-floor image; <a href="${SOURCES.map}" target="_blank" rel="noopener">official upper-floor map</a>; <a href="${SOURCES.figures}" target="_blank" rel="noopener">published tank dimensions</a>; <a href="https://www.openstreetmap.org/relation/7037898" target="_blank" rel="noopener">OSM footprint</a>.</p></details><p class="aq-stats"></p>`;
  host.append(panel);
  const mount=host.querySelector<HTMLElement>('.map-canvas')!,labels=document.createElement('div');labels.className='aq-label-layer';labels.hidden=true;mount.append(labels);
  const key=document.createElement('div');key.className='aq-map-key';key.innerHTML='<strong>PUBLIC INTERIOR · APPROXIMATE</strong><span>10 m grid · 1.7 m figure at entrance · Tank positions &amp; rooms estimated</span><span>Drag to orbit · pinch / scroll to zoom · arrows when canvas is focused</span>';labels.append(key);
  const labelPlaces=[...PLACES,{...PLACES.find(p=>p.id==='open-sea')!,name:'Open Sea · upper viewing',floor:0 as Floor}];
  const labelButtons=labelPlaces.map(p=>{const button=document.createElement('button');button.className='aq-label';button.innerHTML=p.name;button.setAttribute('aria-label','Inspect '+p.name);labels.append(button);button.addEventListener('click',()=>select(p.id),{signal:abort.signal});return {p,button};});
  const entry=document.createElement('button');entry.className='aquarium-entry';entry.textContent='Inside aquarium →';host.querySelector('.map-buttons')!.after(entry);
  const query=<T extends HTMLElement>(selector:string)=>panel.querySelector<T>(selector)!;
  function line(color:string){const material=new LineBasicMaterial({color,depthTest:false});const mesh=new LineSegments(new BufferGeometry(),material);mesh.renderOrder=10;mesh.frustumCulled=false;root.add(mesh);return mesh;}
  const grid=line('#7c9990'),selection=line('#f4cf82'),route=line('#ffc28e');
  function linePoints(mesh:LineSegments,points:number[]){mesh.geometry.dispose();mesh.geometry=new BufferGeometry();mesh.geometry.setAttribute('position',new Float32BufferAttribute(points,3));}
  const gridPoints:number[]=[];for(let x=-80;x<=110;x+=10)gridPoints.push(x,-.4,20,x,-.4,-85);for(let b=-20;b<=80;b+=10)gridPoints.push(-80,-.4,-b,110,-.4,-b);linePoints(grid,gridPoints);grid.material.depthTest=true;
  let enabled=false,floor:Floor=0,selected='entrance',cameraMode='dollhouse',routing=false,step=0;
  let routeData=routeTo(selected);
  const world=(x:number,y:number,bay:number)=>root.localToWorld(new Vector3(x,y,-bay));
  function move(target:Vector3,offset:Vector3){controls.target.copy(target);camera.position.copy(target).add(offset);controls.update();draw();}
  function frame(){
    if(!enabled)return;
    const place=PLACES.find(p=>p.id===selected)!;
    controls.minDistance=cameraMode==='eye'?.5:4;controls.maxDistance=600;controls.maxPolarAngle=cameraMode==='eye'?Math.PI*.8:Math.PI*.495;
    camera.near=.08;camera.fov=cameraMode==='eye'?65:45;camera.updateProjectionMatrix();
    if(cameraMode==='eye'){
      const stop=routing?routeData.path[step]:{point:place.point,floor:place.floor};
      const eye=world(stop.point[0],stop.floor*UPPER_FLOOR+1.65,stop.point[1]);
      const next=routing?routeData.path[Math.min(step+1,routeData.path.length-1)]:undefined;
      const tank=TANKS.find(t=>t.id===place.tank);
      const target=next&&next!==stop?world(next.point[0],next.floor*UPPER_FLOOR+1.65,next.point[1]):tank?world(tank.center[0],stop.floor*UPPER_FLOOR+2,tank.center[1]):world(stop.point[0],stop.floor*UPPER_FLOOR+1.65,stop.point[1]+8);
      // At vertical transitions look along the corridor; avoid a zero target vector.
      if(Math.hypot(target.x-eye.x,target.z-eye.z)<.1)target.add(new Vector3(2,0,-2));
      camera.position.copy(eye);controls.target.copy(target);controls.update();draw();return;
    }
    const distance=Math.max(125,205/camera.aspect)/(2*Math.tan(camera.fov*Math.PI/360))*1.12;
    const target=world(12,floor*UPPER_FLOOR,27);
    const offset=cameraMode==='plan'?new Vector3(0,distance,.001):new Vector3(0,.96,1).normalize().multiplyScalar(distance);
    offset.applyAxisAngle(new Vector3(0,1,0),AQUARIUM_HEADING);move(target,offset);
  }
  function setFloor(value:Floor,reset=true){floor=value;model.setFloor(floor);panel.querySelectorAll<HTMLButtonElement>('[data-floor]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.floor)===floor)));updateRoute();if(reset)frame();}
  function cameraChoice(value:string){cameraMode=value;panel.querySelectorAll<HTMLButtonElement>('[data-camera]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.camera===value)));frame();}
  function updateRoute(){
    const points:number[]=[];
    if(routing)for(let i=1;i<routeData.path.length;i++){
      const a=routeData.path[i-1],b=routeData.path[i];if(a.floor!==floor&&b.floor!==floor)continue;
      const pa=waypointPosition(a),pb=waypointPosition(b);points.push(pa[0],pa[1]+.15,pa[2],pb[0],pb[1]+.15,pb[2]);
    }
    linePoints(route,points);route.visible=routing;
    query('#aq-route').setAttribute('aria-pressed',String(routing));query('.aq-stepper').hidden=!routing;
    query<HTMLButtonElement>('#aq-prev').disabled=step===0;query<HTMLButtonElement>('#aq-next').disabled=step===routeData.path.length-1;
    query('#aq-stop').textContent=`Stop ${step+1} / ${routeData.path.length}`;
    const hasLift=routeData.path.some((p,i)=>i>0&&p.floor!==routeData.path[i-1].floor);
    query('.aq-route-status').textContent=routing?`≈ ${Math.round(routeData.distance)} m from entrance${hasLift?' · floor change at a lift marker':''}. Estimated route.`:'Choose an exhibit to inspect its placement and scale.';
    const stats=model.stats();query('.aq-stats').textContent=`Model: ${stats.triangles.toLocaleString()} triangles · ${stats.draws} mesh batches + ${routing?3:2} guide lines. Renders only on interaction.`;
  }
  function select(id:string){
    const previousFloor=floor;selected=id;const p=PLACES.find(p=>p.id===id)!;query<HTMLSelectElement>('#aq-destination').value=id;routeData=routeTo(id);step=0;
    query('.aq-title').textContent=p.name;const tank=TANKS.find(t=>t.id===p.tank);
    query('.aq-evidence').textContent=tank?tank.evidence:p.note;
    query('.aq-dimension').textContent=tank?`${tank.size[0].toFixed(2)} × ${tank.size[1].toFixed(2)} × ${tank.size[2].toFixed(2)} m${tank.verified.length?' · published '+(tank.verified.length===3?'envelope':'height'):' · estimated'}`:`Floor ${p.floor+1} · layout estimate`;
    const outline=tank?tankOutline(tank):[[p.point[0]-2,p.point[1]-2],[p.point[0]+2,p.point[1]-2],[p.point[0]+2,p.point[1]+2],[p.point[0]-2,p.point[1]+2]] as Point[];
    const y=tank?tank.base+tank.size[2]+.2:p.floor*UPPER_FLOOR+.15,positions:number[]=[];
    outline.forEach((a,i)=>{const b=outline[(i+1)%outline.length];positions.push(a[0],y,-a[1],b[0],y,-b[1]);});linePoints(selection,positions);
    setFloor(p.floor,false);if(cameraMode==='eye'||previousFloor!==p.floor)frame();else draw();
  }
  function focus(){
    cameraChoice('dollhouse');const p=PLACES.find(p=>p.id===selected)!,tank=TANKS.find(t=>t.id===p.tank),size=tank?Math.max(tank.size[0],tank.size[1],tank.size[2]):16;
    const d=Math.max(30,size*2.4/Math.min(camera.aspect,1));move(world(tank?.center[0]??p.point[0],tank?tank.base+tank.size[2]/2:p.floor*UPPER_FLOOR+1,tank?.center[1]??p.point[1]),new Vector3(0,.75,1).normalize().multiplyScalar(d).applyAxisAngle(new Vector3(0,1,0),AQUARIUM_HEADING));
  }
  function setEnabled(value:boolean){enabled=value;root.visible=value;labels.hidden=!value;host.classList.toggle('aquarium-open',value);if(!value){controls.minDistance=25;controls.maxDistance=12000;controls.maxPolarAngle=Math.PI*.495;camera.near=1;camera.fov=45;camera.updateProjectionMatrix();}onMode(value);if(value){select(selected);frame();}}
  entry.addEventListener('click',()=>setEnabled(true),{signal:abort.signal});query('.aq-back').addEventListener('click',()=>setEnabled(false),{signal:abort.signal});
  panel.querySelectorAll<HTMLButtonElement>('[data-floor]').forEach(b=>b.addEventListener('click',()=>{cameraChoice('dollhouse');const next=Number(b.dataset.floor) as Floor;select(next===0?'entrance':'open-sea');setFloor(next);},{signal:abort.signal}));
  panel.querySelectorAll<HTMLButtonElement>('[data-camera]').forEach(b=>b.addEventListener('click',()=>cameraChoice(b.dataset.camera!),{signal:abort.signal}));
  query('#aq-destination').addEventListener('change',()=>select(query<HTMLSelectElement>('#aq-destination').value),{signal:abort.signal});query('#aq-focus').addEventListener('click',focus,{signal:abort.signal});
  query('#aq-route').addEventListener('click',()=>{routing=!routing;step=0;updateRoute();if(routing){setFloor(0,false);cameraChoice('dollhouse');}draw();},{signal:abort.signal});
  function advance(delta:number){step=Math.max(0,Math.min(routeData.path.length-1,step+delta));setFloor(routeData.path[step].floor,false);updateRoute();cameraChoice('eye');}
  query('#aq-prev').addEventListener('click',()=>advance(-1),{signal:abort.signal});query('#aq-next').addEventListener('click',()=>advance(1),{signal:abort.signal});
  function updateLabels(){
    if(!enabled)return;
    host.dataset.aquariumFloor=String(floor);host.dataset.aquariumCamera=cameraMode;host.dataset.aquariumSelection=selected;host.dataset.aquariumStep=String(step);camera.updateMatrixWorld();const occupied:{x:number;y:number;w:number}[]=[];
    for(const {p,button} of [...labelButtons].sort((a,b)=>Number(b.p.id===selected)-Number(a.p.id===selected))){
      const tank=TANKS.find(t=>t.id===p.tank),v=world(tank?.center[0]??p.point[0],tank?tank.base+tank.size[2]+1:p.floor*UPPER_FLOOR+1,tank?.center[1]??p.point[1]);v.project(camera);
      const x=(v.x*.5+.5)*mount.clientWidth,y=(-v.y*.5+.5)*mount.clientHeight,w=Math.max(75,button.textContent!.length*5.8);
      const hide=p.floor!==floor||v.z<-1||v.z>1||x<w/2||x>mount.clientWidth-w/2||y<30||y>mount.clientHeight-65||cameraMode==='eye'&&p.id!==selected||occupied.some(o=>Math.abs(o.x-x)<(o.w+w)/2+5&&Math.abs(o.y-y)<35);
      button.hidden=hide;button.setAttribute('aria-pressed',String(p.id===selected));if(hide)continue;
      occupied.push({x,y,w});button.style.left=x+'px';button.style.top=y+'px';
    }
  }
  select('entrance');
  return {root,get enabled(){return enabled;},get state(){return {floor,selected,cameraMode,routing,step,distance:routeData.distance};},setEnabled,frame,updateLabels,
    dispose(){abort.abort();panel.remove();labels.remove();entry.remove();root.traverse(o=>{if(o instanceof Mesh||o instanceof LineSegments){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());}});root.removeFromParent();}};
}
