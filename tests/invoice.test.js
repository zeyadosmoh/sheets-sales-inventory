'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLib, plain } = require('./helpers/loadLib');

const lib = loadLib();

test('format / parse / normalize invoice numbers', () => {
  assert.equal(lib.formatInvoiceNumber(2026, 42), 'INV-2026-00042');
  assert.deepEqual(plain(lib.parseInvoiceNumber('inv 2026 42')), { year: 2026, seq: 42 });
  assert.deepEqual(plain(lib.parseInvoiceNumber('INV/2026/00042')), { year: 2026, seq: 42 });
  assert.equal(lib.parseInvoiceNumber('ORDER-12'), null);
  assert.equal(lib.normalizeInvoiceNo(' inv-2026-7 '), 'INV-2026-00007');
  assert.equal(lib.normalizeInvoiceNo(' po 778 '), 'PO 778');
  assert.equal(lib.normalizeInvoiceNo(''), '');
});

test('nextInvoiceSeq is per year and ignores junk', () => {
  const existing = ['INV-2026-00003', 'INV-2026-00010', 'INV-2025-00099', 'ORDER-5', ''];
  assert.equal(lib.nextInvoiceSeq(existing, 2026), 11);
  assert.equal(lib.nextInvoiceSeq(existing, 2025), 100);
  assert.equal(lib.nextInvoiceSeq(existing, 2027), 1);
  assert.equal(lib.nextInvoiceSeq([], 2026), 1);
});

test('assignInvoiceNumbers groups named customers per day, walk-ins get one each', () => {
  const rows = [
    { date: '2026-05-01', invoice: '', sku: 'A', qty: 1, customer: 'Mona Ali' },
    { date: '2026-05-01', invoice: '', sku: 'B', qty: 1, customer: 'mona ali' },
    { date: '2026-05-01', invoice: '', sku: 'C', qty: 1, customer: 'Walk-in' },
    { date: '2026-05-01', invoice: '', sku: 'D', qty: 1, customer: '' },
    { date: '2026-05-02', invoice: '', sku: 'A', qty: 1, customer: 'Mona Ali' },
    { date: '2026-05-02', invoice: 'INV-2026-00020', sku: 'B', qty: 1, customer: 'Omar' },
    { date: '2027-01-01', invoice: '', sku: 'A', qty: 1, customer: 'Omar' }
  ];
  const out = plain(lib.assignInvoiceNumbers(rows, ['INV-2026-00005']));
  // Existing max is 20 (from the import itself), so new 2026 numbers start at 21.
  assert.deepEqual(out.map((r) => r.invoice), [
    'INV-2026-00021', 'INV-2026-00021', 'INV-2026-00022', 'INV-2026-00023', 'INV-2026-00024', 'INV-2026-00020', 'INV-2027-00001'
  ]);
  assert.equal(rows[0].invoice, '', 'input rows are not mutated');
});

test('buildInvoice totals lines and uses stored unit price', () => {
  const productsBySku = { A: { name: 'Apple', price: 10 }, B: { name: 'Bread', price: 5 } };
  const lines = [
    { date: '2026-05-02', invoice: 'INV-2026-00001', sku: 'A', qty: 3, unitPrice: 9.5, customer: '' },
    { date: '2026-05-02', invoice: 'INV-2026-00001', sku: 'B', qty: 2, unitPrice: '', customer: 'Mona Ali' },
    { date: '2026-05-02', invoice: 'INV-2026-00002', sku: 'B', qty: 9, unitPrice: 5, customer: 'Other' }
  ];
  const inv = plain(lib.buildInvoice('INV-2026-00001', lines, productsBySku, { currency: 'EGP', shopName: 'Demo Shop' }));
  assert.equal(inv.customer, 'Mona Ali');
  assert.equal(inv.date, '2026-05-02');
  assert.deepEqual(inv.lines, [
    { sku: 'A', name: 'Apple', qty: 3, unitPrice: 9.5, total: 28.5 },
    { sku: 'B', name: 'Bread', qty: 2, unitPrice: 5, total: 10 }
  ]);
  assert.equal(inv.total, 38.5);
  assert.equal(lib.invoiceFileName(inv), 'INV-2026-00001 - Demo Shop.pdf');
  assert.equal(lib.buildInvoice('INV-2026-09999', lines, productsBySku, {}), null);
});

// ---------- buildInvoiceHtml ----------

function htmlFixture(customer) {
  const productsBySku = {
    A: { name: 'Apple', price: 10 },
    B: { name: 'Bread', price: 5 },
    C: { name: 'Cheese & Crackers', price: 1250 }
  };
  const lines = [
    { date: '2026-11-03', invoice: 'INV-2026-00042', sku: 'A', qty: 3, unitPrice: 9.5, customer },
    { date: '2026-11-03', invoice: 'INV-2026-00042', sku: 'B', qty: 2, unitPrice: '', customer },
    { date: '2026-11-03', invoice: 'INV-2026-00042', sku: 'C', qty: 8, unitPrice: 1250, customer }
  ];
  const settings = { currency: 'EGP', shopName: 'Demo Shop (synthetic)' };
  const invoice = lib.buildInvoice('INV-2026-00042', lines, productsBySku, settings);
  return { invoice, settings, html: lib.buildInvoiceHtml(invoice, settings) };
}

test('buildInvoiceHtml shows invoice no, date, customer and shop name', () => {
  const { html } = htmlFixture('Mona Ali');
  assert.match(html, /^<!DOCTYPE html>/);
  assert.ok(html.includes('INV-2026-00042'));
  assert.ok(html.includes('2026-11-03'));
  assert.ok(html.includes('Mona Ali'));
  assert.ok(html.includes('Demo Shop (synthetic)'));
  assert.ok(html.includes('size: A4'), 'A4 print CSS');
});

test('buildInvoiceHtml lists every line with qty, unit price and line total', () => {
  const { html } = htmlFixture('Mona Ali');
  const rows = html.split('\n').filter((l) => l.startsWith('<tr><td>'));
  assert.equal(rows.length, 3, 'one table row per invoice line');
  assert.ok(rows[0].includes('>A<') && rows[0].includes('Apple') && rows[0].includes('>3<') &&
    rows[0].includes('EGP 9.50') && rows[0].includes('EGP 28.50'));
  assert.ok(rows[1].includes('Bread') && rows[1].includes('EGP 5.00') && rows[1].includes('EGP 10.00'));
  // Product names are escaped too.
  assert.ok(rows[2].includes('Cheese &amp; Crackers') && rows[2].includes('EGP 1,250.00') && rows[2].includes('EGP 10,000.00'));
});

test('buildInvoiceHtml prints the correct total', () => {
  const { invoice, html } = htmlFixture('Mona Ali');
  assert.equal(invoice.total, 10038.5);
  const totalRow = html.split('\n').find((l) => l.startsWith('<tr class="total">'));
  assert.ok(totalRow.includes('EGP 10,038.50'), totalRow);
});

test('buildInvoiceHtml escapes injected HTML in the customer name', () => {
  const evil = '<script>alert("x")</script><img src=x onerror=alert(1)>';
  const { html } = htmlFixture(evil);
  assert.ok(!html.includes('<script>'), 'no raw script tag');
  assert.ok(!html.includes('<img'), 'no raw img tag');
  assert.ok(html.includes('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&lt;img src=x onerror=alert(1)&gt;'));
});

test('buildInvoiceHtml carries the synthetic-data label', () => {
  const { html } = htmlFixture('');
  assert.ok(html.includes('Synthetic sample data - not a real business'));
  assert.ok(html.includes('Walk-in'), 'blank customer prints as Walk-in');
});
