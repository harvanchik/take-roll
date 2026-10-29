import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {dirname} from 'node:path';
import {createElement as h} from 'react';
import {renderToStaticMarkup as render} from 'react-dom/server';
import {applyAction} from '../lib/model.ts';
import {seedData} from './fixtures.mjs';
import {archiveExpiresAt,organizationSettings} from '../lib/workspace-settings.ts';
import {eventPath,resolvePage,withSlugs} from '../lib/navigation.ts';
import {selectedComparisonEvents} from '../lib/subevents.ts';
const require=createRequire(import.meta.url),{build}=require(require.resolve('esbuild',{paths:[dirname(require.resolve('wrangler/package.json'))]}));
await build({stdin:{contents:"export {default as ArchiveList} from './app/archive-list';export {NamePreferences} from './app/name-preferences';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',jsx:'automatic',packages:'external',outfile:'.sites-runtime/archive-ui-test.mjs'});
const {ArchiveList,NamePreferences}=await import('../.sites-runtime/archive-ui-test.mjs');
function setup(){let d=seedData();d=applyAction(d,{type:'create-event',rosterId:d.rosters[0].id,name:'Archived Meeting',date:'2026-10-19'});d=applyAction(d,{type:'create-subevent',eventId:d.events[0].id,name:'Afternoon',date:'2026-10-19'});return withSlugs(applyAction(d,{type:'archive-event',eventId:d.events[0].id},'2026-10-19T12:00:00Z'));}
test('archive cards use three compact icon actions and show the configured expiry without inline tables',()=>{
 const d=setup();
 for(const retention of ['1d','7d','30d','3m','6m']){
  const html=render(h(NamePreferences,{settings:organizationSettings({archiveRetention:retention})},h(ArchiveList,{events:d.events,busy:false,onAction:async()=>true,onView(){}})));
  assert.equal((html.match(/<button/g)||[]).length,3);for(const tooltip of ['View Event','Restore Event','Delete Permanently'])assert.ok(html.includes('data-tooltip="'+tooltip+'"'));
  assert.match(html,/events-grid archive-events-grid/);assert.match(html,/event-card archive-card/);assert.match(html,/<h3>Archived Meeting<\/h3>/);assert.match(html,/event-card-progress-row/);
  assert.ok(html.includes(archiveExpiresAt(d.events[0].archivedAt,retention).toISOString()));assert.match(html,/Expires/);assert.ok(!html.includes('<details'));assert.ok(!html.includes('archive-person'));
 }
});
test('archived parent and subevent links open the same normal event routes without mixing active comparisons',()=>{
 let d=setup();for(const event of d.events){const route=resolvePage(d,eventPath(event,d));assert.equal(route.view,'events');assert.equal(route.eventId,event.id);}
 d=withSlugs(applyAction(d,{type:'create-event',rosterId:d.rosters[0].id,name:'Active Meeting',date:'2026-10-20'}));
 const parent=d.events.find(e=>e.archivedAt&&!e.parentEventId),selected=d.events.map(e=>e.id);
 assert.equal(selectedComparisonEvents(d,parent,{scope:'all',selected}).length,2);
 assert.ok(selectedComparisonEvents(d,d.events.at(-1),{scope:'all',selected}).every(e=>!e.archivedAt));
});
test('every archived-record mutation still fails on the server model',()=>{
 const d=setup(),event=d.events[0],personId=event.participants[0].id;
 for(const action of [{type:'status',status:'Absent'},{type:'person-note',note:'Changed'},{type:'person-flag',flag:'flagged'},{type:'rename-event',name:'Changed'},{type:'rename-subevent',name:'Changed'},{type:'event-note',note:'Changed'},{type:'add-event-people',csv:'Alex,Rivera,,,'},{type:'remove-event-person'},{type:'restore-event-person'},{type:'delete-event-person'},{type:'clear-person-history'},{type:'create-subevent',name:'Changed',date:'2026-10-20'}])assert.throws(()=>applyAction(d,{...action,eventId:event.id,personId}),/Archived/);
});

test('test-only archive cards never expose attendance progress',()=>{
 const d=setup();d.events[0].settings={testOnly:true};const html=render(h(NamePreferences,{settings:organizationSettings({})},h(ArchiveList,{events:d.events,busy:false,onAction:async()=>true,onView(){}})));assert.match(html,/Test Only/);assert.doesNotMatch(html,/event-card-progress-row|segmented-progress|\d+\/\d+ Marked/);
});
