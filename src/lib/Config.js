/**
 * Shared constants.
 * PURE: no Apps Script services in this folder (src/lib). Tested in Node.
 * Apps Script loads every file into one global scope, so `var` = global.
 */

var SAMPLE_DATA_LABEL = 'Synthetic sample data';
var SCRIPT_TIMEZONE = 'Africa/Cairo';

var SHEET = {
  DASHBOARD: 'Dashboard',
  SALES: 'Sales',
  PRODUCTS: 'Products',
  INVENTORY: 'Inventory',
  IMPORT: 'Import',
  IMPORT_LOG: 'Import_Log',
  SETTINGS: 'Settings',
  INVOICE: 'Invoice_Template'
};

var HEADERS = {
  PRODUCTS: ['SKU', 'Product', 'Category', 'Unit Cost', 'Price', 'Reorder Level'],
  SALES: ['Date', 'Invoice No', 'SKU', 'Product', 'Qty', 'Unit Price', 'Total', 'Customer', 'Source'],
  INVENTORY: ['SKU', 'Product', 'Opening Stock', 'Purchases', 'Sold', 'On Hand', 'Reorder Level', 'Status'],
  IMPORT: ['Date', 'SKU', 'Qty', 'Invoice No', 'Customer'],
  IMPORT_LOG: ['Timestamp', 'Source', 'Row', 'Type', 'Reason', 'Raw Data'],
  SETTINGS: ['Setting', 'Value', 'Notes']
};

var STATUS = { OK: 'OK', LOW: 'LOW', OUT: 'OUT' };

/** Import limits / sanity rules. */
var IMPORT_RULES = {
  MAX_QTY: 10000,
  MIN_DATE: '2000-01-01'
};
