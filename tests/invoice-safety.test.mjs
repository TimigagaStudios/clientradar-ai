// Pure synthetic tests, no database, payment or provider.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const out = await build({ entryPoints: ['src/lib/invoice-safety.ts'], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
const { invoiceAmount, invoiceDate, amountLabel, invoiceRecordHtml } = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].contents).toString('base64')}`);
for (const value of ['', '0', '-2', '2.123', '1e3', 'Infinity', null, undefined, true, '1000000000', {}, '2.']) assert.equal(invoiceAmount(value), null, String(value));
assert.equal(invoiceAmount('12.50'), 12.5); assert.equal(invoiceAmount(2), 2); assert.equal(amountLabel('1200.5'), '1,200.50');
for (const date of ['2025-02-29', '2026-13-01', '2026-11-31', '0000-01-01', '', null]) assert.equal(invoiceDate(date), false);
assert.equal(invoiceDate('2024-02-29'), true); assert.equal(invoiceDate('2026-11-17'), true);
const html = invoiceRecordHtml({ id: '<script>alert(1)</script>', business_name: '<img src=x onerror=alert(1)>', amount: 20, status: 'Paid', due_date: '2026-11-17', created_at: '2026-11-01T12:00:00Z' });
assert(!html.includes('<script>alert')); assert(!html.includes('<img src=x')); assert(html.includes('&lt;img src=x onerror=alert(1)&gt;')); assert.match(html, /currency not verified/); assert.match(html, /not independently verified/); assert(!html.includes('Website Project')); assert(!html.includes('Total Due')); assert(!html.includes('$20')); assert(!html.includes('https://'));
console.log('PASS invoice validation, payment/currency honesty and escaped printable record.');
