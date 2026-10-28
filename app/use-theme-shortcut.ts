'use client';
import {useEffect,useRef,useState} from 'react';
import {setTheme} from '../lib/theme';

type Theme='light'|'dark';
/** Theme applies immediately; authenticated preference writes wait for any active save. */
export default function useThemeShortcut({enabled=true,busy,save}:{enabled?:boolean;busy:boolean;save?:(theme:Theme)=>Promise<unknown>}){
 const [pending,setPending]=useState<Theme|null>(null),[writing,setWriting]=useState(false),saveRef=useRef(save);
 saveRef.current=save;
 useEffect(()=>{if(!enabled)return;const shortcut=(event:KeyboardEvent)=>{
  if(event.repeat||event.isComposing||!(event.ctrlKey||event.metaKey)||!event.shiftKey||event.altKey||event.key.toLowerCase()!=='l')return;
  event.preventDefault();const next=document.documentElement.dataset.theme==='dark'?'light':'dark';setTheme(next);if(saveRef.current)setPending(next);
 };window.addEventListener('keydown',shortcut);return()=>window.removeEventListener('keydown',shortcut);},[enabled]);
 useEffect(()=>{if(pending)setTheme(pending);if(!pending||busy||writing||!saveRef.current)return;const next=pending;setPending(null);setWriting(true);
  void saveRef.current(next).finally(()=>setWriting(false));
 },[pending,busy,writing]);
}
