import {DEFAULT_ATTENDANCE} from '../lib/attendance-settings.ts';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import {dirname} from 'node:path';
import {archiveExpiresAt,validateOrganization,defaultOrganization,purgeExpiredArchives} from '../lib/workspace-settings.ts';
const require=createRequire(import.meta.url),{build}=require(require.resolve('esbuild',{paths:[dirname(require.resolve('wrangler/package.json'))]}));
await build({entryPoints:['app/settings-panel.tsx'],bundle:true,platform:'node',format:'esm',jsx:'automatic',packages:'external',outfile:'.sites-runtime/settings-preview-test.mjs'});
const {default:Panel}=await import('../.sites-runtime/settings-preview-test.mjs');const {createElement}=await import('react'),{renderToStaticMarkup}=await import('react-dom/server');
const render=(organization={},role='admin')=>renderToStaticMarkup(createElement(Panel,{data:{events:[],rosters:[],organization:{...defaultOrganization,...organization}},account:{name:'Alex',email:'test@example.test',organizationRole:role},busy:false,onAction:async()=>true}));
test('all five retention periods validate and shorter periods expire exactly at their boundaries',()=>{
 for(const [value,days] of [['1d',1],['7d',7],['30d',30]]){assert.equal(validateOrganization({...defaultOrganization,archiveRetention:value}).archiveRetention,value);assert.equal(archiveExpiresAt('2026-10-01T12:00:00Z',value).toISOString(),new Date(Date.parse('2026-10-01T12:00:00Z')+days*86400000).toISOString());}
 for(const value of ['3m','6m'])assert.equal(validateOrganization({...defaultOrganization,archiveRetention:value}).archiveRetention,value);
 assert.throws(()=>validateOrganization({...defaultOrganization,archiveRetention:'12m'}));
 const data={events:[{id:'root',archivedAt:'2026-10-01T12:00:00Z'},{id:'child',parentEventId:'root'}],organization:{...defaultOrganization,archiveRetention:'1d'}};assert.equal(purgeExpiredArchives(data,Date.parse('2026-10-02T11:59:59Z')).events.length,2);assert.equal(purgeExpiredArchives(data,Date.parse('2026-10-02T12:00:00Z')).events.length,0);
 assert.equal(defaultOrganization.archiveRetention,'30d');
});
test('retention is an accessible discrete slider with five title-case choices',()=>{
 const html=render();assert.match(html,/type="range" min="0" max="4" step="1"/);assert.match(html,/aria-valuetext="30 Days"/);for(const label of ['1 Day','1 Week','30 Days','3 Months','6 Months'])assert.ok(html.includes(label));assert.match(html,/aria-label="Insert Name Part"/);for(const label of ['Table Density','Starting Page','Default Event View','Date Format','Time Format','Time Zone','Save Mode'])assert.ok(html.includes('aria-label="'+label+'"'));
});
test('the single live roll-call preview follows both name and pronunciation choices',()=>{
 const html=render({nameDisplay:'quoted',showPronunciation:true});assert.match(html,/Roll Call Preview/);assert.match(html,/Alexandra &#x27;Alex&#x27; Rivera/);assert.match(html,/al-ig-ZAN-druh/);assert.match(html,/Present/);assert.ok(!html.includes('Name Display Preview'));assert.ok(!html.includes('settings-roll-preview'));
 const hidden=render({nameDisplay:'preferred',showPronunciation:false});assert.match(hidden,/Alex Rivera/);assert.ok(!hidden.includes('al-ig-ZAN-druh'));assert.match(render({nameDisplay:'legal'}),/Alexandra Rivera/);
});
test('members see organization settings without admin save or member management controls',()=>{const html=render({},'member');assert.match(html,/<fieldset[^>]*disabled/);assert.ok(!html.includes('Save Organization'));assert.ok(!html.includes('Add Member'));assert.match(html,/settings-save-all/);assert.match(html,/settings-save-all/);});


test('color swatches expose their color-name tooltips without a tooltip on the picker trigger',()=>{
 const html=render();
 for(const name of ['Green','Yellow','Orange','Red','Purple','Pink','Blue','Teal','Indigo','Lime','Gray','Signal Red','Signal Green'])assert.ok(html.includes('data-tooltip="'+name+'"'),'Missing '+name+' tooltip');
 for(const summary of html.matchAll(/<summary[^>]*>/g))assert.ok(!summary[0].includes('data-tooltip='),'Picker trigger must not have a hover tooltip');
});

test('alphabetical sorting is optional, validates strictly and is visible to workspace admins',()=>{
 assert.equal(validateOrganization({...defaultOrganization,forceAlphabetical:true}).forceAlphabetical,true);
 assert.equal(validateOrganization({...defaultOrganization,forceAlphabetical:false}).forceAlphabetical,false);
 assert.throws(()=>validateOrganization({...defaultOrganization,forceAlphabetical:'true'}));
 assert.match(render({forceAlphabetical:true}),/Default Sort/);
});


test('name formatting uses one inline textbox and the shared roll-call preview',()=>{
 const html=render();assert.match(html,/role="textbox"[^>]+aria-multiline="false"[^>]+contentEditable="true"/i);assert.ok(!html.includes('With Preferred Name'));assert.ok(!html.includes('Without Preferred Name'));assert.ok(!html.includes('Alt + Arrow'));assert.ok(!html.includes('name-format-help'));assert.match(html,/Roll Call Preview/);assert.ok(!html.includes('Name Display Preview'));assert.ok(!html.includes('name-format-presets'));assert.ok(!html.includes('Punctuation before'));assert.ok(!html.includes('Punctuation after'));assert.ok(!html.includes('name-format-part-title'));
 assert.match(render({},'member'),/role="textbox"[^>]+aria-disabled="true"[^>]+contentEditable="false"/i);
});


test('settings use three accessible tabs with mounted panels and Profile selected initially',()=>{
 const html=render();const tabs=[...html.matchAll(/<button[^>]*role="tab"[^>]*>([\s\S]*?)<\/button>/g)];
 assert.equal(tabs.length,3);for(const [i,label] of ['Profile','Preferences','Organization'].entries())assert.ok(tabs[i][1].includes(label));
 assert.match(tabs[0][0],/aria-selected="true"/);assert.match(tabs[1][0],/aria-selected="false"/);
 const panels=[...html.matchAll(/<div[^>]*role="tabpanel"[^>]*>/g)];assert.equal(panels.length,3);assert.ok(!panels[0][0].includes('hidden='));assert.match(panels[1][0],/hidden=""/);assert.match(panels[2][0],/hidden=""/);
 // Inactive forms are still present: a tab switch cannot unmount their drafts.
 assert.equal((html.match(/class="primary settings-save-all"/g)||[]).length,1);for(const label of ['Save Profile','Save Preferences','Save Organization'])assert.ok(!html.includes(label));
 const profileEnd=html.indexOf('Privacy &amp; Legal'),preferences=html.indexOf('<h2>Preferences</h2>'),organization=html.indexOf('<h2>Organization</h2>');assert.ok(profileEnd<preferences&&preferences<organization);
});

test('organization settings have ordered disclosure groups without adding event overrides',()=>{
 const html=render().split('class="settings-card organization-settings"')[1];const groups=[...html.matchAll(/<details class="settings-group"([^>]*)><summary><h3>([^<]+)<\/h3>/g)];
 assert.deepEqual(groups.map(m=>m[2]),['Names &amp; Sorting','Attendance Statuses','Roll Call Display','Mobile','Archived Records','Live Preview']);
 for(const [i,group] of groups.entries())assert.equal(group[1].includes('open'),i!==4);
 assert.ok(!html.includes('Local Settings'));assert.ok(!html.includes('Inherit'));assert.match(html,/Keep Archived Records/);
});

await build({entryPoints:['app/event-settings-panel.tsx'],bundle:true,platform:'node',format:'esm',jsx:'automatic',packages:'external',outfile:'.sites-runtime/event-settings-panel-test.mjs'});
const {default:EventPanel}=await import('../.sites-runtime/event-settings-panel-test.mjs');
test('event settings reuse global control groups and previews without account or organization controls',()=>{
 const event={id:'event',name:'Local Event',date:'2026-10-20',rosterId:'roster',rosterName:'Staff',note:'',participants:[],createdAt:'',updatedAt:'',history:[]},data={events:[event],rosters:[]};
 const props={data,event,busy:false,admin:true,onAction:async()=>false,onDirtyChange(){},onBack(){}};
 const local=renderToStaticMarkup(createElement(EventPanel,props)),global=render();
 for(const heading of ['Names &amp; Sorting','Attendance Statuses','Roll Call Display','Live Preview']){assert.ok(local.includes(heading),heading);assert.ok(global.includes(heading),heading);}
 for(const label of ['Use Global Settings','aria-label="Save"','Back To Event','Roll Call Preview'])assert.ok(local.includes(label),label);
 for(const label of ['Organization Name','Keep Archived Records','Save Profile'])assert.ok(!local.includes(label),label);
 const archived=renderToStaticMarkup(createElement(EventPanel,{...props,event:{...event,archivedAt:'2026-10-20T00:00:00Z'},data:{...data,events:[{...event,archivedAt:'2026-10-20T00:00:00Z'}]}}));
 assert.ok(archived.includes('Archived Event'));assert.match(archived,/<button[^>]*aria-label="Save"[^>]*disabled/);assert.match(archived,/<fieldset[^>]*disabled/);
});

 test('default sort uses the shared dropdown and a compact ASC direction button',()=>{const html=render();assert.match(html,/Default Sort/);assert.match(html,/aria-label="Default Sort Direction: ASC"/);assert.match(html,/class="sort-direction"/);assert.match(html,/lucide-arrow-up/);assert.ok(!html.includes('Always Sort Roll Call'));assert.ok(!html.includes('Default To Last Name Order'));const descending=render({defaultSort:{key:'Last Changed',direction:'desc'}});assert.match(descending,/Default Sort Direction: DESC/);assert.match(descending,/class="[^"]*dropdown-arrow[^"]*"[^>]*data-flipped="true"/);});

test('event mode switch disables and fades global controls while local controls remain editable',()=>{const event={id:'mode',name:'Mode Event',date:'2026-10-22',rosterId:'r',rosterName:'Staff',note:'',participants:[],createdAt:'',updatedAt:'',history:[]},props={data:{events:[event],rosters:[]},event,busy:false,admin:true,onAction:async()=>false,onDirtyChange(){},onBack(){}};const html=renderToStaticMarkup(createElement(EventPanel,props));assert.match(html,/aria-pressed="true"[^>]*>Use Global Settings/);assert.match(html,/settings-controls event-settings-inherited[^>]*disabled/);assert.match(html,/<button[^>]*disabled[^>]*>Revert Local Settings/);assert.match(html,/contentEditable="false"/);const local={...event,settings:{useGlobal:false,nameDisplay:'legal'}};const editable=renderToStaticMarkup(createElement(EventPanel,{...props,event:local,data:{events:[local],rosters:[]}}));assert.ok(!editable.includes('event-settings-inherited'));assert.match(editable,/contentEditable="true"/);assert.match(editable,/aria-pressed="true"[^>]*>Use Local Settings/);assert.match(editable,/<button[^>]*class="event-test-toggle"[^>]*aria-pressed="false"[^>]*>Test Only/);assert.match(editable,/aria-label="About Test Only"/);assert.doesNotMatch(editable,/type="checkbox"[^>]*Test Only/);const testEvent={...local,settings:{...local.settings,testOnly:true}};const testHtml=renderToStaticMarkup(createElement(EventPanel,{...props,event:testEvent,data:{events:[testEvent],rosters:[]}}));assert.match(testHtml,/<button[^>]*class="event-test-toggle"[^>]*aria-pressed="true"[^>]*>Test Only/);assert.match(testHtml,/event-test-badge[^>]*>TEST ONLY/);});

await build({entryPoints:['app/roll-call-settings-fields.tsx'],bundle:true,platform:'node',format:'esm',jsx:'automatic',packages:'external',outfile:'.sites-runtime/shared-settings-layout-test.mjs'});
const {default:SharedFields}=await import('../.sites-runtime/shared-settings-layout-test.mjs');
test('global and event settings share identical sections, columns, previews and controls',()=>{const renderFields=scope=>renderToStaticMarkup(createElement(SharedFields,{value:defaultOrganization,scope,disabled:false,onChange(){}})).replaceAll('global-default-sort','scope-default-sort').replaceAll('event-default-sort','scope-default-sort').replaceAll('global-swipe-','scope-swipe-').replaceAll('event-swipe-','scope-swipe-');const global=renderFields('global'),local=renderFields('event');assert.equal(global,local);assert.match(global,/class="roll-call-settings-sections"/);assert.ok(!global.includes('settings-column'));assert.match(global,/class="name-settings-fields"/);assert.match(global,/class="display-settings-fields"/);assert.equal((global.match(/<details class="settings-group"/g)||[]).length,5);assert.match(global,/Default Swipe Left Action/);assert.match(global,/Default Swipe Right Action/);});

test('excuses share the status section, include contained drag handles and hide when disabled',()=>{const html=render();assert.match(html,/Enable Excuse Types/);assert.match(html,/Reorder Work/);assert.match(html,/sortable-contained/);assert.match(html,/Excuse Name: Work/);const hidden=render({attendance:{...DEFAULT_ATTENDANCE,excuseTypes:false}});assert.ok(!hidden.includes('Excuse Name:'));assert.ok(!hidden.includes('Excused Button Label'));});
test('personal preferences stay in four compact groups with all twelve choices and one shared save',()=>{
 const html=render(),panel=html.slice(html.indexOf('<h2>Preferences</h2>'),html.indexOf('<h2>Organization</h2>'));
 const groups=[...panel.matchAll(/<h3>([^<]+)<\/h3>/g)].map(match=>match[1]);assert.deepEqual(groups,['Appearance','Navigation &amp; Tables','Dates &amp; Time','Editing &amp; Shortcuts']);
 for(const label of ['Table Density','Default Event View','Starting Page','Date Format','Time Format','Time Zone','Remember Search &amp; Filters','Sidebar','Reduce Motion','Confirm Bulk Attendance Changes','Show Keyboard Shortcut Hints','Show Person IDs In Roll Call'])assert.ok(panel.includes(label),label);
 assert.equal((html.match(/class="primary settings-save-all"/g)||[]).length,1);assert.ok(!panel.includes('Save Preferences'));
});
