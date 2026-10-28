import {spawnSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
await import('./check-legal-review.mjs');
const tests=readdirSync('tests').filter(f=>f.endsWith('.test.mjs')).sort().map(f=>'tests/'+f);
for(const args of [['--test','--test-concurrency=1',...tests],['tests/api.integration.mjs'],['tests/supabase-auth.integration.mjs'],['tests/demo.integration.mjs'],['tests/organization.integration.mjs'],['tests/workspaces.integration.mjs'],['tests/collaboration.integration.mjs'],['tests/legal.integration.mjs'],['tests/subevent-delete.integration.mjs'],['tests/event-settings.integration.mjs'],['tests/event-settings-live.integration.mjs']]){const result=spawnSync(process.execPath,args,{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);}
