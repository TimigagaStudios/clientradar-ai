// Local mocked tests only. No provider calls, secrets or customer data.
// Run after npm ci: node tests/demo-ai-json.test.mjs
import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function bundle(path) {
  const result = await build({ entryPoints: [path], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString('base64')}`);
}
const { parseDemoJson, demoResponseText } = await bundle('api/lib/_demo-json.ts');
const expected = { hero: { title: 'A {clear} title', description: 'A "quote" and a backslash \\ here' }, about: { body: 'Sample' }, services: [{ title: 'One', body: 'Two' }] };
const json = JSON.stringify(expected);
for (const text of [json, `\uFEFF  ${json} `, `\`\`\`json\n${json}\n\`\`\``, `\`\`\`\n${json}\n\`\`\``, `Here is your demo:\n\`\`\`json\n${json}\n\`\`\`\nDone.`]) {
  assert.deepEqual(parseDemoJson(text), expected);
}
const withComma = '{"hero":{"title":"Keep ,} inside text",},"services":[{"title":"A","body":"B",},],}';
assert.deepEqual(parseDemoJson(withComma), { hero: { title: 'Keep ,} inside text' }, services: [{ title: 'A', body: 'B' }] });
const withNewlines = '{"hero":{"title":"First\nSecond\tThird"},}';
assert.equal(parseDemoJson(withNewlines).hero.title, 'First\nSecond\tThird');
for (const input of ['', null, 'oops', '{"hero":{"title":"unfinished"}', '{"hero":{"title":"broken"}', `${json}\n${json}`, `[${json}]`, '{"unrelated":"value"}', '"a string"', 'x'.repeat(250001)]) {
  assert.throws(() => parseDemoJson(input));
}
assert.throws(() => parseDemoJson('prefix {"hero":{"title":"unclosed}')); // Never use a nested partial object.
assert.throws(() => parseDemoJson('{"hero":{"title":"This is \u0001 bad", "description": "missing quote}}'));
const parts = [{ text: '{"hero":' }, { text: '{"title":"From parts"}}' }];
assert.equal(demoResponseText('gemini', { candidates: [{ finishReason: 'STOP', content: { parts: [{ thought: true, text: 'not output' }, ...parts] } }] }), '{"hero":{"title":"From parts"}}');
assert.equal(demoResponseText('openrouter', { choices: [{ finish_reason: 'stop', message: { content: parts.map((part) => ({ type: 'text', text: part.text })) } }] }), '{"hero":{"title":"From parts"}}');
for (const finishReason of ['MAX_TOKENS', 'SAFETY', 'RECITATION', 'OTHER', 'MALFORMED_FUNCTION_CALL']) {
  assert.throws(() => demoResponseText('gemini', { candidates: [{ finishReason, content: { parts } }] }), /incomplete or blocked/);
}
assert.throws(() => demoResponseText('openrouter', { choices: [{ finish_reason: 'length', message: { content: json } }] }), /incomplete or blocked/);
assert.equal(demoResponseText('gemini', { candidates: [{ content: { parts: [{ thought: true, text: 'private' }] } }] }), '');

const { generateDemoContent } = await bundle('api/lib/demo-ai.ts');
const lead = { business_name: 'Internal QA test', category: 'Test', city: 'Lagos' };
const oldEnv = { ...process.env };
const oldFetch = globalThis.fetch;
let calls = [];
const reply = (payload, status = 200) => new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });
try {
  process.env.GEMINI_API_KEY = 'local-mock-key';
  process.env.DEMO_AI_PROVIDER = 'gemini';
  process.env.DEMO_AI_MODEL = 'mock-model';
  globalThis.fetch = async (url, options) => { calls.push({ url: String(url), options }); return reply({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: `Here is the answer:\n\`\`\`json\n${json}\n\`\`\`` }] } }] }); };
  const generated = await generateDemoContent(lead, 'auto', 'test prompt', 'ultra');
  assert.equal(generated.hero.title, expected.hero.title);
  assert.equal(calls.length, 1);
  assert.equal(JSON.parse(calls[0].options.body).generationConfig.responseMimeType, 'application/json');

  calls = [];
  process.env.DEMO_AI_PROVIDER = 'openrouter';
  globalThis.fetch = async (url, options) => { calls.push({ url: String(url), options }); return reply({ choices: [{ finish_reason: 'stop', message: { content: [{ type: 'text', text: '{"hero":' }, { type: 'text', text: '{"title":"One"},"about":{"body":"Two"},}' }] } }] }); };
  assert.equal((await generateDemoContent(lead, 'auto', 'test prompt')).hero.title, 'One');
  assert.equal(calls.length, 1);

  calls = [];
  globalThis.fetch = async (url, options) => { calls.push({ url: String(url), options }); return reply({ choices: [{ finish_reason: 'length', message: { content: json } }] }); };
  await assert.rejects(() => generateDemoContent(lead, 'auto', 'test prompt'), /incomplete or blocked/);
  assert.equal(calls.length, 1); // No automatic paid retries.

  calls = [];
  globalThis.fetch = async (url, options) => { calls.push({ url: String(url), options }); return reply({ choices: [{ finish_reason: 'stop', message: { content: '{"hero":{"title":"unfinished"}' } }] }); };
  await assert.rejects(() => generateDemoContent(lead, 'auto', 'test prompt'), /complete usable JSON object/);
  assert.equal(calls.length, 1);

  const secretMarker = 'local-sensitive-response-marker';
  globalThis.fetch = async () => new Response(secretMarker, { status: 200 });
  await assert.rejects(() => generateDemoContent(lead, 'auto', 'test prompt'), (err) => err.message === 'Demo AI provider returned an invalid response' && !err.message.includes(secretMarker));
  globalThis.fetch = async () => { throw new Error(`request included ${secretMarker} local-mock-key`); };
  await assert.rejects(() => generateDemoContent(lead, 'auto', 'test prompt'), (err) => err.message === 'Demo AI provider request failed' && !err.message.includes(secretMarker));
  globalThis.fetch = async () => reply({ error: secretMarker }, 429);
  await assert.rejects(() => generateDemoContent(lead, 'auto', 'test prompt'), (err) => err.message === 'Demo AI provider returned HTTP 429' && !err.message.includes(secretMarker));
  globalThis.fetch = async () => reply({ choices: [{ finish_reason: 'stop', message: { content: secretMarker } }] });
  await assert.rejects(() => generateDemoContent(lead, 'auto', 'test prompt'), (err) => !err.message.includes(secretMarker));

  process.env.DEMO_AI_PROVIDER = 'fallback';
  calls = [];
  assert.equal(await generateDemoContent(lead, 'auto', 'test prompt'), null);
  assert.equal(calls.length, 0);
} finally {
  globalThis.fetch = oldFetch;
  for (const key of ['GEMINI_API_KEY', 'DEMO_AI_PROVIDER', 'DEMO_AI_MODEL']) {
    if (oldEnv[key] === undefined) delete process.env[key]; else process.env[key] = oldEnv[key];
  }
}
console.log('PASS demo AI JSON: multipart output, wrappers, safe syntax repairs, fail-closed cases and single-call mocked providers.');
