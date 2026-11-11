'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLib, plain } = require('./helpers/loadLib');

const lib = loadLib();

const products = [
  { sku: 'A', name: 'Apple', category: 'Fruit', cost: 6, price: 10 },
  { sku: 'B', name: 'Bread', category: 'Bakery', cost: 3, price: 5 },
  { sku: 'C', name: 'Cheese', category: 'Dairy', cost: 20, price: 30 }
];
const sales = [
  { date: '2026-05-01', invoice: 'INV-2026-00001', sku: 'A', qty: 2, unitPrice: 10 }, // 20
  { date: '2026-05-01', invoice: 'INV-2026-00001', sku: 'B', qty: 1, unitPrice: 5 }, // 5
  { date: '2026-05-20', invoice: 'INV-2026-00002', sku: 'C', qty: 1, unitPrice: 28 }, // 28 (discounted)
  { date: '2026-06-02', invoice: 'INV-2026-00003', sku: 'A', qty: 3, unitPrice: '' }, // 30 (falls back to price)
  { date: '2026-06-03', invoice: '', sku: 'B', qty: 4, unitPrice: 5 } // 20, no invoice -> own order
];

test('headline KPIs', () => {
  const k = plain(lib.computeKpis(sales, products));
  assert.equal(k.revenue, 103);
  assert.equal(k.orders, 4);
  assert.equal(k.avgOrderValue, 25.75);
  assert.equal(k.unitsSold, 11);
  // cost = 2*6 + 1*3 + 1*20 + 3*6 + 4*3 = 65
  assert.equal(k.grossProfit, 38);
  assert.equal(k.marginPct, 0.369);
});

test('revenue by month, by category, and top products', () => {
  const k = plain(lib.computeKpis(sales, products, { topN: 2 }));
  assert.deepEqual(k.revenueByMonth, [
    { month: '2026-05', label: 'May 2026', revenue: 53 },
    { month: '2026-06', label: 'Jun 2026', revenue: 50 }
  ]);
  assert.deepEqual(k.revenueByCategory, [
    { category: 'Fruit', revenue: 50 },
    { category: 'Dairy', revenue: 28 },
    { category: 'Bakery', revenue: 25 }
  ]);
  assert.deepEqual(k.topProducts, [
    { sku: 'A', name: 'Apple', units: 5, revenue: 50 },
    { sku: 'C', name: 'Cheese', units: 1, revenue: 28 }
  ]);
});

test('no sales -> zeros, no division by zero', () => {
  const k = plain(lib.computeKpis([], products));
  assert.equal(k.revenue, 0);
  assert.equal(k.orders, 0);
  assert.equal(k.avgOrderValue, 0);
  assert.equal(k.marginPct, 0);
  assert.deepEqual(k.topProducts, []);
});

test('unknown SKU counts revenue under "Unknown"; zero qty ignored', () => {
  const k = plain(lib.computeKpis([
    { date: '2026-05-01', invoice: 'X', sku: 'Z', qty: 1, unitPrice: 7 },
    { date: '2026-05-01', invoice: 'Y', sku: 'A', qty: 0, unitPrice: 10 }
  ], products));
  assert.equal(k.revenue, 7);
  assert.equal(k.orders, 1);
  assert.deepEqual(k.revenueByCategory, [{ category: 'Unknown', revenue: 7 }]);
});

test('filterSalesByDate is inclusive', () => {
  assert.equal(lib.filterSalesByDate(sales, '2026-05-20', '2026-06-02').length, 2);
  assert.equal(lib.filterSalesByDate(sales, null, '2026-05-01').length, 2);
});

test('unfinished month is labelled "(to date)" when todayIso is given', () => {
  const nov = sales.concat([{ date: '2026-11-02', invoice: 'INV-2026-00009', sku: 'A', qty: 1, unitPrice: 10 }]);
  const labels = plain(lib.computeKpis(nov, products, { todayIso: '2026-11-11' })).revenueByMonth.map((m) => m.label);
  assert.deepEqual(labels, ['May 2026', 'Jun 2026', 'Nov 2026 (to date)']);
  // Last day of the month is still "to date"; the next day the month is complete.
  assert.equal(lib.monthLabelAsOf('2026-11', '2026-11-30'), 'Nov 2026 (to date)');
  assert.equal(lib.monthLabelAsOf('2026-11', '2026-12-01'), 'Nov 2026');
  // Without todayIso nothing changes (backwards compatible).
  assert.equal(lib.monthLabelAsOf('2026-11'), 'Nov 2026');
});
