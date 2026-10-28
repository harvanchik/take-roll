import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const files=execFileSync('git',['ls-files','-z']).toString().split('\0').filter(Boolean);
const issues=[];
for(const file of files){
 if(/(^|\/)(?:\.env(?!\.example$)|\.sites-runtime|\.wrangler|node_modules|dist|outputs)(?:\/|$)|\.(?:sqlite3?|db|log|tsbuildinfo|tar\.gz)$/i.test(file))issues.push(file+': private/generated file');
 if(/\.(?:png|ico|woff2?)$/i.test(file))continue;
 const content=readFileSync(file,'utf8');
 const secretPatterns=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/gh[pousr]_[a-zA-Z0-9_]{30,}/,/github_pat_[a-zA-Z0-9_]{30,}/,/sb_secret_[a-zA-Z0-9_-]{20,}/,/AKIA[A-Z0-9]{16}/,/\beyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\b/];
 if(secretPatterns.some(pattern=>pattern.test(content)))issues.push(file+': possible secret');
 if(!/(?:THIRD_PARTY_NOTICES|third-party-notices|pnpm-workspace|pnpm-lock)/.test(file)){
  const emails=content.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)||[];
  if(emails.some(email=>!/@(?:example\.(?:com|test|invalid)|sites\.test|takeroll\.online)$/i.test(email)))issues.push(file+': email address requires privacy review');
 }
 if(/C:[\\/]Users[\\/]/i.test(content))issues.push(file+': local or production identifier');
 if(file==='lib/owner-access.ts'&&/OWNER_EMAIL|OWNER_STORE_KEY/.test(content))issues.push(file+': account identity must come from the database');
 if(file==='lib/model.ts'&&/export (?:const SEED|function seedData)/.test(content))issues.push(file+': production seed data is forbidden');
}
if(issues.length){console.error(issues.join('\n'));process.exit(1);}
console.log(`Public source checks passed for ${files.length} files. Review new fixtures and assets manually before publishing.`);
