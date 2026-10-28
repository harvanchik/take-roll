'use client';
import {Fragment,type ReactNode} from 'react';
import {Users} from 'lucide-react';
import PinButton from './pin-button';
export default function SidebarFavorites({items,busy,onOpen,onUnpin,renderEvent}:{items:Array<{id:string;name:string;kind:'event'|'roster';selected:boolean}>;busy:boolean;onOpen:(kind:'event'|'roster',id:string)=>void;onUnpin:(kind:'event'|'roster',id:string)=>void;renderEvent:(id:string)=>ReactNode}){
 if(!items.length)return null;
 return <section className="sidebar-favorites" aria-label="Pinned Events"><div className="workspace-label">PINNED</div><div className="sidebar-favorite-list">{items.map(item=>item.kind==='event'?<Fragment key={item.kind+item.id}>{renderEvent(item.id)}</Fragment>:<div className="sidebar-favorite" key={item.kind+item.id}><button type="button" className={'favorite-open'+(item.selected?' selected':'')} aria-label={`Open Pinned Roster ${item.name}`} data-tooltip={item.name} onClick={()=>onOpen(item.kind,item.id)}><Users size={14}/><span>{item.name}</span></button><PinButton pinned name={item.name} busy={busy} onClick={()=>onUnpin(item.kind,item.id)}/></div>)}</div></section>;
}
