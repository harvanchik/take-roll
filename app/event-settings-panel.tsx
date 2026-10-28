'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {Save} from 'lucide-react';
import DropdownArrow from './dropdown-arrow';
import InfoPopover from './info-popover';
import Modal from './modal';
import EventPageHeading from './event-page-heading';
import RollCallSettingsFields from './roll-call-settings-fields';
import useValueDraft from './use-value-draft';
import {eventSettingsRoot,eventSettingsSource,eventSettingsDraft,eventSettingsSnapshot,mergeEventSettings} from '../lib/event-settings';
import type {Data,Event} from '../lib/model';
export default function EventSettingsPanel({data,event,busy,admin,onAction,onDirtyChange,onBack}:{data:Data;event:Event;busy:boolean;admin:boolean;onAction:(action:any)=>Promise<unknown>;onDirtyChange:(dirty:boolean)=>void;onBack:()=>void}){
 const root=eventSettingsRoot(data,event),source=eventSettingsSource(data,root),draft=useValueDraft(source,eventSettingsDraft);
 const formId=useId(),saving=useRef(false);
 const [reset,setReset]=useState(false),[saved,setSaved]=useState(false),[pending,setPending]=useState(false),dirtyCallback=useRef(onDirtyChange);dirtyCallback.current=onDirtyChange;
 useEffect(()=>{dirtyCallback.current(draft.dirty);return()=>dirtyCallback.current(false);},[draft.dirty]);
 const readOnly=!!root.archivedAt||!admin,locked=busy||pending||readOnly,controlsDisabled=locked||draft.value.useGlobal;
 const displayed=mergeEventSettings(source.global,draft.value.useGlobal?undefined:draft.value.local);
 const save=async()=>{if(locked||saving.current||!draft.dirty)return;saving.current=true;setPending(true);const submitted=draft.value,source=draft.source;draft.beginSave();setSaved(false);
  try{
  const result=await onAction({type:'update-event-settings',eventId:root.id,settings:{...submitted.local,useGlobal:submitted.useGlobal,testOnly:submitted.testOnly},expected:JSON.stringify({exists:true,archived:root.archivedAt??null,value:source})}) as Data|false;
  if(result){draft.commit(submitted,eventSettingsSource(result,result.events.find(e=>e.id===root.id)!));setSaved(true);}else draft.cancelSave();
  }catch(error){draft.cancelSave();throw error;}finally{saving.current=false;setPending(false);}
 };
 return <div className="settings-page event-settings-page"><header className="settings-sticky-header event-settings-sticky-header"><EventPageHeading name={root.name} eyebrow="EVENT SETTINGS" settings testOnly={root.settings?.testOnly} onNavigate={onBack}/>
 <div className="event-settings-heading"><h2>Event Settings</h2><div className="event-settings-toolbar"><details className="mark-dropdown event-options-menu"><summary>Options <DropdownArrow size={14}/></summary><div className="mark-menu"><button type="button" aria-pressed={draft.value.useGlobal} disabled={locked} onClick={()=>{draft.setValue({...draft.value,useGlobal:true});setSaved(false);}}>Use Global Settings {draft.value.useGlobal?'✓':''}</button><button type="button" aria-pressed={!draft.value.useGlobal} disabled={locked} onClick={()=>{draft.setValue({...draft.value,useGlobal:false});setSaved(false);}}>Use Local Settings {!draft.value.useGlobal?'✓':''}</button><button type="button" disabled={locked||draft.value.useGlobal} onClick={()=>setReset(true)}>Revert Local Settings</button><div className="event-test-option"><button type="button" className="event-test-toggle" aria-pressed={draft.value.testOnly} disabled={locked} onClick={()=>{draft.setValue({...draft.value,testOnly:!draft.value.testOnly});setSaved(false);}}>Test Only <span className="event-test-info-space" aria-hidden="true"/>{draft.value.testOnly?'✓':''}</button><InfoPopover label="About Test Only">Test attendance is excluded from person and roster statistics.</InfoPopover></div></div></details><button type="submit" form={formId} className="primary event-settings-save" aria-label={pending?"Saving":saved&&!draft.dirty?"Saved":"Save"} disabled={locked||!draft.dirty}><Save size={15}/><span aria-live="polite">{pending?"Saving…":saved&&!draft.dirty?"Saved":"Save"}</span></button></div></div></header>
 {readOnly&&<p className="settings-hint">{root.archivedAt?'Archived Event':'Managed By The Workspace Owner'}</p>}
 {reset&&<Modal title="Revert To Defaults" className="modal-close-confirm settings-reset-modal" close={()=>setReset(false)}><p>Local settings will match the current global settings when saved. Marks for removed attendance choices will be permanently cleared. This cannot be undone.</p><div className="modal-confirm-actions"><button type="button" className="small" onClick={()=>setReset(false)}>Cancel</button><button type="button" className="primary small" onClick={()=>{draft.setValue({...draft.value,local:eventSettingsSnapshot(source.global)});setSaved(false);setReset(false);}}>Revert To Defaults</button></div></Modal>}
 <form id={formId} className="settings-card organization-settings" onInvalidCapture={e=>e.currentTarget.querySelectorAll<HTMLDetailsElement>('details.settings-group').forEach(group=>{if(group.contains(e.target as Node))group.open=true;})} onSubmit={e=>{e.preventDefault();void save();}}>
 <fieldset className={"settings-controls"+(draft.value.useGlobal?" event-settings-inherited":"")} disabled={controlsDisabled}><RollCallSettingsFields value={displayed} onChange={value=>{if(!controlsDisabled){draft.setValue({...draft.value,local:eventSettingsSnapshot(value)});setSaved(false);}}} disabled={controlsDisabled} scope="event"/></fieldset>
 </form></div>;
}
