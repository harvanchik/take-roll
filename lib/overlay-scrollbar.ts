export function scrollbarGeometry(viewport:number,content:number,scroll:number){
 const height=Math.max(0,viewport),max=Math.max(0,content-height),thumb=max?Math.min(height,Math.max(32,height*height/content)):height,travel=Math.max(0,height-thumb),offset=max?travel*Math.min(max,Math.max(0,scroll))/max:0;
 return {max,thumb,travel,offset};
}
export function scrollbarPositionToScroll(position:number,travel:number,max:number){return travel>0?Math.max(0,Math.min(max,position/travel*max)):0;}
