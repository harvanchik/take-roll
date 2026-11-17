import type {PublicStats} from './public-stats';
export const PUBLIC_STATS_TTL=300;
export const PUBLIC_STATS_CACHE_KEY='https://takeroll.online/api/stats?v=4';
const cache=()=>typeof caches==='undefined'?undefined:(caches as CacheStorage&{default?:Cache}).default;
export async function publicStatsResponse():Promise<Response|undefined>{try{return await cache()?.match(PUBLIC_STATS_CACHE_KEY);}catch{return undefined;}}
export async function cachedPublicStats():Promise<PublicStats|null>{try{const response=await publicStatsResponse();if(!response?.ok)return null;const data=await response.json() as PublicStats;return ['organizations','rosters','events','attendance','absences','tardies','present'].every(key=>Number.isSafeInteger(data[key as keyof PublicStats])&&data[key as keyof PublicStats]>=0)?data:null;}catch{return null;}}
export async function cachePublicStats(response:Response){try{await cache()?.put(PUBLIC_STATS_CACHE_KEY,response.clone());}catch{/* Cache availability must not prevent a successful public response. */}}
