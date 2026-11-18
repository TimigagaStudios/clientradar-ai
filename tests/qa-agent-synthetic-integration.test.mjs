// Synthetic PostgreSQL/PostgREST integration; no real website or email.
// Only run against a freshly initialized disposable local qa_test fixture.
// This test refuses to connect to any other database URL.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { PostgrestClient } from '@supabase/postgrest-js';
import { createRequire } from 'node:module';
const local = 'http://127.0.0.1:55433';
if (process.env.QA_TEST_POSTGREST_URL !== local) throw new Error(`Set QA_TEST_POSTGREST_URL=${local} after starting the isolated test fixture.`);
const mock={name:'mock-auth-db',setup(b){
  b.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:'db',namespace:'test'}));
  b.onResolve({filter:/^\.\/lib\/auth\.js$/},()=>({path:'auth',namespace:'test'}));
  b.onLoad({filter:/.*/,namespace:'test'},a=>({loader:'js',contents:a.path==='db'?'export const createClient=()=>globalThis.__db;':'export async function requireOwner(req,res){if(globalThis.__owner)return true;res.status(401).json({success:false});return false} export const requireUser=requireOwner;'}));
}};
const outputs=await build({entryPoints:['api/team.ts','api/lib/_qa-demo-agent.ts'],bundle:true,platform:'node',format:'cjs',outdir:'/virtual',write:false,plugins:[mock],logLevel:'silent'});
const load=(name)=>{const mod={exports:{}};const code=outputs.outputFiles.find(x=>x.path.endsWith(name)).text;new Function('module','exports','require',code)(mod,mod.exports,createRequire(import.meta.url));return mod.exports;};
Object.assign(process.env,{NEXT_PUBLIC_SUPABASE_URL:'https://unit.invalid',SUPABASE_SERVICE_ROLE_KEY:'mock',BREVO_API_KEY:'mock',BREVO_SENDER_NAME:'Internal Test',BREVO_SENDER_EMAIL:'test@invalid.test'});delete process.env.API_AUTH_DISABLED;
const {default:handler}=await load('team.js');const {screenEvidenceDemo}=await load('_qa-demo-agent.js');
globalThis.__db=new PostgrestClient(local);globalThis.__owner=true;
const realFetch=globalThis.fetch;let sends=0;let release;let providerStarted;
const began=new Promise(r=>{providerStarted=r;});const hold=new Promise(r=>{release=r;});
globalThis.fetch=async(url,options)=>{if(String(url).startsWith('https://api.brevo.com/')){sends++;providerStarted();await hold;return new Response('{}',{status:201});}if(String(url).startsWith(local+'/'))return realFetch(url,options);throw new Error('External network prohibited in test');};
const leadId='dddddddd-dddd-dddd-dddd-dddddddddddd',demoId='eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',taskId='ffffffff-ffff-ffff-ffff-ffffffffffff';
const lead={id:leadId,status:'New',business_name:'Internal Test',email:'person@invalid.test',phone:'',website:''};
const site={status:'not_provided',checkedAt:new Date().toISOString(),host:null,emails:[],phones:[]};
const content=screenEvidenceDemo({businessName:lead.business_name,hero:{title:'Welcome'},about:{body:'About'},services:[{title:'One',body:'Two'}],contact:{email:lead.email},disclaimer:'Demo'},lead,site);
const draft={leadId,name:lead.business_name,email:lead.email,subject:'Hello',body:`Concept: https://app.test/demos/preview/${demoId}`,demoUrl:`/demos/preview/${demoId}`,writtenBy:'built-in',state:'pending'};
async function check(query){const result=await query;if(result.error)throw new Error(JSON.stringify(result.error));return result.data;}
async function call(body){const res={code:0,result:null,status(n){this.code=n;return this;},json(v){this.result=v;return this},setHeader(){}};await handler({method:'POST',body,headers:{host:'app.test'}},res);return res;}
try {
 await check(__db.from('leads').insert(lead));await check(__db.from('demo_jobs').insert({id:demoId,lead_id:leadId,status:'ready',content}));
 await check(__db.from('agent_tasks').insert({id:taskId,agent_key:'outreach',status:'waiting_approval',input:{outreach:true},output:{drafts:[draft]}}));
 let r=await call({action:'outreach-approve',taskId,confirm:true});assert.equal(r.code,200);
 r=await call({action:'outreach-send',taskId,leadId});assert.equal(r.code,409);assert.equal(r.result.review.demos[0].state,'checked');const token=r.result.review.token;assert.equal(sends,0);
 const activity=await check(__db.from('agent_activity').select('agent_key,summary').eq('agent_key','quality-assurance'));assert(activity.some(x=>x.summary.includes('Message screened')));
 await check(__db.from('leads').update({email:'changed@invalid.test'}).eq('id',leadId));
 r=await call({action:'outreach-send',taskId,leadId,confirm:true,qaOverride:true,qaToken:token});assert.equal(r.code,409);assert.equal(r.result.review.demos[0].state,'stale');assert.equal(sends,0);
 await check(__db.from('leads').update({email:lead.email}).eq('id',leadId));
 const sending=call({action:'outreach-send',taskId,leadId,confirm:true,qaOverride:true,qaToken:token});await began;assert.equal(sends,1);
 const changed=await __db.from('demo_jobs').update({content:{...content,businessName:'changed'}}).eq('id',demoId);assert(changed.error,'demo proof lock must reject edits during send');
 const duplicate=await call({action:'outreach-send',taskId,leadId,confirm:true,qaOverride:true,qaToken:token});assert.notEqual(duplicate.code,200);assert.equal(sends,1);
 release();r=await sending;assert.equal(r.code,200);assert.equal(r.result.data.draft.state,'sent');
 console.log('PASS synthetic PostgREST lead-evidence stale review, separate approval, real demo proof lock and single simulated provider request.');
} finally {release?.();globalThis.fetch=realFetch;}
