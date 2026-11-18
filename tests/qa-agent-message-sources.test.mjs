// Offline message source comparison and token binding. No website or email.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const plugin = { name: 'offline-website', setup(b) {
  b.onResolve({ filter: /^\.\/_qa-website\.js$/ }, () => ({ path: 'site', namespace: 'mock' }));
  b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ loader: 'js', contents: 'export async function readQaWebsite(){return globalThis.__qaSite;}' }));
} };
const out = await build({entryPoints:['api/lib/_qa-outreach.ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[plugin],logLevel:'silent'});
const {reviewOutreachDemos}=await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].contents).toString('base64')}`);
const lead={business_name:'Internal',email:'lead@business.test',phone:'1234567890',website:'https://business.test'};
const db={from(table){if(table!=='leads')throw new Error('offline activity');return {select(){return this},eq(){return this},async maybeSingle(){return {data:lead,error:null}}}}};
const scope={leadId:'internal',recipient:'lead@business.test',kind:'intro'};
globalThis.__qaSite={status:'available',host:'business.test',emails:['site@business.test'],phones:['0987654321'],checkedAt:'2020-01-01T00:00:00Z'};
const check=()=>reviewOutreachDemos(db,'Hello','Contact sender@studio.test or 555-111-2222','https://app.test',scope);
const first=await check();assert.equal(first.websiteStatus,'available');assert(first.messageFindings.some(x=>x.code==='message_email_not_in_sources'));assert(first.messageFindings.some(x=>x.code==='message_phone_not_in_sources'));
globalThis.__qaSite.checkedAt='2021-01-01T00:00:00Z';assert.equal((await check()).token,first.token,'timestamp alone does not invalidate approval');
globalThis.__qaSite.emails=['updated@business.test'];assert.notEqual((await check()).token,first.token,'website evidence changes invalidate approval');
globalThis.__qaSite={status:'unavailable',host:'business.test',emails:[],phones:[],checkedAt:'2021-01-01T00:00:00Z'};const failed=await check();assert(failed.messageFindings.some(x=>x.code==='message_website_not_checked'));assert.notEqual(failed.token,first.token);
lead.email='another@business.test';assert((await check()).messageFindings.some(x=>x.code==='recipient_differs_from_lead'));
console.log('PASS offline message lead and website contact comparison, unavailable status and source-bound review token.');
