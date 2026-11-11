/**
 * Text and number helpers. PURE (no Apps Script services).
 */

/**
 * Convert Arabic-Indic (U+0660-0669) and Extended/Persian (U+06F0-06F9) digits
 * to Western digits. Also maps the Arabic decimal separator (U+066B) to "."
 * and the Arabic thousands separator (U+066C) to ",".
 */
function toWesternDigits(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[٠-٩۰-۹٫٬]/g, function (ch) {
    var c = ch.charCodeAt(0);
    if (c >= 0x0660 && c <= 0x0669) return String(c - 0x0660);
    if (c >= 0x06F0 && c <= 0x06F9) return String(c - 0x06F0);
    return c === 0x066B ? '.' : ',';
  });
}

/** Western digits, no invisible marks, single spaces, trimmed. */
function cleanText(value) {
  if (value === null || value === undefined) return '';
  return toWesternDigits(String(value))
    .replace(/[​-‏‪-‮⁦-⁩﻿]/g, '')
    .replace(/[\s ]+/g, ' ')
    .trim();
}

/** "  aHMED   hassan " -> "Ahmed Hassan". */
function toTitleCase(value) {
  return cleanText(value).toLowerCase().replace(/(^|[\s\-'])([a-z])/g, function (m, sep, c) {
    return sep + c.toUpperCase();
  });
}

/** " bev 1 " / "bev_001" / "BEV001" -> "BEV-001". Unknown shapes are just upper-cased. */
function normalizeSku(value) {
  var s = cleanText(value).toUpperCase().replace(/[\s_]+/g, '-').replace(/-+/g, '-');
  var m = s.match(/^([A-Z]{2,5})-?(\d{1,4})$/);
  if (!m) return s;
  return m[1] + '-' + (m[2].length >= 3 ? m[2] : pad(Number(m[2]), 3));
}

/**
 * Parse a human-typed number: "1,250.50", "EGP 300", "12 pcs", Arabic-Indic digits.
 * Returns NaN when no clear number is present.
 */
function parseNumber(value) {
  if (typeof value === 'number') return isFinite(value) ? value : NaN;
  var s = cleanText(value).replace(/[^\d.,\-]/g, '');
  if (!/\d/.test(s)) return NaN;
  var hasComma = s.indexOf(',') >= 0;
  var hasDot = s.indexOf('.') >= 0;
  if (hasComma && hasDot) {
    s = s.replace(/,/g, '');
  } else if (hasComma) {
    s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  return Number(s);
}

/** Returns { value } or { error } for a sale quantity. */
function parseQuantity(value, maxQty) {
  var limit = maxQty || IMPORT_RULES.MAX_QTY;
  var raw = cleanText(value);
  if (raw === '') return { error: 'Missing quantity' };
  var n = parseNumber(raw);
  if (isNaN(n)) return { error: 'Quantity is not a number: "' + raw + '"' };
  if (n <= 0) return { error: 'Quantity must be greater than 0: "' + raw + '"' };
  if (n !== Math.floor(n)) return { error: 'Quantity must be a whole number: "' + raw + '"' };
  if (n > limit) return { error: 'Quantity too large (max ' + limit + '): "' + raw + '"' };
  return { value: n };
}

function round2(x) {
  return Math.round((Number(x) + Number.EPSILON) * 100) / 100;
}

/** formatMoney(1250.5, 'EGP') -> "EGP 1,250.50" */
function formatMoney(amount, currency) {
  var n = round2(amount);
  var parts = Math.abs(n).toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (n < 0 ? '-' : '') + (currency ? currency + ' ' : '') + parts.join('.');
}

function pad(n, width) {
  var s = String(n);
  while (s.length < width) s = '0' + s;
  return s;
}

function escapeHtml(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Stop imported text from becoming a live formula in Sheets ("formula injection").
 * Text starting with = + - @ gets a leading apostrophe, which Sheets shows as plain text.
 */
function sanitizeCellText(value) {
  var s = value === null || value === undefined ? '' : String(value);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function indexBy(items, key) {
  var out = {};
  (items || []).forEach(function (item) { out[item[key]] = item; });
  return out;
}
