import { Bone, Box3, Group, Skeleton, SkinnedMesh, Sphere, Vector3 } from 'three';
import { createToonMaterial } from '../shared/style';
import { buildAvatarGeometry, JOINT, OTTER_JETS, SCUBA_SUIT, type AvatarGear } from './geometry';
export { SCUBA_SUIT, type AvatarGear } from './geometry';
import { DEFAULT_AVATAR_DESIGN, normalizeAvatarDesign, type AvatarDesign } from './design';
import { getAvatarDimensions, sizeAvatarPoint } from './sizing';
export type { AvatarDimensions } from './sizing';
export { AVATAR_OPTIONS, AVATAR_SIZE_LIMITS, DEFAULT_AVATAR_DESIGN, normalizeAvatarDesign } from './design';
export type { AvatarDesign } from './design';

export type AvatarEmote = 'none' | 'wave' | 'cheer' | 'sit' | 'cast';
/** Everything the rig needs can be read from replicated controller state, so a remote
 * player animates from the same fields as the local one. `landing` is the impact speed
 * (m/s) on the single frame the controller reports touching down. */
export interface AvatarMotion { pedalPhase?: number; speed?: number; emote?: AvatarEmote; reducedMotion?: boolean; carrying?: boolean; swimming?: boolean; airborne?: boolean; verticalVelocity?: number; landing?: number; flying?: boolean; boosting?: boolean; submerged?: boolean }
export const AVATAR_BUDGET = { triangles: 5000, draws: 1, materials: 1, imageTextures: 0, bones: 17 } as const;
const EMPTY_MOTION: Readonly<AvatarMotion> = Object.freeze({});
/** Reference movement values; per-avatar placement uses model.dimensions. */
export const OTTER_SUIT_BUDGET = { ...AVATAR_BUDGET, bones: 21 } as const;
export const AVATAR_MOVEMENT = { walkSpeed: 1.7, runSpeed: 3.5, radius: .28, standingHeight: 1.45 } as const;

/**
 * Original coastal toy proportions; nominal 1.45 m including the base hair cap.
 * Root faces +Z and owns placement. The visual rig owns poses; no root scaling or movement.
 * Outfit substitutions rebuild one inexpensive palette batch, keeping the saved identity separate.
 */
/** `gear` is worn equipment baked into the same skinned batch (still one draw). It is not part of
 * the saved appearance: scuba swaps the outfit for a wetsuit and the hairstyle for a hood. */
export function createAvatarModel(input: AvatarDesign = { ...DEFAULT_AVATAR_DESIGN }, { gear = 'none' }: { gear?: AvatarGear } = {}) {
  const design = normalizeAvatarDesign(input), dimensions = getAvatarDimensions(design), root = new Group(), visual = new Group();
  const heightScale = dimensions.heightScale;
  root.name = `avatar:${design.name}`; visual.name = 'avatar:visual'; root.add(visual);
  const geometry = buildAvatarGeometry(gear === 'scuba' ? { ...design, ...SCUBA_SUIT } : design, gear, gear === 'otter-man'), material = createToonMaterial({ vertexColors: true, name: 'avatar:shared-palette-toon', rim: false });
  if (gear === 'otter-man') material.userData.otterArmor = true;
  const mesh = new SkinnedMesh(geometry, material); mesh.name = 'avatar:one-draw-body-face-outfit'; mesh.castShadow = true; mesh.receiveShadow = true;
  visual.add(mesh);
  const bones: Bone[] = [], originalBind: Vector3[] = [], sizedBind: Vector3[] = [];
  function bone(name: string, x: number, y: number, z: number, parent?: number) {
    const node = new Bone(); node.name = name;
    const original = new Vector3(x,y,z);
    if (parent !== undefined) original.add(originalBind[parent]);
    const sized = sizeAvatarPoint(original.clone(), dimensions);
    // Keep the default local pivots bit-for-bit; at other builds transform absolute
    // bind points, then recover locals so limbs and their baked surfaces agree.
    if (design.bodyBuild === 1) node.position.set(x * heightScale,y * heightScale,z * heightScale);
    else { node.position.copy(sized); if (parent !== undefined) node.position.sub(sizedBind[parent]); }
    originalBind.push(original); sizedBind.push(sized);
    (parent === undefined ? visual : bones[parent]).add(node); bones.push(node);
  }
  bone('hips',0,.57,0);
  bone('chest',0,.18,0,JOINT.hips);
  bone('head',0,.30,0,JOINT.chest);
  bone('left-upper-arm',-.205,.13,0,JOINT.chest);
  bone('left-elbow',-.07,-.19,.005,JOINT.leftArm);
  bone('left-hand',-.025,-.15,.013,JOINT.leftElbow);
  bone('right-upper-arm',.205,.13,0,JOINT.chest);
  bone('right-elbow',.07,-.19,.005,JOINT.rightArm);
  bone('right-hand',.025,-.15,.013,JOINT.rightElbow);
  bone('left-hip',-.09,.01,0,JOINT.hips);
  bone('left-knee',0,-.26,.01,JOINT.leftLeg);
  bone('left-foot',0,-.215,.025,JOINT.leftKnee);
  bone('right-hip',.09,.01,0,JOINT.hips);
  bone('right-knee',0,-.26,.01,JOINT.rightLeg);
  bone('right-foot',0,-.215,.025,JOINT.rightKnee);
  bone('left-eye',-.095,.168,.22,JOINT.head);
  bone('right-eye',.095,.168,.22,JOINT.head);
  if (gear === 'otter-man') {
    bone('left-palm-exhaust',0,-.060,.038,JOINT.leftHand);
    bone('right-palm-exhaust',0,-.060,.038,JOINT.rightHand);
    bone('left-sole-exhaust',0,-.094,-.005,JOINT.leftFoot);
    bone('right-sole-exhaust',0,-.094,-.005,JOINT.rightFoot);
  }
  const skeleton = new Skeleton(bones); root.updateMatrixWorld(true);mesh.bind(skeleton);
  // Conservative bounds cover raised arms, seated legs and the full swimming reach.
  // SkinnedMesh keeps these bounds when the shared controller swaps LOD geometry.
  const reachScale = heightScale * Math.max(1, design.bodyBuild);
  mesh.boundingBox = new Box3(new Vector3(-.78,-.14,-.75).multiplyScalar(reachScale),new Vector3(.78,1.8,1.05).multiplyScalar(reachScale));
  mesh.boundingSphere = new Sphere(new Vector3(0,.80,.12).multiplyScalar(heightScale),1.25 * reachScale);
  if (gear === 'otter-man') {
    mesh.boundingBox = new Box3(new Vector3(-1,-1.4,-2.2).multiplyScalar(reachScale),new Vector3(1,2.1,1.7).multiplyScalar(reachScale));
    mesh.boundingSphere = new Sphere(new Vector3(0,.5,-.3).multiplyScalar(heightScale),2.7*reachScale);
  }
  const stats = {
    triangles: (geometry.index?.count ?? geometry.getAttribute('position').count) / 3,
    draws: 1, materials: 1, imageTextures: 0,
    geometryBytes: (geometry.index?.array.byteLength ?? 0) + Object.values(geometry.attributes).reduce((n,a)=>n+a.array.byteLength,0),
    recipeBytes: new TextEncoder().encode(JSON.stringify(design)).length,
    bones: bones.length,
  };
  root.userData = {
    assetId: 'coastal-avatar', units: 'metres', nominalHeightMeters: dimensions.heightMeters, dimensions,
    sizeBasis: 'Original stylized avatar. Selected nominal height, build and all toy-like proportions are artistic choices; hairstyles vary above the crown.',
    facing: '+Z', animation: gear === 'otter-man' ? '21-bone GPU skinning; hover/prone flight; four variable thrusters; automatic blink' : '17-bone GPU skinning; automatic blink; idle/walk/run/jump/land/wave/cheer/sit/cast/swim/tread-water',
    sourceParts: geometry.userData.sourceParts, budget: gear === 'otter-man' ? OTTER_SUIT_BUDGET : AVATAR_BUDGET, stats,
    collider: { shape: 'capsule', radius: dimensions.controllerRadius, height: dimensions.heightMeters, center: [0,dimensions.heightMeters / 2,0] },
    appearance: { ...design }, gear,
  };
  let disposed = false, time = 0, phase = 0, speed = 0, emote: AvatarEmote = 'none';
  let wave = 0, cheer = 0, seated = 0, blink = 1, carry = 0, castTime = Infinity, castCount = 0;
  let swimming = 0, swimmingActive = false, swimPhase = 0;
  let air = 0, rise = 0, landTime = Infinity, landStrength = 0, dive = 0;
  let flightBlend=0, flightPitch=0, boost=0, handThrust=0, footThrust=0;
  const straightFlightJoints=[JOINT.leftElbow,JOINT.rightElbow,JOINT.leftHand,JOINT.rightHand,JOINT.leftLeg,JOINT.rightLeg,JOINT.leftKnee,JOINT.rightKnee,JOINT.leftFoot,JOINT.rightFoot];
  const handJets=[OTTER_JETS.leftHand,OTTER_JETS.rightHand],footJets=[OTTER_JETS.leftFoot,OTTER_JETS.rightFoot];
  function blendFlightJoint(joint:number,x:number,y=0,z=0){
    const r=bones[joint].rotation;r.x+=(x-r.x)*flightBlend;r.y+=(y-r.y)*flightBlend;r.z+=(z-r.z)*flightBlend;
  }
  const tau = Math.PI*2;
  function update(dt: number, motion: AvatarMotion = EMPTY_MOTION) {
    if(disposed || !Number.isFinite(dt) || dt < 0) return;
    dt=Math.min(.1,dt);
    const reduced = motion.reducedMotion === true;
    const targetSpeed = Number.isFinite(motion.speed) ? Math.min(6,Math.max(0,motion.speed!)) : 0;
    swimmingActive=motion.swimming===true;
    const nextEmote = !swimmingActive && (motion.emote === 'wave' || motion.emote === 'cheer' || motion.emote === 'sit' || motion.emote === 'cast') ? motion.emote : 'none';
    if(nextEmote==='cast'&&emote!=='cast'){castTime=0;castCount++;}
    if(nextEmote!=='cast')castTime=Infinity;
    emote=nextEmote;
    if(Number.isFinite(castTime))castTime=Math.min(1.15,castTime+dt);
    const decay = Math.exp(-10*dt), alpha=1-decay;
    const integratedSpeed=targetSpeed*dt+(speed-targetSpeed)*(1-decay)/10;
    speed += (targetSpeed-speed)*alpha;
    time += dt;phase=(phase+integratedSpeed*5.5)%tau;
    swimming += ((swimmingActive?1:0)-swimming)*(1-Math.exp(-7*dt));
    swimPhase=(swimPhase+(dt*.72+integratedSpeed*.16)*tau)%tau;
    carry += ((motion.carrying&&!swimmingActive?1:0)-carry)*alpha;
    wave += ((emote==='wave'?1:0)-wave)*alpha;
    cheer += ((emote==='cheer'?1:0)-cheer)*alpha;
    seated += ((emote==='sit'&&targetSpeed<.05?1:0)-seated)*alpha;
    const stride=Math.min(1,speed/1.7)*(1-seated), run=Math.max(0,Math.min(1,(speed-1.7)/1.8));
    const idle = reduced ? 0 : Math.sin(time*2.2)*.009*(1-stride);
    const amplitude=(.52+run*.21)*stride;
    const left=Math.sin(phase)*amplitude,right=-left;
    const bob = reduced ? 0 : Math.abs(Math.sin(phase))*(.018+run*.023)*stride;
    bones[JOINT.hips].position.y=(.57 + bob+idle - seated*.21) * heightScale;
    bones[JOINT.hips].rotation.set(0,Math.sin(phase)*.055*stride,0);
    bones[JOINT.chest].rotation.set(run*.10*stride+seated*.075,Math.sin(phase)*-.065*stride,reduced?0:Math.sin(time*1.3)*.014*(1-stride));
    bones[JOINT.head].rotation.set(-run*.05*stride, reduced?0:Math.sin(time*.74)*.055*(1-stride), Math.sin(phase)*.018*stride);
    bones[JOINT.leftLeg].rotation.set(left*(1-seated)-seated*1.38,0,0);
    bones[JOINT.rightLeg].rotation.set(right*(1-seated)-seated*1.38,0,0);
    bones[JOINT.leftKnee].rotation.x=Math.max(0,-Math.sin(phase))*(.38+run*.38)*stride+seated*1.48;
    bones[JOINT.rightKnee].rotation.x=Math.max(0,Math.sin(phase))*(.38+run*.38)*stride+seated*1.48;
    bones[JOINT.leftFoot].rotation.x=-Math.max(0,Math.sin(phase))*.20*stride-seated*.12;
    bones[JOINT.rightFoot].rotation.x=-Math.max(0,-Math.sin(phase))*.20*stride-seated*.12;
    const waveWiggle=reduced?0:Math.sin(time*9)*.23;
    const cheerWiggle=reduced?0:Math.sin(time*8)*.12;
    bones[JOINT.leftArm].rotation.set(-left*.8*(1-cheer)-seated*.65,0,-.06-cheer*(2.37+cheerWiggle));
    bones[JOINT.rightArm].rotation.set(-right*.8*(1-wave)*(1-cheer)-seated*.65,-wave*.18,.06+wave*(2.45+waveWiggle)+cheer*(2.37-cheerWiggle));
    bones[JOINT.leftElbow].rotation.set(-.07-run*.5*stride-seated*.3-cheer*.20,0,-cheer*.15);
    bones[JOINT.rightElbow].rotation.set(-.07-run*.5*stride-seated*.3-wave*.55-cheer*.20,0,wave*.2+cheer*.15);
    // The hand anchor's +Y axis follows the rod shaft; the wrist turns it toward open water.
    const carryWeight=carry*(1-wave)*(1-cheer)*(1-seated);
    bones[JOINT.rightArm].rotation.x += (-.75-bones[JOINT.rightArm].rotation.x)*carryWeight;
    bones[JOINT.rightElbow].rotation.x += (-.38-bones[JOINT.rightElbow].rotation.x)*carryWeight;
    bones[JOINT.rightHand].rotation.x=1.75*carryWeight;
    if(castTime<1.15){
      // One anticipation, release and recovery sequence. Holding the emote does not restart it.
      let t=0,arm=-.75,elbow=-.38,wrist=1.75;
      if(castTime<.35){
        t=castTime/.35;t=t*t*(3-2*t);arm-=1.40*t;elbow-=.47*t;wrist-=.15*t;
      }else if(castTime<.73){
        t=(castTime-.35)/.38;t=t*t*(3-2*t);arm=-2.15+1.12*t;elbow=-.85+.73*t;wrist=1.60+.57*t;
      }else{
        t=(castTime-.73)/.42;t=t*t*(3-2*t);arm=-1.03+.28*t;elbow=-.12-.26*t;wrist=2.17-.42*t;
      }
      bones[JOINT.rightArm].rotation.x=arm;bones[JOINT.rightElbow].rotation.x=elbow;bones[JOINT.rightHand].rotation.x=wrist;
    }
    bones[JOINT.leftHand].rotation.set(0,0,-cheer*.18);
    bones[JOINT.rightHand].rotation.z=wave*waveWiggle+cheer*.18;
    // Vehicle distance owns the crank phase; remote avatars can replay the same pose.
    if(Number.isFinite(motion.pedalPhase)){
      const cycle=Math.sin(motion.pedalPhase!);
      bones[JOINT.leftLeg].rotation.x=-1.38+.24*cycle;
      bones[JOINT.rightLeg].rotation.x=-1.38-.24*cycle;
      bones[JOINT.leftKnee].rotation.x=1.48-.32*cycle;
      bones[JOINT.rightKnee].rotation.x=1.48+.32*cycle;
    }
    // Hop: knees tuck and arms lift on the way up, then open for balance on the way down.
    // The controller owns the height; these are pose-only bone changes.
    const airborne=motion.airborne===true&&!swimmingActive;
    air += ((airborne?1:0)-air)*(1-Math.exp(-(airborne?22:14)*dt));
    const vertical=Number.isFinite(motion.verticalVelocity)?motion.verticalVelocity!:0;
    rise += (Math.max(-1,Math.min(1,vertical/3.5))-rise)*(1-Math.exp(-12*dt));
    if(Number.isFinite(motion.landing)&&motion.landing!>0){landTime=0;landStrength=Math.min(1,.35+motion.landing!/6);}
    if(Number.isFinite(landTime))landTime+=dt;
    const dip=landTime<.24?Math.sin(Math.PI*landTime/.24)*landStrength*(1-air):0;
    if(landTime>=.24)landTime=Infinity;
    const jumpWeight=air*(1-seated),up=Math.max(0,rise),tuck=.55+.45*up;
    if(jumpWeight>1e-6){
      const armLift=1.05+.55*up,armWeight=jumpWeight*(1-carry);
      bones[JOINT.leftLeg].rotation.x+=(-.62*tuck-bones[JOINT.leftLeg].rotation.x)*jumpWeight;
      bones[JOINT.rightLeg].rotation.x+=(-.30*tuck-bones[JOINT.rightLeg].rotation.x)*jumpWeight;
      bones[JOINT.leftKnee].rotation.x+=(1.05*tuck-bones[JOINT.leftKnee].rotation.x)*jumpWeight;
      bones[JOINT.rightKnee].rotation.x+=(.80*tuck-bones[JOINT.rightKnee].rotation.x)*jumpWeight;
      bones[JOINT.leftFoot].rotation.x+=(.25-bones[JOINT.leftFoot].rotation.x)*jumpWeight;
      bones[JOINT.rightFoot].rotation.x+=(.25-bones[JOINT.rightFoot].rotation.x)*jumpWeight;
      bones[JOINT.chest].rotation.x+=(.10-bones[JOINT.chest].rotation.x)*jumpWeight;
      bones[JOINT.leftArm].rotation.x+=(-.35-bones[JOINT.leftArm].rotation.x)*jumpWeight;
      bones[JOINT.leftArm].rotation.z+=(-armLift-bones[JOINT.leftArm].rotation.z)*jumpWeight;
      bones[JOINT.rightArm].rotation.x+=(-.35-bones[JOINT.rightArm].rotation.x)*armWeight;
      bones[JOINT.rightArm].rotation.z+=(armLift-bones[JOINT.rightArm].rotation.z)*armWeight;
      bones[JOINT.leftElbow].rotation.x+=(-.45-bones[JOINT.leftElbow].rotation.x)*jumpWeight;
      bones[JOINT.rightElbow].rotation.x+=(-.45-bones[JOINT.rightElbow].rotation.x)*armWeight;
    }
    if(dip>1e-6){
      // A brief knee bend sells the landing; the feet stay planted because the hips drop with the bend.
      bones[JOINT.hips].position.y-=.075*dip*heightScale;
      bones[JOINT.leftLeg].rotation.x-=.42*dip;bones[JOINT.rightLeg].rotation.x-=.42*dip;
      bones[JOINT.leftKnee].rotation.x+=.80*dip;bones[JOINT.rightKnee].rotation.x+=.80*dip;
      bones[JOINT.leftFoot].rotation.x-=.36*dip;bones[JOINT.rightFoot].rotation.x-=.36*dip;
      bones[JOINT.chest].rotation.x+=.16*dip;
    }
    if(swimming>1e-8){
      // Surface breaststroke blends into an upright scull when movement stops.
      // Water height and buoyancy belong to the controller; only visual bones move here.
      const travel=Math.min(1,speed/1.7),stroke=(1-Math.cos(swimPhase))*.5;
      const tread=Math.sin(swimPhase),kick=Math.sin(swimPhase*2);
      // Diving tips the body head-down while descending and upright while rising.
      dive+=((swimmingActive?Math.max(-.45,Math.min(.6,-vertical/1.3)):0)-dive)*(1-Math.exp(-6*dt));
      const pitch=.24+.78*travel+dive*(.55+.45*travel),roll=reduced?0:Math.sin(swimPhase)*.025*travel;
      const swimBob=reduced?0:Math.sin(swimPhase*2)*.012;
      bones[JOINT.hips].position.y+=((.57+swimBob) * heightScale-bones[JOINT.hips].position.y)*swimming;
      bones[JOINT.hips].rotation.x=pitch*swimming;
      bones[JOINT.hips].rotation.y*=1-swimming;bones[JOINT.hips].rotation.z=roll*swimming;
      bones[JOINT.chest].rotation.x+=(-.05*travel-bones[JOINT.chest].rotation.x)*swimming;
      bones[JOINT.chest].rotation.y*=1-swimming;bones[JOINT.chest].rotation.z*=1-swimming;
      // Lift the face to look along +Z while the trunk leans into the stroke.
      bones[JOINT.head].rotation.x+=(-(pitch-Math.max(0,dive)*.7)*.82-bones[JOINT.head].rotation.x)*swimming;
      bones[JOINT.head].rotation.y*=1-swimming;bones[JOINT.head].rotation.z*=1-swimming;
      const armX=(-.28-.12*tread)*(1-travel)+(-2.25+.95*stroke)*travel;
      const armOut=(.65+.10*tread)*(1-travel)+(.18+.86*stroke)*travel;
      const elbowX=(-.85+.20*tread)*(1-travel)+(-.18-.70*stroke)*travel;
      bones[JOINT.leftArm].rotation.x+=(armX-bones[JOINT.leftArm].rotation.x)*swimming;
      bones[JOINT.rightArm].rotation.x+=(armX-bones[JOINT.rightArm].rotation.x)*swimming;
      bones[JOINT.leftArm].rotation.y*=1-swimming;bones[JOINT.rightArm].rotation.y*=1-swimming;
      bones[JOINT.leftArm].rotation.z+=(-armOut-bones[JOINT.leftArm].rotation.z)*swimming;
      bones[JOINT.rightArm].rotation.z+=(armOut-bones[JOINT.rightArm].rotation.z)*swimming;
      bones[JOINT.leftElbow].rotation.x+=(elbowX-bones[JOINT.leftElbow].rotation.x)*swimming;
      bones[JOINT.rightElbow].rotation.x+=(elbowX-bones[JOINT.rightElbow].rotation.x)*swimming;
      bones[JOINT.leftElbow].rotation.z*=1-swimming;bones[JOINT.rightElbow].rotation.z*=1-swimming;
      bones[JOINT.leftHand].rotation.x+=(-.10-bones[JOINT.leftHand].rotation.x)*swimming;
      bones[JOINT.rightHand].rotation.x+=(-.10-bones[JOINT.rightHand].rotation.x)*swimming;
      bones[JOINT.leftHand].rotation.z*=1-swimming;bones[JOINT.rightHand].rotation.z*=1-swimming;
      const leftKick=(-.12+.13*tread)*(1-travel)+kick*.19*travel;
      const rightKick=(-.12-.13*tread)*(1-travel)-kick*.19*travel;
      bones[JOINT.leftLeg].rotation.x+=(leftKick-bones[JOINT.leftLeg].rotation.x)*swimming;
      bones[JOINT.rightLeg].rotation.x+=(rightKick-bones[JOINT.rightLeg].rotation.x)*swimming;
      bones[JOINT.leftKnee].rotation.x+=((.44+.14*tread)*(1-travel)+(.12+Math.max(0,-kick)*.17)*travel-bones[JOINT.leftKnee].rotation.x)*swimming;
      bones[JOINT.rightKnee].rotation.x+=((.44-.14*tread)*(1-travel)+(.12+Math.max(0,kick)*.17)*travel-bones[JOINT.rightKnee].rotation.x)*swimming;
      bones[JOINT.leftFoot].rotation.x+=(-.16-bones[JOINT.leftFoot].rotation.x)*swimming;
      bones[JOINT.rightFoot].rotation.x+=(-.16-bones[JOINT.rightFoot].rotation.x)*swimming;
    }
    const flying=gear==='otter-man'&&motion.flying===true, jets=flying&&!motion.submerged;
    const flightSpeed=Number.isFinite(motion.speed)?Math.max(0,motion.speed!):0;
    flightBlend+=((flying?1:0)-flightBlend)*alpha;
    const travel=Math.min(1,flightSpeed/(motion.submerged?4:12)),prone=travel*travel*(3-2*travel);
    flightPitch+=((flying?prone*1.48:0)-flightPitch)*alpha;
    boost+=((flying&&motion.boosting===true?1:0)-boost)*alpha;
    if(flightBlend>1e-5){
      // Entire body pitches around the hips; head counter-rotates to look along travel.
      blendFlightJoint(JOINT.hips,flightPitch);blendFlightJoint(JOINT.head,-flightPitch*.92);blendFlightJoint(JOINT.chest,0);
      blendFlightJoint(JOINT.leftArm,.04,0,-.16);blendFlightJoint(JOINT.rightArm,.04,0,.16);
      for(const joint of straightFlightJoints)blendFlightJoint(joint,0);
      bones[JOINT.hips].position.y+=(.57*heightScale-bones[JOINT.hips].position.y)*flightBlend;
    }
    if(gear==='otter-man'){
      // Reduced motion removes flicker, but preserves readable thrust/boost state.
      const pulse=reduced?1:1+Math.sin(time*27)*.035;
      handThrust=jets?(.52+prone*.18+boost*.08)*pulse:0;
      footThrust=jets?(.48+prone*.30+boost*1.05)*pulse:0;
      for(const joint of handJets)bones[joint].scale.set(jets?.85:.0001,Math.max(.0001,handThrust),jets?.85:.0001);
      for(const joint of footJets)bones[joint].scale.set(jets?1+boost*.35:.0001,Math.max(.0001,footThrust),jets?1+boost*.35:.0001);
    }
    // Two deterministic natural blinks in a 7.1-second cycle; only eye bones change scale.
    const bt=time%7.1;
    const firstBlink=Math.max(0,1-Math.abs(bt-2.63)/.10), secondBlink=Math.max(0,1-Math.abs(bt-6.18)/.10);
    blink = reduced ? 1 : 1-.97*Math.max(firstBlink,secondBlink);
    bones[JOINT.leftEye].scale.y=blink;bones[JOINT.rightEye].scale.y=blink;
  }
  function dispose(){
    if(disposed)return;disposed=true;skeleton.dispose();geometry.dispose();
    // Viewer style conversion owns its source material; release the current node twin too.
    const current=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    for(const active of new Set(current))active.dispose();
    if(!current.some(active=>active===material||active.userData.nodeSource===material))material.dispose();
  }
  update(0);
  return {
    root, visual, mesh, bones, skeleton, design, gear, dimensions, stats, update, dispose,
    getState:()=>({flightPitch,boost,handThrust,footThrust,speed,emote,phase,time,blink,seated,swimming,swimmingActive,swimPhase,airborne:air,landing:Number.isFinite(landTime),diveTilt:dive,carrying:carry,casting:castTime<1.15,castProgress:Number.isFinite(castTime)?castTime/1.15:0,castCount,disposed}),
    anchors: { leftHand: bones[JOINT.leftHand], rightHand: bones[JOINT.rightHand], head: bones[JOINT.head] },
  };
}
export type AvatarModel = ReturnType<typeof createAvatarModel>;
