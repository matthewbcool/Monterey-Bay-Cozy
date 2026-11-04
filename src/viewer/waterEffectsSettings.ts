/** Optional Gym rendering. Capability permits a choice; it never opts a device in. */
export const WATER_EFFECTS_KEY='monterey-bay-cozy-water-effects-v1';
export interface WaterEffectsSettings {mode:'balanced'|'enhanced';caustics:boolean;shafts:0|12|24}
export const DEFAULT_WATER_EFFECTS:WaterEffectsSettings={mode:'balanced',caustics:true,shafts:12};
export function waterEffectsSettings(value:unknown):WaterEffectsSettings{
 const v=(value&&typeof value==='object'?value:{}) as Partial<WaterEffectsSettings>;
 return {mode:v.mode==='enhanced'?'enhanced':'balanced',caustics:v.caustics!==false,shafts:v.shafts===0||v.shafts===24?v.shafts:12};
}
export function effectiveWaterEffects(settings:WaterEffectsSettings,nativeWebGPU:boolean):WaterEffectsSettings{
 return {...settings,mode:nativeWebGPU?settings.mode:'balanced'};
}
/** Pixel/memory ceilings apply even on high-DPR or 4K screens. These are budgets, not hardware claims. */
export function waterEffectSize(width:number,height:number){
 const scale=Math.min(1,1920/Math.max(1,width),1080/Math.max(1,height));
 return {width:Math.max(1,Math.floor(width*scale)),height:Math.max(1,Math.floor(height*scale))};
}
