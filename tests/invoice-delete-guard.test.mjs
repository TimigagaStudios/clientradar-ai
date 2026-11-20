// Synthetic handlers and DB only. No production records are touched.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const fake = { name: 'mock-boundaries', setup(b) {
  b.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({path:'db',namespace:'fake'}));
  b.onResolve({ filter: /^(\.\/|\.\.\/)lib\/auth\.js$/ }, () => ({path:'auth',namespace:'fake'}));
  b.onLoad({ filter: /.*/, namespace:'fake' }, ({path}) => ({loader:'js',contents:path==='db' ? 'export const createClient=()=>globalThis.testDb;' : 'export async function requireUser(req,res){if(globalThis.allow)return true;res.status(401).json({success:false});return false;}'}));
} };
async function load(path) { const out=await build({entryPoints:[path],bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent',plugins:[fake]});return (await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].contents).toString('base64')}`)).default; }
Object.assign(process.env,{NEXT_PUBLIC_SUPABASE_URL:'https://unit.invalid',SUPABASE_SERVICE_ROLE_KEY:'test'});
const single=await load('api/leads/[id].ts'), bulk=await load('api/leads.ts');
let calls=[], linked=true, failure=null, secondLinked=false, reads=0;
globalThis.allow=true;globalThis.testDb={from(table){let action='read'; return { select(){return this},eq(){return this},not(){return this},in(){return this},update(){action='update';return this},delete(){action='delete';return this},limit(){return this},then(resolve){ calls.push({table,action}); if(table==='invoices'&&action==='read'){ reads++;resolve({data:failure?null:((linked || (secondLinked&&reads>1))?[{id:'invoice'}]:[]),error:failure}); } else resolve({data:action==='delete'&&table==='leads'?[{id:'lead'}]:[],error:null});} };}};
async function call(handler,query,body={}){const res={code:0,result:null,status(n){this.code=n;return this},json(v){this.result=v;return this}};await handler({method:'DELETE',query,body},res);return res;}
for(const [handler,query] of [[single,{id:'lead'}],[bulk,{all:'1'}]]){
 calls=[];linked=true;failure=null;reads=0;let r=await call(handler,query);assert.equal(r.code,500);assert.match(r.result.error,/linked invoice/i);assert.deepEqual(calls,[{table:'invoices',action:'read'}]);
 calls=[];linked=false;failure={code:'42501'};reads=0;r=await call(handler,query);assert.equal(r.code,500);assert.equal(calls.length,1);assert.equal(calls[0].action,'read');
 calls=[];linked=false;failure={code:'PGRST205'};reads=0;r=await call(handler,query);assert.equal(r.code,500);assert.equal(calls.length,1);
 calls=[];failure=null;secondLinked=true;reads=0;r=await call(handler,query);assert.equal(r.code,500);assert(!calls.some(x=>x.table==='leads'&&x.action==='delete'));assert(!calls.some(x=>x.table==='invoices'&&x.action!=='read'));secondLinked=false;
 calls=[];reads=0;r=await call(handler,query);assert.equal(r.code,200);assert(calls.some(x=>x.table==='leads'&&x.action==='delete'));assert(!calls.some(x=>x.table==='invoices'&&x.action!=='read'));
}
globalThis.allow=false;calls=[];assert.equal((await call(single,{id:'lead'})).code,401);assert.equal(calls.length,0);
const merged=await build({entryPoints:['api/lib/_duplicates.ts'],bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
const {mergeLeads}=await import(`data:text/javascript;base64,${Buffer.from(merged.outputFiles[0].contents).toString('base64')}`);
const operations=[];const mergeDb={from(table){let action='read';return {select(){return this},in(){return this},eq(){return this},limit(){return this},update(){action='update';return this},delete(){action='delete';return this},then(resolve){operations.push({table,action});return resolve({data:table==='leads'&&action==='read'?[{id:'keep',business_name:'Same Co'},{id:'remove',business_name:'Same Co'}]:table==='invoices'?[{id:'invoice'}]:[],error:null})}}}};
await assert.rejects(mergeLeads(mergeDb,'keep','remove'),/linked invoice/);
assert.deepEqual(operations,[{table:'leads',action:'read'},{table:'invoices',action:'read'}]);
console.log('PASS mocked lead delete, reset and merge invoice preflight; no invoice auto-delete. No concurrency or live DB guarantee.');
