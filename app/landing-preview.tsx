'use client';
import {useSyncExternalStore} from 'react';
import RollCall from './roll-call';

const subscribe=()=>()=>{};
export default function LandingPreview(){
 const ready=useSyncExternalStore(subscribe,()=>true,()=>false);
 return <section id="try-it" className="landing-demo" aria-labelledby="demo-title"><div className="landing-demo-caption"><h2 id="demo-title">Try Taking Roll</h2></div>{ready?<RollCall demo/>:<div className="demo-loading" role="status">Loading Attendance Preview…</div>}</section>;
}
