'use client';
import {useEffect,useState} from 'react';
import {emptyAttendanceFilters,readAttendanceFilters,writeAttendanceFilters} from '../lib/attendance-filter-url';
export default function useAttendanceFilters(){
 const [filters,setFilters]=useState(emptyAttendanceFilters),[ready,setReady]=useState(false);
 useEffect(()=>{const read=()=>{setFilters(readAttendanceFilters(window.location.search));setReady(true);};read();window.addEventListener('take-roll:filters-restored',read);window.addEventListener('take-roll:popstate',read);window.addEventListener('popstate',read);return()=>{window.removeEventListener('take-roll:filters-restored',read);window.removeEventListener('take-roll:popstate',read);window.removeEventListener('popstate',read);};},[]);
 useEffect(()=>{if(!ready)return;const query=writeAttendanceFilters(window.location.search,filters);window.history.replaceState(window.history.state,'',window.location.pathname+(query?'?'+query:''));},[filters,ready]);
 return [filters,setFilters] as const;
}
