import assert from 'node:assert/strict';
import {test} from 'node:test';
import vm from 'node:vm';
import {syncThemeColor,themeColorScript} from '../lib/theme.ts';

function fixture({mode='browser',theme='light',userAgent='Windows',platform='Win32',touch=0}={}){
 const meta={content:'',setAttribute(name,value){this[name]=value;}};
 const doc={documentElement:{dataset:{theme}},querySelector:()=>meta};
 const win={navigator:{userAgent,platform,maxTouchPoints:touch},matchMedia:query=>({matches:query===`(display-mode: ${mode})`})};
 return {win,doc,meta};
}
test('installed desktop chrome stays navy in either page theme, including touch laptops',()=>{
 for(const mode of ['standalone','window-controls-overlay','minimal-ui','fullscreen'])for(const theme of ['light','dark'])for(const touch of [0,10]){
  const {win,doc,meta}=fixture({mode,theme,touch});syncThemeColor(win,doc);assert.equal(meta.content,'#101c2a');
 }
});
test('mobile installs and normal browser tabs retain theme-matched chrome',()=>{
 for(const theme of ['light','dark'])for(const options of [{},{mode:'standalone',userAgent:'iPhone'},{mode:'standalone',userAgent:'Android'},{mode:'standalone',userAgent:'Macintosh',platform:'MacIntel',touch:5}]){
  const {win,doc,meta}=fixture({...options,theme});syncThemeColor(win,doc);assert.equal(meta.content,theme==='dark'?'#101c2a':'#f5ece5');
 }
});
test('startup script uses the runtime rule without external dependencies',()=>{
 for(const mode of ['browser','standalone'])for(const theme of ['light','dark']){
  const {win,doc,meta}=fixture({mode,theme});vm.runInNewContext(themeColorScript,{window:win,document:doc});assert.equal(meta.content,mode==='standalone'||theme==='dark'?'#101c2a':'#f5ece5');
 }
});
