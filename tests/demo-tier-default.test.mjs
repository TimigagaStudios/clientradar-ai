// Offline new-job defaults and legacy tier compatibility. No real database or emails.
import assert from 'node:assert/strict';import {build} from 'esbuild';
const plugin={name:'fixture',setup(b){
 b.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:'db',namespace:'fake'}));
 b.onResolve({filter:/^\.\/lib\/auth\.js$/},()=>({path:'auth',namespace:'fake'}));
 b.onResolve({filter:/^\.\/lib\/demo-job-process\.js$/},()=>({path:'worker',namespace:'fake'}));
 b.onLoad({filter:/.*/,namespace:'fake'},a=>({loader:'js',contents:{db:'export const createClient=()=>globalThis.__tierDb;',auth:'export async function requireOwner(req,res){return true}; export const requireUser=requireOwner;',worker:'export async function processDemoJob(){throw new Error("Not used")}' }[a.path]}));
}};
const out=await build({entryPoints:['api/demo-jobs.ts','api/lib/demo-ai.ts'],bundle:true,platform:'node',format:'esm',outdir:'/virtual',write:false,plugins:[plugin],logLevel:'silent'});
const load=(name)=>import(`data:text/javascript;base64,${Buffer.from(out.outputFiles.find(x=>x.path.endsWith(name)).contents).toString('base64')}`);
const {normalizeNewStyleLevel,splitTemplateKey}=await load('demo-ai.js');
for(const [v,want] of [[undefined,'ultra'],['unexpected','ultra'],['ultra','ultra'],['mid','mid'],['Mid-Level','mid'],['Hybrid','hybrid']])assert.equal(normalizeNewStyleLevel(v),want);
assert.equal(splitTemplateKey('auto').level,'mid');assert.equal(splitTemplateKey('auto:mid').level,'mid');
Object.assign(process.env,{NEXT_PUBLIC_SUPABASE_URL:'https://unit.invalid',SUPABASE_SERVICE_ROLE_KEY:'mock'});delete process.env.API_AUTH_DISABLED;
const {default:handler}=await load('demo-jobs.js');let inserted;
globalThis.__tierDb={from(table){let action='select';return {select(){return this},eq(){return this},in(){return this},single(){return this},maybeSingle(){return this},insert(v){action='insert';inserted=v;return this},update(){action='update';return this},then(ok){const data=table==='leads'&&action==='select'?{id:'lead',business_name:'Test'}:table==='demo_jobs'&&action==='select'?null:table==='demo_jobs'&&action==='insert'?{id:'job',...inserted}:null;return Promise.resolve({data,error:null}).then(ok)}}}};
async function create(styleLevel){inserted=null;let res={code:0,value:null,status(n){this.code=n;return this},json(v){this.value=v;return this}};await handler({method:'POST',body:{confirm:true,leadId:'lead',styleLevel},query:{},headers:{}},res);assert.equal(res.code,201);return inserted.template_key}
assert.equal(await create(undefined),'auto:ultra');assert.equal(await create('invalid'),'auto:ultra');assert.equal(await create('mid'),'auto:mid');assert.equal(await create('hybrid'),'auto:hybrid');
console.log('PASS new demo Ultra defaults and explicit levels; legacy missing tier remains Mid-Level.');
