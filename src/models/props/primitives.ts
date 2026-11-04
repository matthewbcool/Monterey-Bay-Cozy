import { BoxGeometry, BufferGeometry, CatmullRomCurve3, CylinderGeometry, Float32BufferAttribute, Group, Material, Mesh, MeshStandardMaterial, Object3D, SphereGeometry, TorusGeometry, TubeGeometry, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const palette={cream:'#e7dfbb',wood:'#b88754',woodLight:'#d1a46b',woodDark:'#76523b',mint:'#4e9991',navy:'#264b57',brass:'#c6a25e',coral:'#cb6951',yellow:'#d5aa56',metal:'#a1b5ac'};
export const mat=(color:string,roughness=.8,metalness=0)=>new MeshStandardMaterial({color,roughness,metalness});
export function mesh(parent:Object3D,name:string,geometry:BufferGeometry,material:Material,x=0,y=0,z=0){
  const m=new Mesh(geometry,material);m.name=name;m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
export function box(parent:Object3D,name:string,size:[number,number,number],material:Material,pos:[number,number,number],radius=.025){
  return mesh(parent,name,radius>=.06?new RoundedBoxGeometry(...size,1,radius):new BoxGeometry(...size),material,...pos);
}
export function cylinder(parent:Object3D,name:string,radius:number,length:number,material:Material,pos:[number,number,number],top=radius){
  return mesh(parent,name,new CylinderGeometry(top,radius,length,8),material,...pos);
}
export function sphere(parent:Object3D,name:string,radius:number,material:Material,pos:[number,number,number]){
  return mesh(parent,name,new SphereGeometry(radius,10,6),material,...pos);
}
export function tube(parent:Object3D,name:string,points:number[][],radius:number,material:Material,segments=32){
  return mesh(parent,name,new TubeGeometry(new CatmullRomCurve3(points.map(p=>new Vector3(...p as [number,number,number]))),Math.max(6,Math.ceil(segments/2)),radius,4,false),material);
}
export function ring(parent:Object3D,name:string,radius:number,thickness:number,material:Material,pos:[number,number,number]){
  return mesh(parent,name,new TorusGeometry(radius,thickness,4,12),material,...pos);
}
export function disposeObject(root:Object3D){
  const geometries=new Set<BufferGeometry>(),materials=new Set<Material>();
  root.traverse(o=>{if(o instanceof Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.removeFromParent();
}

// Open, double-skin hull: a real interior, rising bow, transom, and thick gunwales.
export function hull(parent:Group,length:number,beam:number,outer:Material,inner:Material,trim:Material){
  const stations=[[-.5,.60,.69],[-.46,.82,.68],[-.3,.97,.65],[0,1,.65],[.28,.83,.72],[.43,.47,.88],[.5,.018,1.01]];
  function surface(inset:number){
    const vertices:number[]=[],indices:number[]=[];
    for(const [z,width,top] of stations){
      for(let j=0;j<=8;j++){
        const theta=-Math.PI/2+j*Math.PI/8;
        const x=Math.sin(theta)*Math.max(.008,width*beam/2-inset);
        const keel=-.42+Math.pow(Math.abs(z)*2,4)*.2+inset;
        const y=keel+(top-keel)*(1-Math.cos(theta));
        vertices.push(x,y,z*length);
      }
    }
    for(let i=0;i<stations.length-1;i++)for(let j=0;j<8;j++){
      const a=i*9+j,b=a+9;
      if(inset)indices.push(a,b,a+1,a+1,b,b+1);else indices.push(a,a+1,b,a+1,b+1,b);
    }
    const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return g;
  }
  mesh(parent,'Painted hull',surface(0),outer);
  mesh(parent,'Cream hull interior',surface(.095),inner);
  for(const side of [-1,1]){
    tube(parent,'Rounded wooden gunwale',stations.map(([z,w,y])=>[side*w*beam/2,y,z*length]),.075,trim,44);
    for(const f of [.43,.72])tube(parent,'Clinker hull seam',stations.map(([z,w,y])=>[side*w*beam/2*Math.sin(f*Math.PI/2),-.42+(y+.42)*(1-Math.cos(f*Math.PI/2)),z*length]),.017,trim,40);
  }
  box(parent,'Stern transom',[beam*.60,.80,.11],outer,[0,.27,-length/2]);
  box(parent,'Stern cap',[beam*.65,.10,.18],trim,[0,.69,-length/2]);
  tube(parent,'Bow stem',[[0,-.1,length*.47],[0,.3,length*.50],[0,1.02,length*.50]],.065,trim,14);
}
