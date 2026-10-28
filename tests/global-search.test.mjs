import assert from 'node:assert/strict';
import {test} from 'node:test';
import {applyAction,personFromFields} from '../lib/model.ts';
import {withSlugs} from '../lib/navigation.ts';
import {withPersonIds} from '../lib/person-identity.ts';
import {searchItems,searchWorkspace,readRecentSearches} from '../lib/global-search.ts';
import {recordSearchShortcut,matchesSearchShortcut,validSearchShortcut} from '../lib/search-shortcut.ts';
import {validatePreferences,preferenceSettings} from '../lib/workspace-settings.ts';
const at='2026-10-22T12:00:00Z';
function setup(){
 const p=personFromFields({firstName:'Alex',lastName:'Rivera',preferredFirstName:'',firstPronunciation:'',lastPronunciation:''},'person-1');
 let data={rosters:[{id:'r1',name:'Staff',people:[p],createdAt:at,updatedAt:at},{id:'r2',name:'Officials',people:[{...p,id:'alias-1'}],createdAt:at,updatedAt:at}],events:[],personLinks:{'alias-1':'person-1'}};
 data=applyAction(data,{type:'create-event',rosterId:'r1',name:'Fall Training',date:'2026-10-22'},at);
 data=applyAction(data,{type:'create-subevent',eventId:data.events[0].id,name:'Friday',date:'2026-10-23'},at);
 return withSlugs(withPersonIds(data));
}
test('search resolves linked people once, accepts hidden IDs, and finds rosters, events and subevents',()=>{
 const data=setup(),items=searchItems(data),person=items.filter(item=>item.kind==='Person');assert.equal(person.length,1);assert.ok(person[0].detail.includes('Staff'));assert.ok(person[0].detail.includes('Officials'));
 for(const uid of Object.values(data.personIds))assert.equal(searchWorkspace(items,uid)[0].key,person[0].key);
 assert.equal(searchWorkspace(items,'Alex Rivera')[0].kind,'Person');assert.equal(searchWorkspace(items,'Staff')[0].kind,'Roster');assert.equal(searchWorkspace(items,'Fall Training')[0].kind,'Event');assert.equal(searchWorkspace(items,'Friday')[0].kind,'Subevent');
 assert.match(searchWorkspace(items,'Friday')[0].path,/\/event\//);assert.equal(searchWorkspace(items,'not here').length,0);
});
test('search ranks exact and prefix matches, breaks equal ranks by modification date, and caps results at five',()=>{
 const make=(label,modified)=>({key:label,kind:'Roster',label,terms:[label],modified,path:'/',detail:''});
 const items=[make('Team West','2026-10-20'),make('Team East','2026-10-22'),make('My Team','2026-10-25'),make('Team','2026-10-01'),...Array.from({length:10},(_,i)=>make('Team '+i,'2026-10-02'))];
 const result=searchWorkspace(items,'team');assert.equal(result.length,5);assert.equal(result[0].label,'Team');assert.equal(result[1].label,'Team East');assert.equal(result[2].label,'Team West');
});
test('test-only participant data and deleted subevents do not leak into global search',()=>{
 const data=setup(),root=data.events[0],extra={...root.participants[0],id:'test-person',name:'Test Secret',firstName:'Test',lastName:'Secret'};
 data.events[1].subeventDeleted=true;data.events[0].settings={testOnly:true};data.events[0].participants.push(extra);
 const items=searchItems(withPersonIds(data));assert.equal(searchWorkspace(items,'Test Secret').length,0);assert.equal(items.filter(item=>item.kind==='Subevent').length,0);assert.equal(searchWorkspace(items,'Fall Training')[0].kind,'Event');
});
test('recent history is bounded, tolerates corrupt data, and uses an account/workspace key',()=>{
 let key;const storage={getItem:k=>(key=k,JSON.stringify(['a','a',...Array.from({length:8},(_,i)=>'item'+i)]))};assert.equal(readRecentSearches(storage,'user|workspace').length,5);assert.ok(key.includes(encodeURIComponent('user|workspace')));assert.deepEqual(readRecentSearches({getItem:()=>'{bad'},'other'),[]);
});
test('custom shortcuts save, match Ctrl and Cmd interchangeably, and keep modifiers exact',()=>{
 const key={key:'k',ctrlKey:true,metaKey:false,altKey:false,shiftKey:false};assert.equal(recordSearchShortcut(key),'Mod+K');assert.ok(matchesSearchShortcut({...key,ctrlKey:false,metaKey:true},'Mod+K'));assert.ok(!matchesSearchShortcut({...key,shiftKey:true},'Mod+K'));
 assert.ok(validSearchShortcut('Alt+Shift+Q'));assert.ok(!validSearchShortcut('K'));assert.ok(!validSearchShortcut('Alt+Alt+Q'));
 const saved=validatePreferences({theme:'dark',haptics:true,globalSearchShortcut:'Mod+Shift+P'});assert.equal(preferenceSettings(saved).globalSearchShortcut,'Mod+Shift+P');assert.equal(preferenceSettings().globalSearchShortcut,'Mod+K');assert.throws(()=>validatePreferences({theme:'dark',haptics:true,globalSearchShortcut:'Escape'}));
});

test('search details use current memberships, active roster counts, readable dates and separate title metadata',()=>{
 const data=setup();data.rosters[0].name='Current Staff';data.events[0].rosterName='Old Staff';data.events[1].rosterName='Old Staff';
 data.rosters[0].removedPeople=[{...data.rosters[0].people[0],id:'removed-person',removedAt:at,removedIndex:0}];
 const items=searchItems(withPersonIds(data)),person=items.find(item=>item.key==='person:person-1'),roster=items.find(item=>item.key==='roster:r1'),event=items.find(item=>item.kind==='Event'),subevent=items.find(item=>item.kind==='Subevent');
 assert.ok(person.uid);assert.ok(!person.detail.includes(person.uid));assert.ok(person.detail.includes('Current Staff'));assert.ok(!person.detail.includes('Old Staff'));assert.equal(roster.detail,'Roster • 1');assert.equal(event.detail,'Event • 22 Oct 2026');assert.match(subevent.detail,/^Subevent • Fall Training • 22 Oct 2026$/);
 data.events[0].settings={testOnly:true};const testItem=searchItems(data).find(item=>item.kind==='Event');assert.equal(testItem.testOnly,true);assert.ok(!testItem.detail.includes('Test Only'));
});
