import {WebHaptics,type HapticInput} from 'web-haptics';
export type Feedback='selection'|'mark'|'success'|'warning'|'error'|'undo'|'grab';
export const HAPTIC_KEY='roll-call-haptics';
const patterns:Record<Feedback,HapticInput>={
 selection:[{duration:15,intensity:.35}],
 mark:[{duration:35,intensity:.65}],
 success:[{duration:30,intensity:.5},{delay:55,duration:45,intensity:.7}],
 warning:[{duration:45,intensity:.7},{delay:70,duration:25,intensity:.4}],
 error:'error',
 undo:[{duration:35,intensity:.6},{delay:45,duration:20,intensity:.35}],
 grab:[{duration:25,intensity:.55}],
};
let engine:WebHaptics|undefined,lastFeedback=-Infinity,lastGesture=-Infinity,sessionPreference:boolean|undefined;
export function usesIosHapticTaps(){
 if(typeof navigator==='undefined')return false;
 return /iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
}
export function isHapticTouchClick(event:{pointerType?:string;detail:number}){
 // Safari can deliver MouseEvent clicks with detail=0 after a genuine touch.
 if(event.pointerType)return event.pointerType==='touch';
 return Date.now()-lastGesture<=5000;
}
export function noteHapticGesture(touch=true){lastGesture=touch?Date.now():-Infinity;}
export function hapticsEnabled(){
 if(typeof window==='undefined')return false;
 if(sessionPreference!==undefined)return sessionPreference;
 try{const saved=localStorage.getItem(HAPTIC_KEY);if(saved!==null)return saved==='on';}catch{}
 return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
export function feedback(kind:Feedback,fallback=false){
 if(typeof window==='undefined'||document.hidden||!window.matchMedia('(any-pointer: coarse)').matches||!hapticsEnabled()||Date.now()-lastGesture>5000)return;
 // On iOS, the trusted label tap supplies one system tick. Script clicks cannot replace it.
 if(usesIosHapticTaps())return;
 const now=Date.now();
 // The action handler wins over the generic button click from the same gesture.
 if((fallback||kind==='selection')&&now-lastFeedback<80)return;
 lastFeedback=now;
 try{engine??=new WebHaptics({debug:false,showSwitch:false});void engine.trigger(patterns[kind]).catch(()=>{});}catch{}
}
export function setHapticsEnabled(enabled:boolean){sessionPreference=undefined;try{localStorage.setItem(HAPTIC_KEY,enabled?'on':'off');}catch{sessionPreference=enabled;}if(!enabled)stopHaptics();}
export function stopHaptics(){try{engine?.cancel();}catch{}}
export function disposeHaptics(){try{engine?.destroy();}catch{}engine=undefined;lastFeedback=-Infinity;lastGesture=-Infinity;}
export function actionFeedback(action:Record<string,unknown>):Feedback|null{
 const type=action.type;
 if(type==='status'||type==='attendance-state')return 'mark';
 if(type==='person-flag')return action.flag==='complete'?'success':'selection';
 if(type==='mark-remaining'||type==='set-statuses')return 'mark';
 if(type==='remove-event-person'||type==='remove-family-person'||type==='clear-person-history')return 'warning';
 // Notes and debounced excuse saves are deliberately silent; excuse taps have immediate feedback.
 return null;
}
