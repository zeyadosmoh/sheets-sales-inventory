'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLib, plain } = require('./helpers/loadLib');

const lib = loadLib();

test('computeOnHand = opening + purchases - sold, tolerating blanks', () => {
  assert.equal(lib.computeOnHand(50, 20, 65), 5);
  assert.equal(lib.computeOnHand('', 10, 3), 7);
  assert.equal(lib.computeOnHand(5, 0, 9), -4);
});

test('inventoryStatus boundaries', () => {
  assert.equal(lib.inventoryStatus(0, 10), 'OUT');
  assert.equal(lib.inventoryStatus(-3, 10), 'OUT');
  assert.equal(lib.inventoryStatus(1, 10), 'LOW');
  assert.equal(lib.inventoryStatus(10, 10), 'LOW'); // at reorder level -> LOW
  assert.equal(lib.inventoryStatus(11, 10), 'OK');
  assert.equal(lib.inventoryStatus(1, 0), 'OK');
  assert.equal(lib.inventoryStatus('', 5), 'OUT');
});

test('soldBySku sums quantities', () => {
  assert.deepEqual(plain(lib.soldBySku([{ sku: 'A', qty: 2 }, { sku: 'B', qty: 1 }, { sku: 'A', qty: '3' }])), { A: 5, B: 1 });
});

test('lowStockItems: only LOW/OUT, OUT first then lowest stock', () => {
  const rows = [
    { sku: 'A', name: 'a', onHand: 50, reorderLevel: 10 },
    { sku: 'B', name: 'b', onHand: 8, reorderLevel: 10 },
    { sku: 'C', name: 'c', onHand: 0, reorderLevel: 10 },
    { sku: 'D', name: 'd', onHand: 3, reorderLevel: 10 }
  ];
  assert.deepEqual(plain(lib.lowStockItems(rows)).map((r) => [r.sku, r.status]), [['C', 'OUT'], ['D', 'LOW'], ['B', 'LOW']]);
  assert.deepEqual(plain(lib.lowStockItems([])), []);
});
