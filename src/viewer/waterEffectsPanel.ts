import {DEFAULT_WATER_EFFECTS,effectiveWaterEffects,WATER_EFFECTS_KEY,waterEffectsSettings,type WaterEffectsSettings} from './waterEffectsSettings';
/** Gym-only opt-in. Mode changes reload to release every optional GPU resource cleanly. */
export function createWaterEffectsPanel(host:HTMLElement,params:URLSearchParams,signal:AbortSignal){
 let saved:unknown;try{saved=JSON.parse(localStorage.getItem(WATER_EFFECTS_KEY)??'null');}catch{saved=null;}
 let settings=waterEffectsSettings(saved??DEFAULT_WATER_EFFECTS);
 const requested=params.get('water');if(requested==='balanced'||requested==='enhanced')settings.mode=requested;
 const root=document.createElement('details');root.className='gym-performance';root.id='gym-water-effects';
 root.innerHTML='<summary>Water graphics</summary><label>Appearance <select id="gym-water-quality"><option value="balanced">Balanced</option><option value="enhanced" disabled>Enhanced · WebGPU</option></select></label><p id="gym-water-status" role="status">Balanced keeps water lightweight.</p><div id="gym-water-options" hidden><label><input id="gym-water-caustics" type="checkbox"> Chromatic caustics</label><label>Light shafts <select id="gym-water-shafts"><option value="0">Off</option><option value="12">Balanced</option><option value="24">Detailed</option></select></label><p>Enhanced adds clearer underwater light and refraction. Choose Balanced if movement feels less smooth.</p></div>';
 host.append(root);const mode=root.querySelector<HTMLSelectElement>('#gym-water-quality')!,caustics=root.querySelector<HTMLInputElement>('#gym-water-caustics')!,shafts=root.querySelector<HTMLSelectElement>('#gym-water-shafts')!,status=root.querySelector<HTMLElement>('#gym-water-status')!,options=root.querySelector<HTMLElement>('#gym-water-options')!;
 mode.value=settings.mode;caustics.checked=settings.caustics;shafts.value=String(settings.shafts);
 let onChange:(value:WaterEffectsSettings)=>void=()=>{};
 const persist=()=>{try{localStorage.setItem(WATER_EFFECTS_KEY,JSON.stringify(settings));}catch{/* URL mode still works in private storage. */}};
 mode.addEventListener('change',()=>{settings.mode=mode.value==='enhanced'?'enhanced':'balanced';persist();const url=new URL(location.href);url.searchParams.set('water',settings.mode);url.searchParams.set('tab','gym');location.assign(url.href);},{signal});
 const change=()=>{settings=waterEffectsSettings({...settings,caustics:caustics.checked,shafts:Number(shafts.value)});persist();onChange({...settings});};
 caustics.addEventListener('change',change,{signal});shafts.addEventListener('change',change,{signal});
 return {get settings(){return {...settings};},setOnChange(callback:typeof onChange){onChange=callback;},
  setCapability(native:boolean){settings=effectiveWaterEffects(settings,native);mode.options[1].disabled=!native;mode.value=settings.mode;options.hidden=settings.mode!=='enhanced';status.textContent=!native?'Balanced · Enhanced needs WebGPU in this browser.':settings.mode==='enhanced'?'Enhanced · optional effects enabled.':'Balanced · optional effects are off.';return {...settings};},
  fail(){status.textContent='Enhanced water could not start. Returning to Balanced.';settings.mode='balanced';persist();const url=new URL(location.href);url.searchParams.set('water','balanced');location.replace(url.href);},
  dispose(){root.remove();}};
}
