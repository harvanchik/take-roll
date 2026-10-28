import type {Data} from './model';
type Path=Array<string|number>;
export type LivePatch={path:Path;value:unknown}|{path:Path;remove:true}|{path:Path;splice:[number,number,unknown[]]};
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const primitive=(value:unknown)=>value===null||typeof value!=='object';
/** Small structural patches, with a splice for appended history/mutation IDs. */
export function livePatch(before:unknown,after:unknown,path:Path=[],result:LivePatch[]=[]):LivePatch[]{
 if(Object.is(before,after))return result;
 if(Array.isArray(before)&&Array.isArray(after)){
  if(before.every(primitive)&&after.every(primitive)){
   // Bounded mutation-ID queues shift one old ID out as a new one arrives.
   const shift=before.findIndex(value=>Object.is(value,after[0]));
   if(before.length===after.length&&shift>0&&shift<=32&&before.slice(shift).every((value,i)=>Object.is(value,after[i]))){result.push({path,splice:[0,shift,[]]},{path,splice:[after.length-shift,0,after.slice(-shift)]});return result;}
   let first=0,end=0;while(first<Math.min(before.length,after.length)&&Object.is(before[first],after[first]))first++;
   while(end<Math.min(before.length,after.length)-first&&Object.is(before[before.length-1-end],after[after.length-1-end]))end++;
   if(first!==before.length||first!==after.length)result.push({path,splice:[first,before.length-first-end,after.slice(first,after.length-end)]});
  }else if(before.some((value,i)=>object(value)&&object(after[i])&&'id' in value&&value.id!==after[i].id))result.push({path,value:after});
  else{
   for(let i=0;i<Math.min(before.length,after.length);i++)livePatch(before[i],after[i],[...path,i],result);
   if(before.length!==after.length){const index=Math.min(before.length,after.length);result.push({path,splice:[index,before.length-index,after.slice(index)]});}
  }
 }else if(object(before)&&object(after)){
  for(const key of Object.keys(before))if(before[key]!==undefined&&after[key]===undefined)result.push({path:[...path,key],remove:true});
  for(const key of Object.keys(after))if(after[key]!==undefined)livePatch(before[key],after[key],[...path,key],result);
 }else result.push({path,value:after});
 return result;
}
/** Copy only modified branches. The queue's optimistic data is never the patch base. */
export function applyLivePatch(data:Data,patch:LivePatch[]):Data{
 const copies=new WeakMap<object,any>();
 const copyOf=(node:any)=>{let copy=copies.get(node);if(!copy){copy=Array.isArray(node)?node.slice():{...node};copies.set(node,copy);copies.set(copy,copy);}return copy;};
 const apply=(node:any,operation:LivePatch,depth:number):any=>{
  if(depth===operation.path.length){
   if('splice' in operation){if(!Array.isArray(node))throw Error('Invalid Live Patch');const copy=copyOf(node);const [start,count,items]=operation.splice;copy.splice(start,count);for(let i=0;i<items.length;i+=1000)copy.splice(start+i,0,...items.slice(i,i+1000));return copy;}
   return 'value' in operation?operation.value:undefined;
  }
  const key=operation.path[depth];if(key==='__proto__'||key==='prototype'||key==='constructor')throw Error('Invalid Live Patch');
  if(!node||typeof node!=='object'||(Array.isArray(node)&&(typeof key!=='number'||key<0||key>=node.length)))throw Error('Invalid Live Patch');
  const copy=copyOf(node);
  if(depth===operation.path.length-1&&'remove' in operation)delete copy[key];else copy[key]=apply(node[key],operation,depth+1);
  return copy;
 };
 return patch.reduce((current,operation)=>apply(current,operation,0),data);
}
