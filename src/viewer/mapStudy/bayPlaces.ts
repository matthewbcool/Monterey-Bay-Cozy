import { Vector3, type PerspectiveCamera } from 'three';
import type { createBayRegion } from './bayRegion';
/** DOM place labels share the demand-rendered map; no textures, mesh draws or timers. */
export function createBayPlaces(host:HTMLElement,mount:HTMLElement,camera:PerspectiveCamera,bay:ReturnType<typeof createBayRegion>,focus:(id:string)=>void){
 const field=document.createElement('label');field.className='map-bay-navigation';field.textContent='Explore the bay ';
 const select=document.createElement('select');select.id='map-bay-place';select.setAttribute('aria-label','Explore a Monterey Bay place');
 select.append(new Option('Choose a place…',''));for(const p of bay.places)select.append(new Option(p.name,p.id));field.append(select);
 host.querySelector('.map-status')!.after(field);
 const seafloor=host.querySelector('#map-seafloor')?.parentElement;if(seafloor)field.after(seafloor);
 const layer=document.createElement('div');layer.className='bay-place-labels';layer.setAttribute('aria-label','Monterey Bay places');mount.append(layer);
 const nodes=bay.places.map(place=>{const button=document.createElement('button');button.className='bay-place-label';button.textContent=place.name;button.title=place.name+' · regional terrain study';button.addEventListener('click',()=>{select.value=place.id;focus(place.id);});layer.append(button);return {place,button,point:bay.point(place.longitude,place.latitude)};});
 const change=()=>{if(select.value)focus(select.value);};select.addEventListener('change',change);
 const point=new Vector3();
 return {update(visible:boolean){
  layer.hidden=!visible;if(!visible)return;const width=mount.clientWidth,height=mount.clientHeight,occupied:{x:number;y:number;w:number}[]=[];
  for(const {button,point:location} of nodes){point.copy(location);point.y+=40;point.project(camera);const x=(point.x*.5+.5)*width,y=(-point.y*.5+.5)*height,w=button.textContent!.length*6.7+24;
   const obscured=occupied.some(p=>Math.abs(p.x-x)<(p.w+w)/2+8&&Math.abs(p.y-y)<30);
   button.hidden=point.z< -1||point.z>1||x<20||x>width-20||y<25||y>height-45||obscured;
   if(!button.hidden){occupied.push({x,y,w});button.style.left=x+'px';button.style.top=y+'px';}
  }
 },select(id:string){select.value=id;},dispose(){select.removeEventListener('change',change);field.remove();layer.remove();}};
}
