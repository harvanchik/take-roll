'use client';
import {useEffect,useRef,useState} from 'react';
import {Vibrate} from 'lucide-react';
import {ShakeDetector} from '../lib/shake-undo.ts';
import {confirmShakeHistory} from '../lib/confirm-shake.ts';

export default function ShakeUndo({onUndo,onRedo,canUndo,canRedo,enabled,onEnabled,onMessage}:{onUndo:()=>void;onRedo:()=>void;canUndo:boolean;canRedo:boolean;enabled:boolean;onEnabled:(enabled:boolean)=>void;onMessage:(text:string)=>void}){
 const [supported,setSupported]=useState(false),[requesting,setRequesting]=useState(false);
 const latest=useRef({onUndo,onRedo,canUndo,canRedo,onMessage});latest.current={onUndo,onRedo,canUndo,canRedo,onMessage};
 useEffect(()=>{setSupported(window.isSecureContext&&typeof window.DeviceMotionEvent!=='undefined');},[]);
 useEffect(()=>{
  if(!enabled)return;
  const detector=new ShakeDetector();
  const motion=(e:DeviceMotionEvent)=>{
   const editing=document.activeElement?.closest('input,textarea,select,[contenteditable="true"]');
   if(document.hidden||editing||document.querySelector('dialog[open]')||(!latest.current.canUndo&&!latest.current.canRedo)){detector.reset();return;}
   const linear=e.acceleration;
   const acceleration=linear&&[linear.x,linear.y,linear.z].every(n=>n!==null&&Number.isFinite(n))?linear:e.accelerationIncludingGravity;
   if(detector.sample(acceleration,performance.now())){
    confirmShakeHistory({canUndo:latest.current.canUndo,canRedo:latest.current.canRedo,confirm:message=>window.confirm(message),undo:()=>latest.current.onUndo(),redo:()=>latest.current.onRedo()});
   }
  };
  window.addEventListener('devicemotion',motion,{passive:true});
  return()=>window.removeEventListener('devicemotion',motion);
 },[enabled]);
 if(!supported||enabled)return null;
 async function toggle(){
  setRequesting(true);
  try{
   const Motion=window.DeviceMotionEvent as typeof DeviceMotionEvent & {requestPermission?:()=>Promise<string>};
   const allowed=!Motion.requestPermission||await Motion.requestPermission()==='granted';
   onEnabled(allowed);
   latest.current.onMessage(allowed?'Shake to Undo Enabled':'Motion Access Not Granted');
  }catch{latest.current.onMessage('Shake to Undo Is Unavailable');}
  finally{setRequesting(false);}
 }
 return <button className={'icon shake-undo'+(enabled?' enabled':'')} type="button" aria-label={enabled?'Disable Shake to Undo':'Enable Shake to Undo'} data-tooltip={enabled?'Disable Shake Undo':'Enable Shake Undo'} aria-pressed={enabled} disabled={requesting} onClick={()=>void toggle()}><Vibrate size={19}/></button>;
}
