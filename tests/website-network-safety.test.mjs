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
const out=await build({entryPoints:['api/lib/_website.ts','api/lib/_safe-web.ts','api/lib/_places.ts'],bundle:true,platform:'node',format:'esm',outdir:'/virtual',write:false,plugins:[plugin],logLevel:'silent'});
const load=(suffix)=>import(`data:text/javascript;base64,${Buffer.from(out.outputFiles.find(x=>x.path.endsWith(suffix)).contents).toString('base64')}`);
const {scanWebsite,isOfficialWebsiteUrl,findEmails}=await load('_website.js');const {safeWebGet}=await load('_safe-web.js');const {checkWebsite}=await load('_places.js');
function setup(){globalThis.dns=[];globalThis.requests=[];globalThis.pins=[];globalThis.ipByHost={};globalThis.pages={};}
setup();
pages['https://company.test/']={status:301,location:'https://www.company.test/'};
pages['https://www.company.test/']={status:200,body:'<html><head><title>Company</title><link rel="stylesheet" href="/site.css"><link rel="stylesheet" href="https://attacker.test/style.css"></head><body><h1>Welcome</h1><script><h1>Hidden</h1>bad@company.test</script><!-- hidden@company.test --><a href="/contact?secret=one">Contact</a><a href="/about">About</a></body></html>'};
pages['https://www.company.test/contact']={status:200,body:'<html><h1>Contact</h1><a href="mailto:info@company.test">Email</a>Call us: (234) 800-5551</html>'};
pages['https://www.company.test/about']={status:200,body:'<html><h1>Our story</h1>Contact team@company.test <a href="/team">Our team</a><a href="https://outside.test/hidden">External</a><a href="/private?token=secret">Private</a></html>'};
pages['https://www.company.test/site.css']={status:200,type:'text/css',body:'body{color:#123456}'};
const scan=await scanWebsite('https://company.test/?credential=secret');
assert.equal(scan.title,'Company');assert(scan.emails.includes('info@company.test'));assert(scan.linkedPages.some(x=>x.path==='/about' && x.read));
assert(scan.linkedPages.some(x=>x.path==='/contact' && x.read),'the final fetched contact path is represented as read');
assert(scan.linkedPages.some(x=>x.path==='/team' && !x.read),'a link discovered on an already read page is link-only');
assert(!scan.linkedPages.some(x=>x.path==='/private'));assert(!JSON.stringify(scan.linkedPages).includes('secret'));
assert.equal(scan.sourcePages.length,3);
assert.deepEqual(scan.sourcePages[0],{host:'www.company.test',path:'/',title:'Company',heading:'Welcome',emails:[],phones:[]});
assert.equal(scan.sourcePages.find(x=>x.path==='/contact').heading,'Contact');
assert.deepEqual(scan.sourcePages.find(x=>x.path==='/contact').emails,[]); // href-only is not visible evidence.
assert.deepEqual(scan.sourcePages.find(x=>x.path==='/about').emails,['team@company.test']);
assert(!JSON.stringify(scan.sourcePages).includes('secret'));
assert.equal(requests.length,5);assert(requests.every(x=>!x.url.includes('?') && !x.url.includes('attacker.test')));
assert(requests.every(x=>x.options.family===4 && x.options.agent===false && !x.options.headers.Authorization && !x.options.headers.Cookie));
assert(pins.every(x=>x.address==='8.8.8.8' && x.family===4));
assert.equal(isOfficialWebsiteUrl('https://user:password@company.test'),false);
// Additional reads are opt-in, same-origin, robots-gated and never follow a
// redirect. Existing homepage/contact/about behavior is unchanged.
setup();
pages['https://company.test/']={status:200,body:'<html><title>Company</title><a href="/services">Services</a><a href="/products">Products</a><a href="/pricing">Pricing</a><a href="/blog">Blog</a><a href="/logout">Services</a></html>'};
pages['https://company.test/robots.txt']={status:200,type:'text/plain',body:'User-agent: *\nDisallow: /products\n'};
pages['https://company.test/services']={status:200,body:'<html><h1>Services</h1>service@company.test</html>'};
pages['https://company.test/pricing']={status:302,location:'/blocked'};
pages['https://company.test/blog']={status:200,body:'<html><h1>News</h1></html>'};
let expanded=await scanWebsite('https://company.test/',{discoverMore:true});
assert.equal(expanded.extraPagesStatus,'attempted');
assert(expanded.sourcePages.some(p=>p.path==='/services' && p.emails.includes('service@company.test')));
assert(expanded.linkedPages.some(p=>p.path==='/services' && p.read));
assert(!expanded.pagesRead.includes('/products')); assert(!expanded.pagesRead.includes('/pricing'));
assert(!requests.some(x=>x.url.endsWith('/products')||x.url.endsWith('/blocked')||x.url.endsWith('/logout')));
assert(!expanded.emails.includes('service@company.test'),'new discovery does not silently populate contact fields');
setup();pages['https://company.test/']={status:200,body:'<html><a href="/services">Services</a></html>'};
pages['https://company.test/robots.txt']={status:403};
expanded=await scanWebsite('https://company.test/',{discoverMore:true});assert.equal(expanded.extraPagesStatus,'robots_unavailable');assert.equal(requests.length,2);
setup();pages['https://company.test/']={status:200,body:'<html><a href="/services">Services</a></html>'};
pages['https://company.test/robots.txt']={status:404};pages['https://company.test/services']={status:200,body:'<html><h1>Services</h1></html>'};
expanded=await scanWebsite('https://company.test/',{discoverMore:true});assert.equal(expanded.extraPagesStatus,'attempted');assert(expanded.pagesRead.includes('/services'));assert.equal(requests.length,3);
setup();pages['https://company.test/']={status:200,body:'<html><a href="/services">Services</a></html>'};pages['https://company.test/robots.txt']={status:302,location:'https://www.company.test/robots.txt'};
expanded=await scanWebsite('https://company.test/',{discoverMore:true});assert.equal(expanded.extraPagesStatus,'robots_unavailable');assert.equal(requests.length,2);
for (const status of [401,429,500,503]) {
  setup();pages['https://company.test/']={status:200,body:'<html><a href="/services">Services</a></html>'};pages['https://company.test/robots.txt']={status};
  expanded=await scanWebsite('https://company.test/',{discoverMore:true});assert.equal(expanded.extraPagesStatus,'robots_unavailable');assert.equal(requests.length,2);
}
setup();pages['https://company.test/']={status:200,body:'<html><a href="/services">Services</a></html>'};pages['https://company.test/robots.txt']={status:200,type:'text/plain',body:'User-agent: *\nDisallow: /\n'};
expanded=await scanWebsite('https://company.test/',{discoverMore:true});assert.equal(expanded.extraPagesStatus,'attempted');assert.equal(requests.length,2);assert(!expanded.pagesRead.includes('/services'));
setup();pages['https://company.test/']={status:200,body:'<html><a href="/services">Services</a></html>'};
expanded=await scanWebsite('https://company.test/');assert.equal(expanded.extraPagesStatus,'not_requested');assert.equal(requests.length,1);
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
// Lead Finder's provider-supplied site checks must use the same safe transport.
setup();assert.deepEqual(await checkWebsite('http://127.0.0.1/admin'),{outdated:false,note:null});assert.equal(requests.length,0);
setup();assert.deepEqual(await checkWebsite('https://user:password@company.test/'),{outdated:false,note:null});assert.equal(requests.length,0);
setup();ipByHost['company.test']=['169.254.169.254'];assert.deepEqual(await checkWebsite('https://company.test/'),{outdated:false,note:null});assert.equal(requests.length,0);
setup();pages['https://company.test/']={status:302,location:'http://127.0.0.1/private'};assert.deepEqual(await checkWebsite('https://company.test/'),{outdated:false,note:null});assert.equal(requests.length,1);
setup();pages['https://company.test/']={status:200,body:'<html><meta name="viewport" content="width=device-width"></html>'};assert.deepEqual(await checkWebsite('https://company.test/?token=secret'),{outdated:false,note:null});assert.equal(requests[0].url,'https://company.test/');
setup();pages['https://company.test/']={status:200,body:'<html><head></head></html>'};assert.deepEqual(await checkWebsite('https://company.test/'),{outdated:true,note:'Mobile viewport tag not detected'});
setup();pages['https://company.test/']={status:200,body:'x'.repeat(120001)};assert.deepEqual(await checkWebsite('https://company.test/'),{outdated:false,note:null});
console.log('PASS safe scanner and Lead Finder site checks: pinned IPv4, same-site redirects, private destinations, credentials and body/type limits.');
