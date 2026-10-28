// Sites dispatch verifies sign-in and injects identity headers.
// Preserve the original owner account and its existing storage key.
// Some hosted sessions include email without a user-ID header. Authorize the
// verified owner email, but keep records under a stable Site key, not an email.
const OWNER_EMAIL = "owner@example.invalid";
export const OWNER_STORE_KEY = 'site-owner';
export function ownerStoreKey(request: Request): string | null {
 const email = request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase();
 return email === OWNER_EMAIL ? OWNER_STORE_KEY : null;
}


export type AttendanceAccount={storeKey:string;email:string;name?:string;isOwner:boolean;provider?:'chatgpt'|'supabase'};
/** Identity comes only from Sites dispatch, never a form or query parameter. */
export function attendanceAccount(request:Request):AttendanceAccount|null{
 const email=request.headers.get('oai-authenticated-user-email')?.trim()||'';
 let name=request.headers.get('oai-authenticated-user-full-name')||'';
 if(request.headers.get('oai-authenticated-user-full-name-encoding')==='percent-encoded-utf-8'){try{name=decodeURIComponent(name);}catch{name='';}}
 name=name.trim().slice(0,200);
 const owner=ownerStoreKey(request);
 if(owner)return {storeKey:owner,email,...(name?{name}:{}),isOwner:true,provider:'chatgpt'};
 const userId=request.headers.get('oai-authenticated-user-id')?.trim();
 if(!userId||!email||userId.length>500)return null;
 return {storeKey:'chatgpt:'+userId,email,...(name?{name}:{}),isOwner:false,provider:'chatgpt'};
}
