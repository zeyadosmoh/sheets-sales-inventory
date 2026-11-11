'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLib } = require('./helpers/loadLib');

const lib = loadLib();

// Arabic-Indic digits are written as \u escapes so the source stays ASCII.
const AR = (s) => s.replace(/\d/g, (d) => String.fromCharCode(0x0660 + Number(d)));
const FA = (s) => s.replace(/\d/g, (d) => String.fromCharCode(0x06f0 + Number(d)));

test('toWesternDigits converts Arabic-Indic and Persian digits', () => {
  assert.equal(lib.toWesternDigits(AR('2026')), '2026');
  assert.equal(lib.toWesternDigits(FA('0123456789')), '0123456789');
  assert.equal(lib.toWesternDigits(AR('12') + '٫' + AR('5')), '12.5'); // Arabic decimal separator
  assert.equal(lib.toWesternDigits(AR('1') + '٬' + AR('250')), '1,250'); // Arabic thousands separator
  assert.equal(lib.toWesternDigits('BEV-' + AR('007')), 'BEV-007');
  assert.equal(lib.toWesternDigits(null), '');
});

test('cleanText trims, collapses spaces and removes invisible marks', () => {
  assert.equal(lib.cleanText('  Mango \t  Juice 1L  '), 'Mango Juice 1L');
  assert.equal(lib.cleanText('﻿‏SKU​'), 'SKU');
  assert.equal(lib.cleanText(undefined), '');
});

test('toTitleCase unifies case', () => {
  assert.equal(lib.toTitleCase('  aHMED   hassan '), 'Ahmed Hassan');
  assert.equal(lib.toTitleCase('WALK-IN'), 'Walk-In');
  assert.equal(lib.toTitleCase(''), '');
});

test('normalizeSku fixes case, spaces, separators and padding', () => {
  assert.equal(lib.normalizeSku(' bev-001 '), 'BEV-001');
  assert.equal(lib.normalizeSku('bev 1'), 'BEV-001');
  assert.equal(lib.normalizeSku('BEV001'), 'BEV-001');
  assert.equal(lib.normalizeSku('snk_07'), 'SNK-007');
  assert.equal(lib.normalizeSku('dai-' + AR('3')), 'DAI-003');
  assert.equal(lib.normalizeSku('weird item'), 'WEIRD-ITEM');
  assert.equal(lib.normalizeSku(''), '');
});

test('parseNumber handles separators, currency text and Arabic digits', () => {
  assert.equal(lib.parseNumber('1,250.50'), 1250.5);
  assert.equal(lib.parseNumber('1,250'), 1250);
  assert.equal(lib.parseNumber('12,5'), 12.5);
  assert.equal(lib.parseNumber('EGP 300'), 300);
  assert.equal(lib.parseNumber('12 pcs'), 12);
  assert.equal(lib.parseNumber(AR('45')), 45);
  assert.equal(lib.parseNumber(7), 7);
  assert.ok(Number.isNaN(lib.parseNumber('two')));
  assert.ok(Number.isNaN(lib.parseNumber('')));
  assert.ok(Number.isNaN(lib.parseNumber('1-2')));
});

test('parseQuantity accepts positive whole numbers only', () => {
  assert.equal(lib.parseQuantity('3').value, 3);
  assert.equal(lib.parseQuantity(AR('4')).value, 4);
  assert.match(lib.parseQuantity('').error, /Missing quantity/);
  assert.match(lib.parseQuantity('0').error, /greater than 0/);
  assert.match(lib.parseQuantity('-2').error, /greater than 0/);
  assert.match(lib.parseQuantity('1.5').error, /whole number/);
  assert.match(lib.parseQuantity('abc').error, /not a number/);
  assert.match(lib.parseQuantity('20000').error, /too large/);
});

test('formatMoney and round2', () => {
  assert.equal(lib.formatMoney(1250.5, 'EGP'), 'EGP 1,250.50');
  assert.equal(lib.formatMoney(0, 'EGP'), 'EGP 0.00');
  assert.equal(lib.formatMoney(-1234567.891, ''), '-1,234,567.89');
  assert.equal(lib.round2(1.005), 1.01);
  assert.equal(lib.round2(0.1 + 0.2), 0.3);
});

test('sanitizeCellText neutralizes formula injection', () => {
  assert.equal(lib.sanitizeCellText('=IMPORTXML("http://x","//a")'), '\'=IMPORTXML("http://x","//a")');
  assert.equal(lib.sanitizeCellText('+20 100'), "'+20 100");
  assert.equal(lib.sanitizeCellText('-5'), "'-5");
  assert.equal(lib.sanitizeCellText('@user'), "'@user");
  assert.equal(lib.sanitizeCellText('Mona Ali'), 'Mona Ali');
  assert.equal(lib.sanitizeCellText(null), '');
});

test('escapeHtml escapes markup', () => {
  assert.equal(lib.escapeHtml('<a href="x">O\'Brien & co</a>'), '&lt;a href=&quot;x&quot;&gt;O&#39;Brien &amp; co&lt;/a&gt;');
});
