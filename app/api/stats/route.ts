import {env} from 'cloudflare:workers';
import {readPublicStats} from '../../../lib/public-stats';
import {publicStatsResponse,cachePublicStats,PUBLIC_STATS_TTL} from '../../../lib/public-stats-cache';
export const dynamic='force-dynamic';
export async function GET(){
 try{
  const cached=await publicStatsResponse();if(cached)return cached;
  if(!env.DB)throw Error('Database Unavailable');
  const stats=await readPublicStats(env.DB);
  const response=Response.json(stats,{headers:{'Cache-Control':'public, max-age='+PUBLIC_STATS_TTL+', s-maxage='+PUBLIC_STATS_TTL,'X-Content-Type-Options':'nosniff'}});
  await cachePublicStats(response);return response;
 }catch{return Response.json({error:'Community Stats Are Temporarily Unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
