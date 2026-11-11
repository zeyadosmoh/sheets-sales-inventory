/**
 * CSV import. Two entry points, one pipeline:
 *  1) showImportDialog(): the browser reads a local CSV file and sends its TEXT
 *     to importCsvText() - no Drive access needed.
 *  2) importFromImportSheet(): rows pasted into the "Import" sheet.
 * Cleaning/validation is the pure cleanSalesImport() in src/lib/Clean.js.
 */

var IMPORT_MAX_BYTES = 5 * 1024 * 1024;

function showImportDialog() {
  var html = HtmlService.createHtmlOutputFromFile('ui/ImportDialog').setWidth(560).setHeight(460);
  SpreadsheetApp.getUi().showModalDialog(html, 'Import & clean sales CSV');
}

/** Called from ui/ImportDialog.html via google.script.run. */
function importCsvText(text, fileName) {
  if (typeof text !== 'string') throw new Error('No file content received.');
  if (text.length > IMPORT_MAX_BYTES) throw new Error('File is too large (max 5 MB).');
  var name = cleanText(fileName || 'upload.csv').slice(0, 80);
  return runImport_(parseCsv(text), 'CSV file: ' + name);
}

function importFromImportSheet() {
  var ui = SpreadsheetApp.getUi();
  var sh = sheet_(SHEET.IMPORT);
  var rows = sh.getDataRange().getDisplayValues();
  if (rows.length < 2) {
    ui.alert('The Import sheet is empty. Paste rows under the header first.');
    return;
  }
  var result = runImport_(rows, 'Import sheet');
  ui.alert(result.ok ? 'Import finished' : 'Import failed', result.message +
    (result.ok && result.stats.rejected + result.stats.duplicates ? '\n\nDetails are in the Import_Log sheet.' : ''), ui.ButtonSet.OK);
  if (result.ok && result.stats.cleaned > 0) {
    var clear = ui.alert('Clear the Import sheet?', 'The imported rows are now in Sales. Remove the pasted rows from the Import sheet?', ui.ButtonSet.YES_NO);
    if (clear === ui.Button.YES) sh.getRange(2, 1, sh.getMaxRows() - 1, sh.getMaxColumns()).clearContent();
  }
}

/**
 * Shared pipeline: clean -> assign invoice numbers -> append to Sales -> log -> refresh dashboard.
 * Returns a small plain object for the dialog: { ok, message, stats, issues }.
 */
function runImport_(rows, source) {
  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) throw new Error('Another import is running. Try again in a moment.');
  try {
    var products = readProducts_();
    var bySku = indexBy(products, 'sku');
    var known = {};
    products.forEach(function (p) { known[p.sku] = true; });

    // Existing sales, keyed with and without invoice number, so re-importing the
    // same file is detected even after invoice numbers were assigned.
    var sales = readSales_();
    var existing = {};
    sales.forEach(function (s) {
      var rec = { date: s.date, invoice: s.invoice, sku: s.sku, qty: s.qty, customer: s.customer };
      existing[saleKey(rec)] = true;
      rec.invoice = '';
      existing[saleKey(rec)] = true;
    });

    var res = cleanSalesImport(rows, { knownSkus: known, todayIso: todayIso_(), existingKeys: existing });
    if (res.error) {
      writeImportLog_(source, 'ERROR', res.error, []);
      return { ok: false, message: res.error, stats: res.stats, issues: [] };
    }

    var records = assignInvoiceNumbers(res.cleaned, sales.map(function (s) { return s.invoice; }))
      .map(function (r) { r.unitPrice = bySku[r.sku].price; return r; });
    appendSales_(records, source);

    var summary = importSummaryText(res.stats);
    writeImportLog_(source, 'SUMMARY', summary, res.issues);
    if (records.length) {
      SpreadsheetApp.flush();
      refreshDashboard_();
    }
    return { ok: true, message: summary, stats: res.stats, issues: res.issues.slice(0, 100) };
  } finally {
    lock.releaseLock();
  }
}

function writeImportLog_(source, type, message, issues) {
  var sh = sheet_(SHEET.IMPORT_LOG);
  var now = new Date();
  var rows = [[now, sanitizeCellText(source), '', type, sanitizeCellText(message), '']].concat(
    issues.map(function (i) {
      return [now, sanitizeCellText(source), i.rowNumber, i.type, sanitizeCellText(i.reason), sanitizeCellText(i.raw)];
    }));
  var start = sh.getLastRow() + 1;
  ensureRows_(sh, start + rows.length - 1);
  sh.getRange(start, 1, rows.length, 6).setValues(rows);
  sh.getRange(start, 1, 1, 6).setFontWeight('bold');
}
