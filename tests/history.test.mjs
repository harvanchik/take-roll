import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import {dirname} from 'node:path';
import {applyAction} from '../lib/model.ts';
import {seedData} from './fixtures.mjs';
import {attendanceAccount} from '../lib/owner-access.ts';
const require=createRequire(import.meta.url);
const {build}=require(require.resolve('esbuild',{paths:[dirname(require.resolve('wrangler/package.json'))]}));
await build({entryPoints:['app/change-history.tsx'],bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react-dom/server','lucide-react'],outfile:'.sites-runtime/history-test.mjs'});
const {default:ChangeHistory,historyTone,historyStyle,historyValueStyle,HistoryBadges}=await import('../.sites-runtime/history-test.mjs');
const React=await import('react'),{renderToStaticMarkup}=await import('react-dom/server');
const actor={id:'chatgpt:tester',name:'Taylor Test',email:'taylor@example.test'};
function setup(){const d=seedData();return applyAction(d,{type:'create-event',name:'Practice',date:'2026-10-16',rosterId:d.rosters[0].id});}
test('history authors are supplied by trusted caller, never the submitted action',()=>{
 const d=setup(),e=d.events[0],action={type:'status',eventId:e.id,personId:e.participants[0].id,status:'Tardy',actor:{name:'Forged',email:'fake@example.test'}};
 const saved=applyAction(d,action,'2026-10-16T12:00:00Z',actor);
 assert.deepEqual(saved.events[0].participants[0].history[0].actor,actor);
 assert.equal(applyAction(d,action).events[0].participants[0].history[0].actor,undefined);
 const note=applyAction(saved,{type:'person-note',eventId:e.id,personId:e.participants[0].id,note:'Class'},undefined,{email:actor.email});
 assert.deepEqual(note.events[0].participants[0].history[0].actor,actor);
 assert.deepEqual(note.events[0].participants[0].history[1].actor,{email:actor.email});
});
test('verified ChatGPT display name decodes safely without changing workspace ownership',()=>{
 const req=name=>new Request('https://example.test',{headers:{'oai-authenticated-user-email':'person@example.test','oai-authenticated-user-id':'person','oai-authenticated-user-full-name':name,'oai-authenticated-user-full-name-encoding':'percent-encoded-utf-8'}});
 assert.equal(attendanceAccount(req('Ren%C3%A9%20Test')).name,'René Test');
 assert.equal(attendanceAccount(req('%ZZ')).name,undefined);
 assert.equal(attendanceAccount(req('Ren%C3%A9%20Test')).storeKey,'chatgpt:person');
});
test('history badges use resulting attendance, neutral notes, and canonical follow-up states',()=>{
 for(const [kind,to,tone] of [['Status','Tardy · Excused (Academic)','tardy'],['Excuse','Excused (Academic)','academic'],['Excuse','Excused (work)','work'],['Excuse','Excused (Other)','other'],['Flag','Flagged','flagged'],['Flag','Complete','flagged'],['Flag','None','flagged'],['Note','Present','note'],['Undo · Status','Present','present']])assert.equal(historyTone({kind,to}),tone);
});
test('history renders name, email fallback, and honest legacy attribution without the old separator',()=>{
 const html=renderToStaticMarkup(React.createElement(ChangeHistory,{entries:[{id:'1',kind:'Status',from:'Unmarked',to:'Present',at:'2026-10-16T12:00:00Z',actor},{id:'2',kind:'Note',from:'',to:'Class',at:'2026-10-16T12:01:00Z',actor:{email:'email@example.test'}},{id:'3',kind:'Flag',from:'None',to:'Flagged',at:'2026-10-16T12:02:00Z'}],name:'Person',busy:false,onClear:async()=>true}));
 assert.match(html,/by Taylor Test/);assert.match(html,/by email@example.test/);assert.match(html,/by Unknown/);assert.doesNotMatch(html,/<\/b> ·/);assert.doesNotMatch(html,/Clear History|history-clear-button/);
});


test('every flag transition stays red with white text even with custom organization colors',()=>{
 const settings={flagColor:'blue',checkColor:'green',statuses:[],excuses:[]};
 for(const kind of ['Flag','Undo · Flag','Redo · Flag'])for(const to of ['Flagged','Complete','None']){
  const entry={kind,to};assert.equal(historyTone(entry),'flagged');
  assert.equal(historyStyle(entry,settings).backgroundColor,'#bd2637');
  assert.equal(historyStyle(entry,settings).color,'#fff');
 }
});


test('undo and redo render as separate leading badges without changing attendance badge styling',()=>{
 const config={statuses:[{id:'Present',name:'Present',color:'green'}],excuses:[],flagColor:'flag',checkColor:'check'};
 for(const operation of ['Undo','Redo']){
  const entry={kind:operation+' · Status',from:'Absent',to:'Present'};
  const html=renderToStaticMarkup(React.createElement(HistoryBadges,{entry,config}));
  assert.match(html,new RegExp('history-operation"><svg[^>]+width="1em"[^>]+aria-hidden="true"[\\s\\S]*?</svg>'+operation+'</b><b class="history-kind present"'));
  assert.match(html,/>Attendance<\/b>/);assert.ok(!html.includes(' · Status'));
  assert.deepEqual(historyStyle(entry,config),historyStyle({...entry,kind:'Status'},config));
 }
 const plain=renderToStaticMarkup(React.createElement(HistoryBadges,{entry:{kind:'Note',to:'New Note'},config}));
 assert.match(plain,/history-kind note/);assert.ok(!plain.includes('history-operation'));
});


test('history attendance values follow organization colors and keep unmarked and other change types neutral',()=>{
 const config={statuses:[{id:'Present',name:'Arrived',color:'indigo'},{id:'status-remote',name:'Remote',color:'teal'}],excuses:[{id:'work',name:'Work',code:'W',color:'purple'}]};
 const entry={kind:'Undo · Status',from:'Remote',to:'Present',statusId:'Present'};
 assert.equal(historyValueStyle(entry,'from',config)['--tone'],'#79c9c5');
 assert.equal(historyValueStyle(entry,'to',config)['--tone'],'#a8afe9');
 assert.equal(historyValueStyle({...entry,from:'Unmarked'},'from',config),undefined);
 assert.equal(historyValueStyle({...entry,to:'Unmarked',statusId:null},'to',config),undefined);
 for(const kind of ['Note','Flag','Membership'])assert.equal(historyValueStyle({...entry,kind},'to',config),undefined);
 assert.equal(historyValueStyle({kind:'Excuse',from:'No Excuse',to:'Excused (W)',excuseId:'work'},'to',config)['--tone'],'var(--purple)');
});
