'use client';
import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import {preferenceSettings,defaultPreferences,type Preferences} from '../lib/workspace-settings';
import {formatDay,formatTimestamp} from '../lib/dates';
import {readViewState,viewStateKey} from '../lib/personal-navigation';
const Context=createContext({preferences:defaultPreferences,owner:''});
export function PersonalPreferences({value,owner,children}:{value?:Preferences;owner:string;children:ReactNode}){
 const preferences=useMemo(()=>preferenceSettings(value),[value]);
 useEffect(()=>{const root=document.documentElement;root.dataset.density=preferences.tableDensity;root.dataset.reduceMotion=String(preferences.reduceMotion);root.dataset.shortcutHints=String(preferences.shortcutHints);
  if(!preferences.rememberFilters&&owner)try{const prefix=viewStateKey(owner,'');for(const key of Object.keys(localStorage))if(key.startsWith(prefix))localStorage.removeItem(key);}catch{}
 },[preferences.tableDensity,preferences.reduceMotion,preferences.shortcutHints,preferences.rememberFilters,owner]);
 useEffect(()=>()=>{for(const key of ['density','reduceMotion','shortcutHints'])delete document.documentElement.dataset[key];},[]);
 const context=useMemo(()=>({preferences,owner}),[preferences,owner]);
 return <Context.Provider value={context}>{children}</Context.Provider>;
}
export const usePersonalPreferences=()=>useContext(Context).preferences;
export function useDisplayDates(){const p=usePersonalPreferences();return {formatDay:(value:string)=>formatDay(value,p),formatTimestamp:(value:string)=>formatTimestamp(value,p)};}
export function useRememberedView<T extends Record<string,unknown>>(path:string,defaults:T){
 const {preferences:p,owner}=useContext(Context),key=viewStateKey(owner,path);
 const [value,setValue]=useState<T>(()=>p.rememberFilters&&typeof window!=='undefined'?readViewState(localStorage,key,defaults):defaults);
 useEffect(()=>{try{if(p.rememberFilters)localStorage.setItem(key,JSON.stringify(value));else localStorage.removeItem(key);}catch{}},[key,p.rememberFilters,value]);
 return [value,setValue] as const;
}
