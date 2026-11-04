import { BufferGeometry, CatmullRomCurve3, Color, Float32BufferAttribute, type Material, Mesh, Raycaster, Vector3 } from 'three';
import { mulberry32 } from '../shared/random';

// x, half-width, dorsal height: broad shoulders taper to the posterior shell margin.
export const SHELL_PROFILE=[[-.34,.025,.014],[-.30,.15,.062],[-.21,.24,.105],[-.08,.275,.13],[.06,.265,.123],[.20,.225,.095],[.33,.145,.052],[.42,.055,.022],[.45,.003,.007]] as const;
export function shellWidth(x:number){let i=0;while(i<SHELL_PROFILE.length-2&&x>SHELL_PROFILE[i+1][0])i++;const a=SHELL_PROFILE[i],b=SHELL_PROFILE[i+1],t=Math.max(0,Math.min(1,(x-a[0])/(b[0]-a[0])));return a[1]+(b[1]-a[1])*t;}
export function buildShell(seed:number,material:Material){
 const random=mulberry32(seed),palette=['#6f6245','#81724c','#5c5b42','#94805a'].map(c=>new Color(c));
 const positions:number[]=[],colors:number[]=[],indices:number[]=[],around=16;
 for(let r=0;r<SHELL_PROFILE.length;r++){
  const [x,width,height]=SHELL_PROFILE[r];
  for(let i=0;i<around;i++){
   const angle=i/around*Math.PI*2,s=Math.sin(angle),z=Math.cos(angle)*width;
   const y=.005+(s>=0?height*s:-.060*(-s)*Math.sqrt(Math.max(0,1-((x-.02)/.44)**2)));
   positions.push(x,y,z);
   const c=s<-.07?new Color('#c6bd91'):palette[(r+Math.floor(Math.abs(z)/.085)+(random()>.8?1:0))%palette.length].clone();
   colors.push(c.r,c.g,c.b);
   if(r<SHELL_PROFILE.length-1){const a=r*around+i,b=r*around+(i+1)%around,c=(r+1)*around+i,d=(r+1)*around+(i+1)%around;indices.push(a,c,b,b,c,d);}
  }
 }
 // Close tiny front and rear loops; flippers/neck overlap the closed shell.
 for(const row of [0,SHELL_PROFILE.length-1])for(let i=1;i<around-1;i++){const a=row*around;row===0?indices.push(a,a+i,a+i+1):indices.push(a,a+i+1,a+i);}
 const body=new BufferGeometry();body.setAttribute('position',new Float32BufferAttribute(positions,3));body.setAttribute('color',new Float32BufferAttribute(colors,3));body.setIndex(indices);body.computeVertexNormals();
 const surface=new Mesh(body,material),ray=new Raycaster();surface.updateMatrixWorld(true);
 const projected=(x:number,z:number)=>{ray.set(new Vector3(x,1,z),new Vector3(0,-1,0));return ray.intersectObject(surface,false)[0]?.point;};
 const seams:BufferGeometry[]=[];
 function line(points:number[][],width=.0023){
  const curve=new CatmullRomCurve3(points.map(([x,z])=>new Vector3(x,0,z)));
  const steps=Math.max(8,Math.ceil(curve.getLength()/.012)),p:number[]=[],idx:number[]=[];
  // Project both edges of a thin painted ribbon. Tubes/splines between ray hits can sink into facets.
  for(let i=0;i<=steps;i++){
   const center=curve.getPoint(i/steps),tangent=curve.getTangent(i/steps);
   for(const side of [-1,1]){
    const hit=projected(center.x-tangent.z*width*.5*side,center.z+tangent.x*width*.5*side);
    if(!hit)return;
    p.push(hit.x,hit.y+.002,hit.z);
   }
   if(i<steps){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();seams.push(g);
 }
 // Five vertebral scutes; four costal panels on each side. Seams conform to actual facets.
 const boundaries=[-.29,-.19,-.07,.07,.21,.37];
 for(const side of [-1,1])line(boundaries.map((x,i)=>[x,side*([.025,.075,.08,.075,.059,.018][i])]));
 for(const x of boundaries.slice(1,-1)){line([[x,-.075],[x-.02,0],[x,.075]]);for(const side of [-1,1])line([[x,side*.075],[x+.035,side*shellWidth(x+.035)*.67],[x+.04,side*shellWidth(x+.04)*.96]]);}
 for(const side of [-1,1])line(SHELL_PROFILE.slice(1,-1).map(([x,w])=>[x,side*w*.95]),.003);
 // All pigment is vertex color; scute ribbons are merged into the same material batch.
 return {body,seams};
}
