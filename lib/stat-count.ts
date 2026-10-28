export const STAT_COUNT_DURATION=5000;
/** Four seconds at a steady rate, then one second easing smoothly to rest. */
export function statCountAt(total:number,elapsed:number){
 if(elapsed>=STAT_COUNT_DURATION)return total;
 const time=Math.max(0,elapsed),progress=time<=4000?time/4500:1-Math.pow((STAT_COUNT_DURATION-time)/1000,2)/9;
 return Math.floor(total*progress);
}
