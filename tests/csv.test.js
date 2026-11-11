'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLib, plain } = require('./helpers/loadLib');

const lib = loadLib();
const parse = (text, d) => plain(lib.parseCsv(text, d));

test('basic comma CSV with CRLF and trailing newline', () => {
  assert.deepEqual(parse('a,b\r\n1,2\r\n'), [['a', 'b'], ['1', '2']]);
});

test('quoted fields with commas, quotes and newlines', () => {
  assert.deepEqual(parse('name,note\n"Doe, Jane","said ""hi""\nthen left"\n'), [
    ['name', 'note'],
    ['Doe, Jane', 'said "hi"\nthen left']
  ]);
});

test('BOM is removed and empty fields kept', () => {
  assert.deepEqual(parse('﻿a,b,c\n1,,3'), [['a', 'b', 'c'], ['1', '', '3']]);
});

test('auto-detects semicolon and tab delimiters', () => {
  assert.equal(lib.detectDelimiter('date;sku;qty\n1,5;x;2'), ';');
  assert.equal(lib.detectDelimiter('date\tsku\tqty'), '\t');
  assert.deepEqual(parse('date;sku\n2026-05-01;BEV-001'), [['date', 'sku'], ['2026-05-01', 'BEV-001']]);
});

test('old Mac CR line endings and empty input', () => {
  assert.deepEqual(parse('a,b\r1,2'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(parse(''), []);
});
