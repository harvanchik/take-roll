import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {DEFAULT_THEME,themeStartupScript} from '../lib/theme.ts';
import {defaultPreferences,preferenceSettings} from '../lib/workspace-settings.ts';
function startup(saved,deviceDark,blocked=false){const document={documentElement:{dataset:{}}};runInNewContext(themeStartupScript,{document,localStorage:{getItem(){if(blocked)throw Error('Blocked');return saved;}},window:{matchMedia(){return {matches:deviceDark};}}});return document.documentElement.dataset.theme;}
test('new users and absent preferences default to dark regardless of device appearance',()=>{
 assert.equal(DEFAULT_THEME,'dark');assert.equal(defaultPreferences.theme,'dark');assert.equal(preferenceSettings().theme,'dark');
 for(const device of [false,true])for(const saved of [null,'invalid',''])assert.equal(startup(saved,device),'dark');
 assert.equal(startup(null,false,true),'dark');
});
test('explicit light, dark and device choices still win at startup and in settings',()=>{
 for(const device of [false,true]){assert.equal(startup('light',device),'light');assert.equal(startup('dark',device),'dark');assert.equal(startup('device',device),device?'dark':'light');}
 for(const theme of ['light','dark','device'])assert.equal(preferenceSettings({theme,haptics:true}).theme,theme);
});
