import {Group} from 'three';
import {mat,mesh} from '../../models/props/primitives';
import {surface} from './geometry';
import {PIER_LENGTH,pierQuad} from './photoPier';
/** Photo shows masonry, not lawn, around the pier's waterside foundation.
 * A single draped color patch uses the existing ground style and spatial batches. */
export function addPierApron(overlays:Group){
 const apron=mesh(overlays,'Photo-informed concrete pier apron',surface(pierQuad(-1,PIER_LENGTH+1,-3.5,11),.037),mat('#b8b5a5'));
 apron.userData.groundKind=3;
}
