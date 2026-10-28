'use client';
import {createContext,useContext,useEffect,useId,useRef,useState,type ReactNode,type ButtonHTMLAttributes} from 'react';
import {X} from 'lucide-react';
import {ModalBackdropGesture,ModalInputBaseline} from '../lib/modal-dismiss';
const DismissContext=createContext<(()=>void)|null>(null);
/** Cancel buttons share the shell's guarded close path. Successful saves call their owner directly. */
export function ModalDismiss({children,onClick,...props}:ButtonHTMLAttributes<HTMLButtonElement>){
 const dismiss=useContext(DismissContext);
 return <button {...props} type="button" onClick={event=>{onClick?.(event);if(!event.defaultPrevented)dismiss?.();}}>{children}</button>;
}
/** One native dialog shell for every modal, with focus restoration and top-layer semantics. */
export default function Modal({title,children,close,className='',icon,dirty}:{title:string;children:ReactNode;close:()=>void;className?:string;icon?:ReactNode;dirty?:boolean}){
 const ref=useRef<HTMLDialogElement>(null),titleId=useId(),baseline=useRef(new ModalInputBaseline()),gesture=useRef(new ModalBackdropGesture());
 const [confirm,setConfirm]=useState(false);
 const requestClose=()=>{if(dirty??(ref.current&&baseline.current.dirty(ref.current)))setConfirm(true);else close();};
 useEffect(()=>{const active=document.activeElement as HTMLElement|null,dialog=ref.current;if(!dialog)return;dialog.showModal();baseline.current.remember(dialog);
  const observer=new MutationObserver(()=>baseline.current.remember(dialog));observer.observe(dialog,{childList:true,subtree:true});
  return()=>{observer.disconnect();if(dialog.open)dialog.close();if(active?.isConnected)active.focus({preventScroll:true});};
 },[]);
 const outside=(target:EventTarget|null,x:number,y:number)=>{const dialog=ref.current;if(!dialog||target!==dialog)return false;const rect=dialog.getBoundingClientRect();return x<rect.left||x>rect.right||y<rect.top||y>rect.bottom;};
 return <DismissContext.Provider value={requestClose}><dialog ref={ref} className={'app-modal '+className} aria-label={title} aria-labelledby={titleId}
 onCancel={event=>{event.preventDefault();event.stopPropagation();requestClose();}}
 onPointerDownCapture={event=>gesture.current.start(event.pointerId,outside(event.target,event.clientX,event.clientY),event.isPrimary&&event.button===0)}
 onPointerUpCapture={event=>{if(gesture.current.end(event.pointerId,outside(event.target,event.clientX,event.clientY)))requestClose();}}
 onPointerCancel={()=>gesture.current.cancel()}>
 <div className="modal-head"><h2 id={titleId}>{icon}{title}</h2><button type="button" className="icon modal-close" onClick={requestClose} aria-label="Close Dialog" data-tooltip="Close Dialog"><X size={20}/></button></div>{children}
 {confirm&&<ModalCloseConfirmation confirm={close} goBack={()=>setConfirm(false)}/>}
 </dialog></DismissContext.Provider>;
}

export function ConfirmationModal({title,message,confirm,cancel,confirmLabel='Confirm',cancelLabel='Go Back',pending=false,error}:{title:string;message:ReactNode;confirm:()=>void;cancel:()=>void;confirmLabel?:string;cancelLabel?:string;pending?:boolean;error?:string}){
 return <Modal title={title} className="modal-close-confirm" dirty={false} close={()=>{if(!pending)cancel();}}><p>{message}</p>{error&&<p className="form-error" role="alert">{error}</p>}<div className="modal-confirm-actions"><button type="button" autoFocus disabled={pending} onClick={cancel}>{cancelLabel}</button><button type="button" className="danger" disabled={pending} onClick={confirm}>{pending?'Deleting…':confirmLabel}</button></div></Modal>;
}
export function ModalCloseConfirmation({confirm,goBack,title="Close Without Saving?"}:{confirm:()=>void;goBack:()=>void;title?:string}){
 return <ConfirmationModal title={title} message="Unsaved progress will be lost." cancel={goBack} confirm={confirm}/>;
}
