/**
 * Inventory math. PURE (no Apps Script services).
 * The sheet uses formulas with the same rules (see services/Setup.js);
 * these functions power the alert emails and the tests.
 */

function computeOnHand(opening, purchases, sold) {
  return (Number(opening) || 0) + (Number(purchases) || 0) - (Number(sold) || 0);
}

/**
 * OVERSOLD when on hand is negative (more sold than opening + purchases: a data
 * problem to fix), OUT at exactly 0, LOW at or below the reorder level, else OK.
 */
function inventoryStatus(onHand, reorderLevel) {
  var stock = Number(onHand) || 0;
  if (stock < 0) return STATUS.OVERSOLD;
  if (stock === 0) return STATUS.OUT;
  if (stock <= (Number(reorderLevel) || 0)) return STATUS.LOW;
  return STATUS.OK;
}

/** Total quantity sold per SKU. */
function soldBySku(sales) {
  var out = {};
  (sales || []).forEach(function (s) {
    out[s.sku] = (out[s.sku] || 0) + (Number(s.qty) || 0);
  });
  return out;
}

var STATUS_PRIORITY = { OVERSOLD: 0, OUT: 1, LOW: 2, OK: 3 };

/**
 * Items that need attention: OVERSOLD first, then OUT, then LOW; lowest stock first within each.
 * rows: { sku, name, onHand, reorderLevel }
 */
function lowStockItems(rows) {
  return (rows || [])
    .map(function (r) {
      return { sku: r.sku, name: r.name, onHand: Number(r.onHand) || 0, reorderLevel: Number(r.reorderLevel) || 0,
        status: inventoryStatus(r.onHand, r.reorderLevel) };
    })
    .filter(function (r) { return r.status !== STATUS.OK; })
    .sort(function (a, b) {
      if (a.status !== b.status) return STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
      return a.onHand - b.onHand || (a.sku < b.sku ? -1 : 1);
    });
}
