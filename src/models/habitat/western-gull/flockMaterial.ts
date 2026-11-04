import { MeshToonNodeMaterial, type Node, type NodeBuilder } from 'three/webgpu';
import { attribute, cos, float, normalLocal, positionLocal, select, sin, smoothstep, uniform, vec3 } from 'three/tsl';
import { toonRamp } from '../../shared/style';
import { gullPivots } from './definition';

/** One clock for an entire spatial flock; slot parameters provide independent
 * flight phase, beat rate and glide timing. No skeletons or animation textures. */
export class GullFlockMaterial extends MeshToonNodeMaterial {
  readonly clock = uniform(0);
  private readonly flightPosition: Node;
  private readonly flightNormal: Node;

  constructor(sex: 'male' | 'female') {
    super({ name: 'western-gull-instanced-matte', vertexColors: false });
    this.gradientMap = toonRamp();
    this.colorNode = attribute('color', 'vec3');
    this.userData = { toon: 'matte', rim: false, styleBase: this.colorNode, animation: 'analytic-instanced-gull-flight' };
    const pivots = gullPivots(sex);
    const joint = attribute('gullJoint', 'float'), parameters = attribute('gullInstance', 'vec3');
    const wing = joint.greaterThan(.5).and(joint.lessThan(4.5));
    const wrist = joint.greaterThan(2.5).and(joint.lessThan(4.5));
    const right = joint.mod(2).lessThan(.5), side = select(right, float(1), float(-1));
    const cycle = this.clock.mul(parameters.y).add(parameters.z).mod(8);
    const glide = smoothstep(3.2, 3.8, cycle).mul(float(1).sub(smoothstep(6.4, 7, cycle)));
    const strength = float(1).sub(glide.mul(.94));
    const phase = this.clock.mul(Math.PI * 2 * 2.3).mul(parameters.y).add(parameters.x);
    const shoulderAngle = sin(phase).mul(.48).mul(strength).add(.10).mul(side);
    const wristAngle = sin(phase.sub(.45)).mul(.24).mul(strength).mul(side);
    const shoulder = select(right, vec3(pivots[2]), vec3(pivots[1]));
    // Definition pivots are absolute bind coordinates; deform the wrist first,
    // then carry that result through its parent's shoulder transform.
    const wristPivot = select(right, vec3(pivots[4]), vec3(pivots[3]));
    const rotate = (input: Node, angle: Node) => {
      const p = vec3(input), c = cos(angle), s = sin(angle);
      return vec3(p.x.mul(c).sub(p.y.mul(s)), p.x.mul(s).add(p.y.mul(c)), p.z);
    };
    const position = attribute('position', 'vec3'), normal = attribute('normal', 'vec3');
    const foldedPosition = select(wrist, rotate(position.sub(wristPivot), wristAngle).add(wristPivot), position);
    const foldedNormal = select(wrist, rotate(normal, wristAngle), normal);
    this.flightPosition = select(wing, rotate(foldedPosition.sub(shoulder), shoulderAngle).add(shoulder), position);
    this.flightNormal = select(wing, rotate(foldedNormal, shoulderAngle), normal);
  }

  /** Apply local deformation before r180's instancing transform. A positionNode
   * applied afterwards would rotate each bird around the flock origin. */
  override setupPosition(builder: NodeBuilder): Node {
    positionLocal.assign(this.flightPosition);
    normalLocal.assign(this.flightNormal);
    return super.setupPosition(builder);
  }
}
