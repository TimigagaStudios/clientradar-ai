// Local, no-network checks for the deterministic QA helper.
// Run after npm ci: node tests/qa-screen.test.mjs
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const result = await build({ entryPoints: ['api/lib/_demo-qa.ts'], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
const moduleUrl = `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString('base64')}`;
const { inspectDemo, screenDemo, demoQaStatus, demoFingerprint, applyOwnerCorrection } = await import(moduleUrl);
const input = { businessName: ' Sample ', hero: { title: ' Welcome ', description: ' About ' }, about: { body: ' Text ' }, services: [{ title: 'Service', body: 'Guaranteed results' }], contact: { email: 'test@example.com', phone: '123456789' }, disclaimer: 'Demo' };
const original = JSON.stringify(input);
const off = inspectDemo(input);
assert.equal(off.content.hero.title, ' Welcome ');
assert.equal(off.fixes.length, 0);
const on = inspectDemo(input, { fixWhitespace: true });
assert.equal(on.content.hero.title, 'Welcome');
assert.equal(on.content.businessName, ' Sample ');
assert.deepEqual(on.content.contact, input.contact);
assert.equal(JSON.stringify(input), original);
for (const code of ['possible_claim', 'placeholder_email', 'placeholder_phone']) assert(on.issues.some((issue) => issue.code === code));
const checked = screenDemo(input);
assert.equal(demoQaStatus(checked), 'checked');
assert.equal(demoQaStatus({ ...checked, stats: { views: 3 } }), 'checked');
assert.equal(demoQaStatus({ ...checked, businessName: 'Changed' }), 'stale');
assert.equal(demoQaStatus({}), 'unchecked');
assert.equal(demoQaStatus(screenDemo(null)), 'error');
assert.equal(demoFingerprint({ a: { x: 1, y: 2 } }), demoFingerprint({ a: { y: 2, x: 1 } }));
const corrected = applyOwnerCorrection({ contact: null }, 'contact.email', 'owner@example.net');
assert.equal(corrected.contact.email, 'owner@example.net');
assert.throws(() => applyOwnerCorrection(input, '__proto__.x', 'x'));
console.log('QA helper tests passed. These checks are not a factual, visual, security or live-link audit.');
