// Offline Team registry and activity checks. No real database is contacted.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const plugin={name:'fake-db',setup(b){b.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:'db',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const createClient=()=>globalThis.__db;',loader:'js'}));}};
const out=await build({entryPoints:['api/lib/_team.ts','api/lib/_qa-demo-agent.ts'],bundle:true,platform:'node',format:'esm',outdir:'/virtual',write:false,plugins:[plugin],logLevel:'silent'});
process.env.NEXT_PUBLIC_SUPABASE_URL='https://unit.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='mock';
const load=(suffix)=>import(`data:text/javascript;base64,${Buffer.from(out.outputFiles.find(x=>x.path.endsWith(suffix)).contents).toString('base64')}`);
const { AGENTS }=await load('_team.js');const {recordDemoCheck}=await load('_qa-demo-agent.js');
const agent=AGENTS.find(x=>x.key==='quality-assurance');assert.equal(agent.stage,'active');assert.match(agent.stageNote,/limited/i);assert.match(agent.stageNote,/approve every send/i);
const writes=[];globalThis.__db={from(table){return {insert(value){writes.push({table,value});return {select(){return this},async single(){return {data:{id:'task-id'},error:null}},then(done){done({data:null,error:null})}}}}}};
await recordDemoCheck('demo-id',null,{qa:{status:'checked',issues:[{code:'one'}],agent:{websiteStatus:'available',websiteHost:'private-site.invalid'}}});
assert.equal(writes[0].table,'agent_tasks');assert.equal(writes[0].value.agent_key,'quality-assurance');assert.equal(writes[1].table,'agent_activity');assert(!JSON.stringify(writes).includes('private-site.invalid'));
globalThis.__db={from(){throw new Error('unavailable')}};await assert.doesNotReject(()=>recordDemoCheck('demo-id',null,{qa:{status:'error'}}));
console.log('PASS offline Team status accuracy, real QA activity summary and best-effort failure behavior.');
