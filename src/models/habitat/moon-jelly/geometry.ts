import {buildBell} from './bell';
import {buildAnatomy} from './anatomy';
import {addJellyMorphs} from './motion';
import {mulberry32} from '../../shared/random';
/** Compose readable systems into just two GPU batches; seed affects crown height and soft-tissue folds. */
export function buildJellyGeometry(diameter:number,seed=0){
 const heightScale=.96+mulberry32(seed)()*.08;
 const bell=buildBell(diameter/2,heightScale),organs=buildAnatomy(diameter/2,heightScale,seed);
 addJellyMorphs(bell,diameter);addJellyMorphs(organs,diameter);return {bell,organs};
}
