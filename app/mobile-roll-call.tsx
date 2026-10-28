'use client';
import Select from './select';
import {mobileSwipeActions,SKIP_SWIPE} from '../lib/mobile-swipe-actions';
import {reducedMotion} from '../lib/motion';

import {activeStatuses,activeExcuses,choiceColor,excuseStatus} from '../lib/attendance-settings';
import {colorStyle} from './attendance-style';
import {useNamePreferences} from './name-preferences';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {ArrowLeft,Check,Flag,SkipForward,Users} from 'lucide-react';
import {excuseFor,attendanceLabel,type Participant} from '../lib/model';
import {hapticsEnabled,usesIosHapticTaps} from '../lib/haptics';
import {createIosSwipeHaptic} from '../lib/ios-swipe-haptic';
import useValueDraft from './use-value-draft';
import InlineNote from './inline-note';
import ShakeUndo from './shake-undo';
import {swipeHistoryPosition,type SwipeHistoryNavigation} from '../lib/swipe-history.ts';
type HistoryAnimation={phase:'return'|'replay';sign:-1|1};
type Props={swipeActions?:{left?:string;right?:string};onSwipeAction?:(side:'left'|'right',value:string)=>void;demo?:boolean;people:Participant[];busy:boolean;onAction:(id:string,action:Record<string,unknown>)=>Promise<unknown>;historyNavigation:SwipeHistoryNavigation|null;onUndo:()=>void;onRedo:()=>void;canUndo:boolean;canRedo:boolean;motionEnabled:boolean;onMotionEnabled:(enabled:boolean)=>void};
export default function MobileRollCall({swipeActions,onSwipeAction,demo=false,people,busy,onAction,historyNavigation,onUndo,onRedo,canUndo,canRedo,motionEnabled,onMotionEnabled}:Props){
 const {displayName}=useNamePreferences();
 const [deck,setDeck]=useState(()=>{const first=people.findIndex(p=>!p.status);return {index:first<0?0:first,sequence:0,animation:null as HistoryAnimation|null};});
 const [message,setMessage]=useState(''),[navigationBlocked,setNavigationBlocked]=useState(false);
 const current=people[deck.index];
 const next=()=>setDeck(d=>({...d,index:Math.min(d.index+1,people.length),animation:null}));
 useLayoutEffect(()=>{
  if(!historyNavigation)return;
  setMessage(historyNavigation.message);
  const position=swipeHistoryPosition(people,historyNavigation);
  if(!position)return;
  const sign=historyNavigation.swipeDirection;
  setNavigationBlocked(!!sign);
  setDeck(d=>({index:position.index,sequence:d.sequence+1,animation:sign?{phase:historyNavigation.direction==='undo'?'return':'replay',sign}:null}));
 },[historyNavigation]);
 return <div className="mobile-roll-call"><div className="mobile-deck-nav"><button className="icon" aria-label="Previous Person" disabled={deck.index===0||busy||navigationBlocked} onClick={()=>setDeck(d=>({...d,index:Math.max(0,d.index-1),animation:null}))}><ArrowLeft size={20}/></button><span>{current?`${deck.index+1} of ${people.length}`:`${people.length} People Reviewed`}</span><div className="mobile-deck-tools">{!demo&&<ShakeUndo onUndo={onUndo} onRedo={onRedo} canUndo={canUndo&&!busy} canRedo={canRedo&&!busy} enabled={motionEnabled} onEnabled={onMotionEnabled} onMessage={setMessage}/>}<button className="icon" aria-label="Skip Person" disabled={!current||busy||navigationBlocked} onClick={next}><SkipForward size={20}/></button></div></div>{current?<SwipeCard swipeActions={swipeActions} onSwipeAction={onSwipeAction} key={current.id+'|'+deck.sequence} person={current} nextPerson={people[deck.index+1]} animation={deck.animation} onReplayComplete={next} onLock={setNavigationBlocked} busy={busy} onAction={action=>onAction(current.id,action)} onMarked={label=>{setMessage(`${displayName(current)} · ${label}`);next();}}/>:<div className="mobile-deck-done"><Check size={32}/><h3>{people.length?'End of This View':'No Matching People'}</h3><p>{people.length?'Review your marks or change filters to keep going.':'Try another filter or clear your search.'}</p>{people.length>0&&<button onClick={()=>setDeck(d=>({...d,index:0,animation:null}))}><Users size={17}/>Review From Start</button>}</div>}<div className="mobile-last-mark" role="status" aria-live="polite">{message}</div></div>;
}
function SwipeCard({swipeActions,onSwipeAction,person:p,nextPerson,animation,onReplayComplete,onLock,busy,onAction,onMarked}:{swipeActions?:Props['swipeActions'];onSwipeAction?:Props['onSwipeAction'];person:Participant;nextPerson?:Participant;animation:HistoryAnimation|null;onReplayComplete:()=>void;onLock:(locked:boolean)=>void;busy:boolean;onAction:(action:Record<string,unknown>)=>Promise<unknown>;onMarked:(label:string)=>void}){
 const {displayName,displayPronunciation,attendance:config}=useNamePreferences();
 const statuses=activeStatuses(config),excuses=activeExcuses(config),{right,left}=mobileSwipeActions(config,swipeActions);
 const reasonDraft=useValueDraft({id:p.id,status:p.status,excuse:excuseFor(p),removed:p.removed},value=>value.excuse);
 const {value:reason,setValue:setReason}=reasonDraft;const [working,setWorking]=useState(false);
 const stack=useRef<HTMLDivElement>(null),card=useRef<HTMLElement>(null),frame=useRef(0),offset=useRef(0);
 const gesture=useRef<{x:number;y:number;id:number;axis:'pending'|'horizontal'}|null>(null),noteFlush=useRef<()=>void>(()=>{}),timer=useRef<ReturnType<typeof setTimeout>|null>(null),lock=useRef(false),mounted=useRef(true);
 const swipeHaptic=useRef<ReturnType<typeof createIosSwipeHaptic>|null>(null);
 useEffect(()=>{if(!usesIosHapticTaps()||!card.current)return;const native=createIosSwipeHaptic(card.current,hapticsEnabled);swipeHaptic.current=native;return()=>{native.destroy();swipeHaptic.current=null;};},[]);
 const reduced=()=>reducedMotion();
 const paint=(x:number)=>{offset.current=x;const node=stack.current;if(!node)return;const strength=Math.min(1,Math.abs(x)/110);node.style.setProperty('--swipe-x',x+'px');node.style.setProperty('--swipe-turn',(Math.max(-16,Math.min(16,x/22)))+'deg');node.style.setProperty('--swipe-strength',strength*100+'%');node.style.setProperty('--swipe-reveal',String(strength));node.style.setProperty('--swipe-tone',choiceColor(x>=0?right?.id:left?.id,config));};
 const reset=()=>{cancelAnimationFrame(frame.current);if(stack.current){stack.current.dataset.dragging='false';stack.current.dataset.leaving='false';}paint(0);};
 useLayoutEffect(()=>{mounted.current=true;return()=>{mounted.current=false;onLock(false);cancelAnimationFrame(frame.current);if(timer.current)clearTimeout(timer.current);};},[]);
 // Recreate the affected card before animating; cleanup cancels an interrupted exit.
 useLayoutEffect(()=>{
  if(!animation||!stack.current)return;
  const node=stack.current;
  let cancelled=false;
  lock.current=true;setWorking(true);onLock(true);
  const distance=animation.sign*(window.innerWidth+(card.current?.clientWidth||320));
  const finish=()=>{if(cancelled)return;lock.current=false;setWorking(false);onLock(false);if(animation.phase==='replay')onReplayComplete();};
  if(reduced()){finish();return;}
  node.dataset.historyPreparing='true';
  paint(animation.phase==='return'?distance:0);
  void node.offsetWidth;
  frame.current=requestAnimationFrame(()=>{
   delete node.dataset.historyPreparing;
   if(animation.phase==='replay')node.dataset.leaving='true';
   paint(animation.phase==='return'?0:distance);
   timer.current=setTimeout(finish,animation.phase==='return'?300:270);
  });
  return()=>{cancelled=true;cancelAnimationFrame(frame.current);if(timer.current)clearTimeout(timer.current);};
 },[]);
 const mark=(status:string|null,swipeDirection?:-1|1)=>{
  if(lock.current||busy)return;lock.current=true;onLock(true);setWorking(true);noteFlush.current();gesture.current=null;cancelAnimationFrame(frame.current);
  if(stack.current){stack.current.dataset.dragging='false';stack.current.dataset.leaving='true';}
  // Match the exit distance to the viewport instead of jumping to a fixed offset.
  const sign=swipeDirection??(status===left?.id?-1:1);
  paint(sign*(window.innerWidth+(card.current?.clientWidth||320)));
  const started=performance.now();
  const unlock=()=>{if(!mounted.current)return;lock.current=false;setWorking(false);onLock(false);};
  // Queue the mark on release, then let the exit finish before revealing the next card.
  void (async()=>{try{const result=status===SKIP_SWIPE?true:await onAction({type:'attendance-state',status,before:reasonDraft.source,excuse:config.statuses.find(s=>s.id===status)?.allowExcuse===false?null:(excuses.some(e=>e.id===reason)?reason:null),swipeDirection:sign});if(!mounted.current)return;if(!result){reset();unlock();return;}timer.current=setTimeout(()=>{onMarked(status===SKIP_SWIPE?'Skipped':attendanceLabel({...p,status:status??(reason&&excuses.some(e=>e.id===reason)?excuseStatus(reason):null),excuse:config.statuses.find(s=>s.id===status)?.allowExcuse===false?null:(excuses.some(e=>e.id===reason)?reason:null)},config));unlock();},reduced()?0:Math.max(0,260-(performance.now()-started)));}catch{if(mounted.current){reset();unlock();}}})();
 };
 const disabled=busy||working;
 return <div className="mobile-card-stage"><div className="mobile-swipe-cues">{(['left','right'] as const).map(side=>{const action=side==='left'?left:right;return <div key={side} className={'mobile-swipe-action mobile-swipe-'+side} style={{color:choiceColor(action?.id,config)}}>{side==='left'&&<span aria-hidden="true">←</span>}<Select className="swipe-action-trigger" value={action?.id??''} disabled={disabled||!onSwipeAction} aria-label={side==='left'?'Swipe Left Action':'Swipe Right Action'} onValueChange={value=>onSwipeAction?.(side,value)}>{statuses.map(status=><option key={status.id} value={status.id}><span style={{color:choiceColor(status.id,config)}}>{status.name}</span></option>)}<option value={SKIP_SWIPE}>Skip</option></Select>{side==='right'&&<span aria-hidden="true">→</span>}</div>;})}</div><div className="mobile-card-stack" ref={stack}>{nextPerson&&<CardPreview person={nextPerson}/>}<article ref={card} className="mobile-person-card mobile-front-card" tabIndex={0} aria-label={`Attendance Card for ${displayName(p)}`} onPointerDown={e=>{if(disabled||e.button!==0||(e.target as Element).closest('button,input,textarea,a,select'))return;cancelAnimationFrame(frame.current);gesture.current={x:e.clientX,y:e.clientY,id:e.pointerId,axis:'pending'};if(stack.current)stack.current.dataset.dragging='true';e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{const g=gesture.current;if(!g||g.id!==e.pointerId)return;const x=e.clientX-g.x,y=e.clientY-g.y;if(g.axis==='pending'){if(Math.max(Math.abs(x),Math.abs(y))<8)return;if(Math.abs(y)>Math.abs(x)){gesture.current=null;swipeHaptic.current?.cancel();reset();return;}g.axis='horizontal';if(e.pointerType==='touch')swipeHaptic.current?.capture(e.pointerId);}cancelAnimationFrame(frame.current);frame.current=requestAnimationFrame(()=>paint(x));}} onPointerUp={e=>{const g=gesture.current;gesture.current=null;if(!g)return;cancelAnimationFrame(frame.current);const distance=e.clientX-g.x;if(g.axis==='horizontal'&&Math.abs(distance)>=Math.min(95,e.currentTarget.clientWidth*.28)){const status=distance>0?right?.id:left?.id;if(status){swipeHaptic.current?.commit();paint(distance);mark(status,distance>0?1:-1);}else{swipeHaptic.current?.cancel();reset();}}else{swipeHaptic.current?.cancel();reset();}}} onPointerCancel={()=>{gesture.current=null;swipeHaptic.current?.cancel();reset();}} onLostPointerCapture={e=>{if(gesture.current&&!swipeHaptic.current?.owns(e.pointerId)){gesture.current=null;swipeHaptic.current?.cancel();reset();}}}>
 <div className="mobile-card-top"><span className="mobile-current-status">{attendanceLabel(p,config)}</span>{config.flags&&<button className={'icon person-flag '+(p.flag||'neutral')} aria-label={p.flag==='flagged'?'Mark Follow-up Complete':p.flag==='complete'?'Clear Flag':'Flag for Follow-up'} disabled={disabled} onClick={()=>void onAction({type:'person-flag',flag:p.flag==='flagged'?'complete':p.flag==='complete'?null:'flagged'})}>{p.flag==='complete'?<Check size={20}/>:<Flag size={20} fill={p.flag==='flagged'?'currentColor':'none'}/>}</button>}</div><div className="mobile-card-name"><h3>{displayName(p)}</h3>{displayPronunciation(p)&&<p>{displayPronunciation(p)}</p>}</div>
 <fieldset className="mobile-excuses" disabled={disabled}><legend>{config.excusedLabel}</legend>{excuses.map(e=><button type="button" key={e.id} aria-pressed={reason===e.id} style={colorStyle(e.color)} className={'status-button'+(reason===e.id?' checked':'')} onClick={()=>setReason(reason===e.id?null:e.id)}>{e.name}</button>)}</fieldset>{config.comments&&<label className="mobile-note-label">Comment<InlineNote value={p.note} name={displayName(p)} onSave={(note,before)=>onAction({type:'person-note',note,before})} flushRef={noteFlush}/></label>}<div className="mobile-custom-statuses">{statuses.map(s=><button type="button" key={s.id} disabled={disabled} aria-pressed={p.status===s.id} className={'status-button'+(p.status===s.id?' checked':'')} style={colorStyle(s.color)} onClick={()=>mark(s.id)}>{s.name}</button>)}</div>{reason&&excuses.some(e=>e.id===reason)&&<button className="mobile-excuse-only" disabled={disabled} onClick={()=>mark(null)}>Save {config.excusedLabel} Only</button>}</article></div></div>;
}

function CardPreview({person:p}:{person:Participant}){
 const {displayName,displayPronunciation,attendance:config}=useNamePreferences();return <div className="mobile-person-card mobile-next-card" aria-hidden="true" inert><div className="mobile-card-top"><span>{attendanceLabel(p,config)}</span>{config.flags&&<Flag size={20}/>}</div><div className="mobile-card-name"><h3>{displayName(p)}</h3>{displayPronunciation(p)&&<p>{displayPronunciation(p)}</p>}</div><div className="mobile-preview-excuses"><strong>{config.excusedLabel}</strong><div>{activeExcuses(config).map(e=><span key={e.id}>{e.name}</span>)}</div></div>{config.comments&&<div className="mobile-note-label">Comment<div className="mobile-preview-note">{p.note||'Comment…'}</div></div>}</div>;}
