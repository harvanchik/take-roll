import {livePatch,applyLivePatch,type LivePatch} from './live-patch.ts';
import type {Data} from './model.ts';
export type SavePacket={data?:Data;revision?:number;personalRevision?:number;baseRevision?:number;basePersonalRevision?:number;patch?:LivePatch[];[key:string]:unknown};
/** Patches are offered only against the exact acknowledged workspace and personal baseline. */
export function compactSaveReply(reply:SavePacket,base:Data,revision:number):SavePacket{
 if(!reply.data)return reply;
 const patch=livePatch(base,reply.data),compact={...reply,data:undefined,baseRevision:revision,basePersonalRevision:base.personalRevision??0,patch};
 return JSON.stringify(compact).length<JSON.stringify(reply).length?compact:reply;
}
export function expandSaveReply(reply:SavePacket,base?:{data:Data;revision:number}):SavePacket{
 if(!reply.patch)return reply;
 if(!base||reply.baseRevision!==base.revision||reply.basePersonalRevision!==(base.data.personalRevision??0))throw Error('Save Response Needs A Fresh Workspace Snapshot.');
 return {...reply,data:applyLivePatch(base.data,reply.patch)};
}
