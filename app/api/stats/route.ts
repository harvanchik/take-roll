import {env} from 'cloudflare:workers';
import {readPublicStats} from '../../../lib/public-stats';
export const dynamic='force-dynamic';
export async function GET(){
 try{
  if(!env.DB)throw Error('Database Unavailable');
  const stats=await readPublicStats(env.DB);
  return Response.json(stats,{headers:{'Cache-Control':'public, max-age=300, s-maxage=300','X-Content-Type-Options':'nosniff'}});
 }catch{return Response.json({error:'Community Stats Are Temporarily Unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
