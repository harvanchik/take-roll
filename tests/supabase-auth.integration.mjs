import {installLegacyFixture} from './fixtures.mjs';
import {completeD1} from './d1-mock.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {dirname} from 'node:path';
import {readdir,readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
const require=createRequire(import.meta.url);
const {build}=require(require.resolve('esbuild',{paths:[dirname(require.resolve('wrangler/package.json'))]}));
const config={SUPABASE_URL:'https://unit-project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'};
const origin='https://takeroll.online',prefix='sb-unit-project-auth-token';
const db=new DatabaseSync(':memory:');for(const file of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())db.exec(await readFile('drizzle/'+file,'utf8'));
installLegacyFixture(db);
globalThis.__authTestEnv={...config,DB:{prepare(sql){const statement=db.prepare(sql);return {bind(...args){return {async run(){return {meta:{changes:Number(statement.run(...args).changes)}};},async first(){return statement.get(...args)||null;}};}};}}};
completeD1(globalThis.__authTestEnv.DB,db);
await build({entryPoints:['app/api/attendance/route.ts'],bundle:true,platform:'node',format:'esm',outfile:'.sites-runtime/supabase-api-test.mjs',plugins:[{name:'test-env',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const env=globalThis.__authTestEnv;',loader:'js'}));}}]});
await build({entryPoints:['lib/supabase-auth.ts'],bundle:true,platform:'node',format:'esm',outfile:'.sites-runtime/supabase-auth-test.mjs'});
const api=await import('../.sites-runtime/supabase-api-test.mjs');
const auth=await import('../.sites-runtime/supabase-auth-test.mjs');
const tokenUsers=new Map(),refreshUsers=new Map();let userChecks=0,logouts=0,exchanges=0;
const makeUser=(id,provider,email)=>({id,aud:'authenticated',role:'authenticated',email,email_confirmed_at:new Date().toISOString(),created_at:new Date().toISOString(),app_metadata:{provider,providers:[provider]},user_metadata:{},identities:[{id,identity_id:id,user_id:id,provider,identity_data:{email},created_at:new Date().toISOString()}]});
const alice=makeUser('11111111-1111-4111-8111-111111111111','google','owner@example.invalid');
const bob=makeUser('22222222-2222-4222-8222-222222222222','azure','bob@example.test');
function issue(user,expired=false){
 const exp=Math.floor(Date.now()/1000)+(expired?-60:3600),payload={sub:user.id,aud:'authenticated',role:'authenticated',exp,iat:exp-3600,iss:config.SUPABASE_URL+'/auth/v1'};
 const access_token=[{alg:'HS256',typ:'JWT'},payload].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).join('.')+'.test-signature';
 const refresh_token='refresh-'+user.id;tokenUsers.set(access_token,user);refreshUsers.set(refresh_token,user);
 return {access_token,refresh_token,token_type:'bearer',expires_at:exp,expires_in:expired?-60:3600,user};
}
const cookieFor=session=>prefix+'=base64-'+Buffer.from(JSON.stringify(session)).toString('base64url');
const cookieJar=response=>response.headers.getSetCookie().filter(c=>!c.includes('Max-Age=0')).map(c=>c.split(';')[0]).join('; ');
const request=(path='/api/attendance',cookie='',body=null,headers={})=>new Request(origin+path,{method:body?'POST':'GET',headers:{...(cookie?{cookie}:{}),...(body?{'Content-Type':'application/json',Origin:origin}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
globalThis.fetch=async(input,init)=>{
 const req=new Request(input,init),url=new URL(req.url);
 assert.equal(url.origin,config.SUPABASE_URL,'Tests must not contact a real service');
 assert.equal(req.headers.get('apikey'),config.SUPABASE_PUBLISHABLE_KEY);
 if(url.pathname==='/auth/v1/token'){
  const body=await req.json();
  if(url.searchParams.get('grant_type')==='pkce'){
   exchanges++;assert.ok(body.code_verifier?.length>20);
   if(body.auth_code==='good-google')return Response.json(issue(alice));
   if(body.auth_code==='good-microsoft')return Response.json(issue(bob));
  }
  if(url.searchParams.get('grant_type')==='refresh_token'&&refreshUsers.has(body.refresh_token))return Response.json(issue(refreshUsers.get(body.refresh_token)));
  return Response.json({msg:'Invalid Code',error_code:'bad_code'},{status:400});
 }
 if(url.pathname==='/auth/v1/user'){
  userChecks++;const token=req.headers.get('authorization')?.replace('Bearer ','');
  return tokenUsers.has(token)?Response.json(tokenUsers.get(token)):Response.json({msg:'Invalid Token',error_code:'bad_jwt'},{status:401});
 }
 if(url.pathname==='/auth/v1/logout'){logouts++;return new Response(null,{status:204});}
 throw Error('Unexpected Auth Request: '+url.pathname);
};

assert.equal((await api.GET(request())).status,401);
const ownerHeaders={'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.invalid'};
const owner=await (await api.GET(request('/api/attendance','',null,ownerHeaders))).json();
const ownerRecord=db.prepare('SELECT data,revision FROM attendance_stores WHERE user_id=?').get('legacy-fixture-account');
assert.equal(owner.account.id,'legacy-fixture-account');

for(const provider of ['google','microsoft']){
 const started=await auth.startProviderSignIn(request('/auth/sign-in/'+provider+'?return_to=%2Fevent%2Ftraining%2Fday-2'),config,provider);
 assert.equal(started.status,303);const target=new URL(started.headers.get('location'));
 assert.equal(target.origin,config.SUPABASE_URL);assert.equal(target.searchParams.get('provider'),provider==='microsoft'?'azure':'google');
 assert.ok(target.searchParams.get('code_challenge'));assert.equal(target.searchParams.get('code_challenge_method').toLowerCase(),'s256');
 assert.equal(new URL(target.searchParams.get('redirect_to')).origin,origin);
 if(provider==='microsoft')assert.equal(target.searchParams.get('scopes'),'email');
 const setCookies=started.headers.getSetCookie();assert.ok(setCookies.length);
 for(const c of setCookies){assert.match(c,/HttpOnly/);assert.match(c,/Secure/);assert.match(c,/SameSite=Lax/);}
 const callback=await auth.completeProviderSignIn(request('/auth/callback?code=good-'+provider+'&next=%2Fevent%2Ftraining%2Fday-2',cookieJar(started)),config);
 assert.equal(callback.status,303);assert.equal(callback.headers.get('location'),origin+'/event/training/day-2');
 assert.match(callback.headers.get('cache-control'),/private.*no-store/);
 const signedInCookie=cookieJar(callback);assert.ok(signedInCookie.includes(prefix));
 const before=userChecks,result=await api.GET(request('/api/attendance',signedInCookie));
 assert.equal(result.status,200);assert.ok(userChecks>before,'Every request must verify identity with Auth');
 const account=await result.json();assert.equal(account.account.id,'supabase:'+(provider==='google'?alice.id:bob.id));assert.equal(account.account.isOwner,false);
 assert.deepEqual(account.data,{rosters:[],events:[]});
}
assert.equal(exchanges,2);
assert.equal((await auth.completeProviderSignIn(request('/auth/callback?code=stolen-code'),config)).headers.get('location'),origin+'/?auth_error=callback');
assert.equal((await auth.completeProviderSignIn(request('/auth/callback?error=access_denied'),config)).headers.get('location'),origin+'/?auth_error=cancelled');
for(const name of ['apple','email','azure','constructor'])assert.equal((await auth.startProviderSignIn(request('/auth/sign-in/'+name),config,name)).status,404);
const hostedStart=await auth.startProviderSignIn(new Request('https://jake-roll-call.harvanchik.chatgpt.site/auth/sign-in/google?return_to=%2Fevents'),config,'google');
assert.equal(hostedStart.headers.get('location'),origin+'/auth/sign-in/google?return_to=%2Fevents');

// A forged cookie's user object and email never grant ownership or change identity.
const aliceSession=issue(alice),forgedSession={...aliceSession,user:{...alice,id:'owner',app_metadata:{provider:'google'},email:'owner@example.invalid'}};
const aliceCookie=cookieFor(forgedSession),aliceAccount=await (await api.GET(request('/api/attendance',aliceCookie,null,ownerHeaders))).json();
assert.equal(aliceAccount.account.id,'supabase:'+alice.id);assert.equal(aliceAccount.account.isOwner,false);
const created=await api.POST(request('/api/attendance',aliceCookie,{accountId:aliceAccount.account.id,revision:aliceAccount.revision,action:{type:'create-roster',name:'Alice Only',csv:'Test,Person,,,'}}));
assert.equal(created.status,200);const saved=await created.json();
assert.equal(saved.data.rosters[0].name,'Alice Only');
const bobCookie=cookieFor(issue(bob)),bobAccount=await (await api.GET(request('/api/attendance',bobCookie))).json();
assert.deepEqual(bobAccount.data,{rosters:[],events:[]});
assert.equal((await api.POST(request('/api/attendance',bobCookie,{accountId:aliceAccount.account.id,revision:saved.revision,action:{type:'rename-roster',rosterId:saved.data.rosters[0].id,name:'Stolen'}}))).status,403);
assert.equal((await api.POST(request('/api/attendance',bobCookie,{accountId:bobAccount.account.id,revision:bobAccount.revision,action:{type:'rename-roster',rosterId:saved.data.rosters[0].id,name:'Stolen'}}))).status,400);
assert.equal((await api.GET(request('/api/attendance',cookieFor({...aliceSession,access_token:'forged.invalid.token'}),null,ownerHeaders))).status,401);
// An expired/cleared external session must never silently become a different
// account just because a ChatGPT cookie is also present in the browser.
assert.equal((await api.GET(request('/api/attendance','roll-call-auth-method=supabase',null,ownerHeaders))).status,401);
for(const provider of ['email','apple']){
 const user=makeUser('33333333-3333-4333-8333-333333333333',provider,'other@example.test');
 assert.equal((await api.GET(request('/api/attendance',cookieFor(issue(user))))).status,401);
}

// Expired sessions refresh in the route handler and return new private cookies.
const refreshResult=await api.GET(request('/api/attendance',cookieFor(issue(alice,true))));
assert.equal(refreshResult.status,200);assert.ok(refreshResult.headers.getSetCookie().some(c=>c.includes(prefix)&&c.includes('HttpOnly')));
assert.match(refreshResult.headers.get('cache-control'),/private.*no-store/);
assert.equal((await refreshResult.json()).data.rosters[0].name,'Alice Only');
const signedOut=await auth.signOut(request('/auth/sign-out',cookieFor(issue(alice))),config);
assert.equal(signedOut.headers.get('location'),origin+'/');assert.ok(logouts);
assert.ok(signedOut.headers.getSetCookie().some(c=>c.includes(prefix)&&c.includes('Max-Age=0')));
// Sign-out must hold even while Sites continues supplying native identity.
const nativeHeaders={'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.invalid'};
const nativeOut=await auth.signOut(request('/auth/sign-out','',null,nativeHeaders),config);
assert.equal(nativeOut.headers.get('location'),origin+'/');
const outJar=cookieJar(nativeOut);
assert.ok(outJar.includes('roll-call-auth-method=signed-out'));
assert.equal((await api.GET(request('/api/attendance',outJar,null,nativeHeaders))).status,401);
assert.equal((await api.POST(request('/api/attendance',outJar,{accountId:'legacy-fixture-account',action:{type:'create-roster',name:'Blocked',names:'Blocked'}},nativeHeaders))).status,401);
const mixedOut=await auth.signOut(request('/auth/sign-out',cookieFor(issue(alice)),null,nativeHeaders),config);
assert.equal(mixedOut.headers.get('location'),origin+'/');
assert.equal((await api.GET(request('/api/attendance',cookieJar(mixedOut),null,nativeHeaders))).status,401);
// Even a stale auth cookie cannot bypass the explicit signed-out state.
assert.equal((await api.GET(request('/api/attendance',outJar+'; '+cookieFor(issue(alice)),null,nativeHeaders))).status,401);
const startAgain=await auth.startProviderSignIn(request('/auth/sign-in/google',outJar),config,'google');
assert.ok(cookieJar(startAgain).includes('roll-call-auth-method=supabase'));
const nativeAgain=await auth.startChatGPTSignIn(request('/auth/chatgpt',outJar),config);
assert.ok(nativeAgain.headers.getSetCookie().some(c=>c.startsWith('roll-call-auth-method=;')&&c.includes('Max-Age=0')));
const chatgpt=await auth.startChatGPTSignIn(request('/auth/chatgpt?return_to=%2Fevents',cookieFor(issue(alice))),config);
assert.equal(chatgpt.headers.get('location'),origin+'/signin-with-chatgpt?return_to=%2Fevents');
assert.ok(chatgpt.headers.getSetCookie().some(c=>c.includes('Max-Age=0')));
const native=await auth.startChatGPTSignIn(new Request('https://jake-roll-call.harvanchik.chatgpt.site/auth/chatgpt?return_to=%2Fevents'),config);
assert.equal(native.headers.get('location'),'https://jake-roll-call.harvanchik.chatgpt.site/signin-with-chatgpt?return_to=%2Fevents');
assert.throws(()=>auth.authOrigin(new Request('https://evil.test/auth/callback')),/Unsupported/);
const unsafe=await auth.startProviderSignIn(request('/auth/sign-in/google?return_to='+encodeURIComponent('//evil.test')),config,'google');
assert.equal(new URL(unsafe.headers.get('location')).searchParams.get('redirect_to'),origin+'/auth/callback');
assert.ok(unsafe.headers.getSetCookie().some(c=>c.startsWith('roll-call-auth-next=%2Fevents;')));
assert.deepEqual(db.prepare('SELECT data,revision FROM attendance_stores WHERE user_id=?').get('legacy-fixture-account'),ownerRecord);
console.log('Supabase auth passed: Google/Microsoft PKCE callbacks, HttpOnly cookies, identity verification, fresh workspaces, account isolation, rejected Apple/email, refresh, sign-out, safe redirects, and exact ChatGPT owner-data preservation.');

for(const action of [()=>auth.signOut(request('/auth/sign-out','',null,{'Sec-Fetch-Site':'cross-site'}),config),()=>auth.startChatGPTSignIn(request('/auth/chatgpt','',null,{Origin:'https://evil.test'}),config),()=>auth.startProviderSignIn(request('/auth/sign-in/google','',null,{'Sec-Fetch-Site':'cross-site'}),config,'google')])await assert.rejects(action,/Invalid origin/);
const signedUser=tokenUsers.values().next().value;const revokedSession=issue(signedUser);tokenUsers.delete(revokedSession.access_token);assert.equal((await api.GET(request('/api/attendance',cookieFor(revokedSession)))).status,401);
console.log('Auth attack regression passed: cross-site login/logout blocked, revoked service identity fails closed.');

await build({entryPoints:['app/api/attendance/live/route.ts'],bundle:true,platform:'node',format:'esm',outfile:'.sites-runtime/supabase-live-test.mjs',plugins:[{name:'test-env',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const env=globalThis.__authTestEnv;',loader:'js'}));}}]});
const liveAPI=await import('../.sites-runtime/supabase-live-test.mjs');
const liveSession=issue(alice),streamed=await liveAPI.GET(new Request(request('/api/attendance/live?snapshot=1',cookieFor(liveSession)),{signal:AbortSignal.timeout(3000)}));assert.equal(streamed.status,200);
const liveReader=streamed.body.getReader();let delivered='';while(!delivered.includes('"data":')){const chunk=await liveReader.read();assert.equal(chunk.done,false);delivered+=new TextDecoder().decode(chunk.value);}assert.match(delivered,/Alice Only/);
tokenUsers.delete(liveSession.access_token);db.prepare('UPDATE attendance_stores SET revision=revision+1 WHERE user_id=?').run('supabase:'+alice.id);
let afterRevoke='';while(true){const chunk=await liveReader.read();if(chunk.done)break;afterRevoke+=new TextDecoder().decode(chunk.value);}assert.match(afterRevoke,/"reload":true/);assert.ok(!afterRevoke.includes('"data":'));
const expiring=await liveAPI.GET(new Request(request('/api/attendance/live?snapshot=1',cookieFor(issue(alice,true))),{signal:AbortSignal.timeout(3000)}));assert.ok(expiring.headers.getSetCookie().some(c=>c.includes(prefix)));const expiredText=await expiring.text();assert.match(expiredText,/"reload":true/);assert.ok(!expiredText.includes('"data":'));
console.log('Direct live auth passed: every data delivery re-verifies identity, mid-stream revocation stops data, and refreshed-cookie sessions recover through HTTP instead of losing cookies.');

const unverified=makeUser('77777777-7777-4777-8777-777777777777','google','pending@example.test');unverified.email_confirmed_at=null;assert.equal((await api.GET(request('/api/attendance',cookieFor(issue(unverified))))).status,401);

// The agreement/access middleware must forward refreshed cookies to the route.
const expiredRequest=request('/api/attendance',cookieFor(issue(bob,true)));const refreshedContext=auth.createAuthContext(expiredRequest,config);assert.equal((await refreshedContext.account()).storeKey,'supabase:'+bob.id);const forwarded=refreshedContext.forwardRequest();assert.notEqual(forwarded.headers.get('cookie'),expiredRequest.headers.get('cookie'));assert.equal((await api.GET(forwarded)).status,200);assert.ok(refreshedContext.finish(new Response()).headers.getSetCookie().length>0);console.log('Middleware session refresh forwarding passed.');
