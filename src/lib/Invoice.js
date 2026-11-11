/**
 * Invoice numbering and invoice data. PURE (no Apps Script services).
 * Format: INV-YYYY-NNNNN, sequence restarts every calendar year.
 */

var INVOICE_PREFIX = 'INV';

function formatInvoiceNumber(year, seq) {
  return INVOICE_PREFIX + '-' + year + '-' + pad(seq, 5);
}

/** "INV-2026-00042", "inv 2026 42", "INV/2026/42" -> { year: 2026, seq: 42 }; else null. */
function parseInvoiceNumber(value) {
  var m = cleanText(value).toUpperCase().match(/^INV[\s\-_\/#]*(\d{4})[\s\-_\/]*(\d{1,6})$/);
  return m ? { year: Number(m[1]), seq: Number(m[2]) } : null;
}

/** Canonical form when recognisable, otherwise trimmed upper-case text ('' if blank). */
function normalizeInvoiceNo(value) {
  var s = cleanText(value).toUpperCase();
  if (!s) return '';
  var p = parseInvoiceNumber(s);
  return p ? formatInvoiceNumber(p.year, p.seq) : s;
}

/** Next free sequence number for a year, given all existing invoice numbers. */
function nextInvoiceSeq(existingNumbers, year) {
  var max = 0;
  (existingNumbers || []).forEach(function (n) {
    var p = parseInvoiceNumber(n);
    if (p && p.year === year && p.seq > max) max = p.seq;
  });
  return max + 1;
}

function isWalkIn(customer) {
  return !customer || /^walk[\s-]?in$/i.test(String(customer).trim());
}

/**
 * Give every row without an invoice number a new one.
 * Rows with the same date + named customer share one invoice; walk-in / blank
 * customers get one invoice per row. Returns new row objects (input untouched).
 */
function assignInvoiceNumbers(rows, existingNumbers) {
  var known = (existingNumbers || []).concat(rows.map(function (r) { return r.invoice; }).filter(Boolean));
  var nextByYear = {};
  var byGroup = {};
  return rows.map(function (r) {
    var out = {};
    Object.keys(r).forEach(function (k) { out[k] = r[k]; });
    if (out.invoice) return out;
    var groupKey = isWalkIn(out.customer) ? null : out.date + '|' + String(out.customer).toLowerCase();
    if (groupKey && byGroup[groupKey]) { out.invoice = byGroup[groupKey]; return out; }
    var year = Number(String(out.date).slice(0, 4));
    if (nextByYear[year] === undefined) nextByYear[year] = nextInvoiceSeq(known, year);
    out.invoice = formatInvoiceNumber(year, nextByYear[year]++);
    if (groupKey) byGroup[groupKey] = out.invoice;
    return out;
  });
}

/**
 * Build the data printed on one invoice.
 * lines: Sales rows { date, invoice, sku, qty, unitPrice, customer }.
 */
function buildInvoice(invoiceNo, lines, productsBySku, settings) {
  var own = lines.filter(function (l) { return l.invoice === invoiceNo; });
  if (!own.length) return null;
  var items = own.map(function (l) {
    var p = productsBySku[l.sku] || {};
    var unit = l.unitPrice !== '' && l.unitPrice !== null && l.unitPrice !== undefined && isFinite(Number(l.unitPrice))
      ? Number(l.unitPrice) : Number(p.price || 0);
    var qty = Number(l.qty) || 0;
    return { sku: l.sku, name: p.name || l.sku, qty: qty, unitPrice: unit, total: round2(qty * unit) };
  });
  var dates = own.map(function (l) { return l.date; }).sort();
  var customer = '';
  own.some(function (l) { customer = l.customer || ''; return !!customer; });
  var subtotal = round2(items.reduce(function (s, i) { return s + i.total; }, 0));
  return {
    invoiceNo: invoiceNo,
    date: dates[0],
    customer: customer || 'Walk-in',
    lines: items,
    subtotal: subtotal,
    total: subtotal,
    currency: (settings && settings.currency) || 'EGP',
    shopName: (settings && settings.shopName) || ''
  };
}

/** Safe Drive file name, e.g. "INV-2026-00042 - Demo Shop.pdf". */
function invoiceFileName(invoice) {
  var shop = String(invoice.shopName || '').replace(/[\\\/:*?"<>|]+/g, '').trim();
  return invoice.invoiceNo + (shop ? ' - ' + shop : '') + '.pdf';
}
