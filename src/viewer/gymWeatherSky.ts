import { BackSide, Color, DoubleSide, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, PlaneGeometry, SphereGeometry, Vector2, Vector3 } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { abs, asin, atan, attribute, cameraWorldMatrix, clamp, cos, dot, exp, float, floor, fract, fwidth, length, max, mix, normalize, positionLocal, pow, select, sin, smoothstep, sqrt, step, uniform, uv, varying, vec2, vec3, vec4 } from 'three/tsl';
import { STYLE } from '../models/shared/style';
import { mulberry32 } from '../models/shared/random';

// TSL arithmetic includes vector/scalar promotions that the declarations cannot fully express.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any;
type Direction = Readonly<{ x: number; y: number; z: number }>;
export interface GymWeatherSkyFrame {
  /** Animation seconds, independently of the astronomical clock. */
  time: number;
  /** Unit directions from the observer: +X east, +Y up, +Z south. */
  sunDirection: Direction;
  moonDirection: Direction;
  daylight: number;
  cloudCover: number;
  rain: number;
  /** Horizontal east/south velocity in metres per second. */
  wind: Readonly<{ x: number; y: number }>;
  cameraPosition: Direction;
  /** Radians; rotates the illustrative star field with the local sidereal sky. */
  siderealTime?: number;
  reducedMotion?: boolean;
  underwater?: boolean;
}

const hash = (p: N) => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453));
function noise(p: N): N {
  const cell = floor(p), f0 = fract(p), f = f0.mul(f0).mul(vec2(3).sub(f0.mul(2)));
  return mix(mix(hash(cell), hash(cell.add(vec2(1, 0))), f.x), mix(hash(cell.add(vec2(0, 1))), hash(cell.add(vec2(1, 1))), f.x), f.y);
}
/** Four broad, softly overlapping scales give billows without a repeated stripe texture. */
function billows(p: N): N {
  return noise(p).mul(.57).add(noise(p.mul(2.13).add(vec2(5.2, 1.3))).mul(.27))
    .add(noise(p.mul(4.37).add(vec2(2.7, 8.1))).mul(.12)).add(noise(p.mul(8.71)).mul(.04));
}
const bounded = (value: number, fallback = 0) => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;

/**
 * Camera-centred weather atmosphere: one opaque TSL dome and one optional rain draw.
 * Clouds, celestial disks and seeded stars are evaluated in the dome shader. No textures,
 * transparent cloud cards, shadow passes or per-frame geometry/instance uploads are needed.
 * Directions and phase are supplied by astronomy; celestial disk sizes are gently enlarged
 * for the workbench's stylized art. Stars are illustrative rather than a star catalogue.
 */
export function createGymWeatherSky({ seed = 62917, radius = 450, tier = 'standard' }: { seed?: number; radius?: number; tier?: 'base' | 'standard' } = {}) {
  const rainCount = tier === 'base' ? 160 : 240;
  const root = new Group(); root.name = 'Testing Gym weather sky'; root.userData.seed = seed;
  const rainRoot = new Group(); rainRoot.name = 'Camera rain volume'; root.add(rainRoot);
  const u = {
    time: uniform(0), daylight: uniform(1), cover: uniform(.3), rain: uniform(0),
    wind: uniform(new Vector2()), sun: uniform(STYLE.sun.direction.clone()), moon: uniform(new Vector3(0, .5, -.866)),
    moonRight: uniform(new Vector3(1, 0, 0)), moonUp: uniform(new Vector3(0, .866, .5)), siderealTime: uniform(0),
    seed: uniform((seed >>> 0) % 8192),
    zenith: uniform(STYLE.dome.zenith.clone()), horizon: uniform(STYLE.dome.horizon.clone()),
    cloudLight: uniform(new Color('#fff8e9')), cloudShadow: uniform(new Color('#758ba6')),
    nightZenith: uniform(new Color('#081123')), nightHorizon: uniform(new Color('#25374a')),
    moonTint: uniform(new Color('#f4efd8')),
  };
  const geometry = new SphereGeometry(radius, 24, 12);
  const material = new MeshBasicNodeMaterial({ name: 'Procedural weather atmosphere', side: BackSide, depthTest: false, depthWrite: false, fog: false });
  function sampleSky(direction:N):N {
  const d = normalize(direction), day = clamp(u.daylight, 0, 1), night = float(1).sub(day);
  const up = clamp(d.y, 0, 1), skyGradient = pow(up, .55);
  const daySky = mix(u.horizon, u.zenith, skyGradient);
  const nightSky = mix(u.nightHorizon, u.nightZenith, pow(up, .35));
  const sunDot = clamp(dot(d, u.sun), -1, 1);
  const horizonGlow = exp(abs(d.y).mul(-5)).mul(pow(max(sunDot, 0), 4));
  const twilight = smoothstep(-.22, -.01, u.sun.y).mul(float(1).sub(smoothstep(.03, .30, u.sun.y)));
  let sky: N = mix(nightSky, daySky, day).add(vec3(.45, .15, .055).mul(horizonGlow).mul(twilight));
  // Rain softens saturation and dims the high sky into a marine-grey ceiling.
  sky = mix(sky, mix(vec3(.035, .05, .075), vec3(.31, .37, .40), day), u.rain.mul(.55));

  // Broad rounded cumulus clusters are composed in angular sky space. Unlike a flat
  // cloud plane, their tops keep height and rounded silhouettes as they approach the horizon.
  const longitude = atan(d.x, d.z), elevation = asin(clamp(d.y, -.9999, .9999));
  const angularFlow = u.time.mul(u.wind.x.mul(.7).add(u.wind.y.mul(.3))).mul(.00035);
  const cloudUV = vec2(longitude.mul(18 / (Math.PI * 2)).sub(angularFlow), elevation.mul(3.65));
  const cloudCell = floor(cloudUV), cloudFraction = fract(cloudUV);
  let cumulusMask: N = float(0), cumulusPaint: N = float(0);
  for (let cy = -1; cy <= 1; cy++) for (let cx = -1; cx <= 1; cx++) {
    const cell = cloudCell.add(vec2(cx, cy));
    // Eighteen cells wrap exactly around the azimuth seam; the seed changes grouping.
    const id = vec2(fract(cell.x.div(18)).mul(18), cell.y).add(u.seed.mul(.031));
    const r1 = hash(id), r2 = hash(id.add(vec2(4.1, 9.2))), r3 = hash(id.add(vec2(8.7, 3.4)));
    const q = cloudFraction.sub(vec2(cx, cy)).sub(vec2(r1.mul(.4).add(.3), r2.mul(.28).add(.34)));
    const size = r3.mul(.45).add(.65).mul(mix(float(.62), float(1), smoothstep(.2, 1.4, cell.y)));
    const x = q.x.div(size), y = q.y.div(size);
    // Unequal rounded caps vary per cluster, avoiding a repeated three-lobed cloud icon.
    const base = float(1).sub(pow(x.div(r1.mul(.12).add(.42)), 2).add(pow(y.add(.055).div(.12), 2)));
    const left = float(1).sub(pow(x.add(.26).div(r2.mul(.06).add(.18)), 2).add(pow(y.sub(.045).div(r1.mul(.06).add(.17)), 2)));
    const middle = float(1).sub(pow(x.add(r1.mul(.12).sub(.05)).div(r1.mul(.07).add(.22)), 2).add(pow(y.sub(r2.mul(.09).add(.13)).div(r2.mul(.07).add(.23)), 2)));
    const right = float(1).sub(pow(x.sub(.255).div(r3.mul(.08).add(.17)), 2).add(pow(y.sub(.035).div(r1.mul(.06).add(.16)), 2)));
    const shoulder = float(1).sub(pow(x.add(.405).div(.14), 2).add(pow(y.add(.025).div(.115), 2)));
    const cap = float(1).sub(pow(x.sub(.15).div(.16), 2).add(pow(y.sub(r1.mul(.15).add(.16)).div(.16), 2)));
    const silhouette = max(max(max(base, shoulder), left), max(max(middle, cap), right))
      .add(noise(vec2(x, y).mul(6).add(id)).sub(.5).mul(.14));
    // Bound derivative AA at cell edges: unbounded derivatives can draw faint grid seams.
    const edge = clamp(fwidth(silhouette).mul(.7), .045, .18);
    const presence = smoothstep(float(1).sub(u.cover.mul(.95)).sub(.08), float(1).sub(u.cover.mul(.95)).add(.08), hash(id.add(vec2(1.8, 5.6))));
    const mask = smoothstep(edge.negate(), edge, silhouette).mul(presence);
    const topLight = smoothstep(-.09, .28, y);
    const rim = float(1).sub(smoothstep(0, .45, silhouette)).mul(topLight);
    const tone = clamp(topLight.mul(.68).add(.14).add(rim.mul(.10)).add(noise(vec2(x, y).mul(2.4).add(id)).mul(.05)), 0, 1);
    cumulusMask = cumulusMask.add(mask); cumulusPaint = cumulusPaint.add(mask.mul(tone));
  }
  const visibleCloud = smoothstep(.004, .055, d.y).mul(float(1).sub(smoothstep(.88, .995, d.y)));
  const cumulusTone = cumulusPaint.div(max(cumulusMask, .001));
  cumulusMask = clamp(cumulusMask, 0, 1).mul(visibleCloud).mul(smoothstep(0, .10, u.cover));

  // Thick cover joins the scattered shapes into a continuous marine layer. Its broad
  // variation stays soft, without a spray of tiny high-frequency fragments near the horizon.
  const deckUV = d.xz.div(max(d.y.add(.35), .25)).mul(1.65).sub(u.wind.mul(u.time).mul(.00018))
    .add(vec2(u.seed.mul(.013), u.seed.mul(.021)));
  const deckShape = billows(deckUV);
  const deckMask = smoothstep(.24, .43, deckShape).mul(smoothstep(.005, .06, d.y));
  const deckTone = smoothstep(.25, .72, deckShape).mul(.5).add(.23);
  const overcast = smoothstep(.65, 1, u.cover);
  const cloudMask = mix(cumulusMask, max(deckMask, float(.97).mul(smoothstep(.005, .06, d.y))), overcast);
  const cloudTone = mix(cumulusTone, deckTone, overcast);
  const brightCloud = mix(mix(u.cloudShadow, u.cloudLight, cloudTone), vec3(.20, .26, .32), u.rain.mul(.45));
  let cloudColor: N = mix(vec3(.013, .022, .040), brightCloud, day);
  const silver = pow(max(sunDot, 0), 10).mul(cloudTone).mul(.24);
  cloudColor = cloudColor.add(vec3(.35, .29, .18).mul(silver).mul(day).mul(float(1).sub(u.rain.mul(.75))));

  // A seeded, stable field in equatorial coordinates. Local sidereal rotation moves it
  // around the celestial pole; it is not a claim to reproduce named constellations.
  const latitude = 36.6265 * Math.PI / 180;
  const meridian = d.y.mul(Math.cos(latitude)).add(d.z.mul(Math.sin(latitude)));
  const polar = d.y.mul(Math.sin(latitude)).sub(d.z.mul(Math.cos(latitude)));
  const equatorial = vec3(meridian.mul(cos(u.siderealTime)).sub(d.x.mul(sin(u.siderealTime))),
    meridian.mul(sin(u.siderealTime)).add(d.x.mul(cos(u.siderealTime))), polar);
  // Cube-face coordinates keep the points evenly shaped around the celestial pole;
  // equirectangular cells would pinch into a conspicuous radial pattern there.
  const e = abs(equatorial), faceX = e.x.greaterThan(max(e.y, e.z)), faceY = e.y.greaterThan(e.z);
  const faceUV = select(faceX, equatorial.yz.div(max(e.x, .001)), select(faceY, equatorial.xz.div(max(e.y, .001)), equatorial.xy.div(max(e.z, .001))));
  const face = select(faceX, step(0, equatorial.x), select(faceY, step(0, equatorial.y).add(2), step(0, equatorial.z).add(4)));
  const starUV = faceUV.mul(150).add(vec2(face.mul(503), 0));
  const starCell = floor(starUV), starPoint = fract(starUV).sub(vec2(hash(starCell.add(u.seed)), hash(starCell.add(u.seed).add(vec2(4.8, 7.1)))));
  const starRandom = hash(starCell.add(u.seed).add(vec2(9.4, 2.7)));
  const starSize = mix(float(.06), float(.16), pow(starRandom, 14));
  const starDistance = length(starPoint), starAA = clamp(length(fwidth(starUV)), .02, 1);
  const star = exp(pow(starDistance.div(max(starSize, starAA.mul(.45))), 2).mul(-2));
  const starDensity = step(.997, starRandom).mul(smoothstep(.025, .22, d.y)).mul(pow(night, 3));
  sky = sky.add(mix(vec3(.62, .76, 1), vec3(1, .83, .60), hash(starCell)).mul(star).mul(starDensity).mul(.9));

  // Disks are placed at the supplied observer directions, independently of camera heading.
  const sunRadius = .008, sunEdge = max(fwidth(sunDot), .000004);
  const sunDisk = smoothstep(float(Math.cos(sunRadius)).sub(sunEdge), float(Math.cos(sunRadius)).add(sunEdge), sunDot);
  const sunVisible = smoothstep(-.025, .006, u.sun.y);
  const sunHalo = exp(float(1).sub(sunDot).mul(-110)).mul(.26);
  sky = sky.add(mix(vec3(1, .29, .075), vec3(1, .84, .52), smoothstep(0, .3, u.sun.y))
    .mul(sunDisk.mul(1.6).add(sunHalo)).mul(sunVisible));

  const moonRadius = .011, moonDot = dot(d, u.moon);
  const moonUV = vec2(dot(d, u.moonRight), dot(d, u.moonUp)).div(moonRadius);
  const moonR2 = dot(moonUV, moonUV), moonR = sqrt(max(moonR2, 0)), moonAA = max(fwidth(moonR), .02);
  const moonMask = float(1).sub(smoothstep(float(1).sub(moonAA), float(1).add(moonAA), moonR))
    .mul(step(.99, moonDot)).mul(smoothstep(-.02, .012, u.moon.y));
  // Sphere normal faces the observer at the centre (-moon direction). Dotting it with the
  // actual Sun direction produces full/new/crescent/gibbous phases and the correct tilt.
  const moonNormal = u.moonRight.mul(moonUV.x).add(u.moonUp.mul(moonUV.y)).sub(u.moon.mul(sqrt(max(float(1).sub(moonR2), 0))));
  const moonLight = smoothstep(-.035, .035, dot(moonNormal, u.sun));
  const craters = noise(moonUV.mul(5.3).add(19)).mul(.12).add(noise(moonUV.mul(11).sub(8)).mul(.035));
  const moonSurface = mix(mix(vec3(.009, .014, .022), sky, day), u.moonTint.mul(float(.91).sub(craters)), moonLight);
  sky = mix(sky, moonSurface, moonMask.mul(float(1).sub(day.mul(.52))));
  sky = mix(sky, cloudColor, cloudMask);
  // Cloud shadowing also veils the disk/glow and stars; overcast really closes the sky.
  sky = mix(sky, mix(u.nightHorizon, u.horizon, day), float(1).sub(smoothstep(-.17, .08, d.y)).mul(.55));
    return sky;
  }
  const day=clamp(u.daylight,0,1);
  material.colorNode = vec4(sampleSky(positionLocal), 1);
  material.userData.styleBase = material.colorNode; material.userData.rim = false;
  const dome = new Mesh(geometry, material); dome.name = 'Weather sky dome'; dome.renderOrder = -10; dome.frustumCulled = false;
  root.add(dome);

  // One instanced, two-triangle streak per drop. Matrices and random attributes are uploaded
  // once. Shader wrapping and camera-following keep the effect bounded around the observer.
  const rainGeometry = new PlaneGeometry(1, 1), rng = mulberry32(seed ^ 0x19435), seeds = new Float32Array(rainCount * 4);
  for (let i = 0; i < seeds.length; i++) seeds[i] = rng();
  rainGeometry.setAttribute('weatherDrop', new InstancedBufferAttribute(seeds, 4));
  const rainMaterial = new MeshBasicNodeMaterial({ name: 'Weather rain streaks', side: DoubleSide, transparent: true, depthWrite: false, fog: false });
  rainMaterial.forceSinglePass = true;
  const seedNode = attribute('weatherDrop', 'vec4');
  const speed = seedNode.w.mul(.5).add(.7), fall = fract(seedNode.y.sub(u.time.mul(speed)));
  const centre = vec3(fract(seedNode.x.add(u.wind.x.mul(u.time).mul(.002))).sub(.5).mul(26), fall.mul(20).sub(7),
    fract(seedNode.z.add(u.wind.y.mul(u.time).mul(.002))).sub(.5).mul(26));
  const cameraRight = normalize(vec3(cameraWorldMatrix.element(float(0)).x, 0, cameraWorldMatrix.element(float(0)).z));
  const dropLength = seedNode.w.mul(.4).add(.28), dropWidth = seedNode.w.mul(.012).add(.012);
  const rainPosition = centre.add(cameraRight.mul(positionLocal.x).mul(dropWidth))
    .add(vec3(u.wind.x.mul(-.04), 1, u.wind.y.mul(-.04)).mul(positionLocal.y).mul(dropLength));
  rainMaterial.positionNode = rainPosition;
  const rainDistance = varying(length(centre), 'weatherRainDistance');
  const rainAlpha = float(1).sub(smoothstep(6, 16, rainDistance)).mul(smoothstep(.04, .22, uv().y)).mul(float(1).sub(smoothstep(.75, 1, uv().y)))
    .mul(u.rain).mul(.43);
  rainMaterial.colorNode = vec4(mix(vec3(.18, .26, .38), vec3(.66, .76, .81), day), rainAlpha);
  rainMaterial.userData.styleBase = rainMaterial.colorNode; rainMaterial.userData.rim = false;
  const rain = new InstancedMesh(rainGeometry, rainMaterial, rainCount), identity = new Matrix4();
  for (let i = 0; i < rainCount; i++) rain.setMatrixAt(i, identity);
  rain.instanceMatrix.needsUpdate = true; rain.name = 'Instanced weather rain'; rain.frustumCulled = false; rain.renderOrder = 4;
  rain.visible = false; rainRoot.add(rain);
  const basisUp = new Vector3(0, 1, 0);
  const colors = { zenith: STYLE.dome.zenith.clone(), horizon: STYLE.dome.horizon.clone() };
  const rainColor = new Color(), rainNight = new Color().setRGB(.035, .05, .075), rainDay = new Color().setRGB(.31, .37, .40);
  let disposed = false;
  return { root, dome, rainRoot, rain, uniforms: u, colors, sampleSky,
    budget: { skyTriangles: geometry.index!.count / 3, rainTriangles: rainCount * 2, maxDraws: 2, textures: 0, seed },
    update(frame: GymWeatherSkyFrame) {
      if (disposed) return;
      root.position.copy(frame.cameraPosition); root.visible = !frame.underwater;
      u.time.value = frame.reducedMotion ? 0 : Number.isFinite(frame.time) ? frame.time : 0;
      u.daylight.value = bounded(frame.daylight, 1); u.cover.value = bounded(frame.cloudCover); u.rain.value = bounded(frame.rain);
      rainColor.copy(rainNight).lerp(rainDay, u.daylight.value);
      colors.zenith.copy(u.nightZenith.value).lerp(u.zenith.value, u.daylight.value).lerp(rainColor, u.rain.value * .55);
      colors.horizon.copy(u.nightHorizon.value).lerp(u.horizon.value, u.daylight.value).lerp(rainColor, u.rain.value * .55);
      u.wind.value.set(Number.isFinite(frame.wind.x) ? frame.wind.x : 0, Number.isFinite(frame.wind.y) ? frame.wind.y : 0);
      u.sun.value.copy(frame.sunDirection).normalize(); u.moon.value.copy(frame.moonDirection).normalize();
      u.moonRight.value.crossVectors(u.moon.value, basisUp);
      if (u.moonRight.value.lengthSq() < .000001) u.moonRight.value.set(1, 0, 0);
      else u.moonRight.value.normalize();
      u.moonUp.value.crossVectors(u.moonRight.value, u.moon.value).normalize();
      u.siderealTime.value = Number.isFinite(frame.siderealTime) ? frame.siderealTime! : 0;
      rain.visible = u.rain.value > .002 && !frame.reducedMotion && !frame.underwater;
    },
    dispose() { if (disposed) return; disposed = true; root.removeFromParent(); geometry.dispose(); material.dispose(); rain.dispose(); rainGeometry.dispose(); rainMaterial.dispose(); },
  };
}
