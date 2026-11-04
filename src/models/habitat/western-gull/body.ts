import { BufferGeometry, Float32BufferAttribute } from 'three';

/** One continuous stocky trunk, rising neck and rounded head. Rings use
 * [forward/back Z, centre Y, radius X, radius Y], in male specimen metres. */
export function buildGullBody(near: boolean) {
  const rings = near ? [
    [-.287,.425,.014,.025],[-.26,.427,.050,.052],[-.22,.427,.064,.064],
    [-.18,.405,.062,.078],[-.14,.365,.065,.101],[-.08,.313,.088,.116],
    [0,.30,.10,.103],[.10,.30,.083,.093],[.18,.30,.048,.060],[.238,.305,.008,.018],
  ] : [
    [-.287,.425,.016,.025],[-.22,.427,.064,.064],[-.14,.365,.065,.101],
    [0,.30,.10,.103],[.14,.30,.065,.075],[.238,.305,.008,.018],
  ];
  const sides=near?10:6,vertices:number[]=[],indices:number[]=[];
  for(const [z,y,rx,ry] of rings)for(let j=0;j<sides;j++) {
    const angle=j/sides*Math.PI*2;vertices.push(rx*Math.cos(angle),y+ry*Math.sin(angle),z);
  }
  for(let i=0;i<rings.length-1;i++)for(let j=0;j<sides;j++) {
    const a=i*sides+j,b=i*sides+(j+1)%sides,c=a+sides,d=b+sides;
    indices.push(a,b,c,b,d,c);
  }
  for(const [ring,reverse] of [[0,true],[rings.length-1,false]] as const) {
    const [z,y]=rings[ring],center=vertices.length/3;vertices.push(0,y,z);
    for(let j=0;j<sides;j++) {
      const a=ring*sides+j,b=ring*sides+(j+1)%sides;
      indices.push(center,reverse?b:a,reverse?a:b);
    }
  }
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  geometry.name='gull-continuous-head-neck-trunk';return geometry;
}
