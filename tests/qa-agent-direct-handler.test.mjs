// Mocked direct-send handler. No real provider, database or customer data.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const plugin = { name: 'offline', setup(b) {
  b.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({ path: 'db', namespace: 'fake' }));
  b.onResolve({ filter: /^\.\/lib\/auth\.js$/ }, () => ({ path: 'auth', namespace: 'fake' }));
  b.onLoad({ filter: /.*/, namespace: 'fake' }, (a) => ({ loader: 'js', contents: a.path === 'db' ? 'export const createClient=()=>globalThis.__testDb;' : 'export async function requireOwner(req,res){if(globalThis.__testOwner)return true;res.status(401).json({success:false});return false;}' }));
} };
const result = await build({ entryPoints: ['api/send-outreach.ts'], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent', plugins: [plugin] });
const saved = { ...process.env }; const oldFetch = globalThis.fetch;
Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: 'https://unit.invalid', SUPABASE_SERVICE_ROLE_KEY: 'mock', BREVO_API_KEY: 'mock', BREVO_SENDER_NAME: 'Test', BREVO_SENDER_EMAIL: 'test@invalid.test' });
delete process.env.API_AUTH_DISABLED;
const { default: handler } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString('base64')}`);
let calls = 0; let claims = 0;
let savedLead = { business_name: 'Internal', email: 'recipient@invalid.test', phone: '', website: '' };
globalThis.fetch = async () => { calls += 1; return new Response('{}', { status: 201 }); };
globalThis.__testDb = { from(table) { if (table !== 'leads') throw new Error('No activity store in fixture'); return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: savedLead, error: null }; } }; }, async rpc(name) {
  if (name === 'cr_qa_mail_ready') return { data: true, error: null };
  if (name === 'cr_claim_direct_send') { claims += 1; return { data: { claimed: true }, error: null }; }
  if (name === 'cr_resolve_direct_send') return { data: { state: 'sent' }, error: null };
  throw new Error(`Unexpected RPC ${name}`);
} };
const input = { action: 'send', leadId: '11111111-1111-1111-1111-111111111111', toEmail: 'recipient@invalid.test', subject: 'Hello', body: 'Guaranteed results', confirm: true };
async function call(body) {
  const res = { code: 0, result: null, status(code) { this.code = code; return this; }, json(value) { this.result = value; return this; } };
  await handler({ method: 'POST', body, headers: { host: 'app.test' } }, res); return res;
}
try {
  globalThis.__testOwner = false; let r = await call(input); assert.equal(r.code, 401); assert.equal(calls, 0);
  globalThis.__testOwner = true; r = await call({ ...input, confirm: false }); assert.equal(r.code, 403); assert.equal(calls, 0);
  r = await call(input); assert.equal(r.code, 409); assert.equal(r.result.code, 'QA_REVIEW_REQUIRED'); assert(r.result.review.messageFindings.some(x => x.code === 'guarantee')); assert.equal(calls, 0); assert.equal(claims, 0);
  const token = r.result.review.token;
  r = await call({ ...input, body: 'Guaranteed better results', qaOverride: true, qaToken: token }); assert.equal(r.code, 409); assert.equal(calls, 0);
  r = await call({ ...input, toEmail: 'different@invalid.test', qaOverride: true, qaToken: token }); assert.equal(r.code, 409); assert.equal(calls, 0);
  r = await call({ ...input, leadId: '22222222-2222-2222-2222-222222222222', qaOverride: true, qaToken: token }); assert.equal(r.code, 409); assert.equal(calls, 0);
  savedLead = { ...savedLead, email: 'changed@invalid.test' };
  r = await call({ ...input, qaOverride: true, qaToken: token }); assert.equal(r.code, 409); assert(r.result.review.messageFindings.some(x => x.code === 'recipient_differs_from_lead')); assert.equal(calls, 0);
  savedLead = { ...savedLead, email: input.toEmail };
  r = await call({ ...input, qaOverride: true, qaToken: token, confirm: false }); assert.equal(r.code, 403); assert.equal(calls, 0);
  r = await call({ ...input, qaOverride: true, qaToken: token }); assert.equal(r.code, 200); assert.equal(calls, 1); assert.equal(claims, 1);
} finally {
  globalThis.fetch = oldFetch;
  for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'BREVO_API_KEY', 'BREVO_SENDER_NAME', 'BREVO_SENDER_EMAIL', 'API_AUTH_DISABLED']) {
    if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
  }
}
console.log('PASS mocked direct handler: owner and send approval, review override, stale text, claim and simulated provider only.');
