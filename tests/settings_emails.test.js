'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLib, plain } = require('./helpers/loadLib');

const lib = loadLib();

test('parseSettings: defaults, valid values, and errors fall back to defaults', () => {
  const ok = plain(lib.parseSettings([
    ['Shop name', '  My Shop '], ['Owner email', 'Owner@Example.com'], ['Alert hour (0-23)', '٩'],
    ['Currency', 'usd'], ['Weekly summary day', 'monday']
  ]));
  assert.deepEqual(ok.errors, []);
  assert.deepEqual(ok.values, { shopName: 'My Shop', ownerEmail: 'owner@example.com', alertHour: 9, currency: 'USD', weeklyDay: 'MONDAY' });

  const bad = plain(lib.parseSettings([['Owner email', 'nope'], ['Alert hour (0-23)', '25'], ['Currency', 'pounds'], ['Weekly summary day', 'someday']]));
  assert.equal(bad.errors.length, 4);
  assert.deepEqual(bad.values, plain(lib.defaultSettings()));
});

test('placeholder email detection', () => {
  assert.equal(lib.isPlaceholderEmail('owner@example.com'), true);
  assert.equal(lib.isPlaceholderEmail('shop@mail.example'), true);
  assert.equal(lib.isPlaceholderEmail('owner@shop.test'), false);
});

const settings = { shopName: 'Demo Shop', currency: 'EGP' };

test('low-stock email: null when nothing to report', () => {
  assert.equal(lib.buildLowStockEmail([], settings, 'https://x', '2026-11-11'), null);
});

test('low-stock email lists items and escapes HTML', () => {
  const mail = plain(lib.buildLowStockEmail([
    { sku: 'A', name: 'Milk <1L>', onHand: 0, reorderLevel: 10, status: 'OUT' },
    { sku: 'B', name: 'Bread', onHand: 4, reorderLevel: 10, status: 'LOW' }
  ], settings, 'https://sheet', '2026-11-11'));
  assert.equal(mail.subject, '[Demo Shop] Stock alert: 2 item(s) need reordering (1 out of stock)');
  assert.match(mail.body, /OUT {2}A {2}Milk <1L> {2}on hand: 0/);
  assert.match(mail.htmlBody, /Milk &lt;1L&gt;/);
  assert.match(mail.body, /Synthetic sample data/);
});

test('weekly summary email shows KPIs and top products', () => {
  const kpis = { revenue: 1250.5, orders: 10, avgOrderValue: 125.05, unitsSold: 30, topProducts: [{ name: 'Apple', revenue: 500 }] };
  const mail = plain(lib.buildWeeklySummaryEmail(kpis, settings, 'https://sheet', '2026-11-02', '2026-11-08', 4));
  assert.equal(mail.subject, '[Demo Shop] Weekly summary 2026-11-02 to 2026-11-08');
  assert.match(mail.body, /Revenue: EGP 1,250.50/);
  assert.match(mail.body, /Low \/ out of stock items: 4/);
  assert.match(mail.body, /1\. Apple - EGP 500.00/);
  assert.match(mail.htmlBody, /href="https:\/\/sheet"/);
});
