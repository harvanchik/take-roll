import {createAuthContext,type AuthConfig} from './supabase-auth';
import {hasLegalAgreement} from './legal-agreement';
import {safeSignInReturn} from './sign-in';
export const protectedPage=(path:string)=>{try{path=decodeURIComponent(path);}catch{return true;}return /^\/(events|event|event-settings|rosters|roster|person|archive|settings)(\/|$)/.test(path);};
/** Run before rendering, so neither HTML nor RSC can contain a workspace preview. */
export async function pageAccess(request:Request,config:AuthConfig&{DB?:D1Database}){
 const url=new URL(request.url);let path:string;try{path=decodeURIComponent(url.pathname).replace(/\/+/g,'/');}catch{return {response:new Response('Bad Request',{status:400})};}const api=/^\/api\/(attendance(?:\/live)?|organization|workspaces)\/?$/.test(path);
 if(!api&&!protectedPage(path))return null;
 // Guest pages render only the browser-local shell. Protected APIs still require identity.
 if(!api&&url.searchParams.get('guest')==='1')return null;
 const auth=createAuthContext(request,config);
 try{
  const account=await auth.account();
  if(account){
   if(!config.DB)return {response:auth.finish(new Response('Service Temporarily Unavailable',{status:503}))};
   if(!await hasLegalAgreement(config.DB,account.storeKey))return {response:auth.finish(api?Response.json({code:'agreement_required',error:'Accept The Terms & EULA Before Opening Your Workspace.'},{status:428}):new Response(null,{status:303,headers:{Location:'/agreement?return_to='+encodeURIComponent(safeSignInReturn(url.pathname+url.search))}}))};
   return {finish:auth.finish,request:auth.forwardRequest()};
  }
 }catch{return {response:auth.finish(new Response('Could Not Verify Access. Try Again.',{status:503}))};}
 if(api)return {response:auth.finish(Response.json({error:'Sign In To Open Your Workspace.'},{status:401}))};
 return {response:auth.finish(new Response(null,{status:303,headers:{Location:'/'}}))};
}
