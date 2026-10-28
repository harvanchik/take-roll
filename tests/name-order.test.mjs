import assert from 'node:assert/strict';import {test} from 'node:test';import {createRequire} from 'node:module';import {dirname} from 'node:path';
import {lastNameOrder} from '../lib/name-order.ts';import {personFromFields} from '../lib/model.ts';
const require=createRequire(import.meta.url),{build}=require(require.resolve('esbuild',{paths:[dirname(require.resolve('wrangler/package.json'))]}));
await build({stdin:{contents:"export {sortedRows,nextTableSort,tableSortForScope} from './app/table-sort';export {default as Overview} from './app/attendance-overview';export {NamePreferences} from './app/name-preferences';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',jsx:'automatic',packages:'external',outfile:'.sites-runtime/name-order-test.mjs'});
const {sortedRows,nextTableSort,tableSortForScope,Overview,NamePreferences}=await import('../.sites-runtime/name-order-test.mjs');
const {createElement:h}=await import('react'),{renderToStaticMarkup}=await import('react-dom/server');
function person(firstName,lastName,preferredFirstName=''){return personFromFields({firstName,lastName,preferredFirstName,firstPronunciation:'',lastPronunciation:''},firstName+lastName);}
test('default name order uses last names, then legal first names, regardless of preferred/display format',()=>{
 const people=[person('Amy','Zulu','A'),person('Zane','Alpha','Z'),person('Bill','Alpha','Billy'),person('Solo','')],original=structuredClone(people),sort={key:'Full Name',direction:'asc'};
 assert.deepEqual(sortedRows(people,sort,lastNameOrder).map(p=>p.id),[people[2].id,people[1].id,people[3].id,people[0].id]);assert.deepEqual(people,original);
 const prefix=[person('Zed','Al'),person('Amy','Allen')];assert.deepEqual(sortedRows(prefix,sort,lastNameOrder).map(p=>p.lastName),['Al','Allen']);
 assert.deepEqual(sortedRows(people,{...sort,direction:'desc'},lastNameOrder).map(p=>p.id),[people[0].id,people[3].id,people[1].id,people[2].id]);assert.equal(sortedRows(people,null,lastNameOrder),people);
});
test('manual header sorting cycles normally, and leaving/returning restores only the page default',()=>{
 const defaultSort={key:'Full Name',direction:'asc'},scope='event-a';let state={scope,sort:defaultSort};
 state={scope,sort:nextTableSort(state.sort,'Attendance')};assert.deepEqual(state.sort,{key:'Attendance',direction:'asc'});state={scope,sort:nextTableSort(state.sort,'Attendance')};assert.equal(state.sort.direction,'desc');state={scope,sort:nextTableSort(state.sort,'Attendance')};assert.equal(state.sort,null);
 assert.equal(tableSortForScope(state,scope,defaultSort),state);
 state=tableSortForScope(state,'events',defaultSort);state=tableSortForScope(state,scope,defaultSort);assert.deepEqual(state.sort,defaultSort);
 assert.equal(tableSortForScope(state,'event-b',null).sort,null);
});
test('overview defaults to last-name order with all column-header controls available',()=>{
 const participants=[person('Amy','Zulu'),person('Zane','Alpha')].map(p=>({...p,status:null,note:'',updatedAt:null,removed:false,history:[]})),event={id:'event',name:'Meeting',date:'2026-10-21',rosterId:'r',rosterName:'Staff',note:'',participants,createdAt:'',updatedAt:'',history:[]};
 const controls={search:'',filter:[],unmarked:false,flagFilter:null,excuseTypes:[],onSearch(){},onToggle(){},onAll(){},onUnmarked(){},onFlag(){},onExcuseType(){}};
 const html=renderToStaticMarkup(h(NamePreferences,{settings:{name:'Team',nameDisplay:'legal',showPronunciation:true,archiveRetention:'30d',forceAlphabetical:true}},h(Overview,{data:{events:[event],rosters:[]},parent:event,controls,onSelection(){}})));
 const body=html.slice(html.indexOf('<tbody>'));assert.ok(body.indexOf('Zane Alpha')<body.indexOf('Amy Zulu'));const headings=html.match(/<button[^>]*class="sort-heading"[^>]*>/g);assert.match(html,/aria-sort="ascending"/);assert.ok(headings.length>=4);assert.ok(headings.every(button=>!button.includes('disabled')));
});
