import { MeshToonNodeMaterial, type Node, type NodeBuilder } from 'three/webgpu';
import { attribute, cos, float, normalLocal, positionLocal, select, sin, smoothstep, uniform, vec3 } from 'three/tsl';
import { toonRamp } from '../../shared/style';
import { MONARCH } from './definition';

/** One clock drives every instance; immutable slot parameters supply independent
 * beat phase/rate/pose. Hinge math matches the individual rig's Euler XYZ order.
 * This is a node material for both WebGPU and WebGL 2, without shader strings. */
export class MonarchBatchMaterial extends MeshToonNodeMaterial {
  readonly clock = uniform(0);
  private readonly hingedPosition: Node;
  private readonly hingedNormal: Node;

  constructor(wingspanMeters: number) {
    super({ name: 'monarch-instanced-matte', vertexColors: false });
    this.gradientMap = toonRamp();
    this.colorNode = attribute('color', 'vec3');
    this.userData = { toon: 'matte', rim: false, styleBase: this.colorNode, animation: 'analytic-instanced-hinges' };

    const joint = attribute('monarchJoint', 'float'), parameters = attribute('monarchInstance', 'vec4');
    const hinged = joint.greaterThan(.5), hind = joint.greaterThan(2.5);
    const side = select(joint.mod(2).lessThan(.5), float(1), float(-1));
    const flight = parameters.z.lessThan(.5);
    const cycle = this.clock.mul(parameters.y).add(parameters.w).mod(MONARCH.glideCycleSeconds);
    const glide = smoothstep(3.65, 4.05, cycle).mul(float(1).sub(smoothstep(4.65, 5.15, cycle)));
    const phase = this.clock.mul(parameters.y).mul(Math.PI * 2 * MONARCH.wingbeatHz).add(parameters.x);
    const stroke = select(hind, sin(phase.sub(.13)).mul(.84), sin(phase).mul(.95));
    const angle = select(flight, stroke.mul(float(1).sub(glide.mul(.92))).add(.12), select(parameters.z.greaterThan(1.5), float(1.43), float(.09))).mul(side);
    const sweep = select(flight, sin(phase.sub(.2)).mul(.025).mul(side).mul(float(1).sub(glide)), float(0));
    const pivot = vec3(side.mul(wingspanMeters * .015), 0, select(hind, float(wingspanMeters * .01), float(0)));
    const cz = cos(angle), sz = sin(angle), cy = cos(sweep), sy = sin(sweep);
    const rotate = (input: Node) => {
      const p = vec3(input);
      // X=0 Euler XYZ means R_y * R_z: fold first, then the slight wing sweep.
      const x = p.x.mul(cz).sub(p.y.mul(sz)), y = p.x.mul(sz).add(p.y.mul(cz));
      return vec3(x.mul(cy).add(p.z.mul(sy)), y, p.z.mul(cy).sub(x.mul(sy)));
    };
    const position = attribute('position', 'vec3'), normal = attribute('normal', 'vec3');
    this.hingedPosition = select(hinged, rotate(position.sub(pivot)).add(pivot), position);
    this.hingedNormal = select(hinged, rotate(normal), normal);
  }

  /** r180 applies instancing before positionNode. Deform local coordinates here
   * instead, then let the standard path apply each matrix and normal transform. */
  override setupPosition(builder: NodeBuilder): Node {
    positionLocal.assign(this.hingedPosition);
    normalLocal.assign(this.hingedNormal);
    return super.setupPosition(builder);
  }
}
