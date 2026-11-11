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
