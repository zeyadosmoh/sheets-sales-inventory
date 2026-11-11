'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLib, plain } = require('./helpers/loadLib');

const lib = loadLib();
const data = plain(lib.generateSeedData());

test('deterministic: same seed -> identical data, different seed -> different', () => {
  assert.deepEqual(plain(lib.generateSeedData()), data);
  assert.notDeepEqual(plain(lib.generateSeedData({ seed: 7 })).sales, data.sales);
});

test('40 products with unique SKUs and sane prices', () => {
  assert.equal(data.products.length, 40);
  assert.equal(new Set(data.products.map((p) => p.sku)).size, 40);
  for (const p of data.products) {
    assert.match(p.sku, /^[A-Z]{3}-\d{3}$/);
    assert.ok(p.cost > 0 && p.cost < p.price, `${p.sku} cost < price`);
    assert.ok(p.reorderLevel >= 10 && p.reorderLevel <= 30);
  }
});

test('1,500 sales lines over 6 months with valid SKUs and invoices', () => {
  assert.equal(data.sales.length, 1500);
  const skus = new Set(data.products.map((p) => p.sku));
  const dates = data.sales.map((s) => s.date);
  assert.equal([...dates].sort()[0] >= '2026-05-01', true);
  assert.equal([...dates].sort().pop() <= '2026-10-31', true);
  assert.equal(new Set(dates.map((d) => d.slice(0, 7))).size, 6);
  for (const s of data.sales) {
    assert.ok(skus.has(s.sku));
    assert.ok(Number.isInteger(s.qty) && s.qty >= 1 && s.qty <= 5);
    assert.match(s.invoice, /^INV-2026-\d{5}$/);
  }
  // Invoice numbers increase with date (no gaps).
  const invoices = [...new Set(data.sales.map((s) => s.invoice))];
  invoices.forEach((inv, i) => assert.equal(inv, lib.formatInvoiceNumber(2026, i + 1)));
});

test('stock ends with exactly 1 OUT, 3 LOW, and several near reorder', () => {
  const sold = plain(lib.soldBySku(data.sales));
  const bySku = Object.fromEntries(data.products.map((p) => [p.sku, p]));
  const statuses = data.inventory.map((r) => {
    assert.ok(r.opening >= 0 && r.purchases >= 0);
    const onHand = lib.computeOnHand(r.opening, r.purchases, sold[r.sku] || 0);
    return { onHand, reorder: bySku[r.sku].reorderLevel, status: lib.inventoryStatus(onHand, bySku[r.sku].reorderLevel) };
  });
  assert.equal(statuses.filter((s) => s.status === 'OUT').length, 1);
  assert.equal(statuses.filter((s) => s.status === 'LOW').length, 3);
  const near = statuses.filter((s) => s.status === 'OK' && s.onHand - s.reorder <= 3);
  assert.ok(near.length >= 3, 'some products sit just above reorder level');
});
