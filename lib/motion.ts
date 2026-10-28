export function reducedMotion(){return typeof document!=='undefined'&&(document.documentElement.dataset.reduceMotion==='true'||window.matchMedia('(prefers-reduced-motion: reduce)').matches);}
