'use client';
import {useRef,useState} from 'react';
import {ModalCloseConfirmation} from './modal';

/** Defer navigation until the user explicitly discards settings; cancellation keeps the page mounted. */
export default function useSettingsNavigation(shouldConfirm:()=>boolean,onDiscard:()=>void){
 const latest=useRef({shouldConfirm,onDiscard});latest.current={shouldConfirm,onDiscard};
 const pending=useRef<(()=>void)|null>(null),[open,setOpen]=useState(false);
 const guard=(proceed:()=>void)=>{
  if(!latest.current.shouldConfirm())return true;
  if(!pending.current){pending.current=proceed;setOpen(true);}
  return false;
 };
 const cancel=()=>{pending.current=null;setOpen(false);};
 const confirm=()=>{const proceed=pending.current;pending.current=null;setOpen(false);if(proceed){latest.current.onDiscard();proceed();}};
 return {guard,confirmation:open?<ModalCloseConfirmation title="Leave Without Saving?" confirm={confirm} goBack={cancel}/>:null};
}
