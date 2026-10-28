'use client';
import {attendanceSettings} from '../lib/attendance-settings';
import {createContext,useContext,useMemo,type ReactNode} from 'react';
import {displayName as formatName,displayPronunciation as formatPronunciation,type Person} from '../lib/model';
import {organizationSettings,type OrganizationSettings} from '../lib/workspace-settings';
const Context=createContext(organizationSettings());
export function NamePreferences({settings,children}:{settings?:OrganizationSettings;children:ReactNode}){const value=useMemo(()=>organizationSettings(settings),[settings]);return <Context.Provider value={value}>{children}</Context.Provider>;}
export function useNamePreferences(){const settings=useContext(Context);return {attendance:attendanceSettings(settings),displayName:(p:Person)=>formatName(p,settings.nameDisplay),displayPronunciation:(p:Person)=>settings.showPronunciation?formatPronunciation(p):'',settings};}
