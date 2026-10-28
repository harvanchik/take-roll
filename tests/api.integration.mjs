import {completeD1} from './d1-mock.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {dirname} from 'node:path';
const require=createRequire(import.meta.url);
const {build}=require(require.resolve('esbuild',{paths:[dirname(require.resolve('wrangler/package.json'))]}));
import {DatabaseSync} from 'node:sqlite';
import {readdir,readFile} from 'node:fs/promises';
const sqlite=new DatabaseSync(':memory:');for(const file of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())sqlite.exec(await readFile('drizzle/'+file,'utf8'));
globalThis.__testDB={
 prepare(sql){
  const statement=sqlite.prepare(sql);
  return {bind(...args){
   return {
    async run(){const result=statement.run(...args);return {meta:{changes:Number(result.changes)}};},
    async first(){return statement.get(...args)||null;}
   };
  }};
 }
};
completeD1(globalThis.__testDB,sqlite);
await build({entryPoints:['app/api/attendance/route.ts'],bundle:true,platform:'node',format:'esm',outfile:'.sites-runtime/api-test.mjs',plugins:[{name:'mock-d1',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'mock',namespace:'db'}));b.onLoad({filter:/.*/,namespace:'db'},()=>({contents:'export const env={DB:globalThis.__testDB};',loader:'js'}));}}]});
const {GET,POST}=await import('../.sites-runtime/api-test.mjs');
const request=(method,user,body,origin)=>new Request('https://example.test/api/attendance',{method,headers:{...(user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':user==='owner'?'owner@example.invalid':'other@example.test'}:{}),...(body?{'Content-Type':'application/json'}:{}),...(origin?{origin}:{})},...(body?{body:JSON.stringify({accountId:user==='owner'?'site-owner':'chatgpt:'+user,...body})}:{})});
assert.equal((await GET(request('GET'))).status,401);
assert.equal((await POST(request('POST',null,{action:{}}))).status,401);
const visitor=await (await GET(request('GET','other-account'))).json();assert.deepEqual(visitor.data,{rosters:[],events:[]});assert.equal(visitor.account.id,'chatgpt:other-account');
// The real production failure: dispatch supplies authenticated email but no ID.
const emailOnly=()=>new Request('https://example.test/api/attendance',{headers:{'oai-authenticated-user-email':'OWNER@EXAMPLE.INVALID'}});
assert.equal((await GET(emailOnly())).status,200);
let r=await GET(request('GET','owner'));assert.equal(r.status,200);let initial=await r.json();assert.equal(initial.data.rosters[0].people.length,48);assert.deepEqual(JSON.parse(sqlite.prepare('SELECT data FROM attendance_stores WHERE user_id=?').get('site-owner').data).personIds,initial.data.personIds);
const create={revision:initial.revision,action:{type:'create-event',rosterId:initial.data.rosters[0].id,name:'Integration event',date:'2026-10-12'}};
assert.equal((await POST(request('POST','owner',create,'https://malicious.test'))).status,403);
r=await POST(request('POST','owner',create,'https://example.test'));assert.equal(r.status,200);let saved=await r.json();const e=saved.data.events[0],p=e.participants[0];
r=await POST(request('POST','owner',{revision:saved.revision,action:{type:'status',eventId:e.id,personId:p.id,status:'Present'}}));assert.equal(r.status,200);saved=await r.json();
r=await POST(request('POST','owner',{revision:saved.revision,action:{type:'status',eventId:e.id,personId:p.id,status:'Tardy',actor:{name:'Forged',email:'fake@example.test'}}}));assert.equal(r.status,200);saved=await r.json();
assert.notEqual(saved.data.events[0].participants[0].history[1].actor.name,'Forged');
assert.equal(saved.data.events[0].participants[0].history.length,2);
assert.equal(saved.data.events[0].participants[0].history[0].actor.email,'owner@example.invalid');
assert.equal(saved.data.events[0].participants[0].history[0].actor.id,'site-owner');
assert.equal(saved.data.events[0].participants[0].history[0].to,'Present');assert.equal(saved.data.events[0].participants[0].history[1].to,'Tardy');
assert.ok(saved.data.events[0].participants[0].history.every(h=>Number.isFinite(Date.parse(h.at))));
const reopened=await (await GET(request('GET','owner'))).json();assert.deepEqual(reopened.data,saved.data);
const stale=await POST(request('POST','owner',create));assert.equal(stale.status,409);assert.equal((await stale.json()).data.events.length,1);
const emailReopened=await (await GET(emailOnly())).json();assert.deepEqual(emailReopened.data,saved.data);
const emailWrite=new Request('https://example.test/api/attendance',{method:'POST',headers:{'Content-Type':'application/json','oai-authenticated-user-email':'owner@example.invalid','origin':'https://example.test'},body:JSON.stringify({accountId:'site-owner',revision:saved.revision,action:{type:'person-note',eventId:e.id,personId:p.id,note:'Saved with email-only sign-in'}})});
const emailResult=await POST(emailWrite);assert.equal(emailResult.status,200);assert.equal((await emailResult.json()).data.events[0].participants[0].note,'Saved with email-only sign-in');
const illegal=await POST(request('POST','other-account',{revision:saved.revision,action:{type:'status',eventId:e.id,personId:p.id,status:'Absent'}}));assert.equal(illegal.status,409);assert.deepEqual((await (await GET(request('GET','other-account'))).json()).data,{rosters:[],events:[]});
console.log('API integration passed: email-only and ID+email sign-in, per-account access, persistence, status history, conflict handling, and origin checks.');
// CSV rosters persist through the actual API and edits leave old events intact.
let current=await (await GET(emailOnly())).json();
const beforeEvents=structuredClone(current.data.events);
const csvCreate=await POST(request('POST','owner',{revision:current.revision,action:{type:'create-roster',name:'CSV staff',csv:'WExample55,Smith,sample pronunciation,SMITH,Will'}}));
assert.equal(csvCreate.status,200);current=await csvCreate.json();
const csvRoster=current.data.rosters.at(-1);assert.equal(csvRoster.people[0].name,'Will Smith');
const csvEdit=await POST(request('POST','owner',{revision:current.revision,action:{type:'replace-roster-csv',rosterId:csvRoster.id,csv:'WExample55,Smith,sample pronunciation,SMITH,Bill\nJExample25,HExample22,JAYK,sample-family,'}}));
assert.equal(csvEdit.status,200);current=await csvEdit.json();assert.equal(current.data.rosters.at(-1).people[0].name,'Bill Smith');assert.equal(current.data.rosters.at(-1).people[0].id,csvRoster.people[0].id);
const csvReopened=await (await GET(emailOnly())).json();assert.deepEqual(csvReopened.data,current.data);assert.deepEqual(current.data.events,beforeEvents);
const invalidCSV=await POST(request('POST','owner',{revision:current.revision,action:{type:'replace-roster-csv',rosterId:csvRoster.id,csv:'First,Last'}}));assert.equal(invalidCSV.status,400);
assert.deepEqual((await (await GET(emailOnly())).json()).data,current.data);
console.log('CSV API save/reopen and unchanged past attendance passed.');
// Retrying a background save with a lost response must not duplicate its audit entry.
const backgroundEvent=current.data.events[0],backgroundPerson=backgroundEvent.participants[0];
const mutationId=crypto.randomUUID(),clickedAt=new Date(Date.now()-5000).toISOString();
const backgroundBody={revision:current.revision,mutationId,occurredAt:clickedAt,action:{type:'status',eventId:backgroundEvent.id,personId:backgroundPerson.id,status:'Excused (work)'}};
const background=await POST(request('POST','owner',backgroundBody));assert.equal(background.status,200);current=await background.json();
const firstHistory=current.data.events[0].participants[0].history.length;assert.equal(current.data.events[0].participants[0].history.at(-1).at,clickedAt);
const retry=await POST(request('POST','owner',backgroundBody));assert.equal(retry.status,200);const retried=await retry.json();assert.equal(retried.revision,current.revision);assert.equal(retried.data.events[0].participants[0].history.length,firstHistory);
const undoBatch=await POST(request('POST','owner',{revision:current.revision,mutationId:crypto.randomUUID(),action:{type:'set-statuses',eventId:backgroundEvent.id,historyIntent:'undo',changes:[{personId:backgroundPerson.id,status:'Tardy'},{personId:backgroundEvent.participants[1].id,status:'Bit Late'}]}}));assert.equal(undoBatch.status,200);current=await undoBatch.json();assert.match(current.data.events[0].participants[0].history.at(-1).kind,/Undo/);assert.equal(current.data.events[0].participants[1].status,'Bit Late');
console.log('Background save timestamps, idempotent retries, and undo batches passed.');
// Report preferences persist to the account and leave attendance unchanged.
const attendanceBeforeSettings=structuredClone(current.data.events);
const preferences={groups:['Present','Tardy'],notes:false,timestamps:true,format:'markdown',sort:'last'};
const prefs=await POST(request('POST','owner',{revision:current.revision,mutationId:crypto.randomUUID(),action:{type:'report-settings',settings:preferences}}));assert.equal(prefs.status,200);current=await prefs.json();
const prefReopened=await (await GET(emailOnly())).json();assert.deepEqual(prefReopened.data.reportSettings.groups,['Present','Tardy']);assert.equal(prefReopened.data.reportSettings.notes,false);assert.equal(prefReopened.data.reportSettings.format,'markdown');assert.deepEqual(prefReopened.data.events,attendanceBeforeSettings);
console.log('Report settings save/reopen and unchanged attendance passed.');
// Ordering and inline-note writes persist and survive reopening.
const orderedEvent=current.data.events[0],orderedRoster=current.data.rosters[0];
const eventOrder=orderedEvent.participants.map(p=>p.id).reverse();
const ordered=await POST(request('POST','owner',{revision:current.revision,action:{type:'reorder-event',eventId:orderedEvent.id,personId:eventOrder[0],personIds:eventOrder}}));assert.equal(ordered.status,200);current=await ordered.json();
const rosterOrder=orderedRoster.people.map(p=>p.id).reverse();
const rosterMoved=await POST(request('POST','owner',{revision:current.revision,action:{type:'reorder-roster',rosterId:orderedRoster.id,personIds:rosterOrder}}));assert.equal(rosterMoved.status,200);current=await rosterMoved.json();
const inlineNote=await POST(request('POST','owner',{revision:current.revision,action:{type:'person-note',eventId:orderedEvent.id,personId:eventOrder[0],note:'Automatically saved inline note'}}));assert.equal(inlineNote.status,200);current=await inlineNote.json();
const reopenedOrder=await (await GET(emailOnly())).json();assert.deepEqual(reopenedOrder.data.events[0].participants.map(p=>p.id),eventOrder);assert.deepEqual(reopenedOrder.data.rosters[0].people.map(p=>p.id),rosterOrder);assert.equal(reopenedOrder.data.events[0].participants[0].note,'Automatically saved inline note');
console.log('Event/roster ordering and inline-note save/reopen passed.');
// Independent excuse flags persist with attendance, and Present clears them.
const comboEvent=current.data.events[0],comboPerson=comboEvent.participants[0];
let combo=await POST(request('POST','owner',{revision:current.revision,action:{type:'status',eventId:comboEvent.id,personId:comboPerson.id,status:'Tardy'}}));assert.equal(combo.status,200);current=await combo.json();
combo=await POST(request('POST','owner',{revision:current.revision,action:{type:'excuse',eventId:comboEvent.id,personId:comboPerson.id,excuse:'academic'}}));assert.equal(combo.status,200);current=await combo.json();
let comboReload=await (await GET(emailOnly())).json();assert.equal(comboReload.data.events[0].participants[0].status,'Tardy');assert.equal(comboReload.data.events[0].participants[0].excuse,'academic');
combo=await POST(request('POST','owner',{revision:current.revision,action:{type:'status',eventId:comboEvent.id,personId:comboPerson.id,status:'Present'}}));assert.equal(combo.status,200);current=await combo.json();assert.equal(current.data.events[0].participants[0].excuse,null);
const forbiddenCombo=await POST(request('POST','owner',{revision:current.revision,action:{type:'excuse',eventId:comboEvent.id,personId:comboPerson.id,excuse:'other'}}));assert.equal(forbiddenCombo.status,400);
console.log('Combined attendance/excuse save/reopen and incompatible status checks passed.');
// Upgrading the stable storage key must preserve earlier saved records.
sqlite.exec('DELETE FROM attendance_stores');
sqlite.prepare('INSERT INTO attendance_stores (user_id,data,revision,updated_at) VALUES (?,?,?,?)').run('owner',JSON.stringify(saved.data),saved.revision,new Date().toISOString());
const migrated=await (await GET(request('GET','owner'))).json();assert.deepEqual(migrated.data,saved.data);assert.equal(migrated.revision,saved.revision);
console.log('Legacy owner records preserved when upgrading the storage key.');
// Existing owner data and revision remain exact while new accounts get isolated stores.
const ownerSnapshot=sqlite.prepare('SELECT data,revision FROM attendance_stores WHERE user_id=?').get('site-owner');
let a=await (await GET(request('GET','visitor-a'))).json();const b=await (await GET(request('GET','visitor-b'))).json();assert.deepEqual(a.data,{rosters:[],events:[]});assert.deepEqual(b.data,{rosters:[],events:[]});
const added=await POST(request('POST','visitor-a',{revision:a.revision,action:{type:'create-roster',name:'Private A',csv:'Alex,Morgan,AL-ex,MOR-gun,'}}));assert.equal(added.status,200);a=await added.json();
assert.equal((await (await GET(request('GET','visitor-a'))).json()).data.rosters[0].name,'Private A');assert.deepEqual((await (await GET(request('GET','visitor-b'))).json()).data,{rosters:[],events:[]});
const switched=await POST(request('POST','visitor-b',{accountId:'chatgpt:visitor-a',revision:0,action:{type:'report-settings',settings:{notes:false}}}));assert.equal(switched.status,403);assert.equal((await switched.json()).data,undefined);
const guessed=await POST(request('POST','visitor-b',{revision:0,action:{type:'rename-roster',rosterId:a.data.rosters[0].id,name:'Intrusion'}}));assert.equal(guessed.status,400);
assert.deepEqual(sqlite.prepare('SELECT data,revision FROM attendance_stores WHERE user_id=?').get('site-owner'),ownerSnapshot);
assert.equal((await GET(new Request('https://example.test/api/attendance?user_id=site-owner'))).status,401);
console.log('Account isolation, cross-account writes, fresh empty workspaces, and exact owner-data preservation passed.');
let settings=await (await GET(request('GET','visitor-a'))).json();
for(const action of [
 {type:'update-profile',profile:{firstName:'Alexandra',lastName:'Rivera',preferredName:'Alex'}},
 {type:'update-organization',organization:{name:'Officials',nameDisplay:'preferred',showPronunciation:false,archiveRetention:'3m'}},
 {type:'update-preferences',preferences:{theme:'device',haptics:false}}
]){const result=await POST(request('POST','visitor-a',{revision:settings.revision,action}));assert.equal(result.status,200);settings=await result.json();}
const settingsReopened=await (await GET(request('GET','visitor-a'))).json();assert.equal(settingsReopened.data.profile.preferredName,'Alex');assert.equal(settingsReopened.data.organization.nameDisplay,'preferred');assert.equal(settingsReopened.data.preferences.theme,'device');
assert.equal((await POST(request('POST','visitor-a',{revision:settings.revision,action:{type:'update-organization',organization:{...settings.data.organization,archiveRetention:'12m'}}}))).status,400);
const expiredAt=new Date(Date.now()-200*86400000).toISOString();
const fixture={rosters:[],events:[{...saved.data.events[0],id:'expired',name:'Expired',archivedAt:expiredAt,participants:[]},{...saved.data.events[0],id:'child',name:'Child',parentEventId:'expired',participants:[]},{...saved.data.events[0],id:'active',name:'Active',participants:[]},{...saved.data.events[0],id:'recent',name:'Recent',archivedAt:new Date().toISOString(),participants:[]}]};
for(const key of ['chatgpt:expiry-a','chatgpt:expiry-b'])sqlite.prepare('INSERT INTO attendance_stores (user_id,data,revision,updated_at) VALUES (?,?,?,?)').run(key,JSON.stringify(fixture),0,new Date().toISOString());
const expired=await (await GET(request('GET','expiry-a'))).json();assert.deepEqual(expired.data.events.map(e=>e.id),['active','recent']);assert.equal(expired.revision,1);
const persisted=JSON.parse(sqlite.prepare('SELECT data FROM attendance_stores WHERE user_id=?').get('chatgpt:expiry-a').data);assert.deepEqual(persisted.events.map(e=>e.id),['active','recent']);
assert.deepEqual(JSON.parse(sqlite.prepare('SELECT data FROM attendance_stores WHERE user_id=?').get('chatgpt:expiry-b').data),fixture);
console.log('Settings persistence, invalid retention rejection, permanent archive cleanup, and cleanup account isolation passed.');
// A permanent person deletion is scoped, authenticated, and cannot resurrect through a stale restore.
let deletionState=await (await GET(request('GET','owner'))).json();
let deletionResult=await POST(request('POST','owner',{revision:deletionState.revision,action:{type:'create-event',rosterId:deletionState.data.rosters[0].id,name:'Delete person regression',date:'2026-10-19'}}));assert.equal(deletionResult.status,200);deletionState=await deletionResult.json();
const deletionEvent=deletionState.data.events.at(-1),deletionPerson=deletionEvent.participants[0],deleteAction={type:'delete-event-person',eventId:deletionEvent.id,personId:deletionPerson.id};
assert.equal((await POST(request('POST','owner',{revision:deletionState.revision,action:deleteAction}))).status,400);
const foreignDeletion=await (await GET(request('GET','visitor-b'))).json();assert.equal((await POST(request('POST','visitor-b',{revision:foreignDeletion.revision,action:deleteAction}))).status,400);
deleteAction.type='remove-event-person';deletionResult=await POST(request('POST','owner',{revision:deletionState.revision,action:deleteAction}));assert.equal(deletionResult.status,200);deletionState=await deletionResult.json();
deleteAction.type='delete-event-person';
assert.equal((await POST(request('POST','owner',{revision:deletionState.revision,action:deleteAction},'https://malicious.test'))).status,403);
deletionResult=await POST(request('POST','owner',{revision:deletionState.revision,action:deleteAction}));assert.equal(deletionResult.status,200);deletionState=await deletionResult.json();
assert.ok(!deletionState.data.events.find(event=>event.id===deletionEvent.id).participants.some(person=>person.id===deletionPerson.id));
assert.equal((await POST(request('POST','owner',{revision:deletionState.revision,action:{type:'restore-event-person',eventId:deletionEvent.id,personId:deletionPerson.id}}))).status,400);
console.log('Permanent person deletion passed: removed-only, cross-account and CSRF rejection, durable deletion, and rejected stale restoration.');

// Removed roster names persist independently of events and other workspace accounts.
let rosterState=await (await GET(request('GET','roster-removal'))).json();
const rosterWrite=async action=>{const response=await POST(request('POST','roster-removal',{revision:rosterState.revision,action}));assert.equal(response.status,200,JSON.stringify(await response.clone().json()));rosterState=await response.json();};
await rosterWrite({type:'create-roster',name:'First',csv:'Alexandra,Rivera,,,Alex'});
await rosterWrite({type:'create-roster',name:'Second',csv:'Alexandra,Rivera,,,Ali'});
const firstRoster=rosterState.data.rosters[0],secondRoster=rosterState.data.rosters[1],rosterPerson=firstRoster.people[0];
await rosterWrite({type:'create-event',rosterId:firstRoster.id,name:'Saved Meeting',date:'2026-10-22'});const rosterEvents=structuredClone(rosterState.data.events);
await rosterWrite({type:'remove-roster-person',rosterId:firstRoster.id,personId:rosterPerson.id});
let rosterReload=await (await GET(request('GET','roster-removal'))).json();assert.equal(rosterReload.data.rosters[0].removedPeople[0].id,rosterPerson.id);assert.equal(rosterReload.data.rosters[0].people.length,0);
assert.equal((await POST(request('POST','roster-removal',{revision:rosterState.revision,action:{type:'edit-person',rosterId:firstRoster.id,personId:rosterPerson.id,name:'Forbidden',pronunciation:''}}))).status,400);
await rosterWrite({type:'restore-roster-person',rosterId:firstRoster.id,personId:rosterPerson.id});
const personUid=rosterState.data.personIds[rosterPerson.id];assert.match(personUid,/^[A-Z0-9]{7}$/);assert.notEqual(personUid,rosterState.data.personIds[secondRoster.people[0].id]);
await rosterWrite({type:'link-roster-person',rosterId:secondRoster.id,uid:personUid});assert.equal(rosterState.data.rosters[1].people[1].id,rosterPerson.id);
await rosterWrite({type:'remove-person-from-all-rosters',rosterId:firstRoster.id,personId:rosterPerson.id});
assert.deepEqual(rosterState.data.rosters.map(r=>r.people.length),[0,1]);assert.ok(rosterState.data.rosters.every(r=>r.removedPeople[0].id===rosterPerson.id));assert.equal(rosterState.data.rosters[1].people[0].id,secondRoster.people[0].id);assert.deepEqual(rosterState.data.events,rosterEvents);
const rosterDelete={type:'delete-roster-person',rosterId:firstRoster.id,personId:rosterPerson.id};
assert.equal((await POST(request('POST','roster-removal',{revision:rosterState.revision,action:rosterDelete},'https://malicious.test'))).status,403);
const foreignRosterState=await (await GET(request('GET','visitor-b'))).json();assert.equal((await POST(request('POST','visitor-b',{revision:foreignRosterState.revision,action:rosterDelete}))).status,400);
await rosterWrite(rosterDelete);assert.equal(rosterState.data.rosters[0].removedPeople.length,0);assert.equal(rosterState.data.rosters[1].removedPeople[0].id,rosterPerson.id);
assert.equal((await POST(request('POST','roster-removal',{revision:rosterState.revision,action:{type:'restore-roster-person',rosterId:firstRoster.id,personId:rosterPerson.id}}))).status,400);
rosterReload=await (await GET(request('GET','roster-removal'))).json();assert.deepEqual(rosterReload.data,rosterState.data);assert.deepEqual(rosterReload.data.events,rosterEvents);
assert.equal(rosterReload.data.personIds[rosterPerson.id],personUid);assert.equal(JSON.parse(sqlite.prepare('SELECT data FROM attendance_stores WHERE user_id=?').get(rosterReload.account.workspaceId).data).personIds[rosterPerson.id],personUid);
console.log('Removed roster names API passed: durable removal/restoration, all-roster matching, immutable removed names, removed-only permanent deletion, account and CSRF checks, and unchanged saved events.');
const securitySnapshot=sqlite.prepare('SELECT data,revision FROM attendance_stores WHERE user_id=?').get('site-owner');
const rawSave=(body,extra={})=>POST(new Request('https://example.test/api/attendance',{method:'POST',headers:{'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.invalid','Content-Type':'application/json',...extra},body:typeof body==='string'?body:JSON.stringify(body)}));
const valid={accountId:'site-owner',revision:securitySnapshot.revision,action:{type:'update-profile',profile:{firstName:'Test',lastName:'Person',preferredName:''}}};
for(const body of [null,[],{},'not json',{...valid,revision:-1},{...valid,revision:'0'},{...valid,revision:1e20},{...valid,action:[]},{...valid,mutationId:'x'.repeat(129)},{...valid,action:{type:'set-statuses',changes:Array(501).fill({personId:'x',status:'Present'})}},JSON.stringify(valid).replace('"profile":','"__proto__":{},"profile":')])assert.equal((await rawSave(body)).status,400);
let nested={};for(let i=0;i<15;i++)nested={value:nested};assert.equal((await rawSave({...valid,extra:nested})).status,400);
assert.equal((await rawSave(valid,{'Content-Type':'text/plain'})).status,415);
assert.equal((await rawSave(valid,{Origin:'https://evil.test'})).status,403);
assert.equal((await rawSave(valid,{'Sec-Fetch-Site':'cross-site'})).status,403);
assert.equal((await rawSave(valid,{'Content-Length':String(3*1024*1024)})).status,413);
assert.equal((await rawSave(' '.repeat(2*1024*1024+1))).status,413);
assert.deepEqual(sqlite.prepare('SELECT data,revision FROM attendance_stores WHERE user_id=?').get('site-owner'),securitySnapshot);
const window=Math.floor(Date.now()/60000);sqlite.prepare('INSERT INTO request_limits (key,window,hits) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET window=excluded.window,hits=excluded.hits').run('write:site-owner',window,240);
const throttled=await rawSave(valid);assert.equal(throttled.status,429);assert.equal(throttled.headers.get('Retry-After'),'60');assert.equal((await GET(request('GET','visitor-b'))).status,200);
assert.deepEqual(sqlite.prepare('SELECT data,revision FROM attendance_stores WHERE user_id=?').get('site-owner'),securitySnapshot);
console.log('Attack regression passed: malformed/oversized/deep JSON, prototype keys, non-JSON CSRF, cross-site requests, invalid revisions, and account-isolated durable rate limits.');
sqlite.close();


