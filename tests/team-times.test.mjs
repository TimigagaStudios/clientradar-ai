// Offline handler test: no database or provider is contacted.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';

const plugin = { name: 'offline', setup(b) {
  b.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({ path: 'db', namespace: 'fake' }));
  b.onResolve({ filter: /^\.\/lib\/auth\.js$/ }, () => ({ path: 'auth', namespace: 'fake' }));
  b.onLoad({ filter: /.*/, namespace: 'fake' }, (a) => ({ loader: 'js', contents: a.path === 'db'
    ? 'export const createClient=()=>globalThis.__timeDb;'
    : 'export async function requireUser(req,res){if(globalThis.__timeAuth)return true;res.status(401).json({success:false});return false} export const requireOwner=requireUser;' }));
} };
Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: 'https://unit.invalid', SUPABASE_SERVICE_ROLE_KEY: 'mock' });
const bundle = await build({ entryPoints: ['api/team.ts'], bundle: true, platform: 'node', format: 'cjs', write: false, plugins: [plugin], logLevel: 'silent' });
const mod = { exports: {} };
new Function('module', 'exports', 'require', bundle.outputFiles[0].text)(mod, mod.exports, createRequire(import.meta.url));
const handler = mod.exports.default;
const row = { id: 'task', agent_key: 'quality-assurance', title: 'Test', status: 'done', requested_by: 'owner', lead_id: null, error: null, created_at: '2026-01-01T00:00:00Z', started_at: '2026-01-01T01:00:00Z', completed_at: null, input: {} };
globalThis.__timeDb = { from(table) { let selection = ''; const chain = {
  select(value) { selection = value; return this; }, order() { return this; }, limit() { return this; },
  then(done) { const data = table === 'agent_activity' ? [] : selection.includes('title') ? [row] : [{ agent_key: row.agent_key, status: row.status }]; return Promise.resolve({ data, error: null }).then(done); },
}; return chain; } };
async function request(auth) {
  globalThis.__timeAuth = auth;
  const res = { code: 0, result: null, status(n) { this.code = n; return this; }, json(body) { this.result = body; return this; }, setHeader() {} };
  await handler({ method: 'GET', query: {}, headers: {} }, res); return res;
}
let response = await request(false); assert.equal(response.code, 401);
response = await request(true); assert.equal(response.code, 200);
assert.equal(response.result.data.tasks[0].createdAt, row.created_at);
assert.equal(response.result.data.tasks[0].startedAt, row.started_at);
assert.equal(response.result.data.tasks[0].completedAt, null);
console.log('PASS authenticated Team response exposes recorded task timestamps without fabricating missing times.');
