import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import {dirname} from 'node:path';
import {seedData,applyAction} from '../lib/model.ts';
const require=createRequire(import.meta.url);const {build}=require(require.resolve('esbuild',{paths:[dirname(require.resolve('wrangler/package.json'))]}));
await build({entryPoints:['lib/navigation.ts'],bundle:true,format:'esm',platform:'node',outfile:'.sites-runtime/navigation-test.mjs'});
const {withSlugs,slugify,resolvePage,eventPath,rosterPath}=await import('../.sites-runtime/navigation-test.mjs');
function data(){let d=seedData();d=applyAction(d,{type:'create-event',name:'Officials Training',date:'2026-10-12',rosterId:d.rosters[0].id});return d;}
test('readable event and roster paths resolve after refresh without any prior UI state',()=>{const d=withSlugs(data());assert.equal(eventPath(d.events[0]),'/event/officials-training');assert.equal(rosterPath(d.rosters[0]),'/roster/example-staff');assert.equal(resolvePage(d,eventPath(d.events[0])).eventId,d.events[0].id);const r=resolvePage(d,rosterPath(d.rosters[0]));assert.equal(r.view,'rosters');assert.equal(r.rosterId,d.rosters[0].id);assert.equal(resolvePage(d,'/rosters').view,'rosters');assert.equal(resolvePage(d,'/events').eventId,'');});
test('duplicate names receive unique stable paths, while normalization keeps source data intact',()=>{let original=data();original=applyAction(original,{type:'create-event',name:'Officials Training',date:'2026-10-13',rosterId:original.rosters[0].id});const d=withSlugs(original);assert.equal(original.events[0].slug,undefined);assert.notEqual(d.events[0].slug,d.events[1].slug);assert.deepEqual(withSlugs(d),d);assert.equal(resolvePage(d,eventPath(d.events[1])).eventId,d.events[1].id);});
test('renaming a saved event or roster retains its original bookmark URL',()=>{let d=withSlugs(data());const path=eventPath(d.events[0]),roster=rosterPath(d.rosters[0]);d=withSlugs(applyAction(d,{type:'rename-event',eventId:d.events[0].id,name:'New event name'}));d=withSlugs(applyAction(d,{type:'rename-roster',rosterId:d.rosters[0].id,name:'New roster name'}));assert.equal(eventPath(d.events[0]),path);assert.equal(rosterPath(d.rosters[0]),roster);assert.equal(resolvePage(d,path).missing,false);});
test('navigation history routes clear prior selection and unknown links are explicit',()=>{const d=withSlugs(data());const sequence=['/events',eventPath(d.events[0]),'/rosters',rosterPath(d.rosters[0]),eventPath(d.events[0]),'/events'];assert.deepEqual(sequence.map(p=>resolvePage(d,p).eventId),['',d.events[0].id,'','',d.events[0].id,'']);assert.equal(resolvePage(d,'/event/does-not-exist').missing,true);assert.equal(resolvePage(d,'/roster/%E0%A4%A').missing,true);assert.equal(resolvePage(d,'/event/officials-training/').missing,false);assert.equal(slugify('Résumé / Staff!!'),'resume-staff');assert.equal(slugify('!!!'),'event');});
test('archived event bookmarks open the event view and restore preserves their original URL',()=>{let d=withSlugs(data()),e=d.events[0];const path=eventPath(e);d=applyAction(d,{type:'archive-event',eventId:e.id});assert.equal(resolvePage(d,path).view,'events');assert.equal(resolvePage(d,path).eventId,e.id);assert.equal(resolvePage(d,'/archive').view,'archive');d=applyAction(d,{type:'restore-event',eventId:e.id});assert.equal(resolvePage(d,path).view,'events');d=withSlugs(applyAction(d,{type:'duplicate-event',eventId:e.id}));assert.notEqual(eventPath(d.events[1]),path);});
test('subevents use nested stable routes and keep legacy flat bookmarks',()=>{let d=withSlugs(data());const root=d.events[0];d=withSlugs(applyAction(d,{type:'create-subevent',eventId:root.id,name:'Day 2',date:'2026-10-13'}));const child=d.events.at(-1),path=eventPath(child,d);assert.equal(path,'/event/officials-training/day-2');assert.equal(resolvePage(d,path).eventId,child.id);assert.equal(resolvePage(d,eventPath(child)).eventId,child.id);d=withSlugs(applyAction(d,{type:'rename-subevent',eventId:child.id,name:'Second Day'}));assert.equal(eventPath(d.events.at(-1),d),path);d=withSlugs(applyAction(d,{type:'create-subevent',eventId:child.id,name:'Day 2',date:'2026-10-14'}));assert.notEqual(eventPath(d.events.at(-1),d),path);assert.equal(resolvePage(d,eventPath(d.events.at(-1),d)).eventId,d.events.at(-1).id);});

function family(dates){let d=data();d.events[0].date=dates[0];for(let i=1;i<dates.length;i++)d=applyAction(d,{type:'create-subevent',eventId:d.events[0].id,name:'Session '+i,date:dates[i]});return withSlugs(d);}
test('event entry chooses today or the closest past/future calendar day',()=>{
 const now=new Date(2026,9,20,23,59),d=family(['2026-10-19','2026-10-20','2026-10-24']),path=eventPath(d.events[0]);
 assert.equal(resolvePage(d,path,now).eventId,d.events[1].id);
 assert.equal(resolvePage(d,path,new Date(2026,9,18)).eventId,d.events[0].id);
 assert.equal(resolvePage(d,path,new Date(2026,9,23)).eventId,d.events[2].id);
 assert.equal(resolvePage(d,path,new Date(2026,9,30)).eventId,d.events[2].id);
});
test('equally close and duplicate dates use tab order without changing stored records',()=>{
 const d=family(['2026-10-25','2026-10-19','2026-10-21','2026-10-19']);
 // Listed order, not raw array order, determines which equally close session wins.
 d.events[1].createdAt='2026-10-01T00:00:00Z';d.events[2].createdAt='2026-10-03T00:00:00Z';d.events[3].createdAt='2026-10-02T00:00:00Z';
 const original=structuredClone(d);assert.equal(resolvePage(d,eventPath(d.events[0]),new Date(2026,9,20)).eventId,d.events[1].id);assert.deepEqual(d,original);
 const same=family(['2026-10-20','2026-10-20']);assert.equal(resolvePage(same,eventPath(same.events[0]),new Date(2026,9,20)).eventId,same.events[0].id);
});
test('explicit first/other subevent links stay selected after refresh and date changes',()=>{
 const d=family(['2026-10-19','2026-10-20']);for(const event of d.events){const explicit=eventPath({...event},d);assert.equal(explicit.split('/').length,4);assert.equal(resolvePage(d,explicit,new Date(2026,9,20)).eventId,event.id);assert.equal(resolvePage(d,explicit,new Date(2026,9,29)).eventId,event.id);}
});
test('deleted first sessions are skipped and archived events use the same date selection',()=>{
 let d=family(['2026-10-20','2026-10-19','2026-10-21']);const root=d.events[0];d=applyAction(d,{type:'delete-subevent',eventId:root.id,restoreId:'test-delete'});d=applyAction(d,{type:'archive-event',eventId:root.id});assert.equal(resolvePage(d,eventPath(root),new Date(2026,9,20)).eventId,d.events[1].id);assert.equal(resolvePage(d,eventPath(root)+'/'+root.subeventSlug,new Date(2026,9,20)).missing,true);
});

test('early history handoff only claims mounted workspace history entries',async()=>{
 const {historyStartupScript}=await import('../lib/history-startup.ts');const vm=await import('node:vm');const handlers=new Map(),seen=[];const document={documentElement:{dataset:{}}};const window={addEventListener(name,fn){handlers.set(name,fn);},dispatchEvent(event){seen.push(event);}};class CustomEvent{constructor(type,init){this.type=type;this.detail=init.detail;}}vm.runInNewContext(historyStartupScript,{window,document,CustomEvent});const handler=handlers.get('popstate');let stopped=false;const event={state:{takeRollIndex:2},stopImmediatePropagation(){stopped=true;}};handler(event);assert.equal(stopped,false);document.documentElement.dataset.takeRollHistory='active';handler({state:null,stopImmediatePropagation(){stopped=true;}});assert.equal(stopped,false);handler(event);assert.equal(stopped,true);assert.equal(seen[0].type,'take-roll:popstate');assert.equal(seen[0].detail.takeRollIndex,2);
});
