import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const files=[];
function collect(dir){for(const entry of readdirSync(resolve(root,dir),{withFileTypes:true})){const path=dir+'/'+entry.name;if(entry.isDirectory())collect(path);else if(/\.(tsx?|mjs|json)$/.test(entry.name))files.push(path);}}
for(const dir of ['app','lib','build','drizzle'])collect(dir);
files.push('package.json','.openai/hosting.json');files.sort();
const hash=createHash('sha256');for(const file of files){hash.update(file+'\0');hash.update(readFileSync(resolve(root,file),'utf8').replace(/\r\n/g,'\n'));}
const digest=hash.digest('hex'),record=resolve(root,'legal-review.json');
if(process.argv[2]==='--record'){
 const note=process.argv[3]?.trim();if(!note)throw Error('Provide a note describing the legal review and any policy updates.');
 writeFileSync(record,JSON.stringify({reviewedAt:new Date().toISOString(),note,digest},null,2)+'\n');
 console.log('Legal review recorded.');
}else{
 const review=JSON.parse(readFileSync(record,'utf8'));
 if(review.digest!==digest)throw Error('Application behavior or policy sources changed since the last legal review. Follow LEGAL_MAINTENANCE.md, update affected policies, then record the completed review.');
 console.log('Legal review matches current application sources.');
}
