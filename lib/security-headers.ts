/** A fresh nonce protects the framework's streamed inline scripts without unsafe-inline. */
export function securityHeaders(response:Response,nonce:string){
 const result=new Response(response.body,response);const h=result.headers;
 h.set('X-Content-Type-Options','nosniff');
 h.set('Referrer-Policy','strict-origin-when-cross-origin');
 h.set('Strict-Transport-Security','max-age=31536000');
 h.set('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=(), usb=()');
 h.set('Content-Security-Policy',[
  "default-src 'self'",`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,"style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:","font-src 'self'","connect-src 'self'","object-src 'none'","base-uri 'none'",
  "form-action 'self'","frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com https://chat.openai.com","frame-src 'none'","worker-src 'self' blob:",
 ].join('; '));
 if(h.has('Set-Cookie')||h.get('content-type')?.includes('text/html'))h.set('Cache-Control','private, no-store, max-age=0');
 h.delete('X-Powered-By');return result;
}
