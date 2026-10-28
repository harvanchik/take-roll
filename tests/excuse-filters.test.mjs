import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import {dirname} from 'node:path';
import {applyAction,filteredPeople} from '../lib/model.ts';
import {seedData} from './fixtures.mjs';
import {captureAttendanceView,attendanceViewPeople} from '../lib/attendance-view.ts';
import {comparisonRows} from '../lib/subevents.ts';
import {comparisonMatches,comparisonFilterCounts} from '../lib/comparison-filters.ts';
const require=createRequire(import.meta.url),{build}=require(require.resolve('esbuild',{paths:[dirname(require.resolve('wrangler/package.json'))]}));
await build({entryPoints:['app/attendance-toolbar.tsx'],bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','lucide-react'],outfile:'.sites-runtime/excuse-filters-test.mjs'});
const {default:Toolbar}=await import('../.sites-runtime/excuse-filters-test.mjs');
const React=await import('react'),{renderToStaticMarkup}=await import('react-dom/server');
function setup(){let d=seedData();d=applyAction(d,{type:'create-event',name:'Training',date:'2026-10-16',rosterId:d.rosters[0].id});const e=d.events[0];for(const [i,excuse] of ['academic','work','other'].entries())d=applyAction(d,{type:'excuse',eventId:e.id,personId:e.participants[i].id,excuse});return d;}
test('excuse filters combine reason selections and no selections matches every reason',()=>{
 const e=setup().events[0];const find=types=>filteredPeople(e,'',['Excused'],false,types).map(p=>p.id);
 assert.equal(find([]).length,3);assert.deepEqual(find(['academic']),[e.participants[0].id]);assert.deepEqual(find(['academic','other']),[e.participants[0].id,e.participants[2].id]);assert.deepEqual(find(['academic','work','other']),find([]));assert.equal(filteredPeople(e,'not a name',['Excused'],false,['academic']).length,0);
});
test('changing reason filters refreshes membership while an attendance edit keeps the row visible',()=>{
 let d=setup(),e=d.events[0];const view=captureAttendanceView(e,'',['Excused'],false,null,0,null,['academic']);
 assert.deepEqual(view.ids,[e.participants[0].id]);
 d=applyAction(d,{type:'excuse',eventId:e.id,personId:e.participants[0].id,excuse:'work'});e=d.events[0];
 assert.equal(captureAttendanceView(e,'',['Excused'],false,view,0,null,['academic']),view);
 assert.equal(attendanceViewPeople(e,view).length,1);
 assert.equal(captureAttendanceView(e,'',['Excused'],false,view,0,null,['work']).ids.length,2);
});
test('overview reasons only inspect selected subevents, count each person once, and ignore removed cells',()=>{
 let d=setup(),e=d.events[0];d=applyAction(d,{type:'create-subevent',eventId:e.id,name:'Day 2',date:'2026-10-17'});
 d=applyAction(d,{type:'excuse',eventId:d.events[1].id,personId:e.participants[0].id,excuse:'work'});
 const base={search:'',filter:['Excused'],excuseTypes:['work'],unmarked:false,flagFilter:null};
 let rows=comparisonRows(d.events);assert.equal(rows.filter(row=>comparisonMatches(row,base)).length,2);
 assert.deepEqual(comparisonFilterCounts(rows).excuseCounts,{academic:1,work:2,other:1});
 assert.equal(comparisonRows([d.events[0]]).filter(row=>comparisonMatches(row,base)).length,1);
 d=applyAction(d,{type:'remove-event-person',eventId:d.events[1].id,personId:e.participants[0].id});
 assert.equal(comparisonFilterCounts(comparisonRows(d.events)).excuseCounts.work,1);
});
test('shared toolbar replaces Unexcused with compact colored letter counts only while Excused is on',()=>{
 const props={search:'',onSearch(){},filter:['Excused'],excuseTypes:['academic','other'],onExcuseType(){},unmarked:false,flagFilter:null,onAll(){},onToggle(){},onUnmarked(){},onFlag(){},total:3,unmarkedCount:0,counts:[0,0,0,0,3,0],excuseCounts:{academic:1,work:1,other:1}};
 for(const overview of [false,true]){const html=renderToStaticMarkup(React.createElement(Toolbar,{...props,overview}));assert.doesNotMatch(html,/>Unexcused</);for(const letter of ['A','W','O'])assert.match(html,new RegExp('>'+letter+'<span class="filter-count">1</span>'));assert.match(html,/academic selected/);assert.match(html,/other selected/);}
 const off=renderToStaticMarkup(React.createElement(Toolbar,{...props,filter:[],excuseTypes:[]}));assert.match(off,/>Unexcused</);assert.doesNotMatch(off,/excuse-type-filters/);
});
