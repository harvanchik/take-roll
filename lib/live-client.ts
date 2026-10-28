import type {Data} from './model';
import {applyLivePatch,type LivePatch} from './live-patch.ts';
export type LiveVersion={accountId?:string;workspaceId?:string;revision?:number;settingsVersion?:string;organizationRole?:'admin'|'member';reload?:boolean;data?:Data};
/** One connection per visible tab; short HTTP polling is only a transport fallback. */
export function subscribeWorkspace(onVersion:(v:LiveVersion)=>void,onSignedOut:()=>void,onState:(state:'live'|'connecting'|'offline')=>void,workspaceId?:string){
 const selection=workspaceId?'&workspace='+encodeURIComponent(workspaceId):'';
 let stopped=false,source:EventSource|null=null,timer:ReturnType<typeof setTimeout>|undefined,lastMessage=0,polling=false,failures=0,streamFailures=0,reconnectAt=0,nextPollAt=0;
 const abort=new AbortController();
 let baseline:LiveVersion|undefined;
 const active=()=>!stopped&&!document.hidden&&navigator.onLine;
 const accept=(v:LiveVersion)=>{lastMessage=Date.now();failures=0;onState('live');onVersion(v);};
 const poll=async()=>{if(!active()||polling||Date.now()<nextPollAt)return;polling=true;
  try{const r=await fetch('/api/attendance/live?poll=1'+selection,{cache:'no-store',signal:abort.signal});if(stopped)return;if(r.status===401){onSignedOut();return;}if(r.status===428){window.location.replace('/agreement?return_to='+encodeURIComponent(window.location.pathname));return;}if(!r.ok)throw Error('Unavailable');accept(await r.json());}
  catch{if(!stopped){failures++;onState('offline');}}finally{polling=false;nextPollAt=Date.now()+Math.min(30_000,2000*2**Math.min(failures,4));}
 };
 const open=()=>{
  if(!active()||source||Date.now()<reconnectAt)return;
  onState('connecting');
  if(typeof EventSource!=='undefined'){
   lastMessage=Date.now(); // Give a new stream time to connect before using HTTP fallback.
   baseline=undefined;
   const stream=new EventSource('/api/attendance/live?snapshot=1'+selection);source=stream;
   stream.onopen=()=>{if(source!==stream||stopped)return;lastMessage=Date.now();onState('live');};
   stream.addEventListener('ping',()=>{if(source!==stream||stopped)return;lastMessage=Date.now();onState('live');});
   stream.onmessage=event=>{if(source!==stream||stopped)return;try{
    const packet=JSON.parse(event.data) as LiveVersion&{patch?:LivePatch[];baseRevision?:number};
    if(packet.patch){if(!baseline?.data||packet.baseRevision!==baseline.revision||packet.accountId!==baseline.accountId||packet.workspaceId!==baseline.workspaceId)throw Error('Live Patch Gap');packet.data=applyLivePatch(baseline.data,packet.patch);}
    if(packet.data)baseline={accountId:packet.accountId,workspaceId:packet.workspaceId,revision:packet.revision,data:packet.data};
    streamFailures=0;accept(packet);
   }catch{baseline=undefined;stream.close();source=null;reconnectAt=0;accept({reload:true});}};
   stream.onerror=()=>{if(source!==stream||stopped)return;stream.close();source=null;streamFailures++;reconnectAt=Date.now()+Math.min(30_000,250*2**Math.min(streamFailures-1,7));if(active())onState('connecting');};
  }
 };
 const tick=async()=>{
  if(stopped)return;
  if(active()){if(source&&Date.now()-lastMessage>12_000){source.close();source=null;reconnectAt=0;await poll();}open();if(!source&&Date.now()-lastMessage>2000)await poll();}
  timer=setTimeout(tick,typeof EventSource!=='undefined'?500:Math.min(30_000,2000*2**Math.min(failures,4)));
 };
 const visibility=()=>{if(!active()){source?.close();source=null;onState(navigator.onLine?'connecting':'offline');}else{lastMessage=0;reconnectAt=0;nextPollAt=0;open();void poll();}};
 document.addEventListener('visibilitychange',visibility);window.addEventListener('online',visibility);window.addEventListener('offline',visibility);
 open();void tick();
 return()=>{stopped=true;source?.close();abort.abort();clearTimeout(timer);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('online',visibility);window.removeEventListener('offline',visibility);};
}
