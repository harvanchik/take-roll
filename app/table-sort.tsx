'use client';
import {useState,type ReactNode} from 'react';
import DropdownArrow from './dropdown-arrow';
export type Sort={key:string;direction:'asc'|'desc'}|null;
export type ScopedSort={scope:string;sort:Sort};
export function tableSortForScope(current:ScopedSort,scope:string,defaultSort:Sort):ScopedSort{return current.scope===scope?current:{scope,sort:defaultSort};}
export function nextTableSort(current:Sort,key:string):Sort{return current?.key!==key?{key,direction:'asc'}:current.direction==='asc'?{key,direction:'desc'}:null;}
export function useTableSort(defaultSort:Sort=null,resetKey=''){
 const scope=JSON.stringify([resetKey,defaultSort]);
 const [state,setState]=useState<ScopedSort>(()=>({scope,sort:defaultSort})),current=tableSortForScope(state,scope,defaultSort);
 // Reset on navigation before painting, so an old page's manual sort never flashes.
 if(current!==state)setState(current);
 const toggle=(key:string)=>setState(previous=>({scope,sort:nextTableSort(tableSortForScope(previous,scope,defaultSort).sort,key)}));
 return {sort:current.sort,toggle};
}
type SortValue=string|number|ReadonlyArray<string|number>;
function compareValue(a:SortValue,b:SortValue):number{
 if(Array.isArray(a)||Array.isArray(b)){const x=Array.isArray(a)?a:[a],y=Array.isArray(b)?b:[b];for(let i=0;i<Math.max(x.length,y.length);i++){const compared=compareValue(x[i]??'',y[i]??'');if(compared)return compared;}return 0;}
 return typeof a==='number'&&typeof b==='number'?a-b:String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:'base'});
}
export function sortedRows<T>(rows:T[],sort:Sort,value:(row:T,key:string)=>SortValue){if(!sort)return rows;return rows.map(row=>({row,value:value(row,sort.key)})).sort((a,b)=>compareValue(a.value,b.value)*(sort.direction==='asc'?1:-1)).map(item=>item.row);}
export function SortHeading({column,sort,toggle,children,disabled=false}:{disabled?:boolean;column:string;sort:Sort;toggle:(key:string)=>void;children:ReactNode}){const active=sort?.key===column;return <button type="button" className="sort-heading" data-column={column} disabled={disabled} onClick={()=>toggle(column)} aria-label={`${column}: ${active?sort.direction==='asc'?'Sort Descending':'Clear Sort':'Sort Ascending'}`}>{children}{active&&<DropdownArrow size={12} flipped={sort.direction==='asc'}/>}</button>;}
