import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import {dirname} from 'node:path';
import {seedData} from './fixtures.mjs';
import {applyAction} from '../lib/model.ts';
import {emptyAttendanceFilters,readAttendanceFilters,writeAttendanceFilters,attendanceBookmarkPath} from '../lib/attendance-filter-url.ts';
import {resolvePage} from '../lib/navigation.ts';
const require=createRequire(import.meta.url),{build}=require(require.resolve('esbuild',{paths:[dirname(require.resolve('wrangler/package.json'))]}));
await build({entryPoints:['lib/attendance-queue.ts'],bundle:true,platform:'node',format:'esm',outfile:'.sites-runtime/conflict-review-test.mjs'});
const {AttendanceQueue}=await import('../.sites-runtime/conflict-review-test.mjs');
test('attendance filter URLs round trip multiple selections and preserve workspace and comparison people',()=>{
 const filters={...emptyAttendanceFilters(),from:'2026-10-01',to:'2026-11-15',roster:['roster-a','roster-b'],status:['Present','Bit Late'],excuse:['Work'],search:'Training & notes'};
 const query=writeAttendanceFilters('workspace=example&people=ABC1234,DEF5678',filters);
 assert.deepEqual(readAttendanceFilters(query),filters);assert.equal(new URLSearchParams(query).get('people'),'ABC1234,DEF5678');assert.equal(new URLSearchParams(query).get('workspace'),'example');
 const cleared=writeAttendanceFilters(query,emptyAttendanceFilters());assert.equal(new URLSearchParams(cleared).has('search'),false);assert.equal(new URLSearchParams(cleared).get('workspace'),'example');
 assert.equal(attendanceBookmarkPath('/compare?people=ABC1234,DEF5678&search=Training&from=2026-10-01'),'/compare?people=ABC1234%2CDEF5678');assert.equal(attendanceBookmarkPath('/person/ABC1234?status=Present'),'/person/ABC1234');assert.equal(readAttendanceFilters('from=oops').from,'');assert.equal(resolvePage(seedData(),'/compare?people=ABC1234,DEF5678').view,'compare');
});
test('conflict review resolves one edit while preserving a separate pending change',async()=>{
 let data=seedData();data=applyAction(data,{type:'create-event',rosterId:data.rosters[0].id,name:'Synthetic Training',date:'2026-11-15'});data={...data,preferences:{...data.preferences,autoSave:false}};
 const event=data.events[0],first=event.participants[0],second=event.participants[1];
 let received=false;const q=new AttendanceQueue(data,0,async({action})=>{if(!received){received=true;return {status:409,code:'edit_conflict',data:external,revision:1,error:'Changed elsewhere'};}external=applyAction(external,action);return {status:200,data:external,revision:2};},()=>{});
 q.enqueue({type:'person-note',eventId:event.id,personId:first.id,note:'Mine'});q.enqueue({type:'person-note',eventId:event.id,personId:second.id,note:'Separate edit'});
 let external=applyAction(data,{type:'person-note',eventId:event.id,personId:first.id,note:'Theirs'},'2026-11-15T12:00:00Z');
 await q.savePending();const conflicts=q.conflicts();assert.equal(conflicts.length,1);assert.equal(conflicts[0].mine.value,'Mine');assert.equal(conflicts[0].theirs.value,'Theirs');assert.equal(conflicts[0].theirsAt,'2026-11-15T12:00:00Z');
 q.resolveConflict(conflicts[0].id,false);await q.flush();assert.equal(q.data.events[0].participants[0].note,'Theirs');assert.equal(q.data.events[0].participants[1].note,'Separate edit');
});
