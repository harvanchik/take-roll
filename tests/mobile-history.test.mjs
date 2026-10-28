import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import {dirname} from 'node:path';
import {applyAction,displayName} from '../lib/model.ts';
import {seedData} from './fixtures.mjs';
import {swipeHistoryNavigation,swipeHistoryPosition} from '../lib/swipe-history.ts';
import {ShakeDetector} from '../lib/shake-undo.ts';
import {signInHref} from '../lib/sign-in.ts';
import {confirmShakeHistory} from '../lib/confirm-shake.ts';
const require=createRequire(import.meta.url);
const {build}=require(require.resolve('esbuild',{paths:[dirname(require.resolve('wrangler/package.json'))]}));
await build({entryPoints:['lib/attendance-queue.ts'],bundle:true,platform:'node',format:'esm',outfile:'.sites-runtime/mobile-queue-test.mjs'});
const {AttendanceQueue}=await import('../.sites-runtime/mobile-queue-test.mjs');

test('rapid swipe undo/redo targets the changed person, restores status, and updates deck feedback before saves finish',async()=>{
 let data=seedData();data=applyAction(data,{type:'create-event',name:'Mobile Training',date:'2026-10-15',rosterId:data.rosters[0].id});
 const event=data.events[0],[first,second]=event.participants;
 let release,revision=0;const gate=new Promise(resolve=>release=resolve);
 const q=new AttendanceQueue(data,0,async body=>{await gate;data=applyAction(data,body.action,body.occurredAt,body.mutationId);return {status:200,data,revision:++revision};},()=>{});
 assert.equal(q.undo(event.id),undefined);
 q.enqueue({type:'attendance-state',eventId:event.id,personId:first.id,status:'Present',excuse:null,swipeDirection:1});
 q.enqueue({type:'attendance-state',eventId:event.id,personId:second.id,status:'Absent',excuse:'academic',swipeDirection:-1});
 const nav=(direction,token)=>swipeHistoryNavigation(q[direction](event.id),direction,q.data,token,'view');
 let navigation=nav('undo',1);
 assert.equal(navigation.personId,second.id);assert.equal(navigation.swipeDirection,-1);
 assert.deepEqual(swipeHistoryPosition(q.data.events[0].participants,navigation),{index:1,afterReplay:2});
 assert.equal(navigation.message,`Undid · ${displayName(second)} · Unmarked`);
 navigation=nav('undo',2);assert.equal(navigation.personId,first.id);assert.equal(navigation.swipeDirection,1);
 assert.deepEqual(swipeHistoryPosition(q.data.events[0].participants,navigation),{index:0,afterReplay:1});
 navigation=nav('redo',3);assert.equal(navigation.message,`Redid · ${displayName(first)} · Present`);
 navigation=nav('redo',4);assert.match(navigation.message,/Absent.*Excused \(A\)/);
 assert.equal(navigation.personId,second.id);
 // Person identity wins over the old list index, including sorted/filtered lists.
 assert.deepEqual(swipeHistoryPosition([second,first],navigation),{index:0,afterReplay:1});
 assert.equal(swipeHistoryPosition([first],navigation),null);
 const done=q.flush();release();assert.equal(await done,true);
 assert.equal(data.events[0].participants[0].status,'Present');
 assert.equal(data.events[0].participants[1].status,'Absent');
 assert.equal(data.events[0].participants[1].excuse,'academic');
 assert.deepEqual(data.events[0].participants[1].history.map(h=>h.kind),['Status','Undo · Status','Redo · Status']);
});

test('note and flag history selects the affected person without pretending it was a swipe',()=>{
 const person={id:'p',name:'Alex',pronunciation:'',status:'Tardy',excuse:null,note:'Saved',flag:'complete',updatedAt:null,removed:false,history:[]};
 const data={rosters:[],events:[{id:'e',participants:[person]}]};
 for(const type of ['person-note','person-flag']){
  const move={eventId:'e',forward:{type,personId:'p'},backward:{type,personId:'p'}};
  const navigation=swipeHistoryNavigation(move,'undo',data,1,'view');
  assert.equal(navigation.swipeDirection,0);assert.equal(navigation.personId,'p');
  assert.match(navigation.message,type==='person-note'?/Note$/:/Follow-up Complete$/);
 }
});

test('shake detection ignores jitter and single bumps, requires reversals, and cools down',()=>{
 const detector=new ShakeDetector();const sample=(x,t)=>detector.sample({x,y:0,z:0},t);
 for(let i=0;i<20;i++)assert.equal(sample(i%2,100+i*80),false);
 assert.equal(sample(22,1800),false);assert.equal(sample(0,1900),false);
 assert.equal(sample(0,2700),false);assert.equal(sample(20,2800),false);
 assert.equal(sample(-20,2900),false);assert.equal(sample(20,3000),true);
 for(let i=0;i<15;i++)assert.equal(sample(i%2?20:-20,3100+i*90),false);
 assert.equal(sample(0,5400),false);assert.equal(sample(20,5500),false);
 assert.equal(sample(-20,5600),false);assert.equal(sample(20,5700),true);
});

test('missing motion values and unrelated one-direction movement cannot trigger undo',()=>{
 const detector=new ShakeDetector();
 for(let i=0;i<8;i++)assert.equal(detector.sample({x:i*18,y:0,z:0},100+i*100),false);
 assert.equal(detector.sample({x:null,y:0,z:0},1000),false);
 assert.equal(detector.sample(null,1100),false);
 assert.equal(detector.sample({x:NaN,y:0,z:0},1200),false);
});

test('custom-domain login stays on the current host and preserves safe subevent return paths',()=>{
 const path='/event/basketball/day-2';
 for(const host of ['takeroll.online','www.takeroll.online'])assert.equal(signInHref(path,host),'/signin-with-chatgpt?return_to='+encodeURIComponent(path));
 assert.equal(signInHref(path,'JExample25-roll-call.HExample22.chatgpt.site'),'/signin-with-chatgpt?return_to='+encodeURIComponent(path));
 for(const path of ['https://evil.test','//evil.test','/\\evil.test','/callback?code=private&state=private','/signin-with-chatgpt']){
  const href=signInHref(path,'takeroll.online');assert.ok(href.endsWith('return_to=%2Fevents'));assert.ok(!href.includes('private'));
 }
});

test('shake never changes history before confirmation, Cancel keeps data, and redo is offered when undo is empty',()=>{
 const moves=[],prompts=[];
 const options={canUndo:true,canRedo:true,confirm:message=>{prompts.push(message);return false;},undo:()=>moves.push('undo'),redo:()=>moves.push('redo')};
 assert.equal(confirmShakeHistory(options),false);assert.deepEqual(moves,[]);assert.match(prompts[0],/^Undo/);
 assert.equal(confirmShakeHistory({...options,confirm:()=>true}),true);assert.deepEqual(moves,['undo']);
 assert.equal(confirmShakeHistory({...options,canUndo:false,confirm:message=>{assert.match(message,/^Redo/);return true;}}),true);
 assert.deepEqual(moves,['undo','redo']);
 assert.equal(confirmShakeHistory({...options,canUndo:false,canRedo:false,confirm:()=>{throw Error('No history must not show a prompt');}}),false);
});
