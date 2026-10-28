import {env} from 'cloudflare:workers';
import {createAuthContext,type AuthConfig} from '../../../../lib/supabase-auth';
import {requestedWorkspace} from '../../../../lib/organizations';
import {limitAccount} from '../../../../lib/rate-limit';
import {RequestError,sameOriginMutation} from '../../../../lib/request-security';
import {workspaceVersion,workspaceStream} from '../../../../lib/live-updates';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const auth=createAuthContext(request,env as AuthConfig);
 try{
  sameOriginMutation(request);
  const account=await auth.account();if(!account)return auth.finish(new Response(null,{status:401}));
  if(!env.DB)return auth.finish(new Response(null,{status:503}));
  await limitAccount(env.DB,account.storeKey,false);
  const selected=requestedWorkspace(request);
  const read=()=>workspaceVersion(env.DB!,account,selected);
  if(new URL(request.url).searchParams.has('poll'))return auth.finish(Response.json(await read()||{reload:true}));
  const snapshotMode=new URL(request.url).searchParams.get('snapshot')==='1';
  const authorize=async()=>{const verification=createAuthContext(request,env as AuthConfig),current=await verification.account();return current?.storeKey===account.storeKey&&!verification.finish(new Response(null)).headers.has('Set-Cookie');};
  return auth.finish(new Response(workspaceStream(env.DB,account,request.signal,snapshotMode,authorize,selected),{headers:{'Content-Type':'text/event-stream','Cache-Control':'private, no-store, no-transform','X-Accel-Buffering':'no'}}));
 }catch(error){return auth.finish(new Response(null,{status:error instanceof RequestError?error.status:503}));}
}
