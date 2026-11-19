// Synthetic shared-worker regression. No provider, database or email network calls.
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const modules = {
  '_team.js': 'export async function recordTask() {}',
  '_design.js': "export const describeDesign=()=>''; export const loadEarlierDesigns=async()=>[]; export const pickDesignDna=()=>({version:1})",
  '_website.js': 'export async function scanWebsite(){return globalThis.__testScan || null}',
  '_qa-website.js': "export async function readQaWebsite(){return {status:'not_provided',checkedAt:new Date().toISOString(),host:null,emails:[],phones:[]}}", 
  '_photos.js': 'export async function demoPhotos(){return []}; export function photosPossible(){return false}',
  '_patterns.js': 'export async function learnedParts(){return null}',
  '_push.js': 'export async function sendPush(){}',
};
const plugin = { name: 'mock-worker-deps', setup(b) {
  b.onResolve({ filter: /^\.\/.*\.js$/ }, (args) => {
    const name = args.path.slice(2);
    return modules[name] ? { path: name, namespace: 'test' } : null;
  });
  b.onLoad({ filter: /.*/, namespace: 'test' }, (args) => ({ contents: modules[args.path], loader: 'js' }));
} };
const result = await build({ entryPoints: ['api/lib/demo-job-process.ts'], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent', plugins: [plugin] });
const { processDemoJob } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString('base64')}`);
const oldFetch = globalThis.fetch;
const oldEnv = { ...process.env };
const id = '11111111-1111-1111-1111-111111111111';
let row;
function reset() {
  globalThis.__testScan = null;
  row = { id, lead_id: 'lead', status: 'queued', attempts: 0, template_key: 'auto:ultra', prompt: 'Synthetic test', leads: { business_name: 'Internal Test', category: 'Test', city: 'Lagos' } };
}
function query(table) {
  let action = 'read'; let patch; let single = false; const filters = [];
  return {
    select() { return this; }, eq(k, v) { filters.push([k, v]); return this; },
    update(v) { action = 'update'; patch = v; return this; },
    single() { single = true; return this; }, maybeSingle() { single = true; return this; },
    then(resolve) {
      const match = filters.every(([k, v]) => row[k] === v);
      let data = null;
      if (table === 'demo_jobs') {
        if (action === 'update' && match) Object.assign(row, structuredClone(patch));
        data = match ? (single ? structuredClone(row) : [{ id: row.id }]) : (single ? null : []);
      }
      resolve({ data, error: null });
    },
  };
}
const db = { from: query };
const payload = (text, finishReason = 'STOP') => new Response(JSON.stringify({ candidates: [{ finishReason, content: { parts: [{ text }] } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
let calls = 0;
try {
  process.env.DEMO_AI_PROVIDER = 'gemini'; process.env.GEMINI_API_KEY = 'local-mock-key'; process.env.DEMO_AI_MODEL = 'mock-model';
  globalThis.fetch = async () => { calls += 1; return payload('Result:\n```json\n{"hero":{"title":"AI title",},"about":{"body":"AI body"},}\n```'); };
  reset(); const success = await processDemoJob(db, id, { record: false });
  assert.equal(success.status, 'ready'); assert.equal(row.content.generatedBy, 'ai');
  assert.equal(row.content.hero.title, 'AI title'); assert.equal(row.content.qa.status, 'checked'); assert.equal(calls, 1);
  assert.equal(row.content.websiteAnalysis.status, 'not_provided'); assert.deepEqual(row.content.websiteAnalysis.pagesRead, []);

  let promptBody = ''; calls = 0; globalThis.fetch = async (_url, options) => { calls += 1; promptBody = String(options.body); return payload('{\"hero\":{\"title\":\"AI title\"}}'); };
  reset(); row.prompt = 'Website status: No website found'; row.leads.website = 'https://company.test'; await processDemoJob(db, id, { record: false });
  assert.equal(row.content.websiteAnalysis.status, 'unavailable'); assert.match(promptBody, /could not be analyzed/); assert.doesNotMatch(promptBody, /No existing website was found|Website status: No website found/); assert.equal(calls, 1);

  calls = 0; reset(); row.leads.website = 'https://company.test'; globalThis.__testScan = { url:'https://company.test/', title:'Test', description:null, heading:'Test', colors:[], accent:null, darkDesign:null, fonts:[], platform:null, mobileReady:true, emails:[], pagesRead:['/','/about'], images:[] }; await processDemoJob(db, id, { record: false });
  assert.equal(row.content.websiteAnalysis.status, 'partial'); assert.deepEqual(row.content.websiteAnalysis.pagesRead, ['/','/about']); assert.match(promptBody, /untrusted extracted data/); assert.equal(calls, 1);

  calls = 0; globalThis.fetch = async () => { calls += 1; return payload('{"hero":{"title":"truncated"}', 'MAX_TOKENS'); };
  reset(); const fallback = await processDemoJob(db, id, { record: false });
  assert.equal(fallback.status, 'ready'); assert.equal(row.content.generatedBy, 'fallback');
  assert.match(row.content.aiError, /incomplete or blocked/); assert.equal(row.content.qa.status, 'checked'); assert.equal(calls, 1);
} finally {
  globalThis.fetch = oldFetch;
  for (const key of ['GEMINI_API_KEY', 'DEMO_AI_PROVIDER', 'DEMO_AI_MODEL']) {
    if (oldEnv[key] === undefined) delete process.env[key]; else process.env[key] = oldEnv[key];
  }
}
console.log('PASS synthetic shared-worker AI output, safe fallback, QA screening and no additional provider calls.');
