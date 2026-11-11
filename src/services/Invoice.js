/**
 * Invoice PDF for the selected Sales row.
 * Data comes from the pure buildInvoice(); this file only fills the template,
 * exports the PDF, and saves it in a Drive folder the script itself created
 * (so the narrow drive.file scope is enough).
 */

var INVOICE_FOLDER_NAME = 'Shop Invoices (synthetic sample data)';
var INVOICE_FOLDER_PROP = 'INVOICE_FOLDER_ID';

function generateInvoiceForSelection() {
  var ui = SpreadsheetApp.getUi();
  var ss = ss_();
  var sh = ss.getActiveSheet();
  var row = sh.getActiveRange().getRow();
  if (sh.getName() !== SHEET.SALES || row < 2) {
    ui.alert('Select a sale row in the Sales sheet first.');
    return;
  }
  var cells = sh.getRange(row, 1, 1, 9).getValues()[0];
  if (!cleanText(cells[2])) { ui.alert('The selected row has no SKU.'); return; }

  var invoiceNo = normalizeInvoiceNo(cells[1]);
  if (!invoiceNo) {
    var date = parseFlexibleDate(cells[0]);
    if (!date) { ui.alert('The selected row needs a valid date first.'); return; }
    var year = Number(date.slice(0, 4));
    invoiceNo = formatInvoiceNumber(year, nextInvoiceSeq(readSales_().map(function (s) { return s.invoice; }), year));
    sh.getRange(row, 2).setValue(invoiceNo);
  }

  var settings = readSettings_().values;
  var invoice = buildInvoice(invoiceNo, readSales_(), indexBy(readProducts_(), 'sku'), settings);
  if (!invoice) { ui.alert('No sales lines found for ' + invoiceNo + '.'); return; }
  if (invoice.lines.length > INVOICE_LAYOUT.MAX_LINES) {
    ui.alert(invoiceNo + ' has ' + invoice.lines.length + ' lines; the template fits ' + INVOICE_LAYOUT.MAX_LINES + '.');
    return;
  }

  var template = sheet_(SHEET.INVOICE);
  fillInvoiceTemplate_(template, invoice);
  var blob = exportSheetAsPdf_(ss, template, invoiceFileName(invoice));
  var file = getInvoiceFolder_().createFile(blob);

  var url = file.getUrl();
  var html = HtmlService.createHtmlOutput(
    '<p style="font-family:Arial,sans-serif">Saved <b>' + escapeHtml(file.getName()) + '</b> to Drive folder "' +
    escapeHtml(INVOICE_FOLDER_NAME) + '".</p><p><a href="' + escapeHtml(url) + '" target="_blank">Open the PDF</a></p>')
    .setWidth(420).setHeight(140);
  ui.showModalDialog(html, 'Invoice ' + invoiceNo);
}

function fillInvoiceTemplate_(sh, invoice) {
  sh.getRange('A1').setValue(invoice.shopName);
  sh.getRange('B5:B7').setValues([[invoice.invoiceNo], [isoToDate_(invoice.date)], [sanitizeCellText(invoice.customer)]]);
  var first = INVOICE_LAYOUT.FIRST_LINE_ROW;
  sh.getRange(first, 1, INVOICE_LAYOUT.MAX_LINES, 5).clearContent();
  sh.getRange(first, 1, invoice.lines.length, 5).setValues(invoice.lines.map(function (l) {
    return [l.sku, sanitizeCellText(l.name), l.qty, l.unitPrice, l.total];
  }));
  sh.getRange(INVOICE_LAYOUT.TOTAL_ROW, 5).setValue(invoice.total);
}

/**
 * Export ONE sheet as PDF using Spreadsheet.getAs(), which exports every
 * visible sheet - so hide all others for the export, then restore.
 * VERIFY IN PHASE B (scope: spreadsheets.currentonly, no external_request).
 * If this fails, swap only this function (e.g. export URL + UrlFetchApp).
 */
function exportSheetAsPdf_(ss, target, fileName) {
  var sheets = ss.getSheets();
  var wasHidden = sheets.map(function (s) { return s.isSheetHidden(); });
  var active = ss.getActiveSheet();
  try {
    target.showSheet();
    sheets.forEach(function (s) { if (s.getSheetId() !== target.getSheetId()) s.hideSheet(); });
    SpreadsheetApp.flush();
    return ss.getAs('application/pdf').setName(fileName);
  } finally {
    // Show first (a spreadsheet cannot have every sheet hidden), then re-hide.
    sheets.forEach(function (s, i) { if (!wasHidden[i]) s.showSheet(); });
    sheets.forEach(function (s, i) { if (wasHidden[i]) s.hideSheet(); });
    if (active && !active.isSheetHidden()) ss.setActiveSheet(active);
    SpreadsheetApp.flush();
  }
}

/** Folder created by this script (drive.file scope). Re-created if it was deleted. */
function getInvoiceFolder_() {
  var props = PropertiesService.getDocumentProperties();
  var id = props.getProperty(INVOICE_FOLDER_PROP);
  if (id) {
    try {
      var existing = DriveApp.getFolderById(id);
      if (!existing.isTrashed()) return existing;
    } catch (e) {
      // Folder gone or not accessible: fall through and create a new one.
    }
  }
  var folder = DriveApp.createFolder(INVOICE_FOLDER_NAME);
  props.setProperty(INVOICE_FOLDER_PROP, folder.getId());
  return folder;
}
