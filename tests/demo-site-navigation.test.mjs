// Offline checks of rendered demo navigation. No website or customer requests.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const out=await build({entryPoints:['src/lib/demoSite.ts'],bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
const {buildDemoSite}=await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].contents).toString('base64')}`);
for(const level of ['mid','hybrid','ultra']) for(const hasServices of [false,true]) for(const hero of ['split','full','type','form','stack','offset']) {
 const content={businessName:'Test',category:'Business',styleLevel:level,design:{version:1,hero},hero:{title:'Hello'},about:{body:'About'},services:hasServices?[{title:'Service',body:'Example'}]:[],showcase:{kind:'products',items:[{title:'A',detail:'Example'},{title:'B',detail:'Example'}]},faq:[{question:'Question?',answer:'Example'}],contact:{},disclaimer:'Demo'};
 const files=buildDemoSite(content);
 for(const [file,html] of Object.entries(files).filter(([name])=>name.endsWith('.html'))) {
  const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]));
  const links=[...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map(x=>x[1]);
  for(const link of links) {
   if(link.startsWith('#')) assert(ids.has(link.slice(1)),`${level} ${hero} ${file} missing target ${link}`);
   else if(/^[a-z-]+\.html$/.test(link)) assert(Object.hasOwn(files,link),`${level} ${hero} ${file} missing page ${link}`);
  }
 }
 if(!hasServices) assert(files['index.html'].includes('Add confirmed services'));
}
console.log('PASS generated site local navigation and empty-service placeholders across 36 offline demo variants.');
