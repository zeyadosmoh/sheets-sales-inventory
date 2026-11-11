'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLib } = require('./helpers/loadLib');

const lib = loadLib();
const AR = (s) => s.replace(/\d/g, (d) => String.fromCharCode(0x0660 + Number(d)));

test('tests run in the script timezone (Africa/Cairo)', () => {
  assert.equal(Intl.DateTimeFormat().resolvedOptions().timeZone, 'Africa/Cairo');
});

test('ISO-like formats', () => {
  assert.equal(lib.parseFlexibleDate('2026-05-03'), '2026-05-03');
  assert.equal(lib.parseFlexibleDate('2026/5/3'), '2026-05-03');
  assert.equal(lib.parseFlexibleDate('2026.05.03'), '2026-05-03');
  assert.equal(lib.parseFlexibleDate('20260503'), '2026-05-03');
  assert.equal(lib.parseFlexibleDate('2026-05-03 14:30'), '2026-05-03');
  assert.equal(lib.parseFlexibleDate('2026-05-03T23:59:00Z'), '2026-05-03');
});

test('day-first numeric dates (Egypt default), with auto-swap when unambiguous', () => {
  assert.equal(lib.parseFlexibleDate('03/05/2026'), '2026-05-03'); // ambiguous -> day first
  assert.equal(lib.parseFlexibleDate('3-5-26'), '2026-05-03');
  assert.equal(lib.parseFlexibleDate('25/12/2026'), '2026-12-25'); // only valid as d/m
  assert.equal(lib.parseFlexibleDate('12/25/2026'), '2026-12-25'); // only valid as m/d
  assert.equal(lib.parseFlexibleDate('03/05/2026', { dayFirst: false }), '2026-03-05');
  assert.equal(lib.parseFlexibleDate('3/5/2026 2:30 pm'), '2026-05-03');
});

test('month-name formats', () => {
  assert.equal(lib.parseFlexibleDate('3 May 2026'), '2026-05-03');
  assert.equal(lib.parseFlexibleDate('03-may-26'), '2026-05-03');
  assert.equal(lib.parseFlexibleDate('May 3, 2026'), '2026-05-03');
  assert.equal(lib.parseFlexibleDate('September 21st 2026'), '2026-09-21');
  assert.equal(lib.parseFlexibleDate('21 Sept 2026'), '2026-09-21');
});

test('Arabic-Indic digits in dates', () => {
  assert.equal(lib.parseFlexibleDate(AR('2026-05-03')), '2026-05-03');
  assert.equal(lib.parseFlexibleDate(AR('03/05/2026')), '2026-05-03');
});

test('Sheets serial numbers and Date objects', () => {
  assert.equal(lib.parseFlexibleDate(46145), '2026-05-03');
  assert.equal(lib.parseFlexibleDate('46145'), '2026-05-03');
  // Local midnight in Cairo must stay the same calendar day.
  assert.equal(lib.parseFlexibleDate(new Date(2026, 4, 3)), '2026-05-03');
  assert.equal(lib.parseFlexibleDate(new Date(2026, 4, 3, 23, 59)), '2026-05-03');
  assert.equal(lib.parseFlexibleDate(new Date('invalid')), null);
});

test('invalid dates return null', () => {
  for (const bad of ['', null, undefined, 'tomorrow', '31/02/2026', '2026-13-01', '13/13/2026', '32 May 2026', 'Foo 3 2026', '12345678', 5]) {
    assert.equal(lib.parseFlexibleDate(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
});

test('leap years', () => {
  assert.equal(lib.parseFlexibleDate('29/02/2028'), '2028-02-29');
  assert.equal(lib.parseFlexibleDate('29/02/2026'), null);
});

test('ISO helpers', () => {
  assert.equal(lib.addDaysIso('2026-10-30', 3), '2026-11-02');
  assert.equal(lib.addDaysIso('2026-03-01', -1), '2026-02-28');
  assert.equal(lib.daysBetweenIso('2026-05-01', '2026-10-31'), 183);
  assert.equal(lib.monthLabel('2026-05'), 'May 2026');
});
