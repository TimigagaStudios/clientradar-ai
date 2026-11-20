// Test the queued agent's new-demo tier without calling real providers.
import assert from 'node:assert/strict';import {build} from 'esbuild';
const stubs={
 'demo-job-process.js':"export const buildDemoPrompt=()=>''; export async function processDemoJob(){return {content:{generatedBy:'fallback'}}}; export async function refreshDemoSections(){throw Error('not used')}",
 '_places.js':"export async function searchBusinesses(){throw Error('not used')}",
 '_website.js':"export const isOfficialWebsiteUrl=()=>true,isValidContactEmail=()=>true,isValidContactPhone=()=>true,scanSummary=()=>''; export async function scanWebsite(){return null}",
};
const plugin={name:'offline',setup(b){b.onResolve({filter:/^\.\/.*\.js$/},a=>{let n=a.path.slice(2);return stubs[n]?{path:n,namespace:'stub'}:null});b.onLoad({filter:/.*/,namespace:'stub'},a=>({loader:'js',contents:stubs[a.path]}))}};
const out=await build({entryPoints:['api/lib/_agents.ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[plugin],logLevel:'silent'});
const {runAgentTask}=await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].contents).toString('base64')}`);
let inserted;
const db={from(table){let action='select';return {select(){return this},eq(){return this},in(){return this},single(){return this},maybeSingle(){return this},insert(v){action='insert';inserted=v;return this},update(){action='update';return this},then(ok){const data=table==='leads'&&action==='select'?{id:'lead',business_name:'Synthetic'}:table==='demo_jobs'&&action==='select'?null:table==='demo_jobs'&&action==='insert'?{id:'job',...inserted}:null;return Promise.resolve({data,error:null}).then(ok)}}}};
for(const [input,want] of [[undefined,'ultra'],['bad','ultra'],['mid','mid'],['hybrid','hybrid']]){
 const result=await runAgentTask(db,{agent_key:'demo-creation',input:{leadId:'lead',level:input}});
 assert.equal(inserted.template_key,`auto:${want}`);assert.equal(result.output.level,want);
}
console.log('PASS synthetic agent new-demo Ultra default and explicit lower levels.');
