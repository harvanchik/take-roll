import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ATTENDANCE_PALETTE} from '../lib/attendance-settings.ts';
const css=readFileSync('app/skin.css','utf8'),globals=readFileSync('app/globals.css','utf8');
const rgb=hex=>{hex=hex.slice(1);if(hex.length===3)hex=[...hex].map(c=>c+c).join('');return [0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255);};
const mix=(a,b,share)=>a.map((v,i)=>v*share+b[i]*(1-share));
const luminance=color=>color.reduce((sum,v,i)=>sum+[.2126,.7152,.0722][i]*(v<=.04045?v/12.92:((v+.055)/1.055)**2.4),0);
const contrast=(a,b)=>{const [low,high]=[luminance(a),luminance(b)].sort((x,y)=>x-y);return (high+.05)/(low+.05);};
function variables(theme){
 const result={};
 for(const [,selector,body] of (globals+css).matchAll(/(:root(?:\[data-theme=dark\]|:not\(\[data-theme=dark\]\))?)\{([^{}]*)\}/g)){
  if(selector.includes('[data-theme=dark]')&&(selector.includes(':not')?theme==='dark':theme!=='dark'))continue;
  for(const [,key,value] of body.matchAll(/--([\w-]+):([^;}]+)/g))result[key]=value.trim();
 }
 return result;
}

test('attendance text maintains at least 4.5:1 contrast across palette colors and selected gradient backgrounds',()=>{
 for(const theme of ['light','dark']){
  const vars=variables(theme),resolve=value=>rgb(value.startsWith('var(')?vars[value.slice(6,-1)]:value);
  // Read the actual foreground rule shared by status buttons, filters and stat cards.
  const selector=theme==='light'?/\.status-button,\.filter,\.stat\{--status-ink:([^}]+)\}/:/:root\[data-theme=dark\] \.status-button,[^{}]+\{--status-ink:([^}]+)\}/;
  const expression=css.match(selector)?.[1];
  const formula=expression?.match(/^color-mix\(in srgb,var\(--tone,var\(--(?:muted|text)\)\) (\d+)%,(#[a-f\d]+)\)$/i);
  assert.ok(formula,'Expected an explicit readable '+theme+' foreground rule');
  const share=Number(formula[1])/100,base=rgb(formula[2]),panel=resolve('var(--panel)');
  for(const foreground of ATTENDANCE_PALETTE)for(const background of ATTENDANCE_PALETTE){
   const ink=mix(resolve(foreground.value),base,share);
   // Include unselected tables, hover, checked buttons and every gradient endpoint.
   for(const fill of [0,.08,.13,.16,.20,.24,.28,.29]){
    const ratio=contrast(ink,mix(resolve(background.value),panel,fill));
    assert.ok(ratio>=4.5,`${theme}: ${foreground.name} on ${background.name} at ${fill}: ${ratio.toFixed(2)}:1`);
   }
  }
 }
});

// Convert relative OKLCH text to sRGB for an independent contrast check.
function vividInk(rgb,L,gain,limit){
 const [r,g,b]=rgb.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 const l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
 let a=1.9779984951*l-2.428592205*m+.4505937099*s,bb=.0259040371*l+.7827717662*m-.808675766*s;
 const c=Math.hypot(a,bb),scale=c?Math.min(limit,c*gain)/c:0;a*=scale;bb*=scale;
 const ll=(L+.3963377774*a+.2158037573*bb)**3,mm=(L-.1055613458*a-.0638541728*bb)**3,ss=(L-.0894841775*a-1.291485548*bb)**3;
 return [4.0767416621*ll-3.3077115913*mm+.2309699292*ss,-1.2684380046*ll+2.6097574011*mm-.3413193965*ss,-.0041960863*ll-.7034186147*mm+1.707614701*ss].map(v=>Math.max(0,Math.min(1,v<=.0031308?12.92*v:1.055*v**(1/2.4)-.055)));
}
test('vivid attendance text stays readable across both themes and custom gradient endpoints',()=>{
 for(const theme of ['light','dark']){
  const vars=variables(theme),resolve=value=>rgb(value.startsWith('var(')?vars[value.slice(6,-1)]:value),panel=resolve('var(--panel)');
  const gain=Number(vars['attendance-vivid-chroma-gain']),limit=Number(vars['attendance-vivid-chroma-limit']);
  for(const selected of [false,true]){
   const lightness=Number(vars[theme==='light'&&selected?'attendance-vivid-selected-lightness':'attendance-vivid-lightness']);
   for(const foreground of ATTENDANCE_PALETTE)for(const background of ATTENDANCE_PALETTE){
    const ink=vividInk(resolve(foreground.value),lightness,gain,limit);
    const fills=theme==='dark'?[0,.08,.16,...['attendance-dark-gradient-fill','attendance-dark-gradient-hover','attendance-dark-gradient-selected','attendance-dark-gradient-selected-hover'].map(key=>parseFloat(vars[key])/100)]:(selected?[.16,.20,.24,.28,.29]:[0,.08,.13]);
    for(const fill of fills){
     const ratio=contrast(ink,mix(resolve(background.value),panel,fill));
     assert.ok(ratio>=4.5,`${theme}, selected=${selected}: ${foreground.name} on ${background.name}: ${ratio.toFixed(2)}:1`);
    }
   }
  }
 }
});
