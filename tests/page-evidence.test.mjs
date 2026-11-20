// Deterministic source evidence from supplied successful reads; no network.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const out = await build({ entryPoints: ['api/lib/_website.ts'], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
const { evidenceFromReadPages } = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].contents).toString('base64')}`);
const pages = [
  { finalUrl:'https://www.company.test/', text:'<html><head><title>Company &amp; Co</title><script><h1>Fake</h1>wrong@company.test</script></head><body><!-- <h1>Comment</h1> hidden@company.test --><h1>Real <b>heading</b></h1>Questions: info@company.test. <a href="mailto:secret@company.test">Email</a> Phone: (234) 800-5551</body></html>' },
  { finalUrl:'https://www.company.test/about', text:'<html><h1>About us</h1><p>other@company.test</p></html>' },
  { finalUrl:'https://www.company.test/about', text:'<html><h1>Duplicate</h1></html>' },
  { finalUrl:'https://www.company.test/later', text:'<html><h1>Later</h1></html>' },
];
const evidence = evidenceFromReadPages(pages);
assert.equal(evidence.length,3); assert.equal(evidence[0].host,'www.company.test'); assert.equal(evidence[0].path,'/');
assert.equal(evidence[0].title,'Company & Co'); assert.equal(evidence[0].heading,'Real heading');
assert.deepEqual(evidence[0].emails,['info@company.test']); assert(evidence[0].phones.length > 0);
assert.deepEqual(evidence[1].emails,['other@company.test']);
assert(!JSON.stringify(evidence).includes('secret@')); assert(!JSON.stringify(evidence).includes('wrong@')); assert(!JSON.stringify(evidence).includes('hidden@'));
assert.deepEqual(evidenceFromReadPages([{finalUrl:'https://company.test/?secret=1',text:'<h1>x</h1>'},{finalUrl:'https://user:pass@company.test/',text:'<h1>x</h1>'}]),[]);
const hostile = evidenceFromReadPages([{finalUrl:'https://company.test/',text:'<h1>'.repeat(100000)}]);
assert.equal(hostile[0].heading,null);
console.log('PASS bounded page provenance, text-only contacts, duplicate and query exclusion, hidden blocks and hostile input.');
