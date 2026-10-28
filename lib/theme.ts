export type ThemePreference='light'|'dark'|'device';
export const DEFAULT_THEME:ThemePreference='dark';
/** Run before hydration: honor saved choices and use dark for first visits or blocked storage. */
export const themeStartupScript=`try{const saved=localStorage.getItem('roll-call-theme');const theme=['light','dark','device'].includes(saved)?saved:'${DEFAULT_THEME}';document.documentElement.dataset.theme=(theme==='dark'||(theme==='device'&&window.matchMedia('(prefers-color-scheme: dark)').matches))?'dark':'light'}catch(e){document.documentElement.dataset.theme='${DEFAULT_THEME}'};`;
/** Keep installed desktop window chrome navy, independently of the page theme. */
export function syncThemeColor(win:Window=window,doc:Document=document){
 const installed=['standalone','window-controls-overlay','minimal-ui','fullscreen'].some(mode=>win.matchMedia(`(display-mode: ${mode})`).matches);
 const mobile=/Android|iPhone|iPad|iPod/i.test(win.navigator.userAgent)||(win.navigator.platform==='MacIntel'&&win.navigator.maxTouchPoints>1);
 const navy=doc.documentElement.dataset.theme==='dark'||(installed&&!mobile);
 doc.querySelector('meta[name=theme-color]')?.setAttribute('content',navy?'#101c2a':'#f5ece5');
}
// Reuse the exact runtime rule before hydration to avoid a beige startup flash.
export const themeColorScript=`(${syncThemeColor.toString()})()`;
export function applyTheme(theme:ThemePreference){if(typeof window==='undefined')return;const dark=theme==='dark'||(theme==='device'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=dark?'dark':'light';syncThemeColor();}
export function setTheme(theme:ThemePreference){try{localStorage.setItem('roll-call-theme',theme);}catch{}applyTheme(theme);window.dispatchEvent(new Event('theme:change'));}
