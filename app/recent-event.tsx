'use client';
import type {ReactNode} from 'react';
import PinButton from './pin-button';
import EventOptions from './event-options';
export default function RecentEvent({name,selected,busy,children,onOpen,onDuplicate,onArchive,onSettings,pinned=false,onPin}:{name:string;selected:boolean;busy:boolean;children:ReactNode;onOpen:()=>void;onDuplicate:()=>Promise<unknown>;onArchive:()=>Promise<unknown>;onSettings?:()=>void;pinned?:boolean;onPin?:()=>void}){
 return <div className={'recent-entry'+(onPin?' pinnable':'')}><EventOptions busy={busy} onSettings={()=>onSettings?.()} onDuplicate={()=>void onDuplicate()} onArchive={onArchive}><button className={'recent'+(selected?' selected':'')} onClick={onOpen} aria-label={name+'. Right-click for event actions.'}>{children}</button></EventOptions>{onPin&&<PinButton kind="event" pinned={pinned} name={name} busy={busy} onClick={onPin}/>}</div>;
}
