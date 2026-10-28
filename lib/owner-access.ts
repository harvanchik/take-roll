export type AttendanceAccount={storeKey:string;email:string;name?:string;isOwner:boolean;provider?:'chatgpt'|'supabase'};
/** Sites dispatch supplies these verified headers; client forms never select an identity. */
function nativeIdentity(request:Request){
 const email=request.headers.get('oai-authenticated-user-email')?.trim()||'';
 const userId=request.headers.get('oai-authenticated-user-id')?.trim()||'';
 let name=request.headers.get('oai-authenticated-user-full-name')||'';
 if(request.headers.get('oai-authenticated-user-full-name-encoding')==='percent-encoded-utf-8'){try{name=decodeURIComponent(name);}catch{name='';}}
 name=name.trim().slice(0,200);
 return {email,userId,...(name?{name}:{})};
}
export function attendanceAccount(request:Request):AttendanceAccount|null{
 const {email,userId,name}=nativeIdentity(request);
 if(!userId||!email||email.length>254||userId.length>500)return null;
 return {storeKey:'chatgpt:'+userId,email,...(name?{name}:{}),isOwner:false,provider:'chatgpt'};
}
/** Existing accounts keep their stored keys, permissions and acceptance records. */
export async function nativeAttendanceAccount(request:Request,db?:D1Database):Promise<AttendanceAccount|null>{
 const normal=attendanceAccount(request),identity=nativeIdentity(request);
 if(!db||!identity.email||identity.email.length>254||identity.userId.length>500)return normal;
 type Alias={account_id:string;subject:string|null};
 const subject=identity.userId;
 // Once bound, the verified provider subject remains authoritative if the email changes.
 const bound=subject?await db.prepare('SELECT account_id,subject FROM native_account_aliases WHERE subject=?').bind(subject).first<Alias>():null;
 let alias=bound;
 if(!alias){
  alias=await db.prepare('SELECT account_id,subject FROM native_account_aliases WHERE email=?').bind(identity.email.toLowerCase()).first<Alias>();
  if(!alias){
   // Initialize a mapping only from one unambiguous existing native account in this database.
   // Provider-prefixed accounts are deliberately excluded; Supabase identities never use this path.
   const existing=await db.prepare(`SELECT min(owner_id) AS account_id FROM organizations
    WHERE id=owner_id AND instr(owner_id,':')=0 AND lower(trim(owner_email))=?
    HAVING count(DISTINCT owner_id)=1`).bind(identity.email.toLowerCase()).first<{account_id:string}>();
   if(existing?.account_id){
    await db.prepare('INSERT INTO native_account_aliases (email,account_id) VALUES (?,?) ON CONFLICT DO NOTHING').bind(identity.email.toLowerCase(),existing.account_id).run();
    alias=await db.prepare('SELECT account_id,subject FROM native_account_aliases WHERE email=?').bind(identity.email.toLowerCase()).first<Alias>();
   }
  }
  if(!alias)return normal;
  if(subject&&alias.subject&&alias.subject!==subject)return null;
  if(subject&&!alias.subject){
   await db.prepare('UPDATE native_account_aliases SET subject=? WHERE email=? AND subject IS NULL').bind(subject,identity.email.toLowerCase()).run();
   const claimed=await db.prepare('SELECT account_id,subject FROM native_account_aliases WHERE subject=?').bind(subject).first<Alias>();
   if(!claimed||claimed.account_id!==alias.account_id)return null;
   alias=claimed;
  }
 }
 // Some dispatch sessions supply only verified email; only pre-existing DB mappings allow that fallback.
 return {storeKey:alias.account_id,email:identity.email,...(identity.name?{name:identity.name}:{}),isOwner:false,provider:'chatgpt'};
}
