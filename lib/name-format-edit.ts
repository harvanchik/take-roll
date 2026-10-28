import {type NameToken} from './name-format.ts';
export const tokenLength=(token:NameToken)=>token.kind==='field'?1:token.text.length;
export const formatLength=(tokens:NameToken[])=>tokens.reduce((n,t)=>n+tokenLength(t),0);
export function compactTokens(tokens:NameToken[]):NameToken[]{
 const out:NameToken[]=[];
 for(const t of tokens){if(t.kind==='text'&&!t.text)continue;const previous=out.at(-1);if(t.kind==='text'&&previous?.kind==='text'&&t.optionalFor===previous.optionalFor)previous.text+=t.text;else out.push({...t});}
 return out;
}
/** Offsets count a whole name chip as one character; literal text stays editable. */
export function replaceTokens(tokens:NameToken[],start:number,end:number,insert:NameToken[]):NameToken[]{
 const left:NameToken[]=[],right:NameToken[]=[];let offset=0;
 for(const t of tokens){const next=offset+tokenLength(t);
  if(next<=start)left.push(t);else if(offset<start&&t.kind==='text')left.push({...t,text:t.text.slice(0,start-offset)});
  if(offset>=end)right.push(t);else if(next>end&&t.kind==='text')right.push({...t,text:t.text.slice(end-offset)});
  offset=next;
 }
 return compactTokens([...left,...insert,...right]);
}
/** Reorder only the chips. Literal punctuation keeps its exact place in the field. */
export function reorderNameFields(tokens:NameToken[],id:string,to:number):NameToken[]{
 const fields=tokens.filter(t=>t.kind==='field'),from=fields.findIndex(t=>t.id===id);
 if(from<0||to<0||to>=fields.length||from===to)return tokens;
 const moved=fields.splice(from,1)[0];fields.splice(to,0,moved);let index=0;
 return tokens.map(t=>t.kind==='field'?fields[index++]:{kind:'text',text:t.text});
}
export function fieldOffset(tokens:NameToken[],id:string){let offset=0;for(const t of tokens){if(t.kind==='field'&&t.id===id)return offset;offset+=tokenLength(t);}return offset;}
