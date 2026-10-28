'use client';
import {useEffect,useState} from 'react';
import LegalLinks from './legal-links';
import {safeSignInReturn} from '../lib/sign-in';
import {LEGAL_VERSION,agreementDigest} from '../lib/legal-documents';
import {guestPath} from '../lib/guest-store';
type Info={accountId:string;email:string;version:string;documentHash:string;accepted:boolean};
export default function AgreementGate(){
 const [guest,setGuest]=useState<boolean|null>(null);
 useEffect(()=>setGuest(new URLSearchParams(window.location.search).get('guest')==='1'),[]);
 if(guest===null)return <main className="agreement-page" role="status">Loading Agreement…</main>;
 return guest?<GuestAgreement/>:<AccountAgreement/>;
}
function GuestAgreement(){
 const [adult,setAdult]=useState(false),[agree,setAgree]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const accept=async()=>{if(!adult||!agree||busy)return;setBusy(true);setError('');try{
  localStorage.setItem('take-roll.guest-agreement.v1',JSON.stringify({version:LEGAL_VERSION,documentHash:await agreementDigest(),acceptedAt:new Date().toISOString(),adult:true,agree:true}));
  const next=safeSignInReturn(new URLSearchParams(window.location.search).get('return_to')||'/events');
  window.location.replace(guestPath(next));
 }catch{setError('Browser Storage Is Unavailable. Allow Site Storage And Try Again.');setBusy(false);}};
 return <main className="agreement-page"><a className="auth-brand" href="/"><img src="/take-roll-mark.svg" width="30" height="30" alt=""/>Take Roll</a><section className="agreement-card"><h1>Use Take Roll In This Browser</h1><p>Your rosters, events, notes, attendance, settings, and agreement choice are saved on this browser only. They are not uploaded to your account. Clearing site data removes them. Guest mode has no cloud sync or live collaboration.</p><p>Review the <a href="/legal/terms">Terms Of Service & EULA</a>, <a href="/legal/data-processing">Data Processing Terms</a>, and <a href="/legal/privacy">Privacy Policy</a>.</p><small>Browser-Only Mode · Version {LEGAL_VERSION}</small><label className="agreement-check"><input type="checkbox" checked={adult} onChange={e=>setAdult(e.target.checked)} disabled={busy}/>I Am At Least 18 Years Old</label><label className="agreement-check"><input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)} disabled={busy}/>I Agree To The Terms Of Service & EULA And The Data Processing Terms</label><button className="primary" disabled={!adult||!agree||busy} onClick={()=>void accept()}>{busy?'Opening…':'Agree & Continue'}</button><a className="agreement-decline" href="/">Return To Sign In</a>{error&&<p className="form-error" role="alert">{error}</p>}</section><LegalLinks/></main>;
}
function AccountAgreement(){
 const [info,setInfo]=useState<Info|null>(null),[adult,setAdult]=useState(false),[agree,setAgree]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[signedOut,setSignedOut]=useState(false);
 const next=()=>safeSignInReturn(new URLSearchParams(window.location.search).get('return_to')||'/events');
 useEffect(()=>{const controller=new AbortController();fetch('/api/legal',{cache:'no-store',signal:controller.signal}).then(async r=>{if(r.status===401){setSignedOut(true);return;}const p=await r.json() as Info&{error?:string};if(!r.ok)throw Error(p.error||'Could Not Load Agreement.');if(p.accepted){window.location.replace(next());return;}setInfo(p);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[]);
 const accept=async()=>{if(!info||!adult||!agree||busy)return;setBusy(true);setError('');try{const r=await fetch('/api/legal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accountId:info.accountId,revision:0,action:{type:'accept-agreement',version:info.version,documentHash:info.documentHash,adult,agree}})});const p=await r.json() as {accepted?:boolean;error?:string};if(!r.ok||!p.accepted)throw Error(p.error||'Could Not Save Agreement.');window.location.replace(next());}catch(e){setError(e instanceof Error?e.message:'Could Not Save Agreement.');setBusy(false);}};
 return <main className="agreement-page"><a className="auth-brand" href="/"><img src="/take-roll-mark.svg" width="30" height="30" alt=""/>Take Roll</a><section className="agreement-card"><h1>Before You Begin</h1><p>Review the <a href="/legal/terms">Terms Of Service & EULA</a> and <a href="/legal/data-processing">Data Processing Terms</a>. The <a href="/legal/privacy">Privacy Policy</a> explains how information is handled.</p>{info&&<><small>Signed In As {info.email} · Version {info.version}</small><label className="agreement-check"><input type="checkbox" checked={adult} onChange={e=>setAdult(e.target.checked)} disabled={busy}/>I Am At Least 18 Years Old</label><label className="agreement-check"><input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)} disabled={busy}/>I Agree To The Terms Of Service & EULA And The Data Processing Terms</label><button className="primary" disabled={!adult||!agree||busy} onClick={()=>void accept()}>{busy?'Saving…':'Agree & Continue'}</button><a className="agreement-decline" href="/auth/sign-out">Decline & Sign Out</a></>}{signedOut&&<a href="/">Return To Sign In</a>}{!info&&!signedOut&&!error&&<p role="status">Loading Agreement…</p>}{error&&<p className="form-error" role="alert">{error} <button type="button" onClick={()=>window.location.reload()}>Reload</button></p>}</section><LegalLinks/></main>;
}
