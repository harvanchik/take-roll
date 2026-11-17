/** Move a shared boundary while preserving the two columns' total width. */
export function moveColumnStart(widths:number[],index:number,delta:number,previousMinimum=60,currentMinimum=60){
 const next=[...widths];if(index<1||index>=next.length||!Number.isFinite(delta))return next;
 const movement=Math.max(previousMinimum-next[index-1],Math.min(next[index]-currentMinimum,delta));
 next[index-1]+=movement;next[index]-=movement;return next;
}
