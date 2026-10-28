import {env} from 'cloudflare:workers';
import {createAuthContext,type AuthConfig} from '../../../lib/supabase-auth';
import {readMutation,RequestError} from '../../../lib/request-security';
import {limitAccount} from '../../../lib/rate-limit';
import {LEGAL_VERSION,agreementDigest} from '../../../lib/legal-documents';
import {hasLegalAgreement} from '../../../lib/legal-agreement';
export const dynamic='force-dynamic';
async function handle(request:Request,write:boolean){
 const auth=createAuthContext(request,env as AuthConfig);
 const response=(data:unknown,status=200)=>auth.finish(Response.json(data,{status}));
 try{
  const account=await auth.account();if(!account)return response({error:'Sign In To Review Your Agreement.'},401);
  if(!env.DB)return response({error:'Service Temporarily Unavailable.'},503);
  await limitAccount(env.DB,account.storeKey,write);const documentHash=await agreementDigest();
  if(write){
   const body=await readMutation(request);
   if(body.accountId!==account.storeKey)throw new RequestError('Your Signed-In Account Changed. Reload To Continue.',403);
   if(body.action.type!=='accept-agreement'||body.action.agree!==true||body.action.adult!==true)throw new RequestError('Confirm Both Boxes To Continue.');
   if(body.action.version!==LEGAL_VERSION||body.action.documentHash!==documentHash)throw new RequestError('The Agreement Changed. Reload And Review The Current Version.',409);
   await env.DB.prepare('INSERT INTO legal_acceptances (account_id,version,document_hash,accepted_at,adult_confirmed) VALUES (?,?,?,?,1) ON CONFLICT(account_id,version) DO NOTHING').bind(account.storeKey,LEGAL_VERSION,documentHash,new Date().toISOString()).run();
  }
  const accepted=await hasLegalAgreement(env.DB,account.storeKey);if(write&&!accepted)throw new RequestError('This Agreement Version Was Revised. Contact contact@takeroll.online For An Updated Version.',409);
  return response({accountId:account.storeKey,email:account.email,version:LEGAL_VERSION,documentHash,accepted});
 }catch(error){return response({error:error instanceof RequestError?error.message:'Could Not Save Your Agreement. Try Again.'},error instanceof RequestError?error.status:503);}
}
export const GET=(request:Request)=>handle(request,false);
export const POST=(request:Request)=>handle(request,true);
