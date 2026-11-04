import { MathUtils } from 'three';

const TAU=Math.PI*2;
export const smooth=(t:number)=>{t=MathUtils.clamp(t,0,1);return t*t*(3-2*t);};

/** Longer support and shorter recovery, with smooth turnarounds.
 * Authored timing, not an IK/adhesion or measured biomechanics solver. */
export function crawlCycle(phase:number,arm:number,seedPhase:number,out={reach:0,lift:0,curl:0}){
 const cycle=MathUtils.euclideanModulo(phase/TAU+arm*.381966+seedPhase,1);
 const support=.70,recovery=cycle>support?(cycle-support)/(1-support):0;
 out.reach=cycle<=support?smooth(cycle/support):1-smooth(recovery);
 out.lift=Math.sin(Math.PI*recovery)**2;
 out.curl=.25+.75*(.5+.5*Math.cos(phase+arm*1.73+seedPhase*TAU));
 return out;
}

/** Quick squeeze, slower refill, zero slope at either end. */
export function mantlePulse(phase:number){
 const cycle=MathUtils.euclideanModulo(phase/TAU,1);
 return cycle<.22?smooth(cycle/.22):1-smooth((cycle-.22)/.78);
}
