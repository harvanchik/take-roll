import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {nativeAttendanceAccount} from '../lib/owner-access.ts';
const migration=readFileSync('drizzle/0009_native_account_aliases.sql','utf8');
function database(){const db=new DatabaseSync(':memory:');for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')&&!f.startsWith('0009_')).sort())db.exec(readFileSync('drizzle/'+file,'utf8'));return db;}
const binding=db=>({prepare(sql){return {bind(...args){return {async first(){return db.prepare(sql).get(...args)||null;},async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}};}};}};}});
const request=(subject,email='owner@example.test')=>new Request('https://example.test',{headers:{'oai-authenticated-user-email':email,...(subject?{'oai-authenticated-user-id':subject}:{})}});

test('database alias migration preserves every stored record and binds only an unambiguous legacy identity',async()=>{
 const db=database(),at='2026-10-01',key='historical-account';
 db.prepare('INSERT INTO organizations VALUES (?,?,?,?)').run(key,key,'Owner@Example.Test',at);
 db.prepare('INSERT INTO organizations VALUES (?,?,?,?)').run('second-workspace',key,'owner@example.test',at);
 db.prepare('INSERT INTO attendance_stores VALUES (?,?,?,?)').run(key,JSON.stringify({rosters:[{id:'saved-roster'}],events:[{id:'saved-event',participants:[{id:'person',note:'Saved note',history:[{id:'original-history'}]}]}],completedEventMerges:[{key:'completed-repair'}],soccerPeopleLinked:{linked:3}}),52,at);
 db.prepare('INSERT INTO account_settings VALUES (?,?)').run(key,'{"preferences":{"theme":"light"}}');
 db.prepare('INSERT INTO legal_acceptances VALUES (?,?,?,?,?)').run(key,'version','digest',at,1);
 db.prepare('INSERT INTO organization_members VALUES (?,?,?,?,?,?)').run('member','second-workspace','member@example.test','chatgpt:member',key,at);
 const tables=['organizations','attendance_stores','account_settings','legal_acceptances','organization_members'],before=tables.map(t=>db.prepare('SELECT * FROM '+t).all());
 db.exec(migration);assert.deepEqual(tables.map(t=>db.prepare('SELECT * FROM '+t).all()),before);
 assert.equal((await nativeAttendanceAccount(request(null),binding(db))).storeKey,key);
 const linked=await nativeAttendanceAccount(request('native-subject'),binding(db));assert.equal(linked.storeKey,key);assert.equal(linked.isOwner,false);
 assert.equal((await nativeAttendanceAccount(request('native-subject','new-address@example.test'),binding(db))).storeKey,key);
 assert.equal(await nativeAttendanceAccount(request('another-subject'),binding(db)),null);
 assert.equal(await nativeAttendanceAccount(request(null,'unknown@example.test'),binding(db)),null);
 assert.equal((await nativeAttendanceAccount(request('new-subject','new@example.test'),binding(db))).storeKey,'chatgpt:new-subject');
 assert.deepEqual(tables.map(t=>db.prepare('SELECT * FROM '+t).all()),before);db.close();
});

test('ambiguous legacy emails and provider-backed accounts never receive a legacy alias',async()=>{
 const db=database();for(const key of ['old-one','old-two','chatgpt:existing','supabase:existing'])db.prepare('INSERT INTO organizations VALUES (?,?,?,?)').run(key,key,'same@example.test','2026-10-01');db.exec(migration);assert.equal((await nativeAttendanceAccount(request('new-subject','same@example.test'),binding(db))).storeKey,'chatgpt:new-subject');assert.deepEqual(db.prepare('SELECT * FROM native_account_aliases').all(),[]);db.close();
});

test('concurrent claims cannot bind two native subjects to the same legacy account',async()=>{
 const db=database();db.exec(migration);db.prepare('INSERT INTO native_account_aliases (email,account_id) VALUES (?,?)').run('owner@example.test','historical-account');
 const results=await Promise.all(['one','two'].map(subject=>nativeAttendanceAccount(request(subject),binding(db))));assert.equal(results.filter(Boolean).length,1);assert.equal(db.prepare('SELECT subject FROM native_account_aliases').get().subject,'one');db.close();
});

test('production loading contains no seeded roster or account-specific repair hook',()=>{
 const api=readFileSync('app/api/attendance/route.ts','utf8'),model=readFileSync('lib/model.ts','utf8');assert.ok(!/seedData|mergeSoccerEvents|linkSoccerPeople/.test(api));assert.ok(!/export (?:const SEED|function seedData)/.test(model));assert.ok(api.includes('JSON.stringify({rosters:[],events:[]})'));
});
