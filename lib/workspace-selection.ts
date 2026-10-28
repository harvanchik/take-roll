const key=(accountId:string)=>'roll-call.workspace.v1.'+accountId;
type StorageAccess=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
/** Account-scoped preference persists across sign-out; explicit links always take priority. */
export function rememberedWorkspace(accountId:string,local:StorageAccess,session?:StorageAccess){
 for(const storage of [local,session])try{const value=storage?.getItem(key(accountId));if(value)return value;}catch{}
 return undefined;
}
export function rememberWorkspace(accountId:string,workspaceId:string|undefined,local:StorageAccess,session?:StorageAccess){
 for(const storage of [local,session])try{if(workspaceId)storage?.setItem(key(accountId),workspaceId);else storage?.removeItem(key(accountId));}catch{}
}
