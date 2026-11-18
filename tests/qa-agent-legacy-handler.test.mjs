// Isolated legacy demo generation handler. No real provider, database or site.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const modules = {
  db: 'export const createClient=()=>globalThis.__db;',
  auth: 'export async function requireOwner(req,res){if(globalThis.__owner)return true;res.status(401).json({success:false});return false;}',
  writer: 'export async function generateDemoContent(){return null;}',
  site: "export async function readQaWebsite(){return {status:'not_provided',checkedAt:new Date().toISOString(),host:null,emails:[],phones:[]}}",
  team: 'export async function recordTask(record){globalThis.__records.push(record);}',
};
const plugin={name:'mock',setup(b){
  b.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:'db',namespace:'mock'}));
  b.onResolve({filter:/^\.\.\/lib\/auth\.js$/},()=>({path:'auth',namespace:'mock'}));
  b.onResolve({filter:/^\.\.\/lib\/demo-ai\.js$/},()=>({path:'writer',namespace:'mock'}));
  b.onResolve({filter:/^\.\/_qa-website\.js$/},()=>({path:'site',namespace:'mock'}));
  b.onResolve({filter:/^\.\/_team\.js$/},()=>({path:'team',namespace:'mock'}));
  b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:modules[a.path],loader:'js'}));
}};
const out=await build({entryPoints:['api/demo-jobs/[id].ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[plugin],logLevel:'silent'});
process.env.NEXT_PUBLIC_SUPABASE_URL='https://unit.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='mock';delete process.env.API_AUTH_DISABLED;
const {default:handler}=await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].contents).toString('base64')}`);
let row={id:'11111111-1111-1111-1111-111111111111',lead_id:'lead',status:'queued',attempts:0,template_key:'auto',prompt:'test',leads:{business_name:'Internal Test',email:'contact@business.test',website:''}};globalThis.__records=[];
function q(table){let action='read',patch={},filters=[],single=false;
 return {select(){return this},eq(k,v){filters.push([k,v]);return this},is(k,v){filters.push([k,v]);return this},update(v){action='update';patch=v;return this},single(){single=true;return this},maybeSingle(){single=true;return this},then(resolve){let match=filters.every(([k,v])=>row[k]===v);let data=null;if(table==='demo_jobs'){if(action==='update'&&match)Object.assign(row,structuredClone(patch));data=match?(single?structuredClone(row):[{id:row.id}]):null;}resolve({data,error:null});}};
}
globalThis.__db={from:q};async function call(body){const res={code:0,result:null,status(n){this.code=n;return this},json(v){this.result=v;return this}};await handler({method:'POST',body,query:{id:row.id}},res);return res;}
globalThis.__owner=false;let r=await call({confirm:true});assert.equal(r.code,401);assert.equal(row.status,'queued');
globalThis.__owner=true;r=await call({});assert.equal(r.code,403);assert.equal(row.status,'queued');
r=await call({confirm:true});assert.equal(r.code,200);assert.equal(row.status,'ready');assert(row.content.qa.agent);assert(row.content.qa.issues.some(i=>i.code==='website_not_checked'));assert(globalThis.__records.some(x=>x.agentKey==='quality-assurance'));
console.log('PASS legacy demo handler: owner and generation approval, offline evidence screening and actual QA activity.');
