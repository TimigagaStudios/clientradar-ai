// Offline photo policy test: no real provider calls and no real credentials.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const built = await build({ entryPoints: ['api/lib/_photos.ts'], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
const { demoPhotos, photosPossible } = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].contents).toString('base64')}`);
const oldFetch = globalThis.fetch;
const oldUnsplash = process.env.UNSPLASH_ACCESS_KEY;
const oldPexels = process.env.PEXELS_API_KEY;
let requests = [];
try {
  delete process.env.UNSPLASH_ACCESS_KEY; delete process.env.PEXELS_API_KEY;
  globalThis.fetch = async (url) => { requests.push(String(url)); throw new Error('Unexpected network'); };
  assert.equal(photosPossible(), false);
  // JavaScript callers can still pass an old ownImages property; it must be ignored.
  assert.deepEqual(await demoPhotos({ ownImages: ['https://owner.test/image.jpg'], businessName: 'Owner', category: 'bakery', seed: 'a', count: 2 }), []);
  assert.deepEqual(requests, []);
  process.env.PEXELS_API_KEY = 'mock-key';
  assert.equal(photosPossible(), true);
  globalThis.fetch = async (url) => {
    requests.push(String(url));
    return new Response(JSON.stringify({ photos: [{ src: { large: 'https://images.pexels.com/photos/1/test.jpg' }, alt: 'Bread', photographer: 'Artist', url: 'https://www.pexels.com/photo/test/' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const photos = await demoPhotos({ ownImages: ['https://owner.test/image.jpg'], category: 'bakery', seed: 'a', count: 2 });
  assert.equal(photos.length, 1); assert.equal(photos[0].kind, 'sample'); assert.equal(photos[0].source, 'pexels');
  assert.equal(photos[0].credit, 'Artist'); assert(!JSON.stringify(photos).includes('owner.test'));
  assert.equal(requests.length, 1); assert(requests[0].startsWith('https://api.pexels.com/'));
  assert.deepEqual(await demoPhotos({ category: 'bakery', seed: 'a', count: 0 }), []);
} finally {
  globalThis.fetch = oldFetch;
  if (oldUnsplash === undefined) delete process.env.UNSPLASH_ACCESS_KEY; else process.env.UNSPLASH_ACCESS_KEY = oldUnsplash;
  if (oldPexels === undefined) delete process.env.PEXELS_API_KEY; else process.env.PEXELS_API_KEY = oldPexels;
}
console.log('PASS offline: website images ignored, no provider without key, sample attribution retained.');
