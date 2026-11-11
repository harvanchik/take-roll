'use client';

import {useEffect,useState} from 'react';

export default function NotFound(){
 const [signInRecovery,setSignInRecovery]=useState(false);
 useEffect(()=>{
  if(window.location.pathname.replace(/\/$/,'')==='/callback'){
   setSignInRecovery(true);
   // Discard the failed authorization code; a retry starts a fresh login.
   window.history.replaceState(window.history.state,'','/callback');
  }
 },[]);
 return <main className="auth-recovery"><section className="panel">
  <p className="eyebrow">Take Roll</p>
  <h1>{signInRecovery?'Sign-in could not be completed':'Page not found'}</h1>
  <p>{signInRecovery?'Your sign-in may have expired or been interrupted. Start again to continue.':'This page is unavailable. Return to Take Roll to continue.'}</p>
  {signInRecovery&&<div className="auth-providers">
   <a href="/auth/chatgpt?return_to=%2Fevents" target="_top">Try ChatGPT again</a>
   <a href="/auth/sign-in/google?return_to=%2Fevents" target="_top">Continue with Google</a>
   <a href="/auth/sign-in/microsoft?return_to=%2Fevents" target="_top">Continue with Microsoft</a>
  </div>}
  <a href="/">Return to Take Roll</a>
 </section></main>;
}

