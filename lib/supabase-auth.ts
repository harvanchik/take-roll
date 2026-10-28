import {sameOriginMutation} from './request-security';
import {createServerClient,parseCookieHeader,serializeCookieHeader,type CookieOptions} from '@supabase/ssr';
import {nativeAttendanceAccount,type AttendanceAccount} from './owner-access';
import {safeSignInReturn,ORIGINAL_SITE_ORIGIN,signInHref} from './sign-in';
import type {User} from '@supabase/supabase-js';

export type AuthConfig={SUPABASE_URL?:string;SUPABASE_PUBLISHABLE_KEY?:string;DB?:D1Database};
export const AUTH_PROVIDERS={google:'google',microsoft:'azure'} as const;
const HOSTS=new Set(['takeroll.online','www.takeroll.online',new URL(ORIGINAL_SITE_ORIGIN).hostname]);
const cookiePrefix=(url:string)=>'sb-'+new URL(url).hostname.split('.')[0]+'-auth-token';
const RETURN_COOKIE='roll-call-auth-next';
const METHOD_COOKIE='roll-call-auth-method';
const supportedUser=(user:User|null)=>!!user&&!user.is_anonymous&&typeof user.id==='string'&&/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(user.id)&&!!user.email&&!!user.email_confirmed_at&&user.identities?.some(i=>i.provider==='google'||i.provider==='azure');

export function createAuthContext(request:Request,config:AuthConfig){
 const cookies=parseCookieHeader(request.headers.get('cookie')||'').map(c=>({name:c.name,value:c.value||''}));
 const pending=new Map<string,{name:string;value:string;options:CookieOptions}>();
 const ready=!!config.SUPABASE_URL&&!!config.SUPABASE_PUBLISHABLE_KEY;
 const prefix=ready?cookiePrefix(config.SUPABASE_URL!):'sb-';
 const hasSession=cookies.some(c=>ready?(c.name===prefix||c.name.startsWith(prefix+'.')):/^sb-.+-auth-token(?:\.|$)/.test(c.name));
 const selectedSupabase=cookies.some(c=>c.name===METHOD_COOKIE&&c.value==='supabase');
 const explicitlySignedOut=cookies.some(c=>c.name===METHOD_COOKIE&&c.value==='signed-out');
 const client=ready?createServerClient(config.SUPABASE_URL!,config.SUPABASE_PUBLISHABLE_KEY!,{
  cookieOptions:{httpOnly:true,secure:new URL(request.url).protocol==='https:',sameSite:'lax',path:'/'},
  cookies:{getAll:()=>cookies,setAll(values){for(const cookie of values){pending.set(cookie.name,{...cookie,options:{...cookie.options,...(cookie.name.includes('code-verifier')?{maxAge:600}:{})}});const current=cookies.find(c=>c.name===cookie.name);if(current)current.value=cookie.value;else cookies.push({name:cookie.name,value:cookie.value});}}},
 }):null;
 const finish=(response:Response)=>{
  response.headers.set('Cache-Control','private, no-store, max-age=0');
  response.headers.set('Pragma','no-cache');response.headers.set('Expires','0');
  for(const {name,value,options} of pending.values())response.headers.append('Set-Cookie',serializeCookieHeader(name,value,{...options,httpOnly:true,secure:new URL(request.url).protocol==='https:',sameSite:'lax',path:'/'}));
  return response;
 };
 async function account():Promise<AttendanceAccount|null>{
  // A remaining Sites session must not reopen a workspace after app sign-out.
  if(explicitlySignedOut)return null;
  // Explicit Supabase sessions take precedence. Never quietly switch accounts
  // when one expires, and never link a Supabase identity to owner data by email.
  if(!hasSession&&!selectedSupabase)return nativeAttendanceAccount(request,config.DB);
  if(!client||!hasSession)return null;
  const {data,error}=await client.auth.getUser();
  const user=data.user;
  if(error||!supportedUser(user))return null;
  const profileName=[user!.user_metadata?.full_name,user!.user_metadata?.name].find(value=>typeof value==='string'&&value.trim());
  const name=typeof profileName==='string'?profileName.trim().slice(0,200):undefined;
  return {...(name?{name}:{}),storeKey:'supabase:'+user!.id,email:user!.email!,isOwner:false,provider:'supabase'};
 }
 async function clear(){
  if(client&&hasSession){try{await client.auth.signOut({scope:'local'});}catch{/* Clear browser cookies even when the old session has expired. */}}
  for(const c of cookies)if(c.name===prefix||c.name.startsWith(prefix+'.')||c.name.startsWith(prefix+'-code-verifier'))pending.set(c.name,{name:c.name,value:'',options:{maxAge:0}});
  pending.set(RETURN_COOKIE,{name:RETURN_COOKIE,value:'',options:{maxAge:0}});
  pending.set(METHOD_COOKIE,{name:METHOD_COOKIE,value:'',options:{maxAge:0}});
 }
 const setReturnPath=(path:string)=>pending.set(RETURN_COOKIE,{name:RETURN_COOKIE,value:safeSignInReturn(path),options:{maxAge:600}});
 const consumeReturnPath=()=>{const path=cookies.find(c=>c.name===RETURN_COOKIE)?.value;pending.set(RETURN_COOKIE,{name:RETURN_COOKIE,value:'',options:{maxAge:0}});return path;};
 const selectSupabase=()=>pending.set(METHOD_COOKIE,{name:METHOD_COOKIE,value:'supabase',options:{maxAge:365*86400}});
 const selectSignedOut=()=>pending.set(METHOD_COOKIE,{name:METHOD_COOKIE,value:'signed-out',options:{maxAge:365*86400}});
 const forwardRequest=()=>{if(!pending.size)return request;const headers=new Headers(request.headers);headers.set('cookie',cookies.filter(c=>c.value).map(c=>serializeCookieHeader(c.name,c.value,{}).split(';',1)[0]).join('; '));return new Request(request,{headers});};
 return {client,account,clear,finish,forwardRequest,setReturnPath,consumeReturnPath,selectSupabase,selectSignedOut};
}

export function authOrigin(request:Request){
 const url=new URL(request.url);
 if(url.protocol!=='https:'||!HOSTS.has(url.hostname)||url.port)throw Error('Unsupported sign-in address.');
 return url.origin;
}
export function authRedirect(url:string,status=303){return new Response(null,{status,headers:{Location:url}});}
function authError(origin:string,code:string){return authRedirect(origin+'/?auth_error='+encodeURIComponent(code));}

export async function startProviderSignIn(request:Request,config:AuthConfig,providerName:string){
 sameOriginMutation(request);
 const context=createAuthContext(request,config),origin=authOrigin(request);
 if(!Object.hasOwn(AUTH_PROVIDERS,providerName))return context.finish(new Response('Sign-In Method Not Available',{status:404}));
 if(!context.client)return context.finish(authError(origin,'unavailable'));
 const next=safeSignInReturn(new URL(request.url).searchParams.get('return_to')||'/events');
 // PKCE's verifier cookie and callback must use the same host. The Supabase
 // allowlist uses our custom domains.
 if(origin===ORIGINAL_SITE_ORIGIN)return context.finish(authRedirect('https://takeroll.online/auth/sign-in/'+providerName+'?return_to='+encodeURIComponent(next)));
 context.setReturnPath(next);
 context.selectSupabase();
 const provider=AUTH_PROVIDERS[providerName as keyof typeof AUTH_PROVIDERS];
 const {data,error}=await context.client.auth.signInWithOAuth({provider,options:{
  redirectTo:origin+'/auth/callback',
  ...(provider==='azure'?{scopes:'email'}:{}),queryParams:{prompt:'select_account'},
 }});
 if(error||!data.url||new URL(data.url).origin!==new URL(config.SUPABASE_URL!).origin)return context.finish(authError(origin,'signin'));
 return context.finish(authRedirect(data.url));
}

export async function completeProviderSignIn(request:Request,config:AuthConfig){
 const context=createAuthContext(request,config),origin=authOrigin(request),params=new URL(request.url).searchParams;
 const next=context.consumeReturnPath()||params.get('next')||'/events';
 const code=params.get('code');
 if(!context.client||params.has('error')||!code||code.length>4096)return context.finish(authError(origin,'cancelled'));
 const {error}=await context.client.auth.exchangeCodeForSession(code);
 if(error)return context.finish(authError(origin,'callback'));
 // Verify with the Auth service. Decoding a cookie or JWT is not authorization.
 const {data,error:userError}=await context.client.auth.getUser();
 if(userError||!supportedUser(data.user)){
  await context.clear();return context.finish(authError(origin,'provider'));
 }
 context.selectSupabase();
 return context.finish(authRedirect(origin+safeSignInReturn(next)));
}

export async function startChatGPTSignIn(request:Request,config:AuthConfig){
 sameOriginMutation(request);
 const context=createAuthContext(request,config),origin=authOrigin(request),next=safeSignInReturn(new URL(request.url).searchParams.get('return_to')||'/events');
 await context.clear();
 // Enter the Sites-owned flow on the same host as the visitor.
 const target=origin+signInHref(next);
 return context.finish(authRedirect(target));
}

export async function signOut(request:Request,config:AuthConfig){
 sameOriginMutation(request);
 const context=createAuthContext(request,config),origin=authOrigin(request);
 await context.clear();
 context.selectSignedOut();
 return context.finish(authRedirect(origin+'/'));
}
