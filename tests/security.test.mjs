import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {readFile,readdir} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {securityHeaders} from '../lib/security-headers.ts';
import {limitAccount} from '../lib/rate-limit.ts';
import {safeSignInReturn} from '../lib/sign-in.ts';
import {rosterCSV,csv,personFromFields} from '../lib/model.ts';
const require=createRequire(import.meta.url);
const {build}=require(require.resolve('esbuild',{paths:[dirname(require.resolve('wrangler/package.json'))]}));

test('redirects stay on workspace pages and reject hostile URL forms',()=>{
 for(const path of ['https://evil.test','//evil.test','/\\evil.test','/auth/sign-out','/auth%2fsign-out','/api/attendance','/signin-with-chatgpt','/events\n','/events\r\nLocation: https://evil.test','/'.repeat(3000)])assert.equal(safeSignInReturn(path),'/events');
 for(const path of ['/settings','/rosters','/archive','/event/training/day-2','/roster/staff','/events?q=last#event'])assert.equal(safeSignInReturn(path),path);
});
test('all CSV exports neutralize formulas including whitespace/control prefixes',()=>{
 for(const value of ['=1+1','+1','-1','@SUM(1)',' =HYPERLINK("https://evil.test")','\t=1','\n=1','\r=1','\u0000=1']){
  const person=personFromFields({firstName:value,lastName:'Safe',firstPronunciation:'',lastPronunciation:'',preferredFirstName:''});
  const exported=rosterCSV({people:[person]});assert.ok(exported.split('\n')[1].startsWith("'")||exported.split('\n')[1].startsWith('"\''));
  assert.ok(csv([[value]]).startsWith('\uFEFF"\''));
 }
});
test('security headers preserve every cookie, prohibit unsafe scripts, caching, embedding and MIME sniffing',()=>{
 const h=new Headers({'Content-Type':'text/html','X-Powered-By':'framework'});h.append('Set-Cookie','a=1; HttpOnly');h.append('Set-Cookie','b=2; Secure');
 const r=securityHeaders(new Response('<p>ok</p>',{headers:h}),'unique-nonce');
 assert.equal(r.headers.get('X-Content-Type-Options'),'nosniff');assert.equal(r.headers.getSetCookie().length,2);assert.equal(r.headers.get('X-Powered-By'),null);assert.match(r.headers.get('Cache-Control'),/private.*no-store/);
 const csp=r.headers.get('Content-Security-Policy');assert.match(csp,/script-src 'self' 'nonce-unique-nonce' 'strict-dynamic'/);assert.ok(!csp.split(';').find(d=>d.trim().startsWith('script-src')).includes('unsafe-inline'));assert.match(csp,/object-src 'none'/);assert.match(csp,/frame-ancestors 'self' https:\/\/chatgpt.com/);
});
test('atomic rate limits work across instances and never block another account',async()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE request_limits (key TEXT PRIMARY KEY,window INTEGER NOT NULL,hits INTEGER NOT NULL)');
 const binding={prepare(sql){return {bind(...params){return {async first(){return db.prepare(sql).get(...params);}};}};}};
 const now=60000*100;await Promise.all(Array.from({length:240},()=>limitAccount(binding,'alice',true,now)));
 await assert.rejects(()=>limitAccount(binding,'alice',true,now),e=>e.status===429);
 await limitAccount(binding,'bob',true,now);await limitAccount(binding,'alice',false,now);await limitAccount(binding,'alice',true,now+60000);db.close();
});
test('braces downstream patch stops the published deep-pattern stack exhaustion',async()=>{
 const dir=(await readdir('node_modules/.pnpm')).find(d=>d.startsWith('braces@3.0.3_'))||'braces@3.0.3';
 const braces=require(resolve('node_modules/.pnpm',dir,'node_modules/braces'));
 assert.deepEqual(braces.expand('file-{a,b}.txt'),['file-a.txt','file-b.txt']);
 for(const mode of ['compile','expand'])assert.throws(()=>braces[mode]('{'.repeat(4000)+'a'+ '}'.repeat(4000)),e=>e instanceof SyntaxError&&/safe limit/.test(e.message));
});
test('profile fields render hostile markup as inert text',async()=>{
 await build({entryPoints:['app/settings-panel.tsx'],bundle:true,platform:'node',format:'esm',jsx:'automatic',packages:'external',outfile:'.sites-runtime/security-settings.mjs'});
 const {default:Panel}=await import('../.sites-runtime/security-settings.mjs');const {createElement}=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');
 const attack='<img src=x onerror=alert(document.cookie)><script>alert(1)</script>';
 const html=renderToStaticMarkup(createElement(Panel,{data:{events:[],rosters:[],profile:{firstName:attack,lastName:'User',preferredName:''}},account:{email:'test@example.test',name:attack},busy:false,onAction:async()=>true}));
 assert.ok(!html.includes('<img src=x'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;img'));
});
test('installed app manifest keeps all workspace URLs in standalone scope',async()=>{
 const m=JSON.parse(await readFile('public/manifest.webmanifest','utf8'));assert.equal(m.display,'standalone');assert.equal(m.scope,'/');assert.equal(m.start_url,'/');
 for(const icon of m.icons){const bytes=await readFile('public'+new URL(icon.src,'https://takeroll.online').pathname);if(icon.type==='image/png'){assert.equal(bytes.subarray(1,4).toString(),'PNG');assert.equal(bytes.readUInt32BE(16),Number(icon.sizes.split('x')[0]));assert.equal(bytes.readUInt32BE(20),Number(icon.sizes.split('x')[1]));}else{assert.equal(icon.type,'image/svg+xml');assert.match(bytes.toString(),/<svg/);}}
 assert.ok(m.icons.some(icon=>icon.purpose==='maskable'&&icon.sizes==='512x512'));
 const layout=await readFile('app/layout.tsx','utf8');assert.match(layout,/apple-mobile-web-app-capable/);assert.match(layout,/manifest.webmanifest/);
});

