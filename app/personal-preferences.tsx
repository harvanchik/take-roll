'use client';
import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import {preferenceSettings,defaultPreferences,type Preferences} from '../lib/workspace-settings';
import {formatDay,formatTimestamp} from '../lib/dates';
import {viewStateKey} from '../lib/personal-navigation';
const Context=createContext({preferences:defaultPreferences,owner:''});
export function PersonalPreferences({value,owner,children}:{value?:Preferences;owner:string;children:ReactNode}){
 const preferences=useMemo(()=>preferenceSettings(value),[value]);
 useEffect(()=>{const root=document.documentElement;root.dataset.density=preferences.tableDensity;root.dataset.reduceMotion=String(preferences.reduceMotion);root.dataset.shortcutHints=String(preferences.shortcutHints);
  if(owner)try{const prefix=viewStateKey(owner,'');for(const key of Object.keys(localStorage))if(key.startsWith(prefix))localStorage.removeItem(key);}catch{}
 },[preferences.tableDensity,preferences.reduceMotion,preferences.shortcutHints,preferences.rememberFilters,owner]);
 useEffect(()=>()=>{for(const key of ['density','reduceMotion','shortcutHints'])delete document.documentElement.dataset[key];},[]);
 const context=useMemo(()=>({preferences,owner}),[preferences,owner]);
 return <Context.Provider value={context}>{children}</Context.Provider>;
}
export const usePersonalPreferences=()=>useContext(Context).preferences;
export function useDisplayDates(){const p=usePersonalPreferences();return {formatDay:(value:string)=>formatDay(value,p),formatTimestamp:(value:string)=>formatTimestamp(value,p)};}
/** Page searches live only in the URL, never in account or browser storage. */
export function usePageSearch(path:string){
 const [value,setValue]=useState({search:''}),[ready,setReady]=useState(false);
 useEffect(()=>{const read=()=>{setValue({search:new URLSearchParams(window.location.search).get('search')||''});setReady(true);};read();window.addEventListener('take-roll:filters-restored',read);window.addEventListener('popstate',read);return()=>{window.removeEventListener('take-roll:filters-restored',read);window.removeEventListener('popstate',read);};},[path]);
 useEffect(()=>{if(!ready)return;const q=new URLSearchParams(window.location.search);q.delete('search');if(value.search)q.set('search',value.search);window.history.replaceState(window.history.state,'',window.location.pathname+(q.size?'?'+q.toString():''));},[value,ready]);
 return [value,setValue] as const;
}
