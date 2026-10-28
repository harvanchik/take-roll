import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,unlinkSync,existsSync,lstatSync} from 'node:fs';
import {resolve,relative,dirname,isAbsolute,sep} from 'node:path';
const source=process.cwd(),target=resolve(process.argv[2]||'');
if(!process.argv[2]||source===target)throw Error('Pass the separate GitHub checkout path.');
const git=(cwd,args)=>execFileSync('git',args,{cwd});
if(git(target,['rev-parse','--show-toplevel']).toString().trim().replaceAll('\\','/')!==target.replaceAll('\\','/'))throw Error('Destination must be the GitHub repository root.');
const remote=git(target,['remote','get-url','origin']).toString().trim();
if(!/^https:\/\/github\.com\/[^/]+\/[^/]+(?:\.git)?$/.test(remote))throw Error('Destination origin must be an HTTPS GitHub repository.');
if(git(target,['status','--porcelain']).toString().trim())throw Error('Destination has uncommitted changes; preserve and resolve them first.');
if(git(source,['status','--porcelain','--untracked-files=no']).toString().trim())throw Error('Commit the reviewed Sites source before syncing.');
const scan=spawnSync(process.execPath,['scripts/check-public-source.mjs'],{cwd:source,stdio:'inherit'});if(scan.status!==0)process.exit(scan.status||1);
const files=git(source,['ls-tree','-r','--name-only','-z','HEAD']).toString().split('\0').filter(Boolean),wanted=new Set(files);
function checkedPath(file){const result=resolve(target,file),inside=relative(target,result);if(!inside||inside.startsWith('..'+sep)||isAbsolute(inside)||inside==='.git'||inside.startsWith('.git'+sep))throw Error('Unsafe destination path.');let parent=dirname(result);while(parent!==target){if(existsSync(parent)&&lstatSync(parent).isSymbolicLink())throw Error('Destination source paths cannot contain symlinks.');parent=dirname(parent);}return result;}
const removed=git(target,['ls-files','-z']).toString().split('\0').filter(file=>file&&!wanted.has(file));
// Only obsolete tracked source files are removed, never untracked data or directories.
for(const file of removed){const dest=checkedPath(file);if(existsSync(dest))unlinkSync(dest);}
for(const file of files){const dest=checkedPath(file);mkdirSync(dirname(dest),{recursive:true});writeFileSync(dest,git(source,['show','HEAD:'+file]));}
console.log(JSON.stringify({files:files.length,removed:removed.length,expectedTree:git(source,['rev-parse','HEAD^{tree}']).toString().trim(),githubOrigin:remote}));
