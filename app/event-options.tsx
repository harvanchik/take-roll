'use client';
import {ContextMenu} from '@base-ui/react/context-menu';
import {Settings,Copy,Archive} from 'lucide-react';
import {useState,type ReactElement} from 'react';
import Modal from './modal';
export default function EventOptions({children,busy,onSettings,onDuplicate,onArchive}:{children:ReactElement;busy:boolean;onSettings:()=>void;onDuplicate:()=>void;onArchive:()=>Promise<unknown>}){
 const [confirm,setConfirm]=useState(false);
 return <><ContextMenu.Root><ContextMenu.Trigger render={children}/><ContextMenu.Portal><ContextMenu.Positioner collisionPadding={8}><ContextMenu.Popup className="subevent-options-popup"><ContextMenu.Item className="subevent-option" disabled={busy} onClick={onSettings}><Settings size={14}/>Settings</ContextMenu.Item><ContextMenu.Item className="subevent-option" disabled={busy} onClick={onDuplicate}><Copy size={14}/>Duplicate Event</ContextMenu.Item><ContextMenu.Item className="subevent-option" disabled={busy} onClick={()=>setConfirm(true)}><Archive size={14}/>Archive Event</ContextMenu.Item></ContextMenu.Popup></ContextMenu.Positioner></ContextMenu.Portal></ContextMenu.Root>{confirm&&<Modal title="Archive Event" close={()=>setConfirm(false)}><p>Archive this event? Its attendance and history will be kept.</p><div className="settings-actions"><button type="button" onClick={()=>setConfirm(false)}>Cancel</button><button type="button" className="primary" disabled={busy} onClick={async()=>{if(await onArchive())setConfirm(false);}}>Archive Event</button></div></Modal>}</>;
}
