'use client';
import {useState,useRef,useEffect,useId} from 'react';
import {TextDraft,NOTE_SETTLE_MS} from '../lib/text-draft';
export default function useTextDraft(value:string,onSave:(value:string,before:string)=>Promise<unknown>,delay=NOTE_SETTLE_MS,isolated=false){
 const [draft,setDraft]=useState(value),key=useId(),latest=useRef(value),save=useRef(onSave);latest.current=value;save.current=onSave;
 const buffer=useRef<TextDraft|null>(null);
 if(!buffer.current)buffer.current=new TextDraft(value,(next,before)=>{void save.current(next,before);},(next,dirty)=>{setDraft(next);if(!isolated)window.dispatchEvent(new CustomEvent('attendance:text-dirty',{detail:{key,dirty}}));},delay);
 useEffect(()=>buffer.current!.sync(value),[value]);
 useEffect(()=>{if(isolated)return()=>buffer.current!.flush();const flush=()=>buffer.current!.flush(),hidden=()=>{if(document.visibilityState==='hidden')flush();},discard=()=>buffer.current!.reset(latest.current);window.addEventListener('beforeunload',flush);window.addEventListener('pagehide',flush);document.addEventListener('visibilitychange',hidden);window.addEventListener('attendance:flush-drafts',flush);window.addEventListener('attendance:discard-drafts',discard);return()=>{window.removeEventListener('beforeunload',flush);window.removeEventListener('pagehide',flush);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('attendance:flush-drafts',flush);window.removeEventListener('attendance:discard-drafts',discard);flush();window.dispatchEvent(new CustomEvent('attendance:text-dirty',{detail:{key,dirty:false}}));};},[key,isolated]);
 return {draft,dirty:buffer.current.dirty,change:(value:string)=>buffer.current!.update(value),flush:()=>buffer.current!.flush(),cancel:()=>buffer.current!.reset(latest.current),composition:(active:boolean)=>buffer.current!.composition(active)};
}
