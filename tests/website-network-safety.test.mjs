// Simulated DNS and sockets only. No real network access.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const modules = {
  'node:dns/promises': `export class Resolver { resolve4(host) { globalThis.dns.push(host); return Promise.resolve(globalThis.ipByHost[host] || ['8.8.8.8']); } cancel() {} }`,
  'node:https': `import { EventEmitter } from 'node:events';
    export function request(url, options, callback) {
      globalThis.requests.push({url:String(url), options});
      const req=new EventEmitter(); req.destroy=()=>{};
      req.end=()=>queueMicrotask(()=>{
        options.lookup('rebinding.invalid',{all:false},(error,address,family)=>globalThis.pins.push({error,address,family}));
        const item=globalThis.pages[String(url)] || {status:404};
        const res=new EventEmitter();res.statusCode=item.status;res.headers={'content-type':item.type || 'text/html',location:item.location || '', 'content-encoding':item.encoding || 'identity','content-length':item.length};res.destroy=()=>{};
        callback(res);for(const chunk of (item.chunks || [item.body || '']))res.emit('data',Buffer.from(chunk));res.emit('end');
      });return req;
    }`,
};
modules['node:http'] = modules['node:https'];
const plugin={name:'offline-network',setup(b){b.onResolve({filter:/^node:(dns\/promises|http|https)$/},a=>({path:a.path,namespace:'fake'}));b.onLoad({filter:/.*/,namespace:'fake'},a=>({contents:modules[a.path],loader:'js'}));}};
const out=await build({entryPoints:['api/lib/_website.ts','api/lib/_safe-web.ts'],bundle:true,platform:'node',format:'esm',outdir:'/virtual',write:false,plugins:[plugin],logLevel:'silent'});
const load=(suffix)=>import(`data:text/javascript;base64,${Buffer.from(out.outputFiles.find(x=>x.path.endsWith(suffix)).contents).toString('base64')}`);
const {scanWebsite,isOfficialWebsiteUrl,findEmails}=await load('_website.js');const {safeWebGet}=await load('_safe-web.js');
function setup(){globalThis.dns=[];globalThis.requests=[];globalThis.pins=[];globalThis.ipByHost={};globalThis.pages={};}
setup();
pages['https://company.test/']={status:301,location:'https://www.company.test/'};
pages['https://www.company.test/']={status:200,body:'<html><head><title>Company</title><link rel="stylesheet" href="/site.css"><link rel="stylesheet" href="https://attacker.test/style.css"></head><body><a href="/contact?secret=one">Contact</a><a href="/about">About</a></body></html>'};
pages['https://www.company.test/contact']={status:200,body:'<html><a href="mailto:info@company.test">Email</a></html>'};
pages['https://www.company.test/about']={status:200,body:'<html>About</html>'};
pages['https://www.company.test/site.css']={status:200,type:'text/css',body:'body{color:#123456}'};
const scan=await scanWebsite('https://company.test/?credential=secret');
assert.equal(scan.title,'Company');assert.deepEqual(scan.emails,['info@company.test']);
assert.equal(requests.length,5);assert(requests.every(x=>!x.url.includes('?') && !x.url.includes('attacker.test')));
assert(requests.every(x=>x.options.family===4 && x.options.agent===false && !x.options.headers.Authorization && !x.options.headers.Cookie));
assert(pins.every(x=>x.address==='8.8.8.8' && x.family===4));
assert.equal(isOfficialWebsiteUrl('https://user:password@company.test'),false);
setup();ipByHost['company.test']=['8.8.8.8','10.0.0.1'];assert.equal(await scanWebsite('https://company.test/'),null);assert.equal(requests.length,0);
setup();pages['https://company.test/']={status:302,location:'https://www.company.test/'};ipByHost['www.company.test']=['169.254.169.254'];assert.equal(await scanWebsite('https://company.test/'),null);assert.equal(requests.length,1);
setup();pages['https://company.test/']={status:302,location:'https://attacker.test/'};assert.equal(await scanWebsite('https://company.test/'),null);assert.equal(requests.length,1);
setup();pages['https://company.test/']={status:200,body:'x'.repeat(524289)};assert.equal(await scanWebsite('https://company.test/'),null);
setup();pages['https://company.test/']={status:200,encoding:'gzip',body:'hello'};assert.equal(await scanWebsite('https://company.test/'),null);
setup();pages['https://company.test/']={status:200,type:'application/json',body:'{}'};assert.equal(await scanWebsite('https://company.test/'),null);
setup();pages['https://company.test/']={status:302,location:'http://company.test/'};assert.equal(await scanWebsite('https://company.test/'),null);
setup();pages['http://company.test/']={status:301,location:'https://company.test/'};pages['https://company.test/']={status:200,body:'<html>OK</html>'};assert(await scanWebsite('http://company.test/'));
setup();pages['https://company.test/']={status:302,location:'/a'};pages['https://company.test/a']={status:302,location:'/b'};pages['https://company.test/b']={status:302,location:'/c'};pages['https://company.test/c']={status:302,location:'/d'};pages['https://company.test/d']={status:200,body:'ok'};assert.equal(await safeWebGet(new URL('https://company.test/'),{maxBytes:1000,timeoutMs:6000,types:['text/html'],agent:'test'}),null);assert.equal(requests.length,4);
assert.deepEqual(findEmails('x'.repeat(200000),'company.test'),[]);
console.log('PASS safe scanner: pinned IPv4, same-site redirects, private destinations, credentials, body/type limits and no external stylesheets.');
