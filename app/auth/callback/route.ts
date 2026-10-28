import {env} from 'cloudflare:workers';
import {completeProviderSignIn,type AuthConfig} from '../../../lib/supabase-auth';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{return await completeProviderSignIn(request,env as AuthConfig);}
 catch{return new Response('Sign-In Could Not Be Completed. Return to the Site and Try Again.',{status:503,headers:{'Cache-Control':'no-store'}});}
}
