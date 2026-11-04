import {BufferGeometry,Color,Float32BufferAttribute} from 'three';
// One continuous neck/head/beak surface avoids intersecting primitive seams around the jaw.
const PROFILE=[[-.50,.018,.007,.014],[-.484,.022,.024,.035],[-.46,.032,.040,.052],[-.43,.034,.044,.058],[-.399,.030,.039,.052],[-.37,.020,.034,.043],[-.30,.014,.037,.050],[-.275,.012,.035,.045]] as const;
export function headFlank(x:number,y:number){
 let i=0;while(i<PROFILE.length-2&&x>PROFILE[i+1][0])i++;
 const a=PROFILE[i],b=PROFILE[i+1],t=Math.max(0,Math.min(1,(x-a[0])/(b[0]-a[0])));
 const center=a[1]+(b[1]-a[1])*t,height=a[2]+(b[2]-a[2])*t,width=a[3]+(b[3]-a[3])*t;
 return width*Math.sqrt(Math.max(0,1-((y-center)/height)**2));
}
export function buildHead(){
 const p:number[]=[],c:number[]=[],idx:number[]=[],around=12;
 for(let r=0;r<PROFILE.length;r++){
  const [x,center,height,width]=PROFILE[r];
  for(let q=0;q<around;q++){
   const angle=q/around*Math.PI*2;p.push(x,center+Math.sin(angle)*height,Math.cos(angle)*width);
   const color=new Color(r<2?'#b6a982':r>4?'#8d8966':'#9e9875');c.push(color.r,color.g,color.b);
   if(r<PROFILE.length-1){const a=r*around+q,b=r*around+(q+1)%around,d=(r+1)*around+q,e=(r+1)*around+(q+1)%around;idx.push(a,d,b,b,d,e);}
  }
 }
 for(const row of [0,PROFILE.length-1])for(let q=1;q<around-1;q++){const a=row*around;row===0?idx.push(a,a+q,a+q+1):idx.push(a,a+q+1,a+q);}
 const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('color',new Float32BufferAttribute(c,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
