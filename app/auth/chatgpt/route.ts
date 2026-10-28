import {env} from 'cloudflare:workers';
import {startChatGPTSignIn,type AuthConfig} from '../../../lib/supabase-auth';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{return await startChatGPTSignIn(request,env as AuthConfig);}
 catch{return new Response('Sign-In Is Temporarily Unavailable. Try Again.',{status:503,headers:{'Cache-Control':'no-store'}});}
}
