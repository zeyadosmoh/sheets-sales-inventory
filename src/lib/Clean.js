/**
 * Clean and validate an imported sales CSV. PURE (no Apps Script services).
 *
 * Input: rows from parseCsv (first row = header).
 * Output: { error, cleaned[], issues[], stats }
 *   cleaned: { date, invoice, sku, qty, customer, sourceRow }
 *   issues:  { rowNumber, type: REJECTED|DUPLICATE|ALREADY_IMPORTED, reason, raw }
 */

var IMPORT_FIELD_ALIASES = {
  date: ['date', 'sale date', 'order date', 'invoice date', 'day'],
  sku: ['sku', 'product sku', 'item code', 'product code', 'code', 'item'],
  qty: ['qty', 'quantity', 'units', 'qnty', 'pcs'],
  invoice: ['invoice', 'invoice no', 'invoice number', 'invoice #', 'invoice id', 'inv', 'inv no'],
  customer: ['customer', 'customer name', 'client', 'buyer']
};
var IMPORT_REQUIRED = ['date', 'sku', 'qty'];

function normalizeHeaderName(h) {
  return cleanText(h).toLowerCase().replace(/[_.:]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Map header cells to field indexes. Returns { map: {field: index}, missing: [field] }. */
function mapImportHeader(headerRow) {
  var map = {};
  (headerRow || []).forEach(function (h, i) {
    var name = normalizeHeaderName(h);
    Object.keys(IMPORT_FIELD_ALIASES).forEach(function (field) {
      if (map[field] === undefined && IMPORT_FIELD_ALIASES[field].indexOf(name) >= 0) map[field] = i;
    });
  });
  var missing = IMPORT_REQUIRED.filter(function (f) { return map[f] === undefined; });
  return { map: map, missing: missing };
}

/** Identity of a sale line for duplicate detection (after cleaning). */
function saleKey(r) {
  return [r.date, r.invoice || '', r.sku, r.qty, String(r.customer || '').toLowerCase()].join('|');
}

/**
 * options:
 *   knownSkus     { 'BEV-001': true, ... }  rows with other SKUs are rejected
 *   todayIso      'YYYY-MM-DD'              rows dated after this are rejected
 *   existingKeys  { saleKey: true }         rows already in the Sales sheet are skipped
 */
function cleanSalesImport(rows, options) {
  var opts = options || {};
  var known = opts.knownSkus || null;
  var existing = opts.existingKeys || {};
  var result = {
    error: null,
    cleaned: [],
    issues: [],
    stats: { dataRows: 0, cleaned: 0, rejected: 0, duplicates: 0, alreadyImported: 0, blankSkipped: 0 }
  };
  if (!rows || !rows.length) { result.error = 'The file is empty.'; return result; }

  var header = mapImportHeader(rows[0]);
  if (header.missing.length) {
    result.error = 'Missing required column(s): ' + header.missing.join(', ') +
      '. Expected a header row like: Date, SKU, Qty, Invoice No, Customer.';
    return result;
  }
  var map = header.map;
  var seen = {};

  for (var i = 1; i < rows.length; i++) {
    var raw = rows[i] || [];
    var rowNumber = i + 1; // 1-based, header is row 1
    if (raw.every(function (c) { return cleanText(c) === ''; })) { result.stats.blankSkipped++; continue; }
    result.stats.dataRows++;

    var get = function (f) { return map[f] === undefined ? '' : raw[map[f]]; };
    var reasons = [];

    var dateRaw = cleanText(get('date'));
    var date = null;
    if (!dateRaw) {
      reasons.push('Missing date');
    } else {
      date = parseFlexibleDate(dateRaw);
      if (!date) reasons.push('Unrecognized date "' + dateRaw + '"');
      else if (date < IMPORT_RULES.MIN_DATE) reasons.push('Date too old (' + date + ')');
      else if (opts.todayIso && date > opts.todayIso) reasons.push('Date is in the future (' + date + ')');
    }

    var sku = normalizeSku(get('sku'));
    if (!sku) reasons.push('Missing SKU');
    else if (known && !known[sku]) reasons.push('Unknown SKU "' + sku + '"');

    var q = parseQuantity(get('qty'));
    if (q.error) reasons.push(q.error);

    var rawText = raw.map(function (c) { return String(c); }).join(' | ');
    if (reasons.length) {
      result.issues.push({ rowNumber: rowNumber, type: 'REJECTED', reason: reasons.join('; '), raw: rawText });
      result.stats.rejected++;
      continue;
    }

    var rec = {
      date: date,
      invoice: normalizeInvoiceNo(get('invoice')),
      sku: sku,
      qty: q.value,
      customer: toTitleCase(get('customer')),
      sourceRow: rowNumber
    };
    var key = saleKey(rec);
    if (seen[key]) {
      result.issues.push({ rowNumber: rowNumber, type: 'DUPLICATE', reason: 'Exact duplicate of row ' + seen[key], raw: rawText });
      result.stats.duplicates++;
      continue;
    }
    seen[key] = rowNumber;
    if (existing[key]) {
      result.issues.push({ rowNumber: rowNumber, type: 'ALREADY_IMPORTED', reason: 'Same sale already exists in Sales', raw: rawText });
      result.stats.alreadyImported++;
      continue;
    }
    result.cleaned.push(rec);
  }
  result.stats.cleaned = result.cleaned.length;
  return result;
}

/** One-paragraph summary for the dialog / log. */
function importSummaryText(stats) {
  return 'Rows read: ' + stats.dataRows +
    ' | Imported: ' + stats.cleaned +
    ' | Rejected: ' + stats.rejected +
    ' | Duplicates dropped: ' + stats.duplicates +
    ' | Already in Sales: ' + stats.alreadyImported +
    ' | Blank rows skipped: ' + stats.blankSkipped;
}
