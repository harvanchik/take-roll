import type {Event} from './model.ts';
import {RequestError} from './request-security.ts';
const encode=(bytes:Uint8Array)=>{let value='';for(let i=0;i<bytes.length;i+=8192)value+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(value);};
const decode=(value:string)=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
async function key(db:D1Database,workspace:string,create=false){
 if(create)await db.prepare('INSERT INTO subevent_undo_keys (workspace_id,secret) VALUES (?,?) ON CONFLICT(workspace_id) DO NOTHING').bind(workspace,encode(crypto.getRandomValues(new Uint8Array(32)))).run();
 const row=await db.prepare('SELECT secret FROM subevent_undo_keys WHERE workspace_id=?').bind(workspace).first<{secret:string}>();
 if(!row)throw new RequestError('Could Not Prepare Subevent Undo.',503);
 return crypto.subtle.importKey('raw',decode(row.secret),'AES-GCM',false,['encrypt','decrypt']);
}
/** Only the deleting tab receives this sealed record. It is never stored in the workspace or live stream. */
export async function sealSubeventUndo(db:D1Database,workspace:string,actor:string,event:Event,restoreId:string){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const payload=new TextEncoder().encode(JSON.stringify({workspace,actor,event,restoreId}));
 const zipped=await new Response(new Blob([payload]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
 const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(db,workspace,true),zipped);
 const token=encode(iv)+'.'+encode(new Uint8Array(encrypted));
 if(token.length>1800000)throw new RequestError('This Subevent Is Too Large To Delete With Undo.');
 return token;
}
export async function openSubeventUndo(db:D1Database,workspace:string,actor:string,token:unknown){
 try{
  if(typeof token!=='string'||token.length>1800000)throw Error();
  const [iv,value,...extra]=token.split('.');if(extra.length)throw Error();
  const decrypted=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(iv)},await key(db,workspace),decode(value));
  const json=await new Response(new Blob([decrypted]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  const payload=JSON.parse(json) as {workspace:string;actor:string;event:Event;restoreId:string};
  if(payload.workspace!==workspace||payload.actor!==actor)throw Error();
  return payload;
 }catch{throw new RequestError('This Subevent Can No Longer Be Restored In This Tab.',409);}
}
