/**
 * Thin read/write layer between the sheets and the pure logic in src/lib.
 * Rule: no business rules here - only moving data in and out of sheets.
 */

function ss_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function sheet_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('Sheet "' + name + '" not found. Run Shop Tools > Rebuild workbook.');
  return sh;
}

/** SpreadsheetApp.getUi() throws when there is no UI (editor run, time trigger). */
function tryGetUi_() {
  try { return SpreadsheetApp.getUi(); } catch (e) { return null; }
}

function todayIso_() {
  return Utilities.formatDate(new Date(), SCRIPT_TIMEZONE, 'yyyy-MM-dd');
}

/** ISO -> Date at local midnight. Script and spreadsheet both use Africa/Cairo. */
function isoToDate_(iso) {
  var p = isoParts(iso);
  return new Date(p[0], p[1] - 1, p[2]);
}

function currencyFormat_(currency) {
  return '#,##0.00 "' + currency + '"';
}

/** Data rows (without header) for the first numCols columns. */
function dataRows_(sh, numCols) {
  var last = sh.getLastRow();
  return last < 2 ? [] : sh.getRange(2, 1, last - 1, numCols).getValues();
}

/** Last non-empty row in one column (ARRAYFORMULA columns can make getLastRow misleading). */
function lastRowInColumn_(sh, col) {
  var last = sh.getLastRow();
  if (last < 1) return 0;
  var vals = sh.getRange(1, col, last, 1).getValues();
  for (var i = vals.length - 1; i >= 0; i--) {
    if (vals[i][0] !== '' && vals[i][0] !== null) return i + 1;
  }
  return 0;
}

function ensureRows_(sh, neededRows) {
  var max = sh.getMaxRows();
  if (neededRows > max) sh.insertRowsAfter(max, neededRows - max);
}

function readProducts_() {
  return dataRows_(sheet_(SHEET.PRODUCTS), 6)
    .filter(function (r) { return cleanText(r[0]) !== ''; })
    .map(function (r) {
      return { sku: normalizeSku(r[0]), name: cleanText(r[1]), category: cleanText(r[2]),
        cost: Number(r[3]) || 0, price: Number(r[4]) || 0, reorderLevel: Number(r[5]) || 0 };
    });
}

function readSales_() {
  return dataRows_(sheet_(SHEET.SALES), 9)
    .map(function (r) {
      return { date: parseFlexibleDate(r[0]), invoice: cleanText(r[1]), sku: normalizeSku(r[2]), name: r[3],
        qty: Number(r[4]) || 0, unitPrice: r[5], customer: cleanText(r[7]), source: r[8] };
    })
    .filter(function (s) { return s.sku && s.date; });
}

function readInventory_() {
  return dataRows_(sheet_(SHEET.INVENTORY), 8)
    .filter(function (r) { return cleanText(r[0]) !== ''; })
    .map(function (r) {
      return { sku: cleanText(r[0]), name: cleanText(r[1]), opening: Number(r[2]) || 0, purchases: Number(r[3]) || 0,
        sold: Number(r[4]) || 0, onHand: Number(r[5]) || 0, reorderLevel: Number(r[6]) || 0, status: r[7] };
    });
}

/** { values, errors } from the Settings sheet. */
function readSettings_() {
  return parseSettings(dataRows_(sheet_(SHEET.SETTINGS), 2));
}

/**
 * Append sale records { date, invoice, sku, qty, unitPrice, customer }.
 * Writes only the input columns; Product (D) and Total (G) are ARRAYFORMULA columns.
 */
function appendSales_(records, source) {
  if (!records.length) return;
  var sh = sheet_(SHEET.SALES);
  var start = lastRowInColumn_(sh, 1) + 1;
  var n = records.length;
  ensureRows_(sh, start + n - 1);
  sh.getRange(start, 1, n, 3).setValues(records.map(function (r) {
    return [isoToDate_(r.date), sanitizeCellText(r.invoice), r.sku];
  }));
  sh.getRange(start, 5, n, 2).setValues(records.map(function (r) { return [r.qty, r.unitPrice]; }));
  sh.getRange(start, 8, n, 2).setValues(records.map(function (r) {
    return [sanitizeCellText(r.customer), sanitizeCellText(source)];
  }));
}
