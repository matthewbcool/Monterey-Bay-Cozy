/** A few projected street/place labels for the Caledonia plan view; no GPU textures. */
import {Vector3,type PerspectiveCamera} from 'three';
import {caledoniaHeight,CALEDONIA} from './caledonia';
import {projectWaterfront} from './waterfront';
export function createCaledoniaLabels(host:HTMLElement,camera:PerspectiveCamera,origin:readonly[number,number]=CALEDONIA.origin as [number,number]){
 const layer=document.createElement('div');layer.className='caledonia-labels';layer.hidden=true;layer.setAttribute('aria-label','Caledonia Park places and streets');layer.style.cssText='position:absolute;inset:0;pointer-events:none;overflow:hidden';host.append(layer);
 const locations:[string,number,number][]=[['Meals on Wheels',-192,69],['Tommy Stillwell Court',-289,284],['Caledonia Park',-246,183],['Playgrounds',-250,224],['Caledonia Ave',-291,241],['19th St',-192,201],['Central Ave',-263,319],['Pacific Ave',-316,155],['Union St',-218,207]];
 const entries=locations.map(([name,x,z])=>{const el=document.createElement('span');el.textContent=name;el.style.cssText='position:absolute;transform:translate(-50%,-50%);white-space:nowrap;text-align:center;font:11px/1.3 system-ui;color:#f6eed6;background:#284d4ddd;padding:4px 6px;border-radius:5px';layer.append(el);const [xx,zz]=projectWaterfront([x,z],origin);return {el,point:new Vector3(xx,caledoniaHeight(x,z)+.1,zz),width:name.length*6+12};});
 const projected=new Vector3(),occupied:{x:number;y:number;width:number}[]=[];
 return {update(show:boolean){layer.hidden=!show;if(!show)return;occupied.length=0;camera.updateMatrixWorld();for(const item of entries){projected.copy(item.point).project(camera);const x=(projected.x*.5+.5)*host.clientWidth,y=(-projected.y*.5+.5)*host.clientHeight;const overlap=occupied.some(o=>Math.abs(o.x-x)<(o.width+item.width)/2+5&&Math.abs(o.y-y)<28);item.el.hidden=overlap||projected.z< -1||projected.z>1||x<item.width/2||x>host.clientWidth-item.width/2||y<70||y>host.clientHeight-75;if(!item.el.hidden){occupied.push({x,y,width:item.width});item.el.style.left=x+'px';item.el.style.top=y+'px';}}},dispose(){layer.remove();}};
}
