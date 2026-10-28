'use client';
import DropdownArrow from './dropdown-arrow';

import {useEffect,useRef,type ReactNode} from 'react';
import {revealSettingsGroup} from '../lib/settings-reveal';
/** Native disclosure keeps fields mounted, so collapsing a group preserves drafts. */
export default function SettingsGroup({title,open=false,children}:{title:string;open?:boolean;children:ReactNode}){
 const expanded=useRef(open),frame=useRef(0);
 useEffect(()=>()=>cancelAnimationFrame(frame.current),[]);
 return <details className="settings-group" open={open} onToggle={event=>{
  if(event.target!==event.currentTarget)return;
  const group=event.currentTarget,wasOpen=expanded.current;expanded.current=group.open;
  cancelAnimationFrame(frame.current);
  if(group.open&&!wasOpen)frame.current=requestAnimationFrame(()=>{frame.current=0;revealSettingsGroup(group);});
 }}><summary><h3>{title}</h3><DropdownArrow size={15}/></summary><div className="settings-group-body">{children}</div></details>;
}
