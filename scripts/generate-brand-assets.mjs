// Run when the brand changes. Generated assets are checked in; no runtime work.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const require=createRequire(import.meta.url);
const sharp=require(require.resolve('sharp',{paths:[require.resolve('wrangler/package.json')]}));
const mark=readFileSync('public/take-roll-mark.svg','utf8').replace(/<\/?svg[^>]*>/g,'');
const navy='#101c2a';
mkdirSync('public/icons',{recursive:true});
const icon=`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="${navy}"/><g transform="translate(192 212) scale(20)">${mark}</g></svg>`;
writeFileSync('public/icons/app-icon.svg',icon);
writeFileSync('public/favicon.svg',icon);
for(const [name,size] of [['apple-touch-icon',180],['apple-touch-icon-152',152],['apple-touch-icon-167',167],['icon-192',192],['icon-512',512],['maskable-512',512],['icon-1024',1024],['favicon-32',32],['favicon-16',16]]){
 await sharp(Buffer.from(icon)).resize(size,size).png().toFile(`public/icons/${name}.png`);
}
const favicons=[16,32,48].map(async size=>({size,png:await sharp(Buffer.from(icon)).resize(size,size).png().toBuffer()}));
const entries=await Promise.all(favicons),header=Buffer.alloc(6+16*entries.length);header.writeUInt16LE(1,2);header.writeUInt16LE(entries.length,4);
let offset=header.length;
entries.forEach(({size,png},index)=>{const at=6+index*16;header[at]=size;header[at+1]=size;header.writeUInt16LE(1,at+4);header.writeUInt16LE(32,at+6);header.writeUInt32LE(png.length,at+8);header.writeUInt32LE(offset,at+12);offset+=png.length;});
writeFileSync('public/favicon.ico',Buffer.concat([header,...entries.map(entry=>entry.png)]));
// Separate maskable entry: the complete mark stays inside the 40%-radius safe circle.
const card=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="${navy}"/>
<g transform="translate(62 51) scale(1.65)">${mark}</g>
<g fill="#fffdf8" font-family="Georgia,serif" font-weight="bold"><text x="129" y="91" font-size="35">Take Roll</text><text x="64" y="247" font-size="77">Take Roll.</text><text x="64" y="334" font-size="77">Keep Track.</text></g>
<g font-family="Arial,sans-serif"><text x="67" y="389" font-size="23" fill="#b4bfcb">Every person. Every event. In sync.</text>
<rect x="67" y="440" width="178" height="45" fill="#99d5af"/><text x="156" y="469" text-anchor="middle" font-size="17" font-weight="bold" fill="${navy}">Start Taking Roll →</text>
<rect x="701" y="174" width="435" height="302" fill="#203247"/>
<rect x="689" y="162" width="435" height="302" fill="#192a3d" stroke="#35485d"/>
<text x="715" y="197" font-size="11" font-weight="bold" letter-spacing="2" fill="#ead290">YOUR TEAM · TOGETHER</text>
<text x="715" y="232" font-family="Georgia,serif" font-size="26" font-weight="bold" fill="#fffdf8">Team Check-In</text>
<g stroke="#35485d"><path d="M714 252H1098M714 314H1098M714 376H1098"/></g>
<g fill="#f1eadd" font-size="17"><text x="744" y="289">Alex Rivera</text><text x="744" y="351">Jordan Lee</text><text x="744" y="413">Taylor Morgan</text></g>
<g fill="#b4bfcb" font-size="10"><text x="715" y="288">01</text><text x="715" y="350">02</text><text x="715" y="412">03</text></g>
<rect x="973" y="268" width="125" height="32" fill="#99d5af"/><rect x="973" y="330" width="125" height="32" fill="#ead290"/><rect x="973" y="392" width="125" height="32" fill="#99d5af"/>
<g fill="${navy}" font-size="12" font-weight="bold" text-anchor="middle"><text x="1035" y="289">✓ Present</text><text x="1035" y="351">Bit Late</text><text x="1035" y="413">✓ Present</text></g>
<text x="67" y="566" font-size="16" fill="#b4bfcb">Saved Rosters   /   Live Collaboration   /   Attendance History</text>
<text x="1124" y="566" text-anchor="end" font-size="17" fill="#fffdf8">takeroll.online</text></g>
<path d="M0 625H300" stroke="#99d5af" stroke-width="10"/><path d="M300 625H600" stroke="#ead290" stroke-width="10"/><path d="M600 625H900" stroke="#edb18d" stroke-width="10"/><path d="M900 625H1200" stroke="#ec9a9a" stroke-width="10"/>
</svg>`;
writeFileSync('public/share-card.svg',card);
await sharp(Buffer.from(card)).png().toFile('public/share-card-v1.png');
console.log('Generated install icons and 1200 × 630 share card.');
