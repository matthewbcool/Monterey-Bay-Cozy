/** Cached USGS DS781 NAVD88 elevations. Source/refresh contract: docs/bathymetry.md. */
import data from '../../data/monterey-bathymetry.json';
export const BATHYMETRY = data;
const g=data.grid;
const value=(i:number,j:number)=>data.values[j*g.columns+i];
/** Return a surveyed triangle only when all three source nodes exist. Never turn NoData into zero. */
export function surveyedHeight(x:number,z:number):number|undefined {
 const u=(x-g.minX)/g.step,v=(z-g.minZ)/g.step,i=Math.floor(u),j=Math.floor(v),a=u-i,b=v-j;
 if(!Number.isFinite(u+v)||i<0||j<0||i>=g.columns-1||j>=g.rows-1)return undefined;
 const h00=value(i,j),h11=value(i+1,j+1),edge=a>=b?value(i+1,j):value(i,j+1);
 if(h00===null||h11===null||edge===null)return undefined;
 return a>=b?h00+a*(edge-h00)+b*(h11-edge):h00+b*(edge-h00)+a*(h11-edge);
}
/** Small source gaps use the closest real grid node within 30 m; this is explicitly inferred. */
export function nearbySurveyHeight(x:number,z:number):number|undefined {
 const i=Math.round((x-g.minX)/g.step),j=Math.round((z-g.minZ)/g.step);let best=Infinity,height:number|undefined;
 for(let dj=-3;dj<=3;dj++)for(let di=-3;di<=3;di++){
  const xx=i+di,zz=j+dj;if(xx<0||zz<0||xx>=g.columns||zz>=g.rows)continue;
  const h=value(xx,zz),d=(g.minX+xx*g.step-x)**2+(g.minZ+zz*g.step-z)**2;
  if(h!==null&&d<=900&&d<best){best=d;height=h;}
 }
 return height;
}
