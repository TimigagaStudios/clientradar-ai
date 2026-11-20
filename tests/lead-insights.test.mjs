// Pure local calculations; no databases or providers are used.
import assert from 'node:assert/strict';import {build} from 'esbuild';
const output=await build({entryPoints:['src/lib/lead-insights.ts'],bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
const {savedRating,reputationPoints,savedClosedValue,hasTrackedDemo}=await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
for(const value of [null,undefined,'',0,-1,6,'bad',Infinity,true,{}]){assert.equal(savedRating(value),null);assert.equal(reputationPoints(value),0)}
assert.equal(savedRating('4.6'),4.6);assert.equal(reputationPoints('4.6'),23);assert.equal(reputationPoints(5),25);
assert.equal(savedClosedValue([{status:'New',dealValue:9000},{status:'Negotiating',dealValue:6000},{status:'Deal Closed',dealValue:1200},{status:'Deal Closed',dealValue:null},{status:'Deal Closed',dealValue:'bad'},{status:'Deal Closed',dealValue:-4}]),1200);
assert.equal(hasTrackedDemo({demoStatus:'Not Started'}),false);assert.equal(hasTrackedDemo({demoStatus:'Ready'}),true);assert.equal(hasTrackedDemo({demoLink:'/demo',demoStatus:'Not Started'}),true);
console.log('PASS saved rating, absent rating, closed values and no-demo tracking without inferred facts.');
