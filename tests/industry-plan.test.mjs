// Synthetic category cues only; not a factual classifier or website generator.
import assert from 'node:assert/strict'; import {build} from 'esbuild';
const result=await build({entryPoints:['api/lib/_industry-plan.ts'],bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
const {industryPagePlan}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString('base64')}`);
for(const [category,expected] of [['Hair salons','Beauty and personal care'],['Barbershops','Beauty and personal care'],['Nail studios','Beauty and personal care'],['Spas','Beauty and personal care'],['Dental clinics','Dental'],['Medical clinics','Healthcare'],['Physiotherapy centres','Healthcare'],['Restaurants','Food and dining'],['Bakeries','Food and dining'],['Hotels','Hotel and hospitality'],['Fashion boutiques','Retail and commerce'],['Real estate agencies','Property and real estate'],['Property management','Property and real estate'],['Accounting firms','Professional and local services'],['Photography studios','Professional and local services']]) assert.equal(industryPagePlan(category).profile,expected,category);
assert(industryPagePlan('salon').suggestedPages.includes('Appointments'));
assert(industryPagePlan('dental').suggestedPages.includes('Patient information'));
assert(industryPagePlan('real estate').suggestedPages.includes('Property listings'));
assert.equal(industryPagePlan('Unfamiliar trade').matched,false); assert.equal(industryPagePlan(null).profile,'General business');
assert(!JSON.stringify(industryPagePlan('salon')).includes('$')); console.log('PASS bounded category-based industry page ideas; no business facts or new pages are generated.');
