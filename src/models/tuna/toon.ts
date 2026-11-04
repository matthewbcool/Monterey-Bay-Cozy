import { Color, Matrix3, Matrix4, Vector3 } from 'three';
import { MeshBasicNodeMaterial, type Node } from 'three/webgpu';
import { attribute, clamp, cos, float, mix, modelWorldMatrix, nodeObject, normalLocal, positionLocal, pow, select, sin, uniform, uniformArray, varying, vec3, vec4, transformNormalToView } from 'three/tsl';
import { STYLE } from '../shared/style';
import { paintedFishLight } from '../shared/fish/paintedLight';

type Uniform<T> = ReturnType<typeof uniform<T>>;
/** Per-fish swim state shared by every tuna material, so one write moves the whole body. */
export interface TunaSwimUniforms { swimPhase: Uniform<number>; swimBlend: Uniform<number>; swimActive: Uniform<number> }
export function createSwimUniforms(): TunaSwimUniforms {
  return { swimPhase: uniform(0), swimBlend: uniform(0), swimActive: uniform(1) };
}

interface CelOptions { color: Color | string; vertexColors: boolean; matte: boolean; bend: boolean; swim: TunaSwimUniforms; batched?:{transforms:Matrix4[];normals:Matrix3[]} }

/**
 * TSL port of the former GLSL painted-cel shader (same wave, same two bands), so it runs on
 * WebGPURenderer's native WebGPU and WebGL 2 backends. `uniforms` keeps the old `.value` API.
 */
export class TunaCelMaterial extends MeshBasicNodeMaterial {
  readonly uniforms: TunaSwimUniforms & { baseColor: Uniform<Color>; keyDirection: Uniform<Vector3>; shadowTint: Uniform<Color>; matte: Uniform<number>; bendEnabled: Uniform<number> };
  private readonly options: CelOptions;
  constructor(options: CelOptions) {
    super({ name: options.matte ? 'painted-matte-fin' : 'painted-cel', fog: false });
    this.options = options;
    const { swim } = options;
    const u = this.uniforms = {
      ...swim,
      baseColor: uniform(new Color(options.color)), keyDirection: uniform(STYLE.sun.direction.clone()),
      shadowTint: uniform(new Color('#638b9b')), matte: uniform(options.matte ? 1 : 0), bendEnabled: uniform(options.bend ? 1 : 0),
    };
    // Same wave and derivative as motion.ts, evaluated on static GPU buffers. Only bent
    // materials build the wave, so hinged fins and the caught face skip that vertex work.
    let normal: Node = normalLocal;
    if (options.bend) {
      const x = positionLocal.x, active = u.swimActive;
      const t = clamp(x.add(3.15).div(6), 0, 1);
      const amplitude = mix(float(.24), float(.43), u.swimBlend);
      const envelope = float(.007).mul(float(1).sub(u.swimBlend.mul(.6))).add(amplitude.mul(pow(t, 3.5)));
      const angle = u.swimPhase.sub(t.mul(3.4));
      const inside = x.greaterThan(-3.15).and(x.lessThan(2.85));
      const slope = select(inside, amplitude.mul(3.5).mul(pow(t, 2.5)).mul(sin(angle)).sub(envelope.mul(3.4).mul(cos(angle))).div(6), float(0));
      this.positionNode = vec3(x, positionLocal.y, positionLocal.z.add(envelope.mul(sin(angle)).mul(active)));
      normal = vec3(normalLocal.x.sub(slope.mul(normalLocal.z).mul(active)), normalLocal.y, normalLocal.z);
    }
    if(options.batched){
      const joint=attribute('tunaJoint','float'),hinged=joint.greaterThan(.5);
      const matrix=uniformArray(options.batched.transforms,'mat4').element(joint.toInt());
      const normalMatrix=uniformArray(options.batched.normals,'mat3').element(joint.toInt());
      this.positionNode=select(hinged,matrix.mul(vec4(positionLocal,1)).xyz,this.positionNode!);
      normal=select(hinged,normalMatrix.mul(normalLocal),normal);
    }
    this.normalNode=transformNormalToView(normal);
    const worldNormal = varying(modelWorldMatrix.mul(vec4(nodeObject(normal), 0)).xyz, 'vTunaNormal');
    const tint = options.vertexColors ? varying(attribute('color', 'vec3'), 'vTunaTint') : vec3(1);
    const matte=options.batched?attribute('fishMatte','float'):u.matte;
    this.colorNode=paintedFishLight(u.baseColor.mul(tint),worldNormal,matte,u.keyDirection,u.shadowTint);
    // The per-vertex fin mask suppresses rim light without splitting render batches.
    this.userData={styleBase:this.colorNode,rim:!options.matte,rimMask:options.batched?matte.oneMinus():undefined,deformedNormal:normal,toon:'tuna-cel'};
  }
  /** The bending twin of a hinged-fin material, sharing this fish's swim uniforms. */
  bent() { return new TunaCelMaterial({ ...this.options, bend: true }); }
}

export function createCelMaterial(color: Color | string, vertexColors = false, matte = false, swim = createSwimUniforms()) {
  return new TunaCelMaterial({ color, vertexColors, matte, bend: false, swim });
}
