'use client';
import {useEffect,useReducer,useRef,type SetStateAction} from 'react';
import {ValueDraft} from '../lib/value-draft';
export default function useValueDraft<T,S>(source:S,normalize:(source:S)=>T){
 const transform=useRef(normalize);transform.current=normalize;
 const ref=useRef<ValueDraft<T,S>|null>(null),[,render]=useReducer(n=>n+1,0);
 if(!ref.current)ref.current=new ValueDraft(source,value=>transform.current(value));
 const draft=ref.current;
 useEffect(()=>{if(draft.sync(source))render();},[source]);
 return {value:draft.value,source:draft.source,get dirty(){return draft.dirty;},beginSave:()=>draft.beginSave(),cancelSave:()=>{draft.cancelSave();render();},setValue:(next:SetStateAction<T>)=>{draft.update(typeof next==='function'?(next as (value:T)=>T)(draft.value):next);render();},commit:(submitted:T,result:S)=>{draft.commit(submitted,result);render();}};
}
