'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadLib, plain } = require('./helpers/loadLib');

const lib = loadLib();
const AR = (s) => s.replace(/\d/g, (d) => String.fromCharCode(0x0660 + Number(d)));
const KNOWN = { 'BEV-001': true, 'SNK-002': true, 'DAI-003': true };
const OPTS = { knownSkus: KNOWN, todayIso: '2026-11-11' };

function run(rows, opts = OPTS) {
  return plain(lib.cleanSalesImport(rows, opts));
}

test('header aliases are matched case/space-insensitively', () => {
  const h = plain(lib.mapImportHeader([' Sale_Date ', 'Item Code', 'QUANTITY', 'Invoice #', 'Client']));
  assert.deepEqual(h.map, { date: 0, sku: 1, qty: 2, invoice: 3, customer: 4 });
  assert.deepEqual(h.missing, []);
});

test('missing required columns -> error, nothing imported', () => {
  const r = run([['Date', 'Product', 'Qty']]);
  assert.match(r.error, /Missing required column\(s\): sku/);
  assert.equal(r.cleaned.length, 0);
});

test('empty file -> error', () => {
  assert.match(run([]).error, /empty/);
});

test('cleans spaces, case, dates, digits and invoice numbers', () => {
  const r = run([
    ['Date', 'SKU', 'Qty', 'Invoice No', 'Customer'],
    ['  03/05/2026 ', ' bev 1 ', ' 2 ', 'inv 2026 7', '  mONA   aLI '],
    [AR('2026-05-04'), 'snk_002', AR('3'), '', ''],
    ['May 5, 2026', 'DAI003', '1 pcs', 'INV-2026-00008', 'Walk-in']
  ]);
  assert.equal(r.error, null);
  assert.deepEqual(r.cleaned, [
    { date: '2026-05-03', invoice: 'INV-2026-00007', sku: 'BEV-001', qty: 2, customer: 'Mona Ali', sourceRow: 2 },
    { date: '2026-05-04', invoice: '', sku: 'SNK-002', qty: 3, customer: '', sourceRow: 3 },
    { date: '2026-05-05', invoice: 'INV-2026-00008', sku: 'DAI-003', qty: 1, customer: 'Walk-In', sourceRow: 4 }
  ]);
  assert.equal(r.issues.length, 0);
});

test('invalid rows are rejected with every reason, others still import', () => {
  const r = run([
    ['Date', 'SKU', 'Qty'],
    ['2026-05-01', 'BEV-001', '1'],
    ['', 'BEV-001', '1'],
    ['31/02/2026', 'BEV-001', '1'],
    ['2027-01-01', 'BEV-001', '1'],
    ['2026-05-01', 'XYZ-999', '1'],
    ['2026-05-01', '', '0'],
    ['2026-05-01', 'BEV-001', 'two'],
    ['1999-12-31', 'BEV-001', '1']
  ]);
  assert.equal(r.cleaned.length, 1);
  assert.equal(r.stats.rejected, 7);
  const reasons = r.issues.map((i) => [i.rowNumber, i.type, i.reason]);
  assert.deepEqual(reasons, [
    [3, 'REJECTED', 'Missing date'],
    [4, 'REJECTED', 'Unrecognized date "31/02/2026"'],
    [5, 'REJECTED', 'Date is in the future (2027-01-01)'],
    [6, 'REJECTED', 'Unknown SKU "XYZ-999"'],
    [7, 'REJECTED', 'Missing SKU; Quantity must be greater than 0: "0"'],
    [8, 'REJECTED', 'Quantity is not a number: "two"'],
    [9, 'REJECTED', 'Date too old (1999-12-31)']
  ]);
  assert.equal(r.issues[0].raw, ' | BEV-001 | 1');
});

test('exact duplicates are detected AFTER cleaning', () => {
  const r = run([
    ['Date', 'SKU', 'Qty', 'Customer'],
    ['2026-05-01', 'BEV-001', '2', 'Mona Ali'],
    ['01/05/2026', ' bev-001', AR('2'), 'MONA  ALI'], // same sale, written differently
    ['2026-05-01', 'BEV-001', '3', 'Mona Ali'] // different qty -> not a duplicate
  ]);
  assert.equal(r.cleaned.length, 2);
  assert.equal(r.stats.duplicates, 1);
  assert.deepEqual([r.issues[0].rowNumber, r.issues[0].type, r.issues[0].reason], [3, 'DUPLICATE', 'Exact duplicate of row 2']);
});

test('rows already in the Sales sheet are skipped', () => {
  const existing = {};
  existing[lib.saleKey({ date: '2026-05-01', invoice: 'INV-2026-00001', sku: 'BEV-001', qty: 1, customer: 'Omar' })] = true;
  const r = run(
    [['Date', 'SKU', 'Qty', 'Invoice', 'Customer'], ['2026-05-01', 'BEV-001', '1', 'INV-2026-00001', 'omar'], ['2026-05-02', 'BEV-001', '1', 'INV-2026-00002', 'omar']],
    { ...OPTS, existingKeys: existing }
  );
  assert.equal(r.cleaned.length, 1);
  assert.equal(r.stats.alreadyImported, 1);
  assert.equal(r.issues[0].type, 'ALREADY_IMPORTED');
});

test('blank rows are skipped silently and counted', () => {
  const r = run([['Date', 'SKU', 'Qty'], ['', '', ''], ['  ', '', ' '], ['2026-05-01', 'BEV-001', '1']]);
  assert.equal(r.stats.blankSkipped, 2);
  assert.equal(r.stats.dataRows, 1);
  assert.match(lib.importSummaryText(r.stats), /Imported: 1 \| Rejected: 0/);
});

test('without knownSkus any SKU shape is accepted', () => {
  const r = run([['Date', 'SKU', 'Qty'], ['2026-05-01', 'new-1', '1']], { todayIso: '2026-11-11' });
  assert.equal(r.cleaned[0].sku, 'NEW-001');
});

test('samples/messy_sales.csv cleans to the documented counts', () => {
  const csv = fs.readFileSync(path.join(__dirname, '..', 'samples', 'messy_sales.csv'), 'utf8');
  const seed = lib.generateSeedData();
  const known = {};
  seed.products.forEach((p) => { known[p.sku] = true; });
  const r = plain(lib.cleanSalesImport(lib.parseCsv(csv), { knownSkus: known, todayIso: '2026-11-11' }));
  assert.equal(r.error, null);
  assert.deepEqual(r.stats, { dataRows: 30, cleaned: 20, rejected: 7, duplicates: 3, alreadyImported: 0, blankSkipped: 2 });
});
