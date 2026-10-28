'use client';
import {Component,useEffect,useState,type ReactNode} from 'react';
import PreferenceSync from './preference-sync';
import {installViewportGuards} from '../lib/installed-viewport';
import HapticFeedback from './haptic-feedback';
import Tooltips from './tooltips';
import {currentCopyrightYear} from '../lib/legal-presentation';

export function CurrentYear(){
 const [year,setYear]=useState(2026);
 useEffect(()=>{const update=()=>setYear(currentCopyrightYear());update();const timer=window.setInterval(update,60_000);window.addEventListener('focus',update);return()=>{window.clearInterval(timer);window.removeEventListener('focus',update);};},[]);
 return <span>{year}</span>;
}

/** Optional interface helpers must never replace the workspace with an error. */
export class EnhancementBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?null:this.props.children;}
}

// Keep the small storage notice in this shared bundle. A separate notice file
// can be blocked by privacy extensions before React can render any page.
function StorageNotice(){
 const [open,setOpen]=useState(false);
 useEffect(()=>{try{setOpen(localStorage.getItem('take-roll.cookie-notice.v1')!=='seen');}catch{setOpen(true);}},[]);
 if(!open)return null;
 return <aside className="cookie-notice" aria-label="Cookie Notice"><div><strong>Cookies & Device Storage</strong><p>We use essential sign-in cookies and store preferences and guest-mode records on your device. No advertising or analytics trackers.</p><a href="/legal/cookies">Cookie Details & Controls</a></div><button type="button" onClick={()=>{try{localStorage.setItem('take-roll.cookie-notice.v1','seen');}catch{}setOpen(false);}}>Got It</button></aside>;
}

export default function PageEnhancements(){useEffect(()=>installViewportGuards(),[]);return <>
 <EnhancementBoundary><Tooltips/></EnhancementBoundary>
 <EnhancementBoundary><HapticFeedback/></EnhancementBoundary>
 <EnhancementBoundary><PreferenceSync/></EnhancementBoundary>
 <EnhancementBoundary><StorageNotice/></EnhancementBoundary>
 </>;}
