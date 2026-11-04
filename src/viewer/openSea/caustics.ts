import {DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, RGBAFormat, UnsignedByteType} from 'three';

/** Periodic, seeded cellular light field generated in code. One immutable 256 KiB texture.
 * Two warped samples animate the light in the shader; no image downloads or per-frame uploads. */
export function createCausticTexture(size=256){
  const cells=6,points:number[][]=[];let seed=1937;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let y=0;y<cells;y++)for(let x=0;x<cells;x++)points.push([x+.18+random()*.64,y+.18+random()*.64]);
  const data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size*Math.PI*2,v=y/size*Math.PI*2;
    // Periodic domain warp bends the cellular edges into soft water-like filaments.
    const px=x/size*cells+Math.sin(v*2+Math.sin(u))*.25+Math.sin(u*3+v*2)*.13;
    const py=y/size*cells+Math.cos(u*2+Math.sin(v))*.24+Math.cos(v*3-u)*.13;
    const ix=Math.floor(px),iy=Math.floor(py);let nearest=Infinity,second=Infinity;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const cx=ix+dx,cy=iy+dy,point=points[((cy+cells)%cells)*cells+(cx+cells)%cells];
      const sx=point[0]+Math.floor(cx/cells)*cells-px,sy=point[1]+Math.floor(cy/cells)*cells-py,d=sx*sx+sy*sy;
      if(d<nearest){second=nearest;nearest=d;}else if(d<second)second=d;
    }
    const gap=Math.sqrt(second)-Math.sqrt(nearest);
    const light=.78*Math.exp(-gap*gap/.0016)+.22*Math.exp(-gap*gap/.018);
    const i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=Math.round(light*255);data[i+3]=255;
  }
  const texture=new DataTexture(data,size,size,RGBAFormat,UnsignedByteType);
  texture.name='procedural-caustic-cells';texture.wrapS=texture.wrapT=RepeatWrapping;
  texture.minFilter=LinearMipmapLinearFilter;texture.magFilter=LinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;
  return texture;
}
