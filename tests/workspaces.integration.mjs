import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {dirname} from 'node:path';
import {readFile,readdir} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {completeD1} from './d1-mock.mjs';
const require=createRequire(import.meta.url),{build}=require(require.resolve('esbuild',{paths:[dirname(require.resolve('wrangler/package.json'))]}));
const sqlite=new DatabaseSync(':memory:');for(const f of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())sqlite.exec(await readFile('drizzle/'+f,'utf8'));
let beforeRun;
const db={prepare(sql){const stmt=sqlite.prepare(sql);return {bind(...args){return {async first(){return stmt.get(...args)||null;},async all(){return {results:stmt.all(...args)};},async run(){beforeRun?.(sql,args);return {meta:{changes:Number(stmt.run(...args).changes)}};}};}};}};
completeD1(db,sqlite);globalThis.__workspaceDB=db;
await build({stdin:{contents:"export * as attendance from './app/api/attendance/route';export * as members from './app/api/organization/route';export * as workspaces from './app/api/workspaces/route';export {workspaceVersion,roomVersion,workspaceStream,notifyWorkspace} from './lib/live-updates';export {liveSnapshot} from './lib/live-snapshot';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile:'.sites-runtime/workspaces-test.mjs',plugins:[{name:'mock',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const env={DB:globalThis.__workspaceDB}',loader:'js'}));}}]});
const {attendance,members,workspaces,workspaceVersion,roomVersion,workspaceStream,notifyWorkspace,liveSnapshot}=await import('../.sites-runtime/workspaces-test.mjs');
const id=user=>'chatgpt:'+user;
function request(user,path,body,extra={}){return new Request('https://example.test/api/'+path,{method:body?'POST':'GET',headers:{'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@example.test',...(body?{'Content-Type':'application/json',Origin:'https://example.test'}:{}),...extra},...(body?{body:JSON.stringify(body)}:{})});}
async function load(user,workspace){const r=await attendance.GET(request(user,'attendance'+(workspace?'?workspace='+encodeURIComponent(workspace):'')));assert.equal(r.status,200,await r.clone().text());return r.json();}
const action=(user,workspace,type,extra={})=>workspaces.POST(request(user,'workspaces',{accountId:id(user),workspaceId:workspace,revision:0,action:{type,...extra}}));
const invite=(user,workspace,email)=>members.POST(request(user,'organization',{accountId:id(user),workspaceId:workspace,revision:0,action:{type:'invite-member',email}}));
async function edit(user,workspace,change){const snapshot=await load(user,workspace);return attendance.POST(request(user,'attendance',{accountId:id(user),workspaceId:workspace,revision:snapshot.revision,action:change}));}
const account=user=>({storeKey:id(user),email:user+'@example.test',isOwner:false,provider:'chatgpt'});
const list=async user=>(await (await workspaces.GET(request(user,'workspaces'))).json()).workspaces;
const joined=async(user,workspace,email)=>{const response=await members.GET(request(user,'organization?workspace='+encodeURIComponent(workspace)));assert.equal(response.status,200);return (await response.json()).members.find(member=>member.email===email);};

await load('alice');await load('bob');await load('charlie');
let response=await action('alice',undefined,'create-workspace',{name:'Second Team'});assert.equal(response.status,200);const second=(await response.json()).workspaceId;
response=await action('alice',undefined,'create-workspace',{name:'Third Team'});assert.equal(response.status,200);const third=(await response.json()).workspaceId;
assert.equal((await list('alice')).filter(item=>item.role==='admin').length,3);
for(const workspace of [id('alice'),second])assert.equal((await invite('alice',workspace,'bob@example.test')).status,200);
assert.equal((await invite('charlie',id('charlie'),'bob@example.test')).status,200);
await load('bob');const choices=await list('bob');assert.equal(choices.length,4);assert.equal(choices.filter(item=>item.role==='member').length,3);
assert.equal((await invite('alice',second,' BOB@EXAMPLE.TEST ')).status,409);
assert.equal((await edit('alice',second,{type:'create-roster',name:'Second Roster',csv:'Alex,Rivera,,,'})).status,200);
assert.equal((await edit('alice',third,{type:'create-roster',name:'Third Roster',csv:'Jordan,Lee,,,'})).status,200);
assert.equal((await load('bob',second)).data.rosters[0].name,'Second Roster');
assert.equal((await load('alice',third)).data.rosters[0].name,'Third Roster');assert.equal((await load('alice',id('alice'))).data.rosters.length,0);
assert.equal((await attendance.GET(request('charlie','attendance?workspace='+encodeURIComponent(second)))).status,403);
assert.equal((await action('bob',second,'delete-workspace',{confirmation:'DELETE'})).status,403);
assert.equal((await action('bob',second,'transfer-workspace',{memberId:'fake'})).status,403);
assert.equal((await action('alice',second,'leave-workspace')).status,409);
assert.equal((await invite('alice',second,'pending@example.test')).status,200);
const pending=await joined('alice',second,'pending@example.test');assert.equal(pending.joined,false);
assert.equal((await action('alice',second,'transfer-workspace',{memberId:pending.id})).status,400);
assert.equal((await action('alice',second,'transfer-workspace',{memberId:(await joined('alice',id('alice'),'bob@example.test')).id})).status,400);

// One account can keep two independent live tabs; no account-global active workspace.
const a=await workspaceVersion(db,account('alice'),second),b=await workspaceVersion(db,account('alice'),third);assert.equal(a.workspaceId,second);assert.equal(b.workspaceId,third);
const c1=new AbortController(),c2=new AbortController();
const readPacket=async reader=>{let text='';for(let i=0;i<4;i++){const chunk=await reader.read();text+=new TextDecoder().decode(chunk.value);const packet=text.match(/data: (.+)\n/);if(packet)return JSON.parse(packet[1]);}throw Error('No Packet');};
const s1=workspaceStream(db,account('alice'),c1.signal,true,undefined,second).getReader(),s2=workspaceStream(db,account('alice'),c2.signal,true,undefined,third).getReader();
assert.equal((await readPacket(s1)).data.rosters[0].name,'Second Roster');assert.equal((await readPacket(s2)).data.rosters[0].name,'Third Roster');c1.abort();c2.abort();await s1.cancel();await s2.cancel();

// Transfer is atomic, leaves the old owner as member, and changes live permissions.
const member=await joined('alice',second,'bob@example.test');const before=sqlite.prepare('SELECT data FROM attendance_stores WHERE user_id=?').get(second).data;
assert.equal((await action('alice',second,'transfer-workspace',{memberId:member.id})).status,200);
assert.equal(sqlite.prepare('SELECT data FROM attendance_stores WHERE user_id=?').get(second).data,before);
assert.equal((await load('bob',second)).account.organizationRole,'admin');assert.equal((await load('alice',second)).account.organizationRole,'member');
notifyWorkspace(db,second);assert.equal((await roomVersion(db,second,account('alice'),second)).organizationRole,'member');assert.equal((await roomVersion(db,second,account('bob'),second)).organizationRole,'admin');
assert.equal((await edit('alice',second,{type:'update-organization',organization:{name:'Attack'}})).status,403);
assert.equal((await invite('alice',second,'victim@example.test')).status,403);
assert.equal((await action('alice',second,'delete-workspace',{confirmation:'DELETE'})).status,403);
assert.equal((await action('alice',second,'leave-workspace')).status,200);
assert.equal(await liveSnapshot(db,account('alice'),second),null);assert.equal(await workspaceVersion(db,account('alice'),second),null);
assert.ok((await list('alice')).some(item=>item.id===third));assert.equal((await attendance.GET(request('alice','attendance?workspace='+second))).status,403);
assert.equal((await action('bob',second,'leave-workspace')).status,409);

// Losing ownership while a destructive request is in flight cannot delete a store.
const bobSecondMember=await invite('bob',second,'charlie@example.test');assert.equal(bobSecondMember.status,200);await load('charlie',second);
let raced=false;beforeRun=(sql)=>{if(!raced&&sql.startsWith('DELETE FROM organization_history_actors')){raced=true;sqlite.prepare('UPDATE organizations SET owner_id=?,owner_email=? WHERE id=?').run(id('charlie'),'charlie@example.test',second);}};
assert.equal((await action('bob',second,'delete-workspace',{confirmation:'DELETE'})).status,403);beforeRun=undefined;assert.ok(raced);assert.equal(sqlite.prepare('SELECT data FROM attendance_stores WHERE user_id=?').get(second).data,before);
// Restore the synthetic fixture owner; this is an isolated in-memory test database.
sqlite.prepare('UPDATE organizations SET owner_id=?,owner_email=? WHERE id=?').run(id('bob'),'bob@example.test',second);
assert.equal((await action('bob',second,'delete-workspace')).status,400);assert.equal((await action('bob',second,'delete-workspace',{confirmation:'wrong'})).status,400);
assert.equal((await action('bob',second,'delete-workspace',{confirmation:'DELETE'})).status,200);
for(const [table,column] of [['organizations','id'],['attendance_stores','user_id'],['organization_members','organization_id'],['organization_history_actors','organization_id']])assert.equal(sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column}=?`).get(second).n,0);
assert.equal(await liveSnapshot(db,account('bob'),second),null);assert.ok(!(await list('bob')).some(item=>item.id===second));

// Transferring an older workspace before opening attendance preserves private legacy settings.
sqlite.prepare('INSERT INTO organizations VALUES (?,?,?,?)').run(id('legacy'),'chatgpt:legacy','legacy@example.test','2026-10-01');
sqlite.prepare('INSERT INTO attendance_stores VALUES (?,?,?,?)').run(id('legacy'),JSON.stringify({rosters:[],events:[],profile:{firstName:'Legacy',lastName:'Private',preferredName:''},preferences:{theme:'dark',haptics:false}}),0,'2026-10-01');
sqlite.prepare('INSERT INTO organization_members VALUES (?,?,?,?,?,?)').run('legacy-bob',id('legacy'),'bob@example.test',id('bob'),id('legacy'),'2026-10-01');
assert.equal((await action('legacy',id('legacy'),'transfer-workspace',{memberId:'legacy-bob'})).status,200);
assert.equal(JSON.parse(sqlite.prepare('SELECT data FROM account_settings WHERE account_id=?').get(id('legacy')).data).profile.firstName,'Legacy');
assert.equal((await action('bob',id('legacy'),'delete-workspace',{confirmation:'DELETE'})).status,200);
const legacy=await load('legacy');assert.equal(legacy.account.workspaces.length,0);assert.equal(legacy.data.profile.firstName,'Legacy');assert.equal(legacy.data.preferences.theme,'dark');

// A changed verified email plus a duplicate invitation must not lock the account out.
assert.equal((await invite('alice',third,'charlie@example.test')).status,200);await load('charlie',third);
sqlite.prepare('UPDATE organization_members SET email=? WHERE organization_id=? AND account_id=?').run('former-charlie@example.test',third,id('charlie'));
assert.equal((await invite('alice',third,'charlie@example.test')).status,200);await load('charlie',third);
assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM organization_members WHERE organization_id=? AND account_id=?').get(third,id('charlie')).n,1);
assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM organization_members WHERE organization_id=? AND account_id IS NULL').get(third).n,1);

// Deleting the original final workspace must not resurrect it or reset the account.
await load('solo');await edit('solo',id('solo'),{type:'update-profile',profile:{firstName:'Private',lastName:'Person',preferredName:''}});
assert.equal((await action('solo',id('solo'),'delete-workspace',{confirmation:'DELETE'})).status,200);
let empty=await load('solo');assert.equal(empty.account.workspaceId,undefined);assert.equal(empty.account.workspaces.length,0);assert.equal(empty.data.profile.firstName,'Private');assert.equal(empty.data.events.length,0);
assert.equal((await edit('solo',undefined,{type:'update-preferences',preferences:{theme:'dark',haptics:true}})).status,200);
empty=await load('solo');assert.equal(empty.data.preferences.theme,'dark');assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM organizations WHERE owner_id=?').get(id('solo')).n,0);
assert.equal((await action('solo',undefined,'create-workspace',{name:'Start Again'})).status,200);assert.equal((await list('solo')).length,1);
assert.equal((await workspaces.POST(request('solo','workspaces',{accountId:id('alice'),revision:0,action:{type:'create-workspace',name:'Forged'}}))).status,403);
assert.equal((await workspaces.POST(request('solo','workspaces',{accountId:id('solo'),revision:0,action:{type:'create-workspace',name:'Cross Site'}},{Origin:'https://evil.test'}))).status,403);
sqlite.close();console.log('Multi-workspace integration passed: multiple owned/shared memberships, email invitations, independent live tabs, isolated records, owner/member permissions, joined-only atomic transfer, leaving, stale-access rejection, in-flight ownership revocation, permanent deletion without resurrection, private settings and CSRF/account forgery protection.');
