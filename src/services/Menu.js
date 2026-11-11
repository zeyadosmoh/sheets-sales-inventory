/**
 * Simple triggers: the "Shop Tools" menu and auto unit price on the Sales sheet.
 */

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Shop Tools')
    .addItem('Import & clean CSV file...', 'showImportDialog')
    .addItem('Import from "Import" sheet', 'importFromImportSheet')
    .addSeparator()
    .addItem('Generate invoice PDF for selected sale', 'generateInvoiceForSelection')
    .addItem('Refresh dashboard', 'refreshDashboard')
    .addSeparator()
    .addSubMenu(ui.createMenu('Automation')
      .addItem('Install triggers', 'installTriggers')
      .addItem('Remove triggers', 'removeTriggers')
      .addSeparator()
      .addItem('Send low-stock alert now', 'sendLowStockAlertNow')
      .addItem('Send weekly summary now', 'sendWeeklySummaryNow'))
    .addSeparator()
    .addItem('Rebuild workbook (deletes all data)...', 'setupWorkbook')
    .addToUi();
}

/**
 * When a SKU is typed/picked in Sales, fill Unit Price from Products.
 * The price is stored as a value (not a formula) so later price changes
 * do not rewrite past sales.
 */
function onEdit(e) {
  if (!e || !e.range) return;
  var range = e.range;
  var sh = range.getSheet();
  if (sh.getName() !== SHEET.SALES) return;
  var skuCol = 3;
  var priceCol = 6;
  if (range.getColumn() > skuCol || range.getLastColumn() < skuCol || range.getLastRow() < 2) return;

  var firstRow = Math.max(2, range.getRow());
  var numRows = range.getLastRow() - firstRow + 1;
  var prices = {};
  dataRows_(sh.getParent().getSheetByName(SHEET.PRODUCTS), 5).forEach(function (r) {
    prices[normalizeSku(r[0])] = r[4];
  });
  var skus = sh.getRange(firstRow, skuCol, numRows, 1).getValues();
  sh.getRange(firstRow, priceCol, numRows, 1).setValues(skus.map(function (r) {
    var sku = normalizeSku(r[0]);
    return [sku && prices[sku] !== undefined ? prices[sku] : ''];
  }));
}
