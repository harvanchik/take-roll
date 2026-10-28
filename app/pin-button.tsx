'use client';
import {Pin,PinOff} from 'lucide-react';
export default function PinButton({pinned,name,busy,onClick,kind='roster'}:{pinned:boolean;name:string;busy:boolean;onClick:()=>void;kind?:'event'|'roster'}){
 const label=`${pinned?'Unpin':'Pin'} ${name}`;
 return <button type="button" className={'icon pin-button'+(pinned?' pinned':'')} disabled={busy} aria-label={label} aria-pressed={pinned} data-tooltip={kind==='event'?(pinned?'Unpin Event':'Pin Event'):label} onClick={onClick}>{pinned?<PinOff size={14}/>:<Pin size={14}/>}</button>;
}
