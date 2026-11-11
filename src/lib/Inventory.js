/**
 * Inventory math. PURE (no Apps Script services).
 * The sheet uses formulas with the same rules (see services/Setup.js);
 * these functions power the alert emails and the tests.
 */

function computeOnHand(opening, purchases, sold) {
  return (Number(opening) || 0) + (Number(purchases) || 0) - (Number(sold) || 0);
}

/** OUT when nothing left, LOW at or below the reorder level, otherwise OK. */
function inventoryStatus(onHand, reorderLevel) {
  var stock = Number(onHand) || 0;
  if (stock <= 0) return STATUS.OUT;
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

/**
 * Items that need attention, OUT first, then lowest stock.
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
      if (a.status !== b.status) return a.status === STATUS.OUT ? -1 : 1;
      return a.onHand - b.onHand || (a.sku < b.sku ? -1 : 1);
    });
}
