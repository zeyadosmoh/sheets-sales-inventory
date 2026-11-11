/**
 * Dashboard KPIs. PURE (no Apps Script services).
 *
 * sales:    { date: 'YYYY-MM-DD', invoice, sku, qty, unitPrice }
 * products: { sku, name, category, cost, price }
 */

function lineUnitPrice(sale, product) {
  var u = sale.unitPrice;
  if (u !== '' && u !== null && u !== undefined && isFinite(Number(u))) return Number(u);
  return product ? Number(product.price) || 0 : 0;
}

/** Inclusive ISO date filter. Either bound may be omitted. */
function filterSalesByDate(sales, fromIso, toIso) {
  return (sales || []).filter(function (s) {
    return (!fromIso || s.date >= fromIso) && (!toIso || s.date <= toIso);
  });
}

/**
 * options.topN    - size of topProducts (default 10)
 * options.todayIso - when given, an unfinished month is labelled "Mon YYYY (to date)"
 */
function computeKpis(sales, products, options) {
  var topN = (options && options.topN) || 10;
  var todayIso = options && options.todayIso;
  var bySku = indexBy(products, 'sku');
  var revenue = 0, cost = 0, units = 0;
  var orders = {};
  var byMonth = {}, byCategory = {}, byProduct = {};

  (sales || []).forEach(function (s, i) {
    var qty = Number(s.qty) || 0;
    if (qty <= 0) return;
    var p = bySku[s.sku];
    var line = qty * lineUnitPrice(s, p);
    revenue += line;
    cost += qty * (p ? Number(p.cost) || 0 : 0);
    units += qty;
    orders[s.invoice ? 'inv:' + s.invoice : 'line:' + i] = true;

    var month = String(s.date).slice(0, 7);
    byMonth[month] = (byMonth[month] || 0) + line;
    var cat = p ? p.category : 'Unknown';
    byCategory[cat] = (byCategory[cat] || 0) + line;
    var bp = byProduct[s.sku] || (byProduct[s.sku] = { sku: s.sku, name: p ? p.name : s.sku, units: 0, revenue: 0 });
    bp.units += qty;
    bp.revenue += line;
  });

  var orderCount = Object.keys(orders).length;
  revenue = round2(revenue);
  var grossProfit = round2(revenue - cost);

  return {
    revenue: revenue,
    orders: orderCount,
    avgOrderValue: orderCount ? round2(revenue / orderCount) : 0,
    unitsSold: units,
    grossProfit: grossProfit,
    marginPct: revenue ? Math.round((grossProfit / revenue) * 1000) / 1000 : 0,
    revenueByMonth: Object.keys(byMonth).sort().map(function (m) {
      return { month: m, label: monthLabelAsOf(m, todayIso), revenue: round2(byMonth[m]) };
    }),
    revenueByCategory: Object.keys(byCategory)
      .map(function (c) { return { category: c, revenue: round2(byCategory[c]) }; })
      .sort(function (a, b) { return b.revenue - a.revenue || (a.category < b.category ? -1 : 1); }),
    topProducts: Object.keys(byProduct)
      .map(function (k) { var p = byProduct[k]; p.revenue = round2(p.revenue); return p; })
      .sort(function (a, b) { return b.revenue - a.revenue || (a.sku < b.sku ? -1 : 1); })
      .slice(0, topN)
  };
}
