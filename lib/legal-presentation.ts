const minorWords=new Set(['a','an','and','as','at','but','by','for','from','in','into','nor','of','on','or','per','the','to','via','with']);
export function legalHeading(title:string){return title.split(' ').map((word,index)=>index>0&&minorWords.has(word.toLowerCase())?word.toLowerCase():word).join(' ');}
export function legalEffectiveDate(version:string){return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(version+'T00:00:00Z'));}
export function legalBodyText(text:string,version:string){return text.replace(/Effective [A-Z][a-z]+ \d{1,2}, \d{4}\./g,'Effective '+legalEffectiveDate(version)+'.');}
export function currentCopyrightYear(date=new Date()){const year=date.getFullYear();return Number.isInteger(year)&&year>=2026?year:2026;}
