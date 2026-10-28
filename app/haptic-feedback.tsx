'use client';
import {useEffect} from 'react';
import {installIosHapticTaps} from '../lib/ios-haptic-taps';
import {feedback,noteHapticGesture,hapticsEnabled,stopHaptics,disposeHaptics,usesIosHapticTaps,isHapticTouchClick} from '../lib/haptics';
export default function HapticFeedback(){
 useEffect(()=>{
  const cleanupIos=usesIosHapticTaps()?installIosHapticTaps(document.body,hapticsEnabled):()=>{};
  const touch=()=>noteHapticGesture();
  const gesture=(e:PointerEvent)=>{if(e.isTrusted)noteHapticGesture(e.pointerType==='touch');};
  const keyboard=()=>noteHapticGesture(false);
  const click=(e:MouseEvent)=>{
   if(!e.isTrusted||!(e.target instanceof Element))return;
   const control=e.target.closest<HTMLElement>('button,a[href],summary,input[type="checkbox"],input[type="radio"]');
   if(!control||control.closest('[inert],[data-haptic="off"]')||control.matches(':disabled,[aria-disabled="true"]')||control.closest('fieldset:disabled'))return;
   if(!isHapticTouchClick(e as PointerEvent))return;
   if(control.matches('.danger,.remove-icon'))feedback('warning',true);else feedback('selection',true);
  };
  const change=(e:Event)=>{if(e.isTrusted&&e.target instanceof HTMLSelectElement)feedback('selection');};
  const hidden=()=>{if(document.hidden)stopHaptics();};
  document.addEventListener('touchstart',touch,{passive:true,capture:true});document.addEventListener('keydown',keyboard,true);document.addEventListener('pointerdown',gesture,true);document.addEventListener('click',click);document.addEventListener('change',change);document.addEventListener('visibilitychange',hidden);
  return()=>{cleanupIos();document.removeEventListener('touchstart',touch,true);document.removeEventListener('keydown',keyboard,true);document.removeEventListener('pointerdown',gesture,true);document.removeEventListener('click',click);document.removeEventListener('change',change);document.removeEventListener('visibilitychange',hidden);disposeHaptics();};
 },[]);
 return null;
}
