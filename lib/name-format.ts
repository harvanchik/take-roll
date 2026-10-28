import {ValidationError} from './validation-error.ts';
export type NameDisplay='legal'|'preferred'|'quoted'|`custom:${string}`|`inline:${string}`;
export const NAME_FIELDS={first:'First Name',preferred:'Preferred Name',last:'Last Name',used:'Preferred Or First'} as const;
export type NamePart={id:string;field:keyof typeof NAME_FIELDS;before:string;after:string};
export type NameToken={kind:'field';id:string;field:keyof typeof NAME_FIELDS}|{kind:'text';text:string;optionalFor?:string};
export function nameTokens(mode:NameDisplay):NameToken[]{
 if(mode.startsWith('inline:')){try{return validateNameTokens(JSON.parse(mode.slice(7)));}catch{return nameTokens('quoted');}}
 return nameParts(mode).flatMap(p=>[
  ...(p.before?[{kind:'text' as const,text:p.before,...(p.field==='preferred'?{optionalFor:p.id}:{})}]:[]),
  {kind:'field' as const,id:p.id,field:p.field},
  ...(p.after?[{kind:'text' as const,text:p.after,...(p.field==='preferred'?{optionalFor:p.id}:{})}]:[]),
 ]);
}
export function validateNameTokens(value:unknown):NameToken[]{
 if(!Array.isArray(value)||value.length>40)throw new ValidationError('Use At Most 8 Name Parts And 320 Punctuation Characters.');
 const ids=new Set<string>();let length=0;
 const tokens:NameToken[]=value.map(t=>{
  if(t?.kind==='field'&&typeof t.id==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(t.id)&&!ids.has(t.id)&&Object.hasOwn(NAME_FIELDS,t.field)){ids.add(t.id);return {kind:'field',id:t.id,field:t.field};}
  if(t?.kind==='text'&&typeof t.text==='string'&&!/[\u0000-\u001f\u007f\u200b\ufeff]/.test(t.text)&&(t.optionalFor===undefined||typeof t.optionalFor==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(t.optionalFor))){length+=t.text.length;return {kind:'text',text:t.text,...(t.optionalFor?{optionalFor:t.optionalFor}:{})};}
  throw new ValidationError('Choose Valid Name Parts And Punctuation.');
 });
 if(ids.size>8||length>320)throw new ValidationError('Use At Most 8 Name Parts And 320 Punctuation Characters.');
 return tokens;
}
export function encodeNameTokens(tokens:NameToken[]):NameDisplay{return `inline:${JSON.stringify(tokens)}`;}
export function nameParts(mode:NameDisplay):NamePart[]{
 if(mode.startsWith('custom:')){try{return validateNameParts(JSON.parse(mode.slice(7)));}catch{return nameParts('quoted');}}
 if(mode==='preferred')return [{id:'used',field:'used',before:'',after:' '},{id:'last',field:'last',before:'',after:''}];
 return [{id:'first',field:'first',before:'',after:' '},...(mode==='quoted'?[{id:'preferred',field:'preferred' as const,before:"'",after:"' "}]:[]),{id:'last',field:'last',before:'',after:''}];
}
export function validateNameParts(value:unknown):NamePart[]{
 if(!Array.isArray(value)||value.length<1||value.length>8)throw new ValidationError('Use 1–8 name parts.');
 const ids=new Set<string>();
 return value.map(p=>{if(!p||typeof p.id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(p.id)||ids.has(p.id)||!Object.hasOwn(NAME_FIELDS,p.field)||typeof p.before!=='string'||typeof p.after!=='string'||p.before.length>20||p.after.length>20||/[\u0000-\u001f]/.test(p.before+p.after))throw new ValidationError('Choose valid name parts and punctuation.');ids.add(p.id);return {id:p.id,field:p.field,before:p.before,after:p.after};});
}
export function validateNameDisplay(mode:unknown):NameDisplay{
 if(mode==='legal'||mode==='preferred'||mode==='quoted')return mode;
 if(typeof mode==='string'&&mode.startsWith('inline:')&&mode.length<=6000){try{return encodeNameTokens(validateNameTokens(JSON.parse(mode.slice(7))));}catch{throw new ValidationError('Choose Valid Name Parts And Punctuation.');}}
 if(typeof mode!=='string'||!mode.startsWith('custom:')||mode.length>2500)throw new ValidationError('Choose a valid name format.');
 try{return encodeNameParts(validateNameParts(JSON.parse(mode.slice(7))));}catch{throw new ValidationError('Choose valid name parts and punctuation.');}
}
export function encodeNameParts(parts:NamePart[]):NameDisplay{return `custom:${JSON.stringify(parts)}`;}
export function formatCustomName(fields:{firstName:string;preferredFirstName:string;lastName:string},mode:NameDisplay):string{
 if(mode.startsWith('inline:'))return formatInlineName(fields,nameTokens(mode));
 const parts=nameParts(mode);
 const values={first:fields.firstName,last:fields.lastName,preferred:fields.preferredFirstName!==fields.firstName||!parts.some(p=>p.field==='first'||p.field==='used')?fields.preferredFirstName:'',used:fields.preferredFirstName||fields.firstName};
 return parts.map(p=>values[p.field]?p.before+values[p.field]+p.after:'').join('').trim()||fields.firstName||fields.lastName;
}

function formatInlineName(fields:{firstName:string;preferredFirstName:string;lastName:string},tokens:NameToken[]):string{
 const values={first:fields.firstName,last:fields.lastName,preferred:fields.preferredFirstName!==fields.firstName||!tokens.some(t=>t.kind==='field'&&(t.field==='first'||t.field==='used'))?fields.preferredFirstName:'',used:fields.preferredFirstName||fields.firstName};
 const missing=new Set(tokens.flatMap(t=>t.kind==='field'&&!values[t.field]?[t.id]:[]));
 const chunks=tokens.map(t=>t.kind==='field'?values[t.field]:t.optionalFor&&missing.has(t.optionalFor)?'':t.text);
 // Only punctuation immediately wrapping an empty part is optional. A comma
 // separating the remaining legal names (Last, First) must stay in place.
 const pairs:Record<string,string>={"'":"'",'"':'"','‘':'’','“':'”','(':')','[':']','{':'}'};
 for(let i=0;i<tokens.length;i++){
  const t=tokens[i];if(t.kind!=='field'||!missing.has(t.id))continue;
  const left=i-1,right=i+1;
  const before=left>=0&&tokens[left].kind==='text'?chunks[left]:'',after=right<tokens.length&&tokens[right].kind==='text'?chunks[right]:'';
  const opener=before.match(/(['"‘“(\[{])\s*$/)?.[1];
  if(opener&&after.trimStart().startsWith(pairs[opener])){chunks[left]=before.slice(0,before.lastIndexOf(opener));chunks[right]=after.trimStart().slice(1);}
  const hasBefore=tokens.slice(0,i).some(part=>part.kind==='field'&&values[part.field]),hasAfter=tokens.slice(i+1).some(part=>part.kind==='field'&&values[part.field]);
  if(!hasBefore&&right<tokens.length&&tokens[right].kind==='text')chunks[right]=chunks[right].replace(/^[\s,;:/|–—-]+/,'');
  if(!hasAfter&&left>=0&&tokens[left].kind==='text')chunks[left]=chunks[left].replace(/[\s,;:/|–—-]+$/,'');
 }
 const result=chunks.join('');
 return (missing.size?result.replace(/\s{2,}/g,' ').replace(/([,;:/|])\s*\1/g,'$1'):result).trim()||fields.firstName||fields.lastName;
}
