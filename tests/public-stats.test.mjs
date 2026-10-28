import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {createRequire} from 'node:module';
import {dirname} from 'node:path';
const require=createRequire(import.meta.url),{build}=require(require.resolve('esbuild',{paths:[dirname(require.resolve('wrangler/package.json'))]}));
const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE organizations(id TEXT);CREATE TABLE attendance_stores(user_id TEXT,data TEXT);');
globalThis.__statsDB={prepare(sql){return {async first(){return db.prepare(sql).get();}};}};
await build({entryPoints:['app/api/stats/route.ts'],bundle:true,platform:'node',format:'esm',outfile:'.sites-runtime/stats-test.mjs',plugins:[{name:'mock',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const env={DB:globalThis.__statsDB}',loader:'js'}));}}]});
const {GET}=await import('../.sites-runtime/stats-test.mjs');
test('public stats expose only aggregate counts, exclude legacy copies and removed/deleted marks, and count event families once',async()=>{
 const data={rosters:[{name:'PRIVATE PERSON'}],events:[{id:'test-root',settings:{testOnly:true},participants:[{status:'Present'},{status:'Absent'}]},{id:'test-child',parentEventId:'test-root',participants:[{status:'Tardy'}]},{id:'root',participants:[{status:'Present'},{status:'Absent'},{status:'Tardy'},{status:null},{status:'Absent',removed:true},{status:'Present',removed:true}],note:'PRIVATE NOTE'},{id:'child',parentEventId:'root',participants:[{status:'Absent'},{status:'custom-status'}]},{id:'deleted',subeventDeleted:true,participants:[{status:'Tardy'},{status:'Present'}]},{id:'old-root',subeventDeleted:true,participants:[]},{id:'surviving-child',parentEventId:'old-root',participants:[{status:'Tardy'}]}]};
 db.prepare('INSERT INTO organizations VALUES (?)').run('workspace');db.prepare('INSERT INTO organizations VALUES (?)').run('empty-workspace');db.prepare('INSERT INTO attendance_stores VALUES (?,?)').run('workspace',JSON.stringify(data));db.prepare('INSERT INTO attendance_stores VALUES (?,?)').run('legacy',JSON.stringify(data));
 const r=await GET();assert.equal(r.status,200);assert.deepEqual(await r.json(),{organizations:2,rosters:1,events:2,attendance:6,absences:2,tardies:2,present:1});assert.match(r.headers.get('cache-control'),/max-age=300/);
});
test('statistics failure returns no private details or invented counts',async()=>{
 db.close();const r=await GET();assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'Community Stats Are Temporarily Unavailable.'});assert.equal(r.headers.get('cache-control'),'no-store');
});
