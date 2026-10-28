import {env} from 'cloudflare:workers';
import {signOut,type AuthConfig} from '../../../lib/supabase-auth';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{return await signOut(request,env as AuthConfig);}
 catch{return new Response('Could Not Sign Out. Try Again.',{status:503,headers:{'Cache-Control':'no-store'}});}
}
