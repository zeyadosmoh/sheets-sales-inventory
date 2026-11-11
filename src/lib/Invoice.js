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

/**
 * Printable invoice as a standalone HTML page (A4). PURE.
 * Every piece of data text goes through escapeHtml. Converted to PDF by the
 * service layer (HTML blob -> application/pdf).
 */
function buildInvoiceHtml(invoice, settings) {
  var cur = (invoice && invoice.currency) || (settings && settings.currency) || '';
  var shop = (invoice && invoice.shopName) || (settings && settings.shopName) || '';
  var money = function (n) { return escapeHtml(formatMoney(n, cur)); };
  var rows = invoice.lines.map(function (l) {
    return '<tr><td>' + escapeHtml(l.sku) + '</td><td>' + escapeHtml(l.name) + '</td>' +
      '<td class="num">' + escapeHtml(l.qty) + '</td><td class="num">' + money(l.unitPrice) + '</td>' +
      '<td class="num">' + money(l.total) + '</td></tr>';
  }).join('\n');
  return [
    '<!DOCTYPE html>',
    '<html><head><meta charset="utf-8"><title>' + escapeHtml(invoice.invoiceNo) + '</title>',
    '<style>',
    '@page { size: A4; margin: 18mm; }',
    'body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #202124; }',
    'h1 { font-size: 20pt; margin: 0 0 2pt 0; }',
    '.doc { font-size: 12pt; color: #555555; letter-spacing: 2pt; margin: 0 0 4pt 0; }',
    '.synthetic { font-style: italic; color: #888888; font-size: 9pt; margin: 0 0 14pt 0; }',
    'table { border-collapse: collapse; width: 100%; }',
    '.meta td { padding: 2pt 8pt 2pt 0; }',
    '.meta td.k { font-weight: bold; width: 90pt; }',
    '.lines { margin-top: 14pt; }',
    '.lines th { background: #1f4e79; color: #ffffff; text-align: left; padding: 5pt; }',
    '.lines td { border-bottom: 1px solid #dddddd; padding: 5pt; }',
    '.num { text-align: right; }',
    '.lines th.num { text-align: right; }',
    '.total td { font-weight: bold; border-top: 2px solid #202124; border-bottom: none; }',
    '.thanks { margin-top: 18pt; color: #555555; }',
    '</style></head><body>',
    '<h1>' + escapeHtml(shop) + '</h1>',
    '<p class="doc">INVOICE</p>',
    '<p class="synthetic">Synthetic sample data - not a real business</p>',
    '<table class="meta">',
    '<tr><td class="k">Invoice No</td><td>' + escapeHtml(invoice.invoiceNo) + '</td></tr>',
    '<tr><td class="k">Date</td><td>' + escapeHtml(invoice.date) + '</td></tr>',
    '<tr><td class="k">Customer</td><td>' + escapeHtml(invoice.customer) + '</td></tr>',
    '</table>',
    '<table class="lines">',
    '<tr><th>SKU</th><th>Product</th><th class="num">Qty</th><th class="num">Unit Price</th><th class="num">Total</th></tr>',
    rows,
    '<tr class="total"><td colspan="4" class="num">Total</td><td class="num">' + money(invoice.total) + '</td></tr>',
    '</table>',
    '<p class="thanks">Thank you for your purchase.</p>',
    '</body></html>'
  ].join('\n');
}
