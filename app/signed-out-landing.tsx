'use client';
/* Native anchors preserve full navigation for public and authentication pages on the Sites runtime. */
/* eslint-disable @next/next/no-html-link-for-pages */
import {landingFaqs,softwareApplication} from '../lib/landing-content';
import type {PublicStats} from '../lib/public-stats';
import {CurrentYear} from './page-enhancements';
import LegalLinks from './legal-links';
import CommunityStats from './community-stats';
import InfoPopover from './info-popover';

import {ArrowUp,ArrowUpRight,ClipboardList,Layers,ListChecks,Users} from 'lucide-react';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {reducedMotion} from '../lib/motion';
const subscribeLocation=(notify:()=>void)=>{window.addEventListener('popstate',notify);return()=>window.removeEventListener('popstate',notify);};
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
export default function SignedOutLanding({returnTo,initialStats=null}:{returnTo:string;initialStats?:PublicStats|null}){
 const {href:signIn}=useSignIn(returnTo);
 const landingRef=useRef<HTMLDivElement>(null),headerRef=useRef<HTMLElement>(null);
 const [showBackToTop,setShowBackToTop]=useState(false);
 useEffect(()=>{
  const updateScroll=()=>setShowBackToTop(window.scrollY>400);
  const updateHeader=()=>landingRef.current?.style.setProperty('--landing-header-height',headerRef.current?.getBoundingClientRect().height+'px');
  updateScroll();updateHeader();
  const observer=new ResizeObserver(updateHeader);if(headerRef.current)observer.observe(headerRef.current);
  window.addEventListener('scroll',updateScroll,{passive:true});
  return()=>{observer.disconnect();window.removeEventListener('scroll',updateScroll);};
 },[]);
 const authCode=useSyncExternalStore(subscribeLocation,()=>new URLSearchParams(window.location.search).get('auth_error'),()=>null);
 const authError=authCode?(authCode==='cancelled'?'Sign-In Cancelled. Try Again.':'Sign-In Could Not Be Completed. Please Try Again.'):'';
 const providerPath=(provider:string)=>'/auth/sign-in/'+provider+'?return_to='+encodeURIComponent(safeSignInReturn(returnTo));
 return <div className="auth-landing" ref={landingRef}>
  <header className="auth-header" ref={headerRef}><a className="auth-brand" href="/"><img className="take-roll-mark" src="/take-roll-mark.svg" width="30" height="30" alt=""/><span>Take Roll</span></a><nav className="landing-nav" aria-label="Landing page sections"><a href="#features">Features</a><a href="#use-cases">Who it’s for</a><a href="#community-stats">Activity</a><a href="#try-it">Try it</a><a href="#faq">FAQ</a><a href="#auth-title">Sign In</a></nav><ThemeToggle/></header>
  <main className="auth-main" id="main-content"><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(softwareApplication)}}/>
   <section className="auth-story" id="features"><h1><span>Take Roll.</span> <span>Keep Track.</span></h1><p className="auth-tagline">Free attendance tracking for the groups you organize.</p><p className="landing-intro">TakeRoll helps organizers manage rosters, mark attendance, and review records for meetings, practices, and training. Currently free, with no attendee accounts required. Sign in as an organizer or use browser-only guest mode.</p><div className="auth-features">{features.map(({icon:Icon,title,detail})=><div key={title}><Icon size={22}/><span><h2>{title}</h2><small>{detail}</small></span></div>)}</div></section>
   <section className="auth-sign-in" aria-labelledby="auth-title"><div className="auth-card"><h2 id="auth-title">Sign In</h2>{authError&&<p className="auth-error" role="alert">{authError}</p>}<div className="auth-providers">
    <a href={providerPath('google')}><img className="provider-logo google-logo" src="/brands/google.svg" alt="" width="22" height="22"/><span>Continue with Google</span><ArrowUpRight size={16}/></a>
    <a href={providerPath('microsoft')}><img className="provider-logo" src="/brands/microsoft.svg" alt="" width="22" height="22"/><span>Continue with Microsoft</span><ArrowUpRight size={16}/></a>
    <a className="auth-chatgpt" href={signIn}><img className="provider-logo chatgpt-logo" src="/brands/chatgpt.svg" alt="" width="22" height="22"/><span>Continue with ChatGPT</span><ArrowUpRight size={16}/></a>
   </div><div className="auth-guest-option"><a className="auth-guest-link" href="/events?guest=1">Use without Signing In</a><InfoPopover label="About using Take Roll without signing in">Records saved locally only. Use a method above to save records to a database and access them anywhere.</InfoPopover></div></div></section>
   <section className="landing-use-cases" id="use-cases" aria-labelledby="use-cases-title"><h2 id="use-cases-title">Built for Your Group</h2><p>Keep attendance organized for any group, from workplaces and volunteer programs to clubs, classes, and community activities. Manage separate rosters and events, with subevents for individual meetings or sessions.</p></section><CommunityStats initialStats={initialStats}/>
   <LandingPreview/>
   <section className="landing-faq auth-card" id="faq" aria-labelledby="faq-title"><h2 id="faq-title">Frequently Asked Questions</h2>{landingFaqs.map(({question,answer})=><details key={question}><summary><h3>{question}</h3></summary><p>{answer}</p></details>)}<p className="landing-faq-links">Read our <a href="/legal/privacy">Privacy Policy</a> and <a href="/legal/data-processing">Data Processing Terms</a>, or <a href="/events?guest=1">try guest mode</a>.</p></section>
  </main><footer className="auth-footer"><LegalLinks/><p>© <CurrentYear/> Jake Harvanchik. All Rights Reserved. Proprietary Software.</p></footer>
  {showBackToTop&&<button type="button" className="landing-back-to-top" aria-label="Back to top" title="Back to top" onClick={()=>window.scrollTo({top:0,behavior:reducedMotion()?'instant':'smooth'})}><ArrowUp size={20}/></button>}
 </div>;
}


