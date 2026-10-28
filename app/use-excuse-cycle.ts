'use client';
import {useEffect,useRef,useState,useId} from 'react';
import type {Excuse} from '../lib/model';
import {feedback} from '../lib/haptics';
import {ExcuseCycle} from '../lib/excuse-cycle';
export default function useExcuseCycle(value:Excuse,onSave:(value:Excuse)=>Promise<unknown>,choices:string[]=['work','academic','other'],isolated=false){
 const draftKey=useId(),latest=useRef(value);latest.current=value;
 const announce=(dirty:boolean)=>{if(!isolated)window.dispatchEvent(new CustomEvent('attendance:text-dirty',{detail:{key:draftKey,dirty}}));};
 const [draft,setDraft]=useState(value),save=useRef(onSave);save.current=onSave;
 const cycle=useRef<ExcuseCycle|null>(null);
 if(!cycle.current)cycle.current=new ExcuseCycle(value,next=>{announce(false);void save.current(next);},next=>{setDraft(next);announce(next!==latest.current);});
 useEffect(()=>cycle.current!.sync(value),[value]);
 useEffect(()=>{if(isolated)return()=>cycle.current!.flush();const flush=()=>cycle.current!.flush(),discard=()=>{cycle.current!.reset(latest.current);announce(false);};window.addEventListener('attendance:discard-excuses',discard);window.addEventListener('beforeunload',flush);window.addEventListener('attendance:flush-excuses',flush);return()=>{window.removeEventListener('attendance:discard-excuses',discard);window.removeEventListener('beforeunload',flush);window.removeEventListener('attendance:flush-excuses',flush);flush();};},[]);
 return {reason:draft,cycle:()=>{feedback('selection');cycle.current!.cycle(choices);},flush:()=>cycle.current!.flush()};
}
