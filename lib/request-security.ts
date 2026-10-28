export class RequestError extends Error {status:number;constructor(message:string,status=400){super(message);this.status=status;}}
export function sameOriginMutation(request:Request){
 const origin=request.headers.get('origin');
 if(request.headers.get('sec-fetch-site')==='cross-site'||(origin!==null&&origin!==new URL(request.url).origin))throw new RequestError('Invalid origin.',403);
}
export async function readMutation(request:Request){
 sameOriginMutation(request);
 if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new RequestError('Use application/json.',415);
 const max=2*1024*1024,length=request.headers.get('content-length');
 if(length!==null&&(!/^\d+$/.test(length)||Number(length)>max))throw new RequestError('Request is too large.',413);
 const reader=request.body?.getReader();if(!reader)throw new RequestError('Missing request.');
 let size=0;const chunks:Uint8Array[]=[];
 try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>max){await reader.cancel();throw new RequestError('Request is too large.',413);}chunks.push(part.value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 let body:any;try{body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new RequestError('Invalid JSON.');}
 let nodes=0;
 const validate=(value:unknown,depth=0):void=>{if(++nodes>20000||depth>8)throw new RequestError('Request is too complex.');if(value&&typeof value==='object'){if(Array.isArray(value)&&value.length>500)throw new RequestError('Too many items.');for(const [key,item] of Object.entries(value)){if(['__proto__','prototype','constructor'].includes(key))throw new RequestError('Invalid field.');validate(item,depth+1);}}};
 validate(body);
 if(!body||Array.isArray(body)||typeof body!=='object'||!body.action||Array.isArray(body.action)||typeof body.action!=='object'||typeof body.action.type!=='string'||body.action.type.length>80||!Number.isSafeInteger(body.revision)||body.revision<0||typeof body.accountId!=='string'||body.accountId.length>600)throw new RequestError('Invalid save request.');
 if(body.mutationId!==undefined&&(typeof body.mutationId!=='string'||!body.mutationId.length||body.mutationId.length>128||!/^[\w.-]+$/.test(body.mutationId)))throw new RequestError('Invalid save identifier.');
 if(body.workspaceId!==undefined&&(typeof body.workspaceId!=='string'||body.workspaceId.length>600))throw new RequestError('Invalid Workspace.');
 return body;
}

