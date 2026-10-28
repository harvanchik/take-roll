'use client';
import {useEffect,useId,useMemo,useRef,useState} from 'react';
import {Search,UserRound,Users,CalendarDays,Layers,File,History} from 'lucide-react';
import Modal from './modal';
import {usePersonalPreferences} from './personal-preferences';
import {searchItems,searchWorkspace,readRecentSearches,recentSearchKey,type SearchItem} from '../lib/global-search';
import {matchesSearchShortcut} from '../lib/search-shortcut';
import type {Data} from '../lib/model';
const icons={Person:UserRound,Roster:Users,Event:CalendarDays,Subevent:Layers,Page:File};
export default function GlobalSearch({data,owner,onNavigate}:{data:Data;owner:string;onNavigate:(path:string)=>void}){
 const preferences=usePersonalPreferences(),[open,setOpen]=useState(false),[query,setQuery]=useState(''),[active,setActive]=useState(0),[recent,setRecent]=useState<string[]>([]),input=useRef<HTMLInputElement>(null),id=useId();
 const items=useMemo(()=>searchItems(data),[data]);
 const results=useMemo(()=>query.trim()?searchWorkspace(items,query):recent.flatMap(key=>{const item=items.find(item=>item.key===key);return item?[item]:[];}).slice(0,5),[items,query,recent]);
 useEffect(()=>{setOpen(false);setRecent(readRecentSearches(localStorage,owner));},[owner]);
 useEffect(()=>{const handler=(event:KeyboardEvent)=>{
  if(event.isComposing||(event.target as HTMLElement)?.closest('[data-shortcut-recorder]')||!matchesSearchShortcut(event,preferences.globalSearchShortcut))return;
  if(document.querySelector('dialog[open]:not(.global-search-modal)'))return;
  event.preventDefault();event.stopImmediatePropagation();if(event.repeat)return;
  setQuery('');setActive(0);setRecent(readRecentSearches(localStorage,owner));setOpen(true);requestAnimationFrame(()=>input.current?.focus());
 };window.addEventListener('keydown',handler,true);return()=>window.removeEventListener('keydown',handler,true);},[preferences.globalSearchShortcut,owner]);
 const choose=(item:SearchItem)=>{
  const next=[item.key,...recent.filter(key=>key!==item.key)].slice(0,5);setRecent(next);try{localStorage.setItem(recentSearchKey(owner),JSON.stringify(next));}catch{}
  setOpen(false);onNavigate(item.path);
 };
 if(!open)return null;
 const selected=Math.min(active,Math.max(0,results.length-1));
 return <Modal title="Search" icon={<Search size={19}/>} className="global-search-modal" dirty={false} close={()=>setOpen(false)}>
  <div className="global-search-input"><Search size={17}/><input ref={input} autoFocus aria-label="Search The App" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls={id} aria-activedescendant={results.length?id+'-'+selected:undefined} placeholder="Search…" maxLength={200} value={query} onChange={event=>{setQuery(event.target.value);setActive(0);}} onKeyDown={event=>{
   if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();if(results.length)setActive((selected+(event.key==='ArrowDown'?1:-1)+results.length)%results.length);}
   if(event.key==='Enter'){event.preventDefault();if(results[selected])choose(results[selected]);}
  }}/></div>
  <div id={id} role="listbox" aria-label={query.trim()?'Search Results':'Recent Searches'} className="global-search-results">{results.map((item,index)=>{const Icon=query.trim()?icons[item.kind]:History;return <button type="button" role="option" id={id+'-'+index} aria-selected={selected===index} tabIndex={-1} key={item.key} onMouseEnter={()=>setActive(index)} onClick={()=>choose(item)}><Icon size={17}/><span><strong>{item.label}{item.uid&&<span className="global-search-person-id">{item.uid}</span>}{item.testOnly&&<span className="global-search-test-only">Test Only</span>}</strong><small>{item.detail}</small></span></button>;})}</div>
  {!results.length&&<div className="global-search-empty" role="status">{query.trim()?'No results':'No recent searches'}</div>}
 </Modal>;
}
