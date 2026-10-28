export const ORIGINAL_SITE_ORIGIN='https://take-roll.example';

export function safeSignInReturn(value:string){
 if(value.length>2048||/[\\\u0000-\u0020\u007f]/.test(value)||!value.startsWith('/')||value.startsWith('//'))return '/events';
 try{
  const url=new URL(value,'https://app.local');
  if(!/^\/(?:$|events\/?$|rosters\/?$|archive\/?$|settings\/?$|event-settings\/[^/]+\/?$|event\/[^/]+(?:\/[^/]+)?\/?$|roster\/[^/]+\/?$|person\/[A-Za-z0-9]{7}\/?$)/.test(url.pathname)||url.origin!=='https://app.local'||/^\/(auth|signin-with-chatgpt|signout-with-chatgpt|callback)(\/|$)/.test(url.pathname))return '/events';
  return url.pathname+url.search+url.hash;
 }catch{return '/events';}
}

// Native authentication belongs to Sites dispatch. Keep navigation on the
// current domain; the application must never exchange native OAuth codes.
export function signInHref(returnTo:string,_hostname=''){
 return '/signin-with-chatgpt?return_to='+encodeURIComponent(safeSignInReturn(returnTo));
}
