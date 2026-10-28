import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile,readdir} from 'node:fs/promises';

test('multi-workspace migration preserves existing records and scopes membership uniqueness',async()=>{
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
 const files=(await readdir('drizzle')).filter(file=>file.endsWith('.sql')).sort();
 for(const file of files.filter(file=>!file.startsWith('0007_')))db.exec(await readFile('drizzle/'+file,'utf8'));
 db.prepare('INSERT INTO organizations VALUES (?,?,?,?)').run('original','owner','owner@example.test','2026-10-01');
 db.prepare('INSERT INTO organization_members VALUES (?,?,?,?,?,?)').run('member-original','original','member@example.test','member','owner','2026-10-01');
 db.prepare('INSERT INTO organization_history_actors VALUES (?,?,?)').run('original','member','Original Name');
 db.prepare('INSERT INTO attendance_stores VALUES (?,?,?,?)').run('original',JSON.stringify({rosters:[{id:'retained-roster'}],events:[]}),42,'2026-10-01');
 db.prepare('INSERT INTO legal_acceptances VALUES (?,?,?,?,?)').run('owner','2026-10-17','accepted-digest','2026-10-17',1);
 const tables=['organizations','organization_members','organization_history_actors','attendance_stores','legal_acceptances'];
 const before=tables.map(table=>db.prepare('SELECT * FROM '+table).all());
 for(const file of files.filter(file=>file.startsWith('0007_')))db.exec(await readFile('drizzle/'+file,'utf8'));
 assert.deepEqual(tables.map(table=>db.prepare('SELECT * FROM '+table).all()),before);
 db.prepare('INSERT INTO organizations VALUES (?,?,?,?)').run('second','owner','owner@example.test','2026-10-19');
 db.prepare('INSERT INTO organization_members VALUES (?,?,?,?,?,?)').run('member-second','second','member@example.test','member','owner','2026-10-19');
 assert.throws(()=>db.prepare('INSERT INTO organization_members VALUES (?,?,?,?,?,?)').run('duplicate','second','member@example.test','another-account','owner','2026-10-19'),/UNIQUE/);
 assert.throws(()=>db.prepare('INSERT INTO organization_members VALUES (?,?,?,?,?,?)').run('duplicate-account','second','other@example.test','member','owner','2026-10-19'),/UNIQUE/);
 db.close();
});
