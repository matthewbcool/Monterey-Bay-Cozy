import { BufferGeometry, Float32BufferAttribute, Group, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three';
import { box, mat, mesh } from '../primitives';
import { finishStaticAsset } from '../../shared/staticAsset';

type Point = readonly [number, number, number];
type Ring = readonly [y:number, width:number, depth:number, x?:number, z?:number];

/** Closed organic rings: widths/depths are radii; every section is authored in metres. */
function loft(rings: readonly Ring[], sides=8, faceted=false) {
  const points:number[]=[], indices:number[]=[];
  rings.forEach(([y,w,d,x=0,z=0])=>{
    for(let j=0;j<sides;j++){const a=j/sides*Math.PI*2;points.push(x+w*Math.cos(a),y,z+d*Math.sin(a));}
  });
  for(let i=0;i<rings.length-1;i++)for(let j=0;j<sides;j++){
    const a=i*sides+j,n=i*sides+(j+1)%sides,b=a+sides,bn=n+sides;
    indices.push(a,b,n,n,b,bn);
  }
  for(const end of [0,rings.length-1]){
    const [y,,,x=0,z=0]=rings[end], center=points.length/3;points.push(x,y,z);
    for(let j=0;j<sides;j++){
      const a=end*sides+j,b=end*sides+(j+1)%sides;
      if(end===0)indices.push(center,a,b);else indices.push(center,b,a);
    }
  }
  let g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(points,3));g.setIndex(indices);
  if(faceted){const flat=g.toNonIndexed();g.dispose();g=flat;}
  g.computeVertexNormals();return g;
}

/** Sculpted sleeve/lock/finger with varying cross section, not a constant-radius capsule. */
function sweep(path:readonly Point[], radii:readonly number[], sides=6, flatten=1) {
  const points:number[]=[], indices:number[]=[];
  path.forEach((p,i)=>{
    const tangent=new Vector3(...path[Math.min(path.length-1,i+1)]).sub(new Vector3(...path[Math.max(0,i-1)])).normalize();
    const guide=Math.abs(tangent.z)<.9?new Vector3(0,0,1):new Vector3(0,1,0);
    const u=new Vector3().crossVectors(tangent,guide).normalize(),v=new Vector3().crossVectors(u,tangent);
    for(let j=0;j<sides;j++){
      const a=j/sides*Math.PI*2, q=new Vector3(...p).addScaledVector(u,Math.cos(a)*radii[i]).addScaledVector(v,Math.sin(a)*radii[i]*flatten);
      points.push(q.x,q.y,q.z);
    }
  });
  for(let i=0;i<path.length-1;i++)for(let j=0;j<sides;j++){
    const a=i*sides+j,n=i*sides+(j+1)%sides,b=a+sides,bn=n+sides;indices.push(a,b,n,n,b,bn);
  }
  for(const end of [0,path.length-1]){
    const center=points.length/3;points.push(...path[end]);
    for(let j=0;j<sides;j++){
      const a=end*sides+j,b=end*sides+(j+1)%sides;
      if(end===0)indices.push(center,a,b);else indices.push(center,b,a);
    }
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(points,3));g.setIndex(indices);g.computeVertexNormals();return g;
}

function oval(root:Group,name:string,pos:Point,size:Point,material:MeshStandardMaterial,segments=8,rings=5){
  const geometry=new SphereGeometry(1,segments,rings);geometry.scale(...size);return mesh(root,name,geometry,material,...pos);
}

function createBoulder(root:Group,stone:MeshStandardMaterial,dark:MeshStandardMaterial){
  const geometry=loft([[0,.66,.53],[.12,.72,.56],[.43,.58,.43,.01,-.015],[.61,.39,.30,-.035,-.025],[.65,.31,.24,-.02,-.025]],10,true);
  // Unequal radii give the broad natural stone a chipped silhouette; the flat top supports both feet.
  const positions=geometry.getAttribute('position');
  for(let i=0;i<positions.count;i++)if(positions.getY(i)<.6){
    const x=positions.getX(i),z=positions.getZ(i),a=Math.atan2(z,x),f=1+.055*Math.sin(a*3+.4)+.025*Math.cos(a*7);
    positions.setXYZ(i,x*f,positions.getY(i),z*f);
  }
  geometry.computeVertexNormals();mesh(root,'granite-boulder',geometry,stone);
  const plaque=box(root,'unlettered-inset-bronze-plaque',[.255,.125,.014],dark,[.015,.27,.49]);plaque.rotation.x=-.29;
}

function createBody(root:Group,bronze:MeshStandardMaterial,patina:MeshStandardMaterial){
  mesh(root,'rumpled-sweater',loft([[1.225,.122,.087,-.006,.011],[1.26,.142,.105,-.008,.011],[1.325,.151,.104,-.012,.017],[1.39,.144,.11,-.012,.009],[1.48,.15,.114,-.006],[1.57,.169,.11],[1.615,.16,.102],[1.649,.119,.077],[1.66,.074,.061]],10),bronze);
  mesh(root,'sweater-hem',loft([[1.224,.123,.09,-.006,.011],[1.239,.138,.103,-.008,.011],[1.258,.141,.105,-.008,.011]],10),patina);
  mesh(root,'neck',loft([[1.63,.061,.057],[1.73,.054,.055],[1.765,.057,.061]],8),bronze);
  mesh(root,'wide-sweater-collar',loft([[1.648,.1,.08],[1.673,.104,.083],[1.685,.075,.062]],10),patina);
  for(const side of [-1,1]){
    const x=side*.073;
    mesh(root,side<0?'right-rolled-trousers':'left-rolled-trousers',loft([[.988,.054,.062,x],[1.025,.076,.078,x],[1.078,.08,.083,x-side*.006,.009],[1.115,.069,.075,x-side*.006],[1.165,.082,.087,x,.005],[1.22,.073,.088,x],[1.29,.076,.09,x-side*.008]],8),bronze);
    mesh(root,side<0?'right-rolled-cuff':'left-rolled-cuff',loft([[1.002,.056,.062,x],[1.017,.075,.075,x],[1.054,.071,.078,x],[1.065,.061,.069,x]],8),patina);
    mesh(root,side<0?'right-bare-shin':'left-bare-shin',loft([[.70,.029,.035,x,0],[.76,.029,.035,x,0],[.84,.041,.043,x-side*.005,-.015],[.93,.047,.047,x-side*.003,-.005],[1.04,.045,.052,x,0]],7),bronze);
    mesh(root,side<0?'right-bare-foot':'left-bare-foot',loft([[.65,.037,.079,x,.053],[.671,.049,.096,x,.055],[.696,.044,.076,x,.043],[.729,.027,.033,x,0]],7),bronze);
  }
  mesh(root,'right-reaching-sweater-sleeve',sweep([[-.105,1.57,0],[-.159,1.587,.025],[-.201,1.565,.082],[-.235,1.53,.14],[-.252,1.552,.23],[-.265,1.579,.29]],[.054,.065,.069,.064,.053,.044],8),bronze);
  mesh(root,'left-lowered-sweater-sleeve',sweep([[.105,1.57,0],[.161,1.571,.002],[.209,1.505,.012],[.25,1.405,.026],[.29,1.315,.074]],[.055,.066,.067,.06,.044],8),bronze);
  oval(root,'right-reaching-hand',[-.267,1.588,.322],[.047,.035,.061],bronze,8,4);
  oval(root,'left-boat-holding-hand',[.288,1.28,.095],[.039,.054,.028],bronze,8,4);
}

function createHead(root:Group,bronze:MeshStandardMaterial){
  mesh(root,'child-face-and-cranium',loft([[1.715,.039,.047,0,.017],[1.744,.069,.063,0,.023],[1.785,.096,.084],[1.84,.107,.096],[1.905,.102,.092],[1.953,.075,.075],[1.969,.025,.03]],10),bronze);
  for(const side of [-1,1])oval(root,side<0?'right-ear':'left-ear',[side*.105,1.826,.002],[.019,.033,.023],bronze,6,4);
  oval(root,'tousled-hair-mass',[0,1.921,-.012],[.119,.079,.11],bronze,9,5);
}

function createHeadDetails(root:Group,bronze:MeshStandardMaterial,patina:MeshStandardMaterial,dark:MeshStandardMaterial){
  const locks:Point[][]=[
    [[-.066,1.97,-.005],[-.099,1.94,.064],[-.108,1.86,.041]],
    [[-.046,1.981,.005],[-.071,1.94,.097],[-.06,1.88,.092]],
    [[-.012,1.984,.002],[-.025,1.942,.108],[-.031,1.887,.099]],
    [[.021,1.985,-.008],[.022,1.948,.111],[.012,1.899,.102]],
    [[.058,1.976,-.015],[.076,1.94,.087],[.055,1.879,.09]],
    [[.08,1.958,-.029],[.106,1.914,.036],[.11,1.853,.014]],
    [[-.02,1.988,-.04],[.066,1.965,-.084],[.107,1.904,-.057]],
  ];
  locks.forEach((path,i)=>mesh(root,`swept-hair-lock-${i+1}`,sweep(path,[.012,.022,.004],5,.7),i===3?patina:bronze));
  for(const side of [-1,1]){
    oval(root,side<0?'right-recessed-eye':'left-recessed-eye',[side*.041,1.843,.086],[.015,.009,.007],dark,6,3);
    mesh(root,side<0?'right-brow-ridge':'left-brow-ridge',sweep([[side*.067,1.857,.071],[side*.042,1.865,.09],[side*.023,1.857,.096]],[.005,.007,.004],3),bronze);
  }
  const nose=new BufferGeometry();nose.setAttribute('position',new Float32BufferAttribute([
    -.013,1.854,.087,.013,1.854,.087,-.022,1.799,.087,.022,1.799,.087,0,1.803,.108,
  ],3));nose.setIndex([0,4,1,0,2,4,1,4,3,2,3,4,0,1,2,2,1,3]);nose.computeVertexNormals();mesh(root,'small-sculpted-nose',nose,bronze);
  mesh(root,'subtle-mouth-groove',sweep([[-.025,1.774,.078],[0,1.768,.088],[.023,1.775,.079]],[.003,.004,.003],3,.5),dark);
}

function createPoseDetails(root:Group,bronze:MeshStandardMaterial,patina:MeshStandardMaterial){
  mesh(root,'right-extended-index',sweep([[-.278,1.601,.351],[-.275,1.61,.383],[-.255,1.601,.414]],[.011,.01,.006],4),bronze);
  mesh(root,'right-curled-thumb',sweep([[-.235,1.585,.323],[-.226,1.578,.352],[-.239,1.575,.368]],[.011,.01,.006],4),bronze);
  // Three shallow cast ridges carry the sweater's drape; depth stays inside the parent surface.
  const folds:Point[][]=[
    [[-.108,1.542,.07],[-.058,1.475,.104],[.052,1.412,.098]],
    [[-.111,1.392,.067],[-.025,1.339,.122],[.105,1.305,.087]],
    [[-.104,1.312,.082],[-.037,1.279,.116],[.053,1.264,.105]],
  ];
  folds.forEach((path,i)=>mesh(root,`sweater-drape-ridge-${i+1}`,sweep(path,[.006,.008,.004],3,.45),patina));
}

function createSailboat(root:Group,bronze:MeshStandardMaterial,dark:MeshStandardMaterial){
  const boat=new Group();boat.name='model-sailboat';boat.position.set(.285,1.255,.10);boat.rotation.y=-.52;root.add(boat);
  mesh(boat,'model-boat-pointed-hull',loft([[-.067,.014,.08],[-.043,.041,.123],[0,.064,.158],[.014,.067,.16]],8),bronze);
  mesh(boat,'model-boat-recessed-deck',loft([[.012,.051,.14],[.016,.051,.14]],8),dark);
  mesh(boat,'model-boat-mast',sweep([[0,.006,-.025],[0,.48,-.025]],[.008,.006],5),bronze);
  // A closed triangular wedge has volume and stays visible on either side without DoubleSide.
  const v=[-.005,.025,-.025,-.005,.463,-.025,-.005,.041,.152,.005,.025,-.025,.005,.463,-.025,.005,.041,.152];
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(v,3));g.setIndex([0,2,1,3,4,5,0,1,3,1,4,3,1,2,4,2,5,4,2,0,5,0,3,5]);g.computeVertexNormals();mesh(boat,'triangular-bronze-sail',g,bronze);
  mesh(boat,'model-boat-keel',loft([[-.135,.009,.036],[-.065,.015,.06]],5),dark);
}

/** Dorothy Fowler's boy-and-sailboat sculpture, interpreted from a single frontal photograph.
 * Public metre-space prop, +Z front. Dimensions and concealed anatomy are provisional.
 */
export function createSailingBoyStatue(){
  const root=new Group();root.name='sailing-boy-statue';
  const bronze=mat('#647873'),patina=mat('#7d8c7c'),dark=mat('#45534d'),stone=mat('#b5b2a2');
  createBoulder(root,stone,dark);createBody(root,bronze,patina);createSailboat(root,bronze,dark);
  const head=new Group();head.name='child-head-source';head.position.y=-.018;root.add(head);
  createHead(head,bronze);createHeadDetails(head,bronze,patina,dark);createPoseDetails(root,bronze,patina);
  finishStaticAsset(root,'sailing-boy-statue',[1,1,1],{rim:false});
  root.userData.sculptRuntime={kind:'static-monument',rootMotionNode:root.name,front:[0,0,1],anchors:{floor:[0,0,0],figureFeet:[0,.65,0]},hiddenSurfaces:'inferred from the single front photograph'};
  return root;
}
