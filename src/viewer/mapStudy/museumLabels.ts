import { PerspectiveCamera, Vector3 } from 'three';
import { MUSEUM_ROOMS } from '../../data/pacificGroveMuseum';
import type { createMuseumArea } from './museum';
/** A small projected label layer for the floor study; no per-label canvas or GPU texture. */
export function createMuseumLabels(mount:HTMLElement,camera:PerspectiveCamera,museum:ReturnType<typeof createMuseumArea>){
  const layer=document.createElement('div');layer.className='museum-labels';layer.style.cssText='position:absolute;inset:0;pointer-events:none;overflow:hidden';mount.append(layer);
  const entries=MUSEUM_ROOMS.filter(r=>!['workshop','services','passage','family','shop'].includes(r.id)).map(room=>{const [x0,z0,x1,z1]=room.rect;return {name:room.name.split(' · ')[0],point:museum.point((x0+x1)/2,(z0+z1)/2,.2),upper:false};});
  entries.push({name:'Native Plant Garden',point:museum.point(12,32,.2),upper:false},{name:'Changes · mezzanine',point:museum.point(24.9,7.3,3.7),upper:true});
  const labels=entries.map(entry=>{const el=document.createElement('span');el.textContent=entry.name;el.style.cssText='position:absolute;transform:translate(-50%,-50%);max-width:110px;text-align:center;font:11px/1.3 system-ui;color:#f6eed6;background:#284d4ddd;padding:4px 6px;border-radius:5px;box-shadow:0 1px 5px #18393933';layer.append(el);return {...entry,el};}),projected=new Vector3();
  return {update(enabled:boolean){layer.hidden=!enabled;if(!enabled)return;for(const item of labels){projected.copy(item.point).project(camera);const showUpper=museum.view==='upper';item.el.hidden=projected.z>1||projected.z< -1||(item.upper&&!showUpper)||(showUpper&&item.name==='Main Gallery');item.el.style.left=`${(projected.x*.5+.5)*mount.clientWidth}px`;item.el.style.top=`${(-projected.y*.5+.5)*mount.clientHeight}px`;}},dispose(){layer.remove();}};
}
