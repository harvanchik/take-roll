'use client';
import {CurrentYear} from './page-enhancements';
import LegalLinks from './legal-links';
import CommunityStats from './community-stats';
import InfoPopover from './info-popover';

import {ArrowUpRight,ClipboardList,Layers,ListChecks,Users} from 'lucide-react';
import {useEffect,useState} from 'react';
import ThemeToggle from './theme-toggle';
import LandingPreview from './landing-preview';
import {safeSignInReturn} from '../lib/sign-in.ts';
import {useSignIn} from './use-sign-in';
const features=[
 {icon:Users,title:'Saved Rosters',detail:'Paste CSV or add names.'},
 {icon:Layers,title:'Events & Subevents',detail:'Compare attendance across sessions.'},
 {icon:ListChecks,title:'Quick Attendance',detail:'Mark attendance and excuse types.'},
 {icon:ClipboardList,title:'Notes & Reports',detail:'Track follow-ups and export reports.'},
];
export default function SignedOutLanding({returnTo}:{returnTo:string}){
 const {href:signIn}=useSignIn(returnTo);
 const [authError,setAuthError]=useState('');
 useEffect(()=>{const code=new URLSearchParams(window.location.search).get('auth_error');if(code)setAuthError(code==='cancelled'?'Sign-In Cancelled. Try Again.':'Sign-In Could Not Be Completed. Please Try Again.');},[]);
 const providerPath=(provider:string)=>'/auth/sign-in/'+provider+'?return_to='+encodeURIComponent(safeSignInReturn(returnTo));
 return <div className="auth-landing">
  <header className="auth-header"><a className="auth-brand" href="/"><img className="take-roll-mark" src="/take-roll-mark.svg" width="30" height="30" alt=""/><span>Take Roll</span></a><ThemeToggle/></header>
  <main className="auth-main">
   <section className="auth-story"><h1><span>Take Roll.</span> <span>Keep Track.</span></h1><p className="auth-tagline">Accounting for every member of your staff.</p><div className="auth-features">{features.map(({icon:Icon,title,detail})=><div key={title}><Icon size={22}/><span><strong>{title}</strong><small>{detail}</small></span></div>)}</div></section>
   <section className="auth-sign-in" aria-labelledby="auth-title"><div className="auth-card"><h2 id="auth-title">Sign In</h2>{authError&&<p className="auth-error" role="alert">{authError}</p>}<div className="auth-providers">
    <a href={providerPath('google')}><img className="provider-logo google-logo" src="/brands/google.svg" alt="" width="22" height="22"/><span>Continue with Google</span><ArrowUpRight size={16}/></a>
    <a href={providerPath('microsoft')}><img className="provider-logo" src="/brands/microsoft.svg" alt="" width="22" height="22"/><span>Continue with Microsoft</span><ArrowUpRight size={16}/></a>
    <a className="auth-chatgpt" href={signIn}><img className="provider-logo chatgpt-logo" src="/brands/chatgpt.svg" alt="" width="22" height="22"/><span>Continue with ChatGPT</span><ArrowUpRight size={16}/></a>
   </div><div className="auth-guest-option"><a className="auth-guest-link" href="/events?guest=1">Use without Signing In</a><InfoPopover label="About using Take Roll without signing in">Records saved locally only. Use a method above to save records to a database and access them anywhere.</InfoPopover></div></div></section>
   <CommunityStats/>
   <LandingPreview/>
  </main><footer className="auth-footer"><LegalLinks/><p>© <CurrentYear/> Jake Harvanchik. All Rights Reserved. Proprietary Software.</p></footer>
 </div>;
}


