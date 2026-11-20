// Pure offline tests for conservative rules on additional reads.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const out=await build({entryPoints:['api/lib/_robots.ts'],bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
const {parseRobots,robotsAllows}=await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].contents).toString('base64')}`);
let p=parseRobots('User-agent: *\nDisallow: /private\nAllow: /private/open\nDisallow: /products/*/secret$\n');
assert(p); assert.equal(robotsAllows(p,'/services'),true); assert.equal(robotsAllows(p,'/private'),false); assert.equal(robotsAllows(p,'/private/open'),true); assert.equal(robotsAllows(p,'/products/abc/secret'),false); assert.equal(robotsAllows(p,'/products/abc/secret/more'),true);
p=parseRobots('User-agent: *\nDisallow: /\nUser-agent: ClientRadarAI\nDisallow: /blocked\nUser-agent: ClientRadarAI\nAllow: /blocked/ok\n');
assert.equal(robotsAllows(p,'/services'),true); assert.equal(robotsAllows(p,'/blocked'),false); assert.equal(robotsAllows(p,'/blocked/ok'),true);
p=parseRobots('User-agent: *\nDisallow: /x\nAllow: /x\n');assert.equal(robotsAllows(p,'/x'),true);
p=parseRobots('User-agent: other\nDisallow: /\n');assert.equal(robotsAllows(p,'/services'),true);
assert.equal(parseRobots('User-agent: *\nDisallow: /priv%61te\n'),null);
assert.equal(parseRobots('User-agent: *\nCrawl-delay: 5\n'),null);
assert.equal(parseRobots('User-agent: *\nDisallow: /a$foo\n'),null);
assert.equal(robotsAllows(parseRobots(''),'/a%2fb'),false);
assert.equal(robotsAllows(parseRobots(''),'/services?x=1'),false);
assert.equal(parseRobots('x'.repeat(524289)),null);
assert.equal(parseRobots('User-agent: *\nDisallow: /x\n'.repeat(2001)),null);
console.log('PASS conservative robots policy, priority, wildcard, anchors, ambiguous data and bounded limits.');
