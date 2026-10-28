const small=new Set(['a','an','and','as','at','but','by','for','in','of','on','or','the','to','with']);
export function titleCase(value:string){return value.replace(/\b[A-Za-z]+\b/g,(word,index)=>index>0&&small.has(word.toLowerCase())?word.toLowerCase():word[0].toUpperCase()+word.slice(1));}
