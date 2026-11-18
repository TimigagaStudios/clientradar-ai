// Isolated deterministic tests. Separate tests cover handler integration.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle = await build({ entryPoints: ['api/lib/_qa-agent.ts'], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
const { inspectQaDemo, inspectQaMessage } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`);
const lead = { businessName: 'Sample Business', email: 'team@example.org', phone: '+234 800 555 0123', website: 'https://business.invalid' };
const site = { emails: ['TEAM@example.org'], phones: ['+2348005550123'] };
const content = { businessName: 'Sample Business', contact: { email: 'TEAM@example.org', phone: '+234 800 555 0123' }, hero: { title: 'A simple title' }, showcase: { sample: false, items: [] } };
const before = JSON.stringify({ content, lead, site });
const clean = inspectQaDemo(content, lead, site);
assert.deepEqual(clean.findings, []);
assert.deepEqual(clean.sources, { savedLead: true, websiteContacts: true });
assert.match(clean.limitations.join(' '), /do not verify all claims/);
assert.equal(JSON.stringify({ content, lead, site }), before);
const changed = structuredClone(content); changed.businessName = 'Different name'; changed.contact.email = 'other@invalid.test'; changed.contact.phone = '0123456789'; changed.showcase.sample = true;
changed.hero.title = 'Award-winning, guaranteed results'; changed.showcase.items = [{ title: 'Only 2 spots left', detail: 'USD 900' }];
const findings = inspectQaDemo(changed, lead, site).findings;
for (const code of ['name_differs_from_lead', 'email_differs_from_lead', 'email_not_seen_on_site', 'phone_differs_from_lead', 'phone_not_seen_on_site', 'sample_showcase', 'credentials', 'guarantee', 'promotion', 'price']) assert(findings.some(x => x.code === code), code);
assert(findings.some(x => x.path === 'showcase.items.0.detail' && x.code === 'price'));
const unavailable = inspectQaDemo(content, lead, null);
assert.equal(unavailable.sources.websiteContacts, false);
assert(!unavailable.findings.some(x => x.code.endsWith('_not_seen_on_site')));
const drafts = ['first outreach', 'follow-up', 'reply'];
for (const kind of drafts) {
  const report = inspectQaMessage('Hello', `This ${kind} guarantees success. Act now for 15% off. [first name]`);
  for (const code of ['guarantee', 'pressure', 'promotion', 'placeholder']) assert(report.findings.some(x => x.code === code), `${kind}: ${code}`);
}
assert.deepEqual(inspectQaMessage('', '').findings.map(x => x.code), ['missing_subject', 'missing_body', 'message_facts_need_review']);
assert(inspectQaMessage('Hi', 'Our service costs \u20a6100').findings.some(x => x.code === 'price'));
assert(inspectQaMessage('Hi', "You don't have a proper site, and you're leaving bookings on the table.").findings.some(x => x.code === 'website_assumption'));
assert(inspectQaMessage('Hi', 'A sharper site would turn these views into clients.').findings.some(x => x.code === 'unverified_outcome'));
assert.doesNotThrow(() => inspectQaDemo(null, {}, { emails: 'not a list', phones: [null, 7] }));
console.log('PASS isolated QA agent helper tests.');
