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

  try {
    // Resolve the Drive folder BEFORE touching sheet visibility: a Drive failure
    // then happens while every sheet is still in its normal state.
    var folderId = getInvoiceFolderId_();
    var template = sheet_(SHEET.INVOICE);
    fillInvoiceTemplate_(template, invoice);
    var blob = exportSheetAsPdf_(ss, template, invoiceFileName(invoice));
    var file = savePdfToFolder_(blob, folderId);
  } catch (e) {
    console.error('Invoice PDF failed for ' + invoiceNo + ': ' + (e && e.stack || e));
    ui.alert('Could not create the invoice PDF',
      'Invoice ' + invoiceNo + ' was not saved. Your sheets were left unchanged.\n\n' +
      'Details: ' + (e && e.message ? e.message : String(e)) + '\n\n' +
      'Try again in a moment. If it keeps failing, reload the spreadsheet and re-run it.',
      ui.ButtonSet.OK);
    return;
  }

  var html = HtmlService.createHtmlOutput(
    '<p style="font-family:Arial,sans-serif">Saved <b>' + escapeHtml(file.name) + '</b> to Drive folder "' +
    escapeHtml(INVOICE_FOLDER_NAME) + '".</p><p><a href="' + escapeHtml(file.webViewLink) + '" target="_blank">Open the PDF</a></p>')
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
 * visible sheet - so hide all others only for the export itself, then ALWAYS
 * restore the original visibility in finally (each restore step is isolated so
 * one failure cannot leave other sheets hidden). No Drive calls happen in here.
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
    sheets.forEach(function (s, i) { if (!wasHidden[i]) safely_(function () { s.showSheet(); }); });
    sheets.forEach(function (s, i) { if (wasHidden[i]) safely_(function () { s.hideSheet(); }); });
    safely_(function () { if (active && !active.isSheetHidden()) ss.setActiveSheet(active); });
    safely_(function () { SpreadsheetApp.flush(); });
  }
}

function safely_(fn) {
  try { fn(); } catch (e) { console.error('Sheet visibility restore step failed: ' + e); }
}

/*
 * Drive access goes through the Advanced Drive Service (v3), NOT DriveApp:
 * DriveApp always demands the full "drive" scope, while the Drive API honors
 * drive.file (files/folders this script created).
 */

var FOLDER_MIME = 'application/vnd.google-apps.folder';

/** Id of the invoice folder this script created. Re-created if missing or trashed. */
function getInvoiceFolderId_() {
  var props = PropertiesService.getDocumentProperties();
  var id = props.getProperty(INVOICE_FOLDER_PROP);
  if (id) {
    try {
      var existing = Drive.Files.get(id, { fields: 'id,trashed' });
      if (existing && !existing.trashed) return existing.id;
    } catch (e) {
      // Folder deleted or no longer accessible: fall through and create a new one.
    }
  }
  var folder = Drive.Files.create({ name: INVOICE_FOLDER_NAME, mimeType: FOLDER_MIME }, null, { fields: 'id' });
  props.setProperty(INVOICE_FOLDER_PROP, folder.id);
  return folder.id;
}

/** Upload the PDF into the folder; returns {id, name, webViewLink}. */
function savePdfToFolder_(blob, folderId) {
  return Drive.Files.create(
    { name: blob.getName(), parents: [folderId], mimeType: 'application/pdf' },
    blob,
    { fields: 'id,name,webViewLink' });
}
