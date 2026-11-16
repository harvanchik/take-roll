'use client';
import {useState,useEffect,useRef} from 'react';
import {NotebookPen,Save} from 'lucide-react';
import Modal from './modal';
import {usePersonalPreferences} from './personal-preferences';
import useTextDraft from './use-text-draft';
export default function InlineNote({value,name,onSave,flushRef,isolated=false}:{isolated?:boolean;value:string;name:string;onSave:(note:string,before:string)=>Promise<unknown>;flushRef:{current:()=>void}}){
 const text=useTextDraft(value,onSave,undefined,isolated),prefs=usePersonalPreferences(),auto=prefs.autoSave!==false;
 const [open,setOpen]=useState(false),[expanded,setExpanded]=useState(''),[baseline,setBaseline]=useState(''),[saving,setSaving]=useState(false);
 const current=useRef(text);current.current=text;
 const save=async()=>{if(saving)return;setSaving(true);try{if(!auto){if(expanded!==text.draft&&!await onSave(expanded,baseline))return;const ok=await new Promise<boolean>(resolve=>window.dispatchEvent(new CustomEvent('attendance:save-request',{detail:{resolve}})));if(ok)setBaseline(expanded);}else text.flush();}finally{setSaving(false);}};
 useEffect(()=>{if(!open)return;const shortcut=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key.toLowerCase()==='s'){e.preventDefault();e.stopImmediatePropagation();void save();}};window.addEventListener('keydown',shortcut,true);return()=>window.removeEventListener('keydown',shortcut,true);},[open,expanded,baseline,saving,auto]);
 flushRef.current=text.flush;
 return <><div className="expanded-note-input"><textarea className="inline-person-note" aria-label={`Note for ${name}`} value={text.draft} onChange={e=>text.change(e.target.value)} onBlur={text.flush} onCompositionStart={()=>text.composition(true)} onCompositionEnd={()=>text.composition(false)} maxLength={2000} rows={2} placeholder="Note…" spellCheck={true}/><button type="button" className="icon expand-note" aria-label={'Expand Note for '+name} data-tooltip="Expand Note" onClick={()=>{text.flush();setExpanded(text.draft);setBaseline(text.draft);setOpen(true);}}><NotebookPen size={15}/></button></div>{open&&<Modal title={'Note · '+name} dirty={!auto&&expanded!==baseline} close={()=>{if(auto)text.flush();setOpen(false);}} className="expanded-note-modal"><textarea autoFocus className="expanded-note-editor" aria-label={'Expanded Note for '+name} value={auto?text.draft:expanded} onChange={e=>{setExpanded(e.target.value);if(auto)text.change(e.target.value);}} onCompositionStart={()=>text.composition(true)} onCompositionEnd={()=>text.composition(false)} maxLength={2000} rows={12}/>{!auto&&<div className="modal-footer"><button type="button" className="primary" disabled={saving} onClick={()=>void save()}><Save size={15}/>{saving?'Saving…':'Save'}</button></div>}</Modal>}</>;
}

