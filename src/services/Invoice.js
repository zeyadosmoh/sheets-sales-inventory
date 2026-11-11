/**
 * Invoice PDF for the selected Sales row.
 * Data comes from the pure buildInvoice(), layout from the pure buildInvoiceHtml();
 * this file converts that HTML to PDF (Utilities, no extra scope) and saves it in
 * a Drive folder the script itself created (so the narrow drive.file scope is enough).
 * No sheets are hidden, exported or modified apart from filling in a missing invoice no.
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

  try {
    var blob = invoicePdfBlob_(invoice, settings);
    var file = savePdfToFolder_(blob, getInvoiceFolderId_());
  } catch (e) {
    console.error('Invoice PDF failed for ' + invoiceNo + ': ' + (e && e.stack || e));
    ui.alert('Could not create the invoice PDF',
      'Invoice ' + invoiceNo + ' was not saved.\n\n' +
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

/** HTML invoice -> PDF blob named like "INV-2026-00042 - Demo Shop.pdf". */
function invoicePdfBlob_(invoice, settings) {
  var pdfName = invoiceFileName(invoice);
  var html = buildInvoiceHtml(invoice, settings);
  return Utilities.newBlob(html, 'text/html', pdfName.replace(/\.pdf$/, '') + '.html')
    .getAs('application/pdf')
    .setName(pdfName);
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
