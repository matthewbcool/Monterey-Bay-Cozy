import { Color, Group, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, Object3D } from 'three';
import { mat, mesh } from '../../models/props/primitives';
import { createCoastalTree, type TreeSpecies } from '../../models/habitat/trees/createCoastalTree';
import { finishStaticAsset } from '../../models/shared/staticAsset';

/** Shared species silhouettes, spatially instanced. LOD measures individual trees
 * and rocks, not the diameter of the whole park. Instance slots never move. */
export function createParkNature(random: () => number, groundHeight: (x:number,z:number)=>number = () => 0) {
  const rockSource = new Group();
  // Monterey cypress and granite read from the city's park photos: dark layered crowns, thick
  // twisted trunks, grey-brown lichened rock. Colours are photo estimates, not measurements.
  const stone = mat('#8d8272');
  const stoneGeometry = new IcosahedronGeometry(1, 1), vertices = stoneGeometry.getAttribute('position');
  for (let i = 0; i < vertices.count; i++) {
    const x=vertices.getX(i),y=vertices.getY(i),z=vertices.getZ(i),d=1+.14*Math.sin(x*6+z*4)*Math.cos(y*5);
    vertices.setXYZ(i,x*d,Math.max(-.48,y*d),z*d);
  }
  stoneGeometry.computeVertexNormals(); mesh(rockSource,'Broad weathered granite faces',stoneGeometry,stone);
  // Native and introduced trees use the same library factory as Objects. A species
  // prototype is created lazily, then shared by occupied cells (256 m trees, 96 m rocks). The compact park needs one draw per species.
  const prototypes:Record<string,Mesh>={rock:finishStaticAsset(rockSource,'gym-granite',[1,1,1],{rim:false}).children[0] as Mesh};
  const cells=new Map<string,{kind:keyof typeof prototypes;matrices:Matrix4[];colors:Color[];size:number;sourceIds?:number[]}>();
  const transform=new Object3D();
  function add(kind:keyof typeof prototypes,x:number,z:number,y:number,sx:number,sy:number,sz:number) {
    transform.position.set(x,y+groundHeight(x,z),z);transform.rotation.set(0,random()*Math.PI*2,0);transform.scale.set(sx,sy,sz);transform.updateMatrix();
    const size=kind==='rock'?96:256,offset=kind==='rock'?0:128;
    const key=`${kind}:${Math.floor((x+offset)/size)},${Math.floor((z+offset)/size)}`;
    let cell=cells.get(key);if(!cell){cell={kind,matrices:[],colors:[],size};cells.set(key,cell);}
    cell.matrices.push(transform.matrix.clone());cell.colors.push(new Color().setScalar(kind==='rock'?.72+random()*.28:.91+random()*.09));
    return cell;
  }
  return {
    rock(x:number,z:number,size:number){add('rock',x,z,size*.19-.2,size,size*(.75+random()*.4),size*(.68+random()*.3));},
    // Numeric form remains available for explicitly authored scenery outside the inventory.
    tree(input:{x:number;z:number;height:number;species:TreeSpecies;sourceId:number}|number,zArg?:number,heightArg?:number){
      const {x,z,height,species,sourceId}=typeof input==='number'?{x:input,z:zArg!,height:heightArg!,species:'monterey-cypress' as const,sourceId:undefined}:input;
      const key='tree-'+species;
      prototypes[key]??=createCoastalTree({species,seed:734,heightMetres:1}).children[0] as Mesh;
      const cell=add(key,x,z,0,height,height,height);
      // Keep stable inventory identity on the batch as well as the placement cache.
      if(sourceId!==undefined)(cell.sourceIds??=[]).push(sourceId);
    },
    finish(){
      const root=new Group();root.name='Gym · spatially instanced nature';
      const used=new Set([...cells.values()].map(cell=>cell.kind));
      for(const [kind,proto]of Object.entries(prototypes))if(!used.has(kind)){proto.geometry.dispose();for(const m of Array.isArray(proto.material)?proto.material:[proto.material])m.dispose();}
      for(const[key,cell]of cells){const proto=prototypes[cell.kind],batch=new InstancedMesh(proto.geometry,proto.material,cell.matrices.length);
        batch.name=`gym-${key}`;batch.userData.spatialCell={key,sizeMetres:cell.size};batch.userData.sourceParts=proto.parent?.userData.sourceParts;batch.userData.treeSourceIds=cell.sourceIds;
        cell.matrices.forEach((matrix,i)=>{batch.setMatrixAt(i,matrix);batch.setColorAt(i,cell.colors[i]);});
        batch.instanceMatrix.needsUpdate=true;if(batch.instanceColor)batch.instanceColor.needsUpdate=true;
        batch.computeBoundingBox();batch.computeBoundingSphere();batch.castShadow=batch.receiveShadow=true;root.add(batch);
      }
      return root;
    },
  };
}
