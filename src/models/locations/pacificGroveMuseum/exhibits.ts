/** Original low-poly exhibit vignettes; no museum photography or collection artwork is embedded.
 * Their presence/room follows the visitor guide; positions and specimen selection are illustrative. */
import { Group } from 'three';
import { box, mat, blob, beam, disc } from './helpers';
export function addMuseumExhibits(ground:Group,upper:Group){
  const walnut=mat('#805b42'),oak=mat('#bb9364'),cream=mat('#e6dcc0'),ink=mat('#354e52'),teal=mat('#577c76'),sage=mat('#91a582'),gold=mat('#cda359'),jade=mat('#6e9c88'),fur=mat('#866344');
  const casework=(g:Group,x:number,z:number,w=2.2,y=0)=>{box(g,'Exhibit cabinet',[w,.65,.6],walnut,[x,y+.325,z]);box(g,'Painted exhibit backdrop',[w,1.35,.08],teal,[x,y+1.32,z+.23]);box(g,'Case cornice',[w+.12,.1,.7],oak,[x,y+2,z]);box(g,'Case display shelf',[w,.08,.7],cream,[x,y+.72,z]);for(const dx of [-w/2,w/2])box(g,'Cabinet frame',[.07,1.35,.5],oak,[x+dx,y+1.32,z]);};
  const placard=(g:Group,x:number,z:number,y=.8)=>{box(g,'Interpretation panel',[.65,.06,.4],cream,[x,y,z]).rotation.x=.15;};
  // Front desk stays beside the entry axis, leaving a clear path through the lobby.
  box(ground,'Reception desk',[1.4,1,1.35],walnut,[14.95,.5,17.9]);box(ground,'Reception counter',[1.6,.12,1.5],oak,[14.95,1.06,17.9]);box(ground,'Desk screen',[.48,.35,.08],ink,[15.15,1.32,18.1]);
  for(let i=0;i<3;i++){casework(ground,12.1+i*.95,23.55,.82);for(let j=0;j<3;j++)box(ground,'Gift shop books',[.16,.34,.19],i%2?teal:gold,[11.84+i*.95+j*.19,.94,23.48]);}
  // Monarch display and a pair of original butterfly silhouettes.
  box(ground,'Monarch display',[1.5,1.6,.08],sage,[18.65,1.6,19.85]);for(const dx of [-.33,.33]){blob(ground,'Monarch wing',[18.65+dx,1.75,19.77],[.32,.48,.045],gold);blob(ground,'Monarch wing tip',[18.65+dx,1.96,19.72],[.22,.18,.025],ink);}beam(ground,'Monarch body',[18.65,1.32,19.7],[18.65,2.1,19.7],.08,ink);
  // Dusty: standing brown bear near the main gallery's front half.
  box(ground,'Dusty exhibit plinth',[1.9,.3,1.7],walnut,[22.4,.15,10.7]);
  blob(ground,'Dusty body',[22.4,1.35,10.7],[.48,.85,.34],fur);blob(ground,'Dusty head',[22.4,2.2,10.65],[.37,.37,.32],fur);blob(ground,'Dusty muzzle',[22.4,2.1,10.35],[.23,.17,.18],oak);blob(ground,'Dusty nose',[22.4,2.15,10.19],[.1,.075,.05],ink);
  for(const d of [-1,1]){blob(ground,'Bear ear',[22.4+d*.29,2.46,10.65],[.11,.13,.08],fur);blob(ground,'Bear leg',[22.4+d*.25,.65,10.65],[.19,.5,.22],fur);blob(ground,'Bear arm',[22.4+d*.5,1.5,10.6],[.2,.5,.2],fur).rotation.z=d*.5;blob(ground,'Bear eye',[22.4+d*.14,2.25,10.35],[.034,.034,.026],ink);}
  placard(ground,22.4,9.7,.55);
  // Cultural history: original abstract display cases and a miniature fishing village.
  for(let i=0;i<3;i++){casework(ground,20.1,11.8+i*2.45,1.5);disc(ground,'Basket form',20.1,.92,11.8+i*2.45,.26,oak,.3);}
  box(ground,'Fishing village display table',[2.5,.85,1.2],cream,[26.7,.425,7.25]);
  for(let i=0;i<4;i++){box(ground,'Village study house',[.38,.24,.35],oak,[25.85+i*.53,.97,7.25]);box(ground,'Village study roof',[.43,.06,.44],walnut,[25.85+i*.53,1.12,7.25]).rotation.z=.1;}
  placard(ground,26.7,6.6,1);
  // Bird Room: perimeter cabinets with 24 representative, static bird silhouettes.
  for(let i=0;i<6;i++){const x=1.35+i*2.18;casework(ground,x,1.0,1.95);casework(ground,x,12.9,1.95);
    for(const z of [1,12.9])for(const d of [-.45,.42]){const bird=blob(ground,'Representative bird specimen',[x+d,1.05,z],[.18,.24,.15],i%2?cream:ink);bird.rotation.z=-.15;blob(ground,'Bird head',[x+d+.08,1.29,z-.03],[.1,.11,.09],i%2?ink:cream);beam(ground,'Bird bill',[x+d+.13,1.29,z-.05],[x+d+.27,1.28,z-.05],.045,gold);beam(ground,'Bird perch',[x+d,.74,z],[x+d,.9,z],.035,oak);}}
  for(const [x,z]of [[4,5.5],[9.5,8.5]]){disc(ground,'Bird exploration table',x,.85,z,.85,walnut,.12);box(ground,'Table pedestal',[.35,.8,.35],oak,[x,.4,z]);placard(ground,x,z,.96);}
  // Jade: small green mineral specimens and a touch boulder; Wonder: library/cave/tree.
  for(const x of [32,36.5]){casework(ground,x,21.8,1.8);for(let i=0;i<3;i++)blob(ground,'Jade mineral',[x-.5+i*.5,.94,21.75],[.16,.23,.14],jade);}
  blob(ground,'Jade touch boulder',[35.7,.5,19.3],[.7,.5,.6],jade);
  casework(ground,31.65,12.8,1.25);for(let i=0;i<5;i++)box(ground,'Wonder book',[.11,.35,.24],i%2?sage:gold,[31.15+i*.23,1,12.75]);
  for(const d of [-1,1]){blob(ground,'Wonder reading cave side',[35.7+d*.63,.75,15.6],[.55,.8,.7],walnut);}blob(ground,'Wonder reading cave roof',[35.7,1.55,15.6],[1,.28,.7],walnut);disc(ground,'Reading cushion',35.7,.16,15.6,.55,sage,.23);
  beam(ground,'Wonder tree trunk',[32.2,0,16],[32.5,2.8,16],.22,walnut);for(const d of [-1,1])beam(ground,'Wonder branch',[32.4,1.7,16],[32.4+d*.8,2.5,16.2],.12,oak);blob(ground,'Wonder canopy',[32.5,2.85,16],[1.1,.42,.75],sage);
  for(const x of [32.3,36.4]){casework(ground,x,6.45,1.6);blob(ground,'Fossil specimen',[x,.9,6.3],[.3,.12,.22],cream);}
  box(ground,'Microscope activity table',[1.4,.85,.65],oak,[36.6,.425,8.7]);beam(ground,'Microscope arm',[36.6,.9,8.7],[36.6,1.3,8.8],.09,ink);beam(ground,'Microscope tube',[36.6,1.3,8.8],[36.6,1.42,8.56],.13,ink);
  // Classroom tables, garden fountain and opaque service-door markers.
  for(const x of [27.5,31.5,35.5]){box(ground,'Classroom activity table',[2,.08,1.1],oak,[x,.72,29.4]);for(const dx of [-.8,.8])for(const dz of [-.4,.4])box(ground,'Table leg',[.07,.68,.07],walnut,[x+dx,.34,29.4+dz]);for(const dz of [-1,1])disc(ground,'Classroom stool',x,.45,29.4+dz,.28,sage,.12);}
  box(ground,'Classroom board',[3,1.4,.08],teal,[30.3,1.65,32.8]);box(ground,'Elevator doors',[1.3,2.3,.1],ink,[8.9,1.15,17.8]);box(ground,'Elevator door seam',[.035,2.2,.04],cream,[8.9,1.15,17.73]);
  // Four Changes habitat dioramas around the real open mezzanine, not a solid upper floor.
  const habitats=[['Coastal',20.1,7.2,teal],['Chaparral',29.5,7.2,sage],['Coastal forest',20.1,19.5,teal],['Inland mountains',29.5,19.5,sage]] as const;
  for(const [name,x,z,color]of habitats){casework(upper,x,z,1.7,3.6);blob(upper,name+' landscape',[x,4.4,z],[.65,.14,.24],color);for(const dx of [-.45,.3]){beam(upper,name+' miniature tree',[x+dx,4.4,z],[x+dx,4.9,z],.045,walnut);blob(upper,name+' canopy',[x+dx,4.95,z],[.18,.22,.12],sage);}}
}
