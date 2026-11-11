'use strict';
// Guardrail: business logic in src/lib must stay pure (no Google services),
// so it can run in Node tests and the service layer stays a thin wrapper.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { libFiles, LIB_DIR } = require('./helpers/loadLib');

const SERVICES = /\b(SpreadsheetApp|DriveApp|MailApp|GmailApp|ScriptApp|HtmlService|PropertiesService|Utilities|Session|UrlFetchApp|CacheService|LockService|Logger|Browser)\b/;

for (const file of libFiles()) {
  test(`src/lib/${file} uses no Apps Script services`, () => {
    const code = fs.readFileSync(path.join(LIB_DIR, file), 'utf8');
    const hit = code.split('\n').findIndex((line) => SERVICES.test(line) && !line.trim().startsWith('*') && !line.trim().startsWith('//'));
    assert.equal(hit, -1, `line ${hit + 1}: ${code.split('\n')[hit]}`);
  });
}
