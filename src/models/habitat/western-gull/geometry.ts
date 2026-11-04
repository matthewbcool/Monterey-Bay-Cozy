import { BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, Matrix4, Quaternion, ShapeUtils, SphereGeometry, Uint16BufferAttribute, Vector2, Vector3 } from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../../shared/random';
import type { LodLevel } from '../../shared/lod/geometry';
import { gullDimensions, type GullSex } from './definition';
import { buildGullBody } from './body';

type Point = [number, number, number];
const MALE_PAINT = { white: '#deddd1', underside: '#c8c9bf', slate: '#657078', tip: '#333c43', bill: '#d3aa4e', red: '#ad513f', leg: '#c29c8d', eye: '#242c2d' };

// User-requested visual distinction; a stylized palette, not sex-identification plumage.
const FEMALE_PAINT = {...MALE_PAINT,white:'#eee2cc',underside:'#d4c7c5',slate:'#93849f',tip:'#51465f',leg:'#cca298'};

/** Meaningful source components merge into one indexed matte skin. No feathers,
 * image textures, outlines, transparent layers or per-frame geometry changes. */
export function buildGullGeometry({ sex, seed, detail }: { sex: GullSex; seed: number; detail: LodLevel }) {
  const PAINT=sex==='female'?FEMALE_PAINT:MALE_PAINT;
  const { scale } = gullDimensions(sex), random = mulberry32(seed);
  const parts: BufferGeometry[] = [], near = detail === 'near', far = detail === 'far';
  const mantle = new Color(PAINT.slate).multiplyScalar(.96 + random() * .08);
  function add(g: BufferGeometry, joint: number, color: string | Color, pigment?: (p: Vector3) => Color) {
    g.deleteAttribute('uv'); const p = g.getAttribute('position'), colors: number[] = [], indices: number[] = [], weights: number[] = [], v = new Vector3();
    const base = new Color(color);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i); const c = pigment ? pigment(v) : base;
      colors.push(c.r, c.g, c.b); indices.push(joint, 0, 0, 0); weights.push(1, 0, 0, 0);
    }
    g.setAttribute('color', new Float32BufferAttribute(colors, 3));
    g.setAttribute('skinIndex', new Uint16BufferAttribute(indices, 4));
    g.setAttribute('skinWeight', new Float32BufferAttribute(weights, 4)); parts.push(g);
  }
  function ellipsoid(center: Point, radius: Point, joint: number, color: string | Color, segments: number, rings: number, pigment?: (p: Vector3) => Color) {
    const g = new SphereGeometry(1, segments, rings); g.scale(...radius); g.translate(...center); add(g, joint, color, pigment);
  }
  function triangles(points: Point[], faces: number[][], joint: number, color: string | Color) {
    const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(points.flat(), 3));
    g.setIndex(faces.flat()); g.computeVertexNormals(); add(g, joint, color);
  }
  function sheet(points: Point[], joint: number, top: string | Color, bottom = PAINT.underside, holes: Point[][] = []) {
    // Separate upper/lower vertices keep the dorsal pigment distinct; opaque,
    // single-sided triangles render correctly from below without a second pass.
    const all = [...points,...holes.flat()];
    const faces = ShapeUtils.triangulateShape(points.map(p=>new Vector2(p[0],p[2])),holes.map(h=>h.map(p=>new Vector2(p[0],p[2]))));
    for(const f of faces) {
      const a=new Vector3(...all[f[0]]),b=new Vector3(...all[f[1]]),c=new Vector3(...all[f[2]]);
      if(b.sub(a).cross(c.sub(a)).y<0)f.reverse();
    }
    triangles(all, faces, joint, top); triangles(all, faces.map(f => [...f].reverse()), joint, bottom);
  }
  function rod(a: Point, b: Point, radius: number, joint: number) {
    const start = new Vector3(...a), end = new Vector3(...b), delta = end.clone().sub(start);
    const g = new CylinderGeometry(radius, radius * .9, delta.length(), near ? 5 : 3, 1, true);
    g.applyMatrix4(new Matrix4().compose(start.add(end).multiplyScalar(.5), new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), delta.normalize()), new Vector3(1, 1, 1)));
    add(g, joint, PAINT.leg);
  }
  if (far) {
    // Eight-triangle body diamond includes the head/bill silhouette. No tiny anatomy.
    triangles([[0,.33,-.36],[0,.31,.24],[-.08,.30,0],[0,.43,-.04],[.08,.30,0],[0,.22,0]],
      [[0,2,3],[0,3,4],[0,4,5],[0,5,2],[1,3,2],[1,4,3],[1,5,4],[1,2,5]],0,PAINT.white);
  } else {
    const white = new Color(PAINT.white);
    const body=buildGullBody(near);
    add(body,0,PAINT.white,p=>p.y>.335&&p.z>-.085?mantle:white);
    const bodyPosition=body.getAttribute('position'),bodyJoints=body.getAttribute('skinIndex');
    for(let i=0;i<bodyPosition.count;i++)if(bodyPosition.getZ(i)<-.19)bodyJoints.setX(i,8);
    // A blunt heavy bill with a slight downturned tip, not a needle cone.
    triangles([[-.025,.414,-.263],[.025,.414,-.263],[-.020,.451,-.263],[.020,.451,-.263],[-.009,.424,-.36],[.009,.424,-.36],[0,.409,-.352]],
      [[0,1,3],[0,3,2],[2,3,5],[2,5,4],[0,2,4],[0,4,6],[1,6,5],[1,5,3],[4,5,6],[0,6,1]],8,PAINT.bill);
    if (near) for (const s of [-1,1]) {
      ellipsoid([s*.058,.44,-.239],[.005,.009,.009],8,PAINT.eye,5,3);
      triangles([[s*.016,.417,-.326],[s*.019,.423,-.31],[s*.015,.428,-.328]],[[0,s<0?1:2,s<0?2:1]],8,PAINT.red);
    }
  }
  for (const s of [-1,1]) {
    const shoulder = s < 0 ? 1 : 2, wrist = s < 0 ? 3 : 4, leg = s < 0 ? 5 : 6;
    const p = (x: number, z: number): Point => [s*x,.34,z];
    // Swept elbow, short wrist and pointed primaries carry the gull silhouette.
    if (far) {
      sheet([p(.05,-.055),p(.365,-.005),p(.34,.145),p(.055,.13)],shoulder,mantle);
      sheet([p(.365,-.005),p(.685,.065),p(.34,.145)],wrist,PAINT.tip,PAINT.tip);
      // Tiny tapered leg/foot silhouette for distant perched birds. Sky
      // instancing removes these eight triangles entirely at construction.
      triangles([[s*.052,.23,.025],[s*.044,.006,-.04],[s*.060,.006,-.04],[s*.052,.006,.025]],
        [[0,1,2],[0,2,3],[0,3,1],[1,3,2]],leg,PAINT.leg);
    } else {
      sheet([p(.05,-.055),p(.21,-.085),p(.365,-.005),p(.34,.145),p(.16,.145),p(.055,.10)],shoulder,mantle);
      sheet([p(.055,.10),p(.16,.145),p(.34,.145),p(.33,.162),p(.16,.16)],shoulder,PAINT.white);
      sheet([p(.365,-.005),p(.53,.008),p(.51,.11),p(.34,.145)],wrist,mantle);
      const mirror = [p(.623,.055),p(.641,.062),p(.620,.077)];
      sheet([p(.53,.008),p(.685,.065),p(.59,.113),p(.51,.11)],wrist,PAINT.tip,PAINT.tip,near?[mirror]:[]);
      // Paint partitions share edges, never coplanar overlays: no depth flicker.
      if (near) sheet(mirror,wrist,PAINT.white,PAINT.white);
      rod([s*.052,.23,.025],[s*.052,.12,.045],.009,leg);
      rod([s*.052,.12,.045],[s*.052,.018,.018],.007,leg);
      sheet([[s*.052,.015,.03],[s*.023,.006,-.052],[s*.052,.006,-.04],[s*.083,.006,-.052]],leg,PAINT.leg,PAINT.leg);
    }
  }
  sheet([[-.046,.30,.18],[.046,.30,.18],[.070,.29,.29],[-.070,.29,.29]],7,PAINT.white);
  if (!far) {
    // One reusable eight-triangle droplet in the same draw, scaled to zero at rest.
    const [x,y,z]=[0,.23,.20], r=.011;
    triangles([[x,y+r,z],[x+r,y,z],[x,y,z+r],[x-r,y,z],[x,y,z-r],[x,y-r*1.8,z]],
      [[0,2,1],[0,3,2],[0,4,3],[0,1,4],[5,1,2],[5,2,3],[5,3,4],[5,4,1]],9,PAINT.white);
  }
  const merged = mergeGeometries(parts)!; parts.forEach(p=>p.dispose());
  const result = mergeVertices(merged,1e-7); merged.dispose(); result.scale(scale,scale,scale);
  result.name = `western-gull-${sex}-${detail}`;
  result.computeBoundingBox(); result.computeBoundingSphere(); return result;
}
