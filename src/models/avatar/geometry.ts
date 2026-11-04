import { BufferGeometry, Color, Float32BufferAttribute, SphereGeometry, Uint16BufferAttribute, Vector3 } from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import type { AvatarDesign } from './design';
import { avatarWidthAtHeight, avatarWidthSlope, getAvatarDimensions, sizeAvatarPoint } from './sizing';

/** Index order is part of the rig contract. Every generated vertex carries ordinary GPU skinning. */
export const JOINT = {
  hips: 0, chest: 1, head: 2,
  leftArm: 3, leftElbow: 4, leftHand: 5, rightArm: 6, rightElbow: 7, rightHand: 8,
  leftLeg: 9, leftKnee: 10, leftFoot: 11, rightLeg: 12, rightKnee: 13, rightFoot: 14,
  leftEye: 15, rightEye: 16,
} as const;
export const OTTER_JETS = { leftHand: 17, rightHand: 18, leftFoot: 19, rightFoot: 20 } as const;
type Point = [number, number, number];
type Weight = (p: Vector3) => [number, number, number];
const smooth = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

/** Equipment worn as part of the one skinned batch. Not saved in the appearance recipe. */
export type AvatarGear = 'none' | 'scuba' | 'otter-man';
/** Wetsuit colors applied over the saved outfit while scuba gear is worn. Original palette. */
export const SCUBA_SUIT = { topStyle: 'hoodie', bottomStyle: 'trousers', topColor: '#2c3f47', bottomColor: '#2c3f47', shoeColor: '#2c3f47' } as const;

/** Colors and skin weights are baked once; there are no avatar image maps or animation-time uploads. */
export function buildAvatarGeometry(d: AvatarDesign, gear: AvatarGear = 'none', thrusters = false) {
  const scuba = gear === 'scuba';
  const parts: BufferGeometry[] = [], names: string[] = [];
  const skin = new Color(d.skinTone), blush = skin.clone().lerp(new Color('#d98b79'), .28);
  const top = new Color(d.topColor), topShade = top.clone().multiplyScalar(.74);
  const bottom = new Color(d.bottomColor), hair = new Color(d.hairColor), hairShade = hair.clone().multiplyScalar(.85);
  const ink = new Color('#3d302b'), cream = new Color('#fff2d7');
  const point = new Vector3();
  function add(name: string, g: BufferGeometry, color: Color | string, joint: number | Weight) {
    g.deleteAttribute('uv');
    const c = typeof color === 'string' ? new Color(color) : color;
    const p = g.getAttribute('position'), colors = new Float32Array(p.count * 3), indices = new Uint16Array(p.count * 4), weights = new Float32Array(p.count * 4);
    for (let i = 0; i < p.count; i++) {
      colors.set([c.r, c.g, c.b], i * 3); point.fromBufferAttribute(p, i);
      const w = typeof joint === 'number' ? [joint, joint, 0] : joint(point);
      indices.set([w[0], w[1], 0, 0], i * 4); weights.set([1 - w[2], w[2], 0, 0], i * 4);
    }
    g.setAttribute('color', new Float32BufferAttribute(colors, 3));
    g.setAttribute('skinIndex', new Uint16BufferAttribute(indices, 4));
    g.setAttribute('skinWeight', new Float32BufferAttribute(weights, 4));
    if (gear === 'otter-man') {
      // One categorical channel keeps metal, soft details and self-lit exhaust in one draw.
      const surface = name.includes('plume') || name.includes('jet') || name.includes('outlet') || name.includes('core') ? 2
        : name.includes('muzzle') || name.includes('belly') || name.includes('nose') || name.includes('visor') || name.includes('paw') ? 0 : 1;
      g.setAttribute('otterSurface', new Float32BufferAttribute(new Float32Array(p.count).fill(surface), 1));
    }
    parts.push(g); names.push(name);
  }
  function ellipsoid(name: string, center: Point, scale: Point, color: Color | string, joint: number | Weight, segments = 12, rings = 8) {
    const g = new SphereGeometry(1, segments, rings); g.scale(...scale); g.translate(...center); add(name, g, color, joint);
  }
  /** Elliptic section loft, closed at both ends. Rings let shoulders/hips keep a continuous silhouette. */
  function loft(name: string, rows: [number, number, number, number, number][], color: Color | string, joint: number | Weight, segments = 12) {
    const p: number[] = [], index: number[] = [];
    rows.forEach(([x, y, z, rx, rz], r) => {
      for (let i = 0; i < segments; i++) { const a = i / segments * Math.PI * 2; p.push(x + Math.sin(a) * rx, y, z + Math.cos(a) * rz); }
      if (r) for (let i = 0; i < segments; i++) { const a = (r - 1) * segments + i, b = (r - 1) * segments + (i + 1) % segments, c = r * segments + i, e = r * segments + (i + 1) % segments; index.push(a, b, c, b, e, c); }
    });
    for (const [r, reverse] of [[0, false], [rows.length - 1, true]] as const) {
      const center = p.length / 3; p.push(rows[r][0], rows[r][1], rows[r][2]);
      for (let i = 0; i < segments; i++) { const a = r * segments + i, b = r * segments + (i + 1) % segments; index.push(center, reverse ? a : b, reverse ? b : a); }
    }
    const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(p, 3)); g.setIndex(index); g.computeVertexNormals(); add(name, g, color, joint);
  }
  function tube(name: string, points: Point[], radius: number, color: Color | string, joint: number, sides = 5) {
    const p: number[] = [], index: number[] = [], tangent = new Vector3(), axis = new Vector3(), cross = new Vector3();
    for (let j = 0; j < points.length; j++) {
      tangent.fromArray(points[Math.min(points.length - 1, j + 1)]).sub(new Vector3().fromArray(points[Math.max(0, j - 1)])).normalize();
      axis.set(0, 0, 1).cross(tangent).normalize(); cross.copy(tangent).cross(axis).normalize();
      for (let k = 0; k < sides; k++) { const a = k / sides * Math.PI * 2; p.push(points[j][0] + radius * (axis.x * Math.cos(a) + cross.x * Math.sin(a)), points[j][1] + radius * (axis.y * Math.cos(a) + cross.y * Math.sin(a)), points[j][2] + radius * (axis.z * Math.cos(a) + cross.z * Math.sin(a))); }
      if (j) for (let k = 0; k < sides; k++) { const a = (j - 1) * sides + k, b = (j - 1) * sides + (k + 1) % sides, c = j * sides + k, e = j * sides + (k + 1) % sides; index.push(a, b, c, b, e, c); }
    }
    const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(p, 3)); g.setIndex(index); g.computeVertexNormals(); add(name, g, color, joint);
  }
  const faceZ = (x: number, y: number) => .235 * Math.sqrt(Math.max(.02, 1 - (x / .267) ** 2 - ((y - 1.18) / .252) ** 2));
  /** A convex colored disc follows the head surface; facial features never float on a flat plane. */
  function patch(name: string, x: number, y: number, rx: number, ry: number, offset: number, color: Color | string, joint: number, segments = 16) {
    const p = [x, y, faceZ(x, y) + offset], index: number[] = [];
    for (let i = 0; i < segments; i++) { const a = i / segments * Math.PI * 2, px = x + Math.cos(a) * rx, py = y + Math.sin(a) * ry; p.push(px, py, faceZ(px, py) + offset); }
    for (let i = 0; i < segments; i++) index.push(0, i + 1, (i + 1) % segments + 1);
    const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(p, 3)); g.setIndex(index); g.computeVertexNormals(); add(name, g, color, joint);
  }

  /** Tapered surface ribbons keep age lines fine and cheap. Their shade is relative
   * to skin, and their head weights stay independent of the blinking eye bones. */
  function faceLine(name: string, points: [number, number][], width: number, color: Color) {
    const positions: number[] = [], indices: number[] = [];
    points.forEach(([x, y], i) => {
      const before = points[Math.max(0, i - 1)], after = points[Math.min(points.length - 1, i + 1)];
      const dx = after[0] - before[0], dy = after[1] - before[1], length = Math.hypot(dx, dy);
      const halfWidth = width * (.22 + .78 * Math.sin(i / (points.length - 1) * Math.PI));
      for (const side of [-1, 1]) {
        const px = x - side * dy / length * halfWidth, py = y + side * dx / length * halfWidth;
        positions.push(px, py, faceZ(px, py) + .0032);
      }
      if (i) { const a = (i - 1) * 2, b = i * 2; indices.push(a, b, a + 1, a + 1, b, b + 1); }
    });
    const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(positions, 3)); g.setIndex(indices); g.computeVertexNormals();
    add(name, g, color, JOINT.head);
  }

  if (gear === 'otter-man') {
    const armor='#718b88', dark='#263d46', copper='#ca9768', muzzle='#e7d2ac', visor='#91d6d3';
    ellipsoid('otter-helmet-shell',[0,1.18,0],[.28,.26,.25],armor,JOINT.head,16,10);
    ellipsoid('otter-headlamp-rim',[0,1.35,.205],[.063,.058,.035],dark,JOINT.head,8,4);
    ellipsoid('otter-headlamp-core',[0,1.35,.237],[.043,.038,.012],'#fff2c4',JOINT.head,8,4);
    ellipsoid('otter-brow-visor',[0,1.23,.22],[.205,.079,.049],dark,JOINT.head,12,6);
    for(const side of [-1,1]) {
      ellipsoid('otter-round-ear',[side*.235,1.395,-.015],[.075,.075,.045],armor,JOINT.head,8,5);
      ellipsoid('otter-ear-inset',[side*.235,1.395,.023],[.044,.044,.015],copper,JOINT.head,8,4);
      ellipsoid('otter-visor-eye',[side*.095,1.229,.265],[.06,.032,.009],visor,side<0?JOINT.leftEye:JOINT.rightEye,8,4);
      ellipsoid('otter-muzzle',[side*.061,1.124,.245],[.09,.059,.05],muzzle,JOINT.head,10,5);
      for(const row of [-1,0,1]) tube('otter-metal-whisker',[[side*.095,1.13+row*.012,.28],[side*.205,1.13+row*.029,.255]],.0035,copper,JOINT.head,3);
    }
    ellipsoid('otter-nose',[0,1.153,.291],[.032,.022,.018],dark,JOINT.head,8,4);
    loft('otter-chest-shell',[[0,.58,0,.15,.105],[0,.72,0,.195,.14],[0,.88,0,.20,.13],[0,.97,0,.075,.065]],armor,JOINT.chest,12);
    ellipsoid('otter-cream-belly',[0,.75,.128],[.137,.16,.035],muzzle,JOINT.chest,10,6);
    ellipsoid('otter-shell-core',[0,.83,.165],[.047,.05,.012],visor,JOINT.chest,10,4);
    loft('otter-hip-shell',[[0,.52,0,.14,.095],[0,.61,0,.16,.11]],dark,JOINT.hips,12);
    // Broad tapered otter tail doubles as a flight stabilizer; fictional equipment design.
    tube('otter-tail',[[0,.57,-.09],[0,.43,-.24],[0,.25,-.36],[0,.17,-.5]],.063,armor,JOINT.hips,6);
    for(const side of [-1,1]) {
      const arm=side<0?JOINT.leftArm:JOINT.rightArm,elbow=side<0?JOINT.leftElbow:JOINT.rightElbow,hand=side<0?JOINT.leftHand:JOINT.rightHand;
      const leg=side<0?JOINT.leftLeg:JOINT.rightLeg,knee=side<0?JOINT.leftKnee:JOINT.rightKnee,foot=side<0?JOINT.leftFoot:JOINT.rightFoot;
      ellipsoid('otter-shoulder-plate',[side*.218,.875,0],[.082,.087,.086],copper,arm,8,5);
      tube('otter-upper-arm',[[side*.217,.855,0],[side*.272,.70,.005]],.055,armor,arm,8);
      tube('otter-gauntlet',[[side*.275,.69,.005],[side*.30,.55,.018]],.062,copper,elbow,8);
      ellipsoid('otter-paw',[side*.30,.515,.026],[.055,.065,.055],dark,hand,8,5);
      loft('otter-wrist-nozzle',[[side*.30,.48,.056,.038,.032],[side*.30,.52,.056,.045,.038]],'#b9d0d0',hand,8);
      ellipsoid('otter-palm-jet',[side*.30,.485,.056],[.026,.025,.015],visor,hand,8,4);
      tube('otter-thigh',[[side*.09,.57,0],[side*.09,.335,.01]],.072,armor,leg,8);
      ellipsoid('otter-knee',[side*.09,.325,.047],[.065,.065,.06],copper,knee,8,5);
      tube('otter-shin',[[side*.09,.31,.01],[side*.09,.12,.035]],.065,armor,knee,8);
      ellipsoid('otter-boot',[side*.09,.06,.083],[.083,.058,.13],dark,foot,10,5);
      loft('otter-boot-nozzle',[[side*.09,.011,.03,.059,.067],[side*.09,.035,.03,.066,.074]],'#b9d0d0',foot,8);
      ellipsoid('otter-sole-jet',[side*.09,.012,.03],[.048,.012,.057],visor,foot,8,4);
      if (thrusters) {
        for (const [x,y,z,length,radius,joint] of [
          [side*.30,.480,.056,.38,.034,side<0?OTTER_JETS.leftHand:OTTER_JETS.rightHand],
          [side*.09,.011,.03,.70,.055,side<0?OTTER_JETS.leftFoot:OTTER_JETS.rightFoot],
        ]) {
          // Bone scaling opens an opaque, faceted plume. No particles or alpha sorting.
          loft('otter-exhaust-plume',[[x,y,z,radius,radius],[x,y-length*.28,z,radius*1.25,radius*1.25],[x,y-length,z,.001,.001]],'#36bded',joint,6);
          loft('otter-hot-core-plume',[[x,y-.008,z,radius*.72,radius*.72],[x,y-length*.20,z,radius*1.30,radius*1.30],[x,y-length*.60,z,.002,.002]],'#d9ffff',joint,6);
        }
      }
      loft('otter-back-turbine',[[side*.105,.65,-.17,.045,.045],[side*.105,.91,-.17,.06,.06]],copper,JOINT.chest,8);
      ellipsoid('otter-turbine-outlet',[side*.105,.646,-.17],[.033,.012,.033],visor,JOINT.chest,8,4);
    }
  } else {
  ellipsoid('head', [0, 1.18, 0], [.267, .252, .235], skin, JOINT.head, 20, 12);
  ellipsoid('neck', [0, .982, 0], [.068, .105, .065], skin, JOINT.chest, 10, 6);
  for (const side of [-1, 1]) {
    ellipsoid('ear', [side * .26, 1.165, -.006], [.049, .067, .047], skin, JOINT.head, 10, 6);
    ellipsoid('inner-ear', [side * .276, 1.165, .027], [.022, .039, .012], blush, JOINT.head, 8, 5);
    patch('cheek', side * .173, 1.128, .035, .018, .003, blush, JOINT.head, 12);
  }
  ellipsoid('nose', [0, 1.163, .234], [.027, .025, .028], skin.clone().lerp(new Color('#c37957'), .22), JOINT.head, 10, 6);
  for (const side of [-1, 1]) {
    const eye = side < 0 ? JOINT.leftEye : JOINT.rightEye, x = side * .095, y = 1.218;
    const height = d.eyeStyle === 'round' ? .054 : d.eyeStyle === 'almond' ? .04 : .028;
    patch('eye-outline', x, y, .047, height + .004, .004, ink, eye);
    patch('eye-white', x, y, .041, height, .006, cream, eye);
    patch('iris', x + side * .002, y - .001, .022, height * .77, .009, d.eyeColor, eye, 12);
    patch('pupil', x + side * .003, y - .001, .011, height * .60, .011, ink, eye, 10);
    patch('eye-glint', x - .008, y + height * .37, .007, .009, .013, '#fffaf0', eye, 8);
    const brow: Point[] = [];
    for (let i = 0; i < 5; i++) { const bx = x + (i / 4 - .5) * .074, by = y + height + .021 + Math.sin(i / 4 * Math.PI) * .007; brow.push([bx, by, faceZ(bx, by) + .007]); }
    tube('brow', brow, .005, hairShade, JOINT.head, 4);
  }
  const mouth: Point[] = [];
  for (let i = 0; i < 9; i++) { const x = (i / 8 - .5) * .095, y = 1.101 + (x / .0475) ** 2 * .022; mouth.push([x, y, faceZ(x, y) + .008]); }
  if (d.mouthStyle === 'grin') patch('grin', 0, 1.111, .043, .018, .007, ink, JOINT.head, 12);
  if (d.mouthStyle === 'grin') patch('teeth', 0, 1.117, .032, .008, .010, cream, JOINT.head, 12);
  tube('smile', mouth, .006, ink, JOINT.head, 5);

  if (d.faceLines !== 'none') {
    const defined = d.faceLines === 'defined', crease = skin.clone().multiplyScalar(defined ? .61 : .77);
    const width = defined ? .0020 : .0015;
    for (const side of [-1, 1]) {
      faceLine('face-line-outer-eye', [[side * .148, 1.218], [side * .160, 1.213], [side * .174, 1.211]], width, crease);
      faceLine('face-line-smile', [[side * .052, 1.150], [side * .061, 1.140], [side * .067, 1.126], [side * .066, 1.115]], width, crease);
      if (defined) {
        faceLine('face-line-outer-eye-upper', [[side * .148, 1.225], [side * .159, 1.232], [side * .173, 1.235]], width * .85, crease);
        const eyeHeight = d.eyeStyle === 'round' ? .054 : d.eyeStyle === 'almond' ? .040 : .028;
        const baseY = 1.218 - eyeHeight;
        faceLine('face-line-under-eye', [[side * .068, baseY - .012], [side * .088, baseY - .017], [side * .110, baseY - .016], [side * .127, baseY - .011]], width * .75, crease);
      }
    }
    if (defined) {
      // Hair can naturally cover these short forehead creases; it is never lifted or reshaped.
      faceLine('face-line-forehead', [[-.045, 1.300], [-.027, 1.303], [-.009, 1.304], [.009, 1.304], [.027, 1.303], [.045, 1.300]], width * .75, crease);
      faceLine('face-line-forehead-upper', [[-.036, 1.316], [-.018, 1.318], [0, 1.319], [.018, 1.318], [.036, 1.316]], width * .60, crease);
    }
  }

  // A dark collar and a rounded hem give each outfit a legible silhouette at game distance.
  const shirtRows: [number, number, number, number, number][] = [[0, .60, 0, .158, .103], [0, .64, 0, .169, .111], [0, .83, 0, .178, .117], [0, .914, 0, .135, .098], [0, .949, 0, .079, .065]];
  loft('top', shirtRows, top, JOINT.chest);
  loft('collar', [[0, .937, 0, .085, .073], [0, .955, 0, .077, .069]], topShade, JOINT.chest);
  loft('shirt-hem', [[0, .600, 0, .161, .106], [0, .625, 0, .170, .113]], topShade, JOINT.chest);
  if (d.topStyle === 'hoodie') {
    ellipsoid('hood', [0, .905, -.081], [.139, .105, .072], topShade, JOINT.chest, 12, 6);
    loft('hoodie-pocket', [[0, .677, .105, .085, .022], [0, .741, .114, .067, .022]], topShade, JOINT.chest, 8);
    for (const side of [-1, 1]) tube('hoodie-cord', [[side * .034, .932, .073], [side * .039, .86, .121]], .005, cream, JOINT.chest, 4);
  }
  if (d.topStyle === 'vest') {
    loft('undershirt', [[0, .889, 0, .129, .105], [0, .954, 0, .073, .068]], cream, JOINT.chest);
    for (const side of [-1, 1]) {
      tube('vest-opening', [[side * .034, .915, .093], [side * .012, .804, .119], [side * .012, .625, .111]], .011, topShade, JOINT.chest, 4);
      ellipsoid('vest-pocket', [side * .095, .74, .113], [.037, .037, .012], topShade, JOINT.chest, 8, 4);
    }
  }
  if (d.topStyle === 'tee') {
    // Original tiny coastal sail emblem, made from vertex color geometry.
    const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute([-.032,.771,.119, .027,.771,.119, .014,.83,.119],3)); g.setIndex([0,1,2]); g.computeVertexNormals(); add('sail-emblem', g, cream, JOINT.chest);
    tube('emblem-wave', [[-.033,.758,.12],[0,.751,.12],[.032,.758,.12]], .004, cream, JOINT.chest,4);
  }
  for (const side of [-1, 1]) {
    const arm = side < 0 ? JOINT.leftArm : JOINT.rightArm, elbow = arm + 1, hand = arm + 2;
    const armWeight: Weight = p => [arm, elbow, smooth((.735 - p.y) / .08)];
    loft('arm', [[side * .30, .555, .015, .047, .046], [side * .294, .60, .012, .050, .050], [side * .277, .69, .004, .055, .055], [side * .247, .793, 0, .068, .063], [side * .198, .89, 0, .074, .067]], d.topStyle === 'hoodie' ? top : skin, armWeight, 10);
    if (d.topStyle !== 'hoodie') loft('short-sleeve', [[side * .248, .775, 0, .071, .068], [side * .22, .856, 0, .078, .071], [side * .198, .895, 0, .080, .074], [side * .166, .928, 0, .059, .058]], d.topStyle === 'vest' ? cream : top, arm, 10);
    ellipsoid('hand', [side * .306, .535, .019], [.058, .071, .055], skin, hand, 10, 6);
    ellipsoid('thumb', [side * .268, .548, .053], [.027, .038, .029], skin, hand, 8, 5);
    const leg = side < 0 ? JOINT.leftLeg : JOINT.rightLeg, knee = leg + 1, foot = leg + 2;
    const legWeight: Weight = p => [leg, knee, smooth((.36 - p.y) / .08)];
    const isPants = d.bottomStyle === 'trousers';
    loft('leg', [[side * .09, .104, .018, .050, .052], [side * .09, .22, .004, .057, .058], [side * .09, .32, .009, .066, .066], [side * .09, .45, 0, .073, .074], [side * .085, .60, 0, .078, .084]], isPants ? bottom : skin, legWeight, 10);
    if (d.bottomStyle === 'shorts') loft('shorts-leg', [[side * .09, .405, 0, .082, .083], [side * .09, .465, 0, .085, .087], [side * .083, .606, 0, .083, .09]], bottom, leg, 10);
    loft('sock', [[side * .09, .11, .016, .054, .055], [side * .09, .168, .011, .054, .056]], cream, knee, 10);
    ellipsoid('shoe', [side * .09, .075, .051], [.071, .075, .116], d.shoeColor, foot, 12, 6);
    ellipsoid('shoe-sole', [side * .09, .027, .053], [.073, .026, .116], '#d2c4a4', foot, 12, 4);
    tube('shoe-lace', [[side * .09 - .034,.126,.073],[side * .09 + .034,.126,.073]], .005, cream, foot,4);
  }
  loft('waist', [[0, .548, 0, .159, .10], [0, .607, 0, .153, .101]], bottom, JOINT.hips,12);
  if (d.bottomStyle === 'skirt') loft('skirt', [[0, .406, 0, .216, .149], [0, .435, 0, .21, .145], [0, .603, 0, .155, .103]], bottom, JOINT.hips,16);

  if (scuba) {
    // Scuba set: mask, strap and regulator on the head; tank, harness and weight belt on the chest;
    // fins on the feet. Proportions suit the toy body rather than a real 80 cu ft cylinder.
    const suit = '#26353c', tank = '#e9b54c', steel = '#9aa9a8', fin = '#2f8fa0';
    ellipsoid('scuba-mask-frame', [0, 1.214, .218], [.168, .078, .052], suit, JOINT.head, 10, 6);
    ellipsoid('scuba-mask-lens', [0, 1.216, .256], [.142, .058, .02], '#8fd0d6', JOINT.head, 10, 5);
    loft('scuba-mask-strap', [[0, 1.203, -.012, .276, .254], [0, 1.227, -.012, .276, .254]], suit, JOINT.head, 16);
    ellipsoid('scuba-regulator', [0, 1.098, .238], [.042, .03, .034], tank, JOINT.head, 8, 4);
    tube('scuba-hose', [[.03, 1.09, .245], [.10, 1.05, .2], [.15, 1.0, .1]], .012, suit, JOINT.head, 4);
    loft('scuba-tank', [[0, .615, -.205, .062, .062], [0, .64, -.205, .084, .084], [0, .875, -.205, .084, .084], [0, .925, -.205, .048, .048]], tank, JOINT.chest, 10);
    ellipsoid('scuba-valve', [0, .955, -.205], [.034, .03, .034], steel, JOINT.chest, 8, 4);
    loft('scuba-harness', [[0, .70, 0, .188, .127], [0, .862, 0, .186, .125]], suit, JOINT.chest, 14);
    loft('scuba-weight-belt', [[0, .553, 0, .168, .111], [0, .587, 0, .168, .111]], suit, JOINT.hips, 14);
    ellipsoid('scuba-belt-buckle', [0, .57, .112], [.03, .02, .01], steel, JOINT.hips, 6, 3);
    for (const side of [-1, 1]) ellipsoid('scuba-fin', [side * .09, .03, .21], [.088, .016, .175], fin, side < 0 ? JOINT.leftFoot : JOINT.rightFoot, 10, 5);
  }
  // The cap's front edge follows a deliberate fringe rather than a second full head sphere.
  // A wetsuit hood replaces the hairstyle: it reads as diving gear and bounds the triangle count.
  const hp: number[] = [], hi: number[] = [], segments = 20, rings = 7;
  for (let row = 0; row <= rings; row++) for (let i = 0; i < segments; i++) {
    const a = i / segments * Math.PI * 2, front = Math.max(0, Math.cos(a));
    let edge = 1.91 - front * .88;
    if (scuba) edge = 2.05 - front * .95;
    else if (d.hairStyle === 'bob') edge = 2.16 - front * 1.08;
    if (!scuba && d.hairStyle === 'sweep') edge += front * (.10 + Math.sin(a) * .23);
    if (!scuba && d.hairStyle === 'crop') edge += front * Math.cos(a * 5) * .065;
    const t = row / rings * edge;
    const bump = 1 + .013 * Math.cos(a * 7) * Math.sin(t);
    hp.push(Math.sin(a) * Math.sin(t) * .278 * bump, 1.18 + Math.cos(t) * .267, -.01 + Math.cos(a) * Math.sin(t) * .248 * bump);
    if (row) { const prev = (row - 1) * segments + i, prevNext = (row - 1) * segments + (i + 1) % segments, curr = row * segments + i, currNext = row * segments + (i + 1) % segments; hi.push(prev, curr, prevNext, prevNext, curr, currNext); }
  }
  const cap = new BufferGeometry(); cap.setAttribute('position',new Float32BufferAttribute(hp,3));cap.setIndex(hi);cap.computeVertexNormals();
  add(scuba ? 'scuba-hood' : 'hair-cap', cap, scuba ? topShade : hair, JOINT.head);
  if (!scuba) {
    if (d.hairStyle === 'sweep' || d.hairStyle === 'crop') {
      const g = new SphereGeometry(1,12,7);g.scale(.16,.071,.07);g.rotateZ(-.36);g.translate(-.07,1.365,.16);add('swept-fringe',g,hair,JOINT.head);
    }
    if (d.hairStyle === 'bob') for (const side of [-1,1]) {
      ellipsoid('bob-side',[side*.245,1.155,-.045],[.066,.166,.152],hair,JOINT.head,10,7);
      const g=new SphereGeometry(1,10,6);g.scale(.11,.062,.07);g.rotateZ(side*.36);g.translate(side*.085,1.365,.17);add('bob-fringe',g,hair,JOINT.head);
    }
    if (d.hairStyle === 'curls') {
      for(let i=0;i<10;i++){const a=i/10*Math.PI*2;ellipsoid('curl',[Math.sin(a)*.226,1.32+Math.cos(a)*.025,-.012+Math.cos(a)*.18],[.091,.086,.088],i%3===0?hairShade:hair,JOINT.head,8,5);}
      ellipsoid('crown-curl',[-.025,1.434,-.008],[.134,.069,.127],hair,JOINT.head,10,5);
    }
    if (d.hairStyle === 'bun') {
      ellipsoid('bun',[0,1.408,-.176],[.127,.116,.103],hair,JOINT.head,12,8);
      ellipsoid('hair-tie',[0,1.363,-.171],[.117,.025,.09],top,JOINT.head,12,4);
      for(const side of [-1,1])ellipsoid('front-lock',[side*.22,1.215,.07],[.035,.11,.056],hair,JOINT.head,8,5);
    }
  }
  } // ordinary appearance / scuba
  const merged = mergeGeometries(parts)!; parts.forEach(g=>g.dispose());
  const geometry = mergeVertices(merged, 1e-6); merged.dispose();
  const dimensions = getAvatarDimensions(d);
  if (dimensions.heightScale !== 1 || dimensions.bodyBuild !== 1) {
    // Bake size after welding so vertex/index counts stay identical for every size.
    // Use the inverse-transpose of the width taper's Jacobian for smooth, correct lighting.
    const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal'), joints = geometry.getAttribute('skinIndex');
    const normal = new Vector3();
    for (let i = 0; i < p.count; i++) {
      point.fromBufferAttribute(p, i); normal.fromBufferAttribute(n, i);
      const joint = joints.getX(i), head = joint === JOINT.head || joint === JOINT.leftEye || joint === JOINT.rightEye;
      if (!head && dimensions.bodyBuild !== 1) {
        const width = avatarWidthAtHeight(point.y, dimensions.bodyBuild), slope = avatarWidthSlope(point.y, dimensions.bodyBuild);
        normal.set(normal.x / width, normal.y - slope * (point.x * normal.x + point.z * normal.z) / width, normal.z / width).normalize();
      }
      sizeAvatarPoint(point, dimensions, head);
      p.setXYZ(i, point.x, point.y, point.z); n.setXYZ(i, normal.x, normal.y, normal.z);
    }
  }
  geometry.name = 'avatar:vertex-painted-skin'; geometry.computeBoundingBox();geometry.computeBoundingSphere();
  geometry.userData.sourceParts = names;
  return geometry;
}
