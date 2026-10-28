'use client';
import {useEffect,useRef,useState} from 'react';

export default function PersonId({uid}:{uid:string}){
 const [message,setMessage]=useState(''),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 return <><button type="button" className={'person-id'+(message==='Copied'?' copied':'')} aria-label={'Copy Person ID '+uid} data-tooltip={message||'Copy ID'} onClick={async()=>{try{await navigator.clipboard.writeText(uid);setMessage('Copied');}catch{setMessage('Select ID To Copy');}clearTimeout(timer.current);timer.current=setTimeout(()=>setMessage(''),2200);}}>{uid}</button><span className="sr-only" role="status">{message}</span></>;
}
