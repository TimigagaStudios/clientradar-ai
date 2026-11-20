// Mocked Lead Research ranking: no provider or business is contacted.
import assert from 'node:assert/strict';import {build} from 'esbuild';
const plugin={name:'offline',setup(b){b.onResolve({filter:/^\.\/_places\.js$/},()=>({path:'places',namespace:'fake'}));b.onResolve({filter:/^\.\/demo-job-process\.js$/},()=>({path:'worker',namespace:'fake'}));b.onLoad({filter:/.*/,namespace:'fake'},a=>({loader:'js',contents:a.path==='places'?"export async function searchBusinesses(args){globalThis.__calls.push(args);return globalThis.__result}":"export const buildDemoPrompt=()=>'';export async function processDemoJob(){};export async function refreshDemoSections(){}"}))}};
const out=await build({entryPoints:['api/lib/_agents.ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[plugin],logLevel:'silent'});
const {runAgentTask}=await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].contents).toString('base64')}`);
const regular=Array.from({length:22},(_,i)=>({businessName:`Site ${i}`,website:'https://business.invalid',email:'info@business.invalid',phone:'+234 802 345 6789'}));const best={businessName:'No listed website',website:null,email:'info@business.invalid',phone:'+234 802 345 6789'};
globalThis.__calls=[];globalThis.__result={businesses:[...regular,best],source:'openstreetmap',hasMore:false};
let result=await runAgentTask(null,{agent_key:'lead-research',input:{category:'Salon',city:'Lagos',count:2}});assert.equal(result.output.businesses[0].businessName,best.businessName);assert.equal(globalThis.__calls.length,1);
const noSite=Array.from({length:23},(_,i)=>({businessName:`No site ${i}`,website:null,phone:null,email:null}));globalThis.__calls=[];globalThis.__result={businesses:[...noSite,best],source:'geoapify',hasMore:true};
result=await runAgentTask(null,{agent_key:'lead-research',input:{category:'Salon',city:'Lagos',count:2,noWebsite:true}});assert.equal(result.output.businesses[0].businessName,best.businessName);assert.equal(result.output.qualified,1);assert.equal(globalThis.__calls.length,1);
console.log('PASS research prioritizes complete contacts within fetched results without extra provider requests.');
