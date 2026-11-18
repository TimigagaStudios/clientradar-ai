// All DNS and HTTPS operations are simulated. Never contacts a website.
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const mocks = {
  'node:dns/promises': `export class Resolver { resolve4(host) { globalThis.__qaDnsHosts.push(host); return Promise.resolve(globalThis.__qaAddresses); } cancel() {} }`,
  'node:https': `import { EventEmitter } from 'node:events';
    export function request(url, options, callback) {
      globalThis.__qaRequests.push({url: String(url), options});
      const req = new EventEmitter(); req.destroy = () => { globalThis.__qaDestroyed = true; };
      req.end = () => queueMicrotask(() => {
        options.lookup('attacker.invalid', {}, (err, address, family) => { globalThis.__qaPinned = {err, address, family}; });
        const response = new EventEmitter(); response.headers = {'content-type': globalThis.__qaType};
        response.statusCode = globalThis.__qaStatus; response.destroy = () => { globalThis.__qaDestroyed = true; };
        callback(response);
        for (const chunk of globalThis.__qaChunks) response.emit('data', Buffer.from(chunk));
        response.emit('end');
      }); return req;
    }`,
};
const plugin = { name: 'offline-network', setup(b) {
  b.onResolve({ filter: /^node:(dns\/promises|https)$/ }, (args) => ({ path: args.path, namespace: 'offline' }));
  b.onLoad({ filter: /.*/, namespace: 'offline' }, (args) => ({ contents: mocks[args.path], loader: 'js' }));
} };
const result = await build({ entryPoints: ['api/lib/_qa-website.ts'], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent', plugins: [plugin] });
const { isPublicQaIpv4, readQaWebsite } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString('base64')}`);
for (const ip of ['0.0.0.0', '10.0.0.1', '127.0.0.1', '169.254.169.254', '172.16.2.1', '172.31.255.255', '192.168.1.1', '100.64.0.1', '192.0.2.3', '198.18.1.1', '198.51.100.1', '203.0.113.1', '224.0.0.1', '255.255.255.255', '::1', '::ffff:127.0.0.1', '0177.0.0.1', 'bad']) assert.equal(isPublicQaIpv4(ip), false, ip);
for (const ip of ['8.8.8.8', '1.1.1.1', '172.15.1.1', '172.32.1.1']) assert.equal(isPublicQaIpv4(ip), true, ip);
function setup(addresses = ['8.8.8.8'], status = 200, chunks = ['<html><a href="mailto:info@company.test">Email</a><a href="tel:+2348005550123">Call</a></html>'], type = 'text/html; charset=utf-8') {
  globalThis.__qaDnsHosts = []; globalThis.__qaRequests = []; globalThis.__qaAddresses = addresses; globalThis.__qaStatus = status;
  globalThis.__qaChunks = chunks; globalThis.__qaType = type; globalThis.__qaDestroyed = false; globalThis.__qaPinned = null;
}
setup();
const ok = await readQaWebsite('https://company.test/private?token=secret#x');
assert.equal(ok.status, 'available'); assert.equal(ok.host, 'company.test');
assert.deepEqual(ok.emails, ['info@company.test']); assert(ok.phones.length);
assert.equal(globalThis.__qaRequests.length, 1); assert.equal(globalThis.__qaRequests[0].url, 'https://company.test/');
assert.deepEqual(globalThis.__qaPinned, { err: null, address: '8.8.8.8', family: 4 });
assert(!('Authorization' in globalThis.__qaRequests[0].options.headers));
for (const bad of ['http://company.test', 'https://user:pass@company.test', 'https://company.test:8443', 'https://127.0.0.1', 'https://[::1]', 'https://localhost', 'https://facebook.com/page', 'https://192.168.1.1', 'https://0x7f000001', 'file:///etc/passwd']) {
  setup(); const output = await readQaWebsite(bad); assert.equal(output.status, 'unavailable', bad); assert.equal(globalThis.__qaRequests.length, 0, bad);
}
assert.equal((await readQaWebsite('')).status, 'not_provided');
for (const addresses of [[], ['127.0.0.1'], ['8.8.8.8', '10.0.0.1'], ['::1'], Array(33).fill('8.8.8.8')]) {
  setup(addresses); assert.equal((await readQaWebsite('company.test')).status, 'unavailable'); assert.equal(globalThis.__qaRequests.length, 0);
}
setup(['8.8.8.8'], 302); assert.equal((await readQaWebsite('company.test')).status, 'unavailable'); assert.equal(globalThis.__qaRequests.length, 1); assert(globalThis.__qaDestroyed);
setup(['8.8.8.8'], 200, ['x'.repeat(131073)]); assert.equal((await readQaWebsite('company.test')).status, 'unavailable'); assert(globalThis.__qaDestroyed);
setup(['8.8.8.8'], 200, ['secret'], 'application/json'); assert.equal((await readQaWebsite('company.test')).status, 'unavailable');
setup(); const failDns = { resolve4: async () => { throw new Error('sensitive error'); }, get: async () => { throw new Error('unexpected'); }, now: () => new Date('2026-01-01T00:00:00Z') };
const failed = await readQaWebsite('company.test', failDns); assert.equal(failed.status, 'unavailable'); assert(!JSON.stringify(failed).includes('sensitive'));
console.log('PASS simulated DNS pinning, unsafe address rejection, HTTPS, redirect, size and source limits. No website was contacted.');
