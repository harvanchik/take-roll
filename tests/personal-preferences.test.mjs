import assert from 'node:assert/strict';import {test} from 'node:test';
import {defaultPreferences,preferenceSettings,validatePreferences} from '../lib/workspace-settings.ts';
import {formatDay,formatTimestamp} from '../lib/dates.ts';
import {startingPath,readViewState,viewStateKey,readComparisonState} from '../lib/personal-navigation.ts';
import {shortcutTooltip} from '../lib/shortcut-hints.ts';
import {applyAction} from '../lib/model.ts';
import {seedData} from './fixtures.mjs';
test('all twelve personal preferences round trip without changing shared settings',()=>{
 const preferences={...defaultPreferences,tableDensity:'compact',defaultEventView:'overview',startingPage:'rosters',dateFormat:'iso',timeFormat:'24h',timeZone:'America/Chicago',rememberFilters:true,sidebarBehavior:'collapsed',reduceMotion:true,confirmBulkChanges:false,shortcutHints:false,showPersonIds:true};
 assert.deepEqual(validatePreferences(preferences),preferences);const before=seedData(),after=applyAction(before,{type:'update-preferences',preferences});assert.deepEqual(after.preferences,preferences);assert.deepEqual(after.rosters,before.rosters);assert.deepEqual(after.events,before.events);assert.equal(after.organization,before.organization);
 const legacy=applyAction(after,{type:'update-preferences',preferences:{theme:'dark',haptics:false}});assert.equal(legacy.preferences.timeZone,'America/Chicago');assert.equal(legacy.preferences.showPersonIds,true);
});
test('invalid preference choices, booleans and time zones are rejected',()=>{
 for(const key of ['tableDensity','defaultEventView','startingPage','dateFormat','timeFormat','sidebarBehavior'])assert.throws(()=>validatePreferences({...defaultPreferences,[key]:'invalid'}));
 for(const key of ['autoSave','rememberFilters','reduceMotion','confirmBulkChanges','shortcutHints','showPersonIds'])assert.throws(()=>validatePreferences({...defaultPreferences,[key]:'false'}));
 for(const zone of ['Not/AZone','',null,'x'.repeat(101)])assert.throws(()=>validatePreferences({...defaultPreferences,timeZone:zone}));
 assert.equal(validatePreferences({...defaultPreferences,timeZone:'UTC'}).timeZone,'UTC');assert.equal(preferenceSettings({theme:'dark',haptics:false}).confirmBulkChanges,true);assert.equal(preferenceSettings().rememberFilters,false);
});
test('date and time choices respect timestamp zones and preserve literal session dates',()=>{
 assert.equal(formatDay('2026-10-24',{dateFormat:'mdy',timeZone:'Pacific/Honolulu'}),'10/24/2026');assert.equal(formatDay('2026-10-24',{dateFormat:'dmy'}),'24/10/2026');assert.equal(formatDay('2026-10-24',{dateFormat:'iso'}),'2026-10-24');
 assert.equal(formatTimestamp('2026-10-24T01:05:00Z',{dateFormat:'iso',timeFormat:'24h',timeZone:'America/Chicago'}),'2026-10-23, 20:05');assert.equal(formatTimestamp('2026-10-24T01:05:00Z',{dateFormat:'mdy',timeFormat:'12h',timeZone:'UTC'}),'10/24/2026, 1:05 AM');
});
test('starting page validates remembered routes and respects explicit choices',()=>{
 const valid=p=>['/rosters','/event/test/day-1'].includes(p);assert.equal(startingPath({...defaultPreferences,startingPage:'rosters'},'/event/test/day-1',valid),'/rosters');assert.equal(startingPath(defaultPreferences,'/event/test/day-1',valid),'/event/test/day-1');for(const path of ['/event/deleted','//evil.test','https://evil.test',null])assert.equal(startingPath(defaultPreferences,path,valid),'/events');
});
test('remembered filters are scoped and malformed state cannot inject unrelated keys',()=>{
 assert.notEqual(viewStateKey('a|workspace','/events'),viewStateKey('b|workspace','/events'));assert.notEqual(viewStateKey('a|workspace','/events'),viewStateKey('a|other','/events'));
 const defaults={search:'',status:[],flag:null};const storage={getItem:()=>JSON.stringify({search:'Alex',status:['Present'],flag:'flagged',extra:'ignored'})};assert.deepEqual(readViewState(storage,'key',defaults),{search:'Alex',status:['Present'],flag:'flagged'});assert.deepEqual(readViewState({getItem:()=>'{bad'},'key',defaults),defaults);assert.deepEqual(readViewState({getItem:()=>JSON.stringify({search:5,status:[{}],flag:'bad'})},'key',defaults),defaults);
});
test('shortcut hints are optional without disabling actions or changing attendance notes',()=>{assert.equal(shortcutTooltip('Save Changes (Ctrl/Cmd + S)',false),'Save Changes');assert.equal(shortcutTooltip('Save Changes (Ctrl/Cmd + S)',true),'Save Changes (Ctrl/Cmd + S)');assert.equal(shortcutTooltip('View Attendance Record',false),'View Attendance Record');});
test('overview filters restore their scope and selection while dropping unavailable subevents',()=>{const storage=value=>({getItem:()=>JSON.stringify(value)});assert.deepEqual(readComparisonState(storage({scope:'all',selected:['a','b','deleted']}),'key',['a'],['a','b']),{scope:'all',selected:['a','b']});assert.deepEqual(readComparisonState(storage({scope:'invalid',selected:['a','b']}),'key',['a'],['a','b']),{scope:'family',selected:['a']});assert.deepEqual(readComparisonState(storage({scope:'family',selected:[]}),'key',['a'],['a']),{scope:'family',selected:[]});});
