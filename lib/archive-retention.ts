import {purgeExpiredArchives} from './workspace-settings';
import type {Data} from './model';
import {withPersonIds} from './person-identity';
/** Called only after authentication resolves this workspace's storage key. */
export async function readCurrentStore(db:D1Database,user:string,access?:{sql:string;args:string[]}){
 for(let attempt=0;attempt<4;attempt++){
  const row=await db.prepare('SELECT data,revision FROM attendance_stores WHERE user_id=?'+(access?' AND '+access.sql:'')).bind(user,...(access?.args||[])).first<{data:string;revision:number}>();
  if(!row)return null;
  const current=JSON.parse(row.data) as Data,identified=withPersonIds(current),next=purgeExpiredArchives(identified);
  // Reserve IDs durably before cleanup can remove a legacy collision's first owner.
  if(next===current)return row;
  const encoded=JSON.stringify(next),result=await db.prepare('UPDATE attendance_stores SET data=?,revision=revision+1,updated_at=? WHERE user_id=? AND revision=?'+(access?' AND '+access.sql:'')).bind(encoded,new Date().toISOString(),user,row.revision,...(access?.args||[])).run();
  if(result.meta.changes)return {data:encoded,revision:row.revision+1};
 }
 throw Error('Records changed during archive cleanup. Try again.');
}
