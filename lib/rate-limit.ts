import {RequestError} from './request-security.ts';
/** Atomic database quota: shared by Worker instances, isolated by authenticated account. */
export async function limitAccount(db:D1Database,account:string,write:boolean,now=Date.now()){
 const window=Math.floor(now/60000),limit=write?240:600;
 const result=await db.prepare('INSERT INTO request_limits (key,window,hits) VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN window=excluded.window THEN hits+1 ELSE 1 END,window=excluded.window RETURNING hits').bind((write?'write:':'read:')+account,window).first<{hits:number}>();
 if(!result||result.hits>limit)throw new RequestError('Too many requests. Try again in a minute.',429);
}
