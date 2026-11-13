'use client';
import {useEffect,useState} from 'react';
export const CLOSE_REMOVALS='take-roll:close-removals';
export function closeRemovals(){window.dispatchEvent(new Event(CLOSE_REMOVALS));}
export default function useRemovalBanner(){
 const [open,setOpen]=useState(false);
 useEffect(()=>{const close=()=>setOpen(false);const pointer=(e:PointerEvent)=>{if(!(e.target as Element)?.closest('.inline-confirm,.remove-icon'))close();};const key=(e:KeyboardEvent)=>{if(e.key==='Escape'||e.key==='ArrowUp'||e.key==='ArrowDown')close();};window.addEventListener(CLOSE_REMOVALS,close);document.addEventListener('pointerdown',pointer);document.addEventListener('keydown',key);return()=>{window.removeEventListener(CLOSE_REMOVALS,close);document.removeEventListener('pointerdown',pointer);document.removeEventListener('keydown',key);};},[]);
 return [open,(value:boolean)=>{closeRemovals();setOpen(value);}] as const;
}
