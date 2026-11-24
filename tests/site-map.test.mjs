// Offline discovery from supplied HTML only. No web requests are made.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const output = await build({ entryPoints: ['api/lib/_site-map.ts'], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
const { discoverLinkedPages, discoverReadPageLinks } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`);
const html = `<html><body><script>const x = '<a href="/fake">Fake</a>'</script>
  <a href="/contact">Contact us</a><a href="/about">About our business</a>
  <a href="/services"><b>Services</b></a><a href="/pricing">Pricing</a>
  <a href="/about">Duplicate</a><a href="https://other.test/contact">Other</a>
  <a href="/account?token=secret">Account</a><a href="#section">Section</a>
  <a href="javascript:alert(1)">Danger</a><a href="/guide.pdf">Guide</a>
  <a href="https://www.company.test/about">Other origin</a><a href="/blog">Blog</a></body></html>`;
const base = new URL('https://company.test/');
const map = discoverLinkedPages(html, base, ['https://company.test/', 'https://company.test/about']);
assert.equal(map[0].label, 'Home'); assert.equal(map[0].read, true);
assert.equal(map.find((x) => x.path === '/about').read, true);
assert.equal(map.find((x) => x.path === '/services').read, false);
assert.equal(map.find((x) => x.path === '/services').kind, 'Services');
assert.equal(map.find((x) => x.path === '/contact').kind, 'Contact');
for (const path of ['/fake', '/account', '/guide.pdf']) assert(!map.some(x => x.path === path), path);
assert.equal(map.filter(x => x.path === '/about').length, 1);
const second = discoverLinkedPages('<a href="/about">About</a>', base, ['https://www.company.test/about']);
assert.equal(second.find(x => x.path === '/about').read, false, 'a different origin was not read');
const many = Array.from({ length: 80 }, (_, i) => `<a href="/page${i}">Page ${i}</a>`).join('') + '<a href="/booking">Book now</a>';
const bounded = discoverLinkedPages(many, base, ['https://company.test/']);
assert.equal(bounded.length, 20); assert(bounded.some(x => x.kind === 'Booking'));
assert(!discoverLinkedPages('<script>' + '<a href="/fake">Fake</a>'.repeat(20000), base, []).some(x => x.path === '/fake'));
const reads = discoverReadPageLinks([
  {finalUrl:'https://company.test/',text:'<a href="/about">About</a>'},
  {finalUrl:'https://company.test/about',text:'<a href="/team">Team</a><a href="/query?token=private">Private</a>'},
  {finalUrl:'https://outside.test/secret',text:'<a href="/leak">Leak</a>'},
],base);
assert(reads.some(x=>x.path==='/about' && x.read)); assert(reads.some(x=>x.path==='/team' && !x.read));
assert(!reads.some(x=>x.path==='/query' || x.path==='/leak')); assert(reads.length<=20);
const limit = discoverReadPageLinks([{finalUrl:'https://company.test/',text:many},{finalUrl:'https://company.test/about',text:'<a href="/last">Last</a>'}],base);assert.equal(limit.length,20);
console.log('PASS bounded site-link discovery, private source states, prioritization and unsafe-link rejection.');
