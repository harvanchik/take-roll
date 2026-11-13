'use client';
import {useState} from 'react';
import {personForUid} from '../lib/person-identity';
import {samePerson} from '../lib/person-links';
import type {Data,Roster} from '../lib/model';
import {useNamePreferences} from './name-preferences';
import Modal,{ModalDismiss} from './modal';

export default function LinkRosterPerson({data,roster,busy,onAction,close}:{data:Data;roster:Roster;busy:boolean;onAction:(action:any)=>Promise<unknown>;close:()=>void}){
 const [uid,setUid]=useState(''),[error,setError]=useState(''),{displayName}=useNamePreferences();
 const person=uid.length===7?personForUid(data,uid):undefined,included=!!person&&roster.people.some(p=>samePerson(data,p.id,person.id,roster.id)),removed=!!person&&roster.removedPeople?.some(p=>samePerson(data,p.id,person.id,roster.id));
 return <Modal title="Link Existing Person" className="link-person-modal" close={close}><form onSubmit={async event=>{event.preventDefault();if(!person||included||removed)return;if(await onAction({type:'link-roster-person',uid})){close();}else setError('Could Not Link Person. Review The Message And Try Again.');}}><label>Person ID<input value={uid} onChange={event=>{setUid(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''));setError('');}} maxLength={7} minLength={7} required autoFocus autoComplete="off" spellCheck={false} disabled={busy}/></label><p className="link-person-preview" role="status">{person?displayName(person):uid.length===7?'Person ID Not Found In This Workspace.':'Paste Their Seven-Character ID.'}{included?' · Already In This Roster':removed?' · Restore From Removed Names':''}</p>{error&&<p className="form-error" role="alert">{error}</p>}<div className="modal-confirm-actions"><ModalDismiss disabled={busy}>Cancel</ModalDismiss><button className="primary" disabled={busy||!person||included||removed}>Link To Roster</button></div></form></Modal>;
}
