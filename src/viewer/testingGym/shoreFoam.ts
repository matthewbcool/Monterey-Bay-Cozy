/** Lightweight shoreline swash: one procedural ribbon, no textures or particles.
 * Distances and terrain are metres. This is artistic surf, not a tide simulation. */
import { BufferGeometry, Float32BufferAttribute, Mesh, DoubleSide } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { abs, cameraPosition, clamp, float, max, mix, positionLocal, sin, smoothstep, uv, vec3 } from 'three/tsl';
import type { GymPoint } from '../avatarController';
import { waveNode, type createWater } from '../water';

type Water = ReturnType<typeof createWater>;
export function createShoreFoam(coast: readonly GymPoint[], floorAt:(x:number,z:number)=>number, isWater:(x:number,z:number)=>boolean, water:Water) {
  const positions:number[]=[], uvs:number[]=[], indices:number[]=[];
  const origin=water.root.position, rows:{x:number;z:number;nx:number;nz:number;s:number}[]=[];
  let distance=0;
  for(let i=0;i<coast.length-1;i++){
    const a=coast[i],b=coast[i+1],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(length<.001)continue;
    let nx=-(b[1]-a[1])/length,nz=(b[0]-a[0])/length;
    if(!isWater((a[0]+b[0])/2+nx*2,(a[1]+b[1])/2+nz*2)){nx=-nx;nz=-nz;}
    const steps=Math.ceil(length/6);
    for(let j=0;j<steps;j++){const t=j/steps;rows.push({x:a[0]+(b[0]-a[0])*t,z:a[1]+(b[1]-a[1])*t,nx,nz,s:distance+length*t});}
    distance+=length;
    if(i===coast.length-2)rows.push({x:b[0],z:b[1],nx,nz,s:distance});
  }
  for(const row of rows)for(let j=0;j<=1;j++){
    const across=-.7+j*3.6,x=row.x+row.nx*across,z=row.z+row.nz*across;
    // Do not drape foam up cliffs or buildings; those vertices remain on the water.
    const h=floorAt(x,z)-origin.y;
    positions.push(x-origin.x,h>0&&h<.6?h+.015:.015,z-origin.z);
    uvs.push(row.s,across);
  }
  for(let i=0;i<rows.length-1;i++)for(let j=0;j<1;j++){const a=i*2+j,b=a+2;indices.push(a,b,a+1,a+1,b,b+1);}
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  geometry.boundingBox!.expandByScalar(.12);geometry.boundingSphere!.radius+=.12;
  geometry.userData={lodMaxErrorMetres:.025};
  const material=new MeshBasicNodeMaterial({name:'Soft shoreline swash',transparent:true,depthWrite:false,side:DoubleSide,forceSinglePass:true});
  const t=water.uniforms.time,s=uv().x,d=uv().y;
  // A six-to-eight-second wash; spatial phase offsets avoid a synchronized coast.
  const phase=t.mul(.87).add(s.mul(.035)).add(sin(s.mul(.11)).mul(.55));
  const pulse=sin(phase).mul(.5).add(.5);
  const front=float(1.9).sub(pulse.mul(2.2)).add(sin(s.mul(1.7).add(t.mul(.22))).mul(.075));
  const edge=float(1).sub(smoothstep(.055,.23,abs(d.sub(front))));
  const trail=smoothstep(0,.18,d.sub(front)).mul(float(1).sub(smoothstep(.2,.85,d.sub(front))));
  const lace=sin(s.mul(5.1).add(d.mul(13)).add(t.mul(.32))).mul(sin(s.mul(2.3).sub(d.mul(9)))).mul(.5).add(.5);
  const broken=mix(float(.35),float(1),smoothstep(.18,.8,lace));
  const fade=smoothstep(-.7,-.4,d).mul(float(1).sub(smoothstep(2.3,2.9,d)));
  const strength=mix(float(.18),float(.62),pulse);
  material.colorNode=vec3(.84,.9,.82).mul(water.uniforms.lightLevel);
  material.opacityNode=clamp(edge.mul(broken).add(trail.mul(lace).mul(.12)).mul(strength).mul(fade),0,.65)
    .mul(smoothstep(origin.y,origin.y+.2,cameraPosition.y));
  material.positionNode=vec3(positionLocal.x,max(positionLocal.y,waveNode(positionLocal.xz,t,water.uniforms.chop).x.add(.018)),positionLocal.z);
  const root=new Mesh(geometry,material);root.name='Shore foam · advancing and retreating';root.position.copy(origin);root.renderOrder=3;
  root.userData={units:'metres',animation:'Shared water time; frozen with reduced motion',budget:{drawCalls:1},rim:false};
  return root;
}
