import {env} from 'cloudflare:workers';
import {startProviderSignIn,type AuthConfig} from '../../../../lib/supabase-auth';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{provider:string}>}){
 try{return await startProviderSignIn(request,env as AuthConfig,(await params).provider);}
 catch{return new Response('Sign-In Is Temporarily Unavailable. Return to the Site and Try Again.',{status:503,headers:{'Cache-Control':'no-store'}});}
}
