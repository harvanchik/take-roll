'use client';
import {useEffect,useState} from 'react';
import RollCall from './roll-call';

export default function LandingPreview(){
 const [ready,setReady]=useState(false);
 useEffect(()=>setReady(true),[]);
 return <section className="landing-demo" aria-labelledby="demo-title"><div className="landing-demo-caption"><h2 id="demo-title">Try Taking Roll</h2></div>{ready?<RollCall demo/>:<div className="demo-loading" role="status">Loading Attendance Preview…</div>}</section>;
}
