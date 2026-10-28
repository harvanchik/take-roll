'use client';
import {useEffect,useState} from 'react';
import {safeSignInReturn} from '../lib/sign-in.ts';

export function useSignIn(returnTo:string){
 const [hostname,setHostname]=useState('');
 useEffect(()=>{setHostname(window.location.hostname);},[]);
 return {href:'/auth/chatgpt?return_to='+encodeURIComponent(safeSignInReturn(returnTo)),backup:['takeroll.online','www.takeroll.online'].includes(hostname)};
}
