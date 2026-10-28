import type {AuthConfig} from '../lib/supabase-auth';
import {pageAccess} from '../lib/page-access';
import {securityHeaders} from '../lib/security-headers';
import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";

export default {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    const path=new URL(request.url).pathname;
    const nonce=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24))));
    const finish=(response:Response)=>import.meta.env.DEV?response:securityHeaders(response,nonce);
    if(!['GET','HEAD'].includes(request.method)&&!(request.method==='POST'&&['/api/attendance','/api/organization','/api/workspaces','/api/legal'].includes(path)))return finish(new Response('Method Not Allowed',{status:405,headers:{Allow:['/api/attendance','/api/organization','/api/workspaces','/api/legal'].includes(path)?'GET, HEAD, POST':'GET, HEAD'}}));
    if(path.split('/').some(part=>part.startsWith('.'))||path.endsWith('.map'))return finish(new Response('Not Found',{status:404}));
    if((request.headers.get('cookie')?.length||0)>32768||request.url.length>8192)return finish(new Response('Request Too Large',{status:431}));
    const access=await pageAccess(request,env as AuthConfig&{DB?:D1Database});
    if(access?.response)return finish(access.response);
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    let response=await runWithConnectorBinding(binding, () => handler.fetch(access?.request||request, env, ctx));
    if(!import.meta.env.DEV&&response.headers.get('content-type')?.includes('text/html')){
      // Preloads need the same nonce as scripts under strict-dynamic. A blocked
      // module preload otherwise causes the later React import to fail too.
      const trustScript={element(element:Element){element.setAttribute('nonce',nonce);}};
      response=new HTMLRewriter().on('script',trustScript)
        .on('link[rel=modulepreload]',trustScript)
        .on('link[rel=preload][as=script]',trustScript).transform(response);
    }
    return finish(access?.finish?access.finish(response):response);
  },
};
