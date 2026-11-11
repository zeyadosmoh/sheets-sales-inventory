/**
 * Dashboard refresh: reads sheets, computes KPIs with the pure computeKpis(),
 * writes values into fixed cells/tables that the charts point at.
 */

var DASH = {
  TITLE: 'A1',
  SUBTITLE: 'A2',
  KPI_LABELS: 'A4:A10',
  KPI_VALUES: 'B4:B10',
  KPI_NAMES: ['Revenue', 'Orders', 'Avg order value', 'Units sold', 'Gross margin', 'Low / out of stock items', 'Top product'],
  MONTH_TITLE: 'D4', MONTH_HEADER: 'D5:E5', MONTH_DATA: 'D6:E17', MONTH_ROWS: 12,
  CAT_TITLE: 'G4', CAT_HEADER: 'G5:H5', CAT_DATA: 'G6:H15', CAT_ROWS: 10,
  TOP_TITLE: 'J4', TOP_HEADER: 'J5:L5', TOP_DATA: 'J6:L15', TOP_ROWS: 10, // Product | Revenue | Units
  TABLE_FIRST_ROW: 4, TABLE_LAST_ROW: 17, TABLE_ROW_HEIGHT: 24
};

/** Menu entry. */
function refreshDashboard() {
  var sh = sheet_(SHEET.DASHBOARD);
  styleDashboardTables_(sh, readSettings_().values);
  var k = refreshDashboard_();
  buildDashboardCharts_(sh);
  ss_().toast('Revenue ' + formatMoney(k.revenue, readSettings_().values.currency) + ' from ' + k.orders + ' orders.', 'Dashboard refreshed', 5);
}

/** Pad rows to a fixed table height so old values are cleared. */
function padRows_(rows, height, width) {
  var out = rows.slice(0, height);
  while (out.length < height) {
    var blank = [];
    for (var i = 0; i < width; i++) blank.push('');
    out.push(blank);
  }
  return out;
}

function refreshDashboard_() {
  var sh = sheet_(SHEET.DASHBOARD);
  var products = readProducts_();
  var sales = readSales_();
  var k = computeKpis(sales, products, { topN: DASH.TOP_ROWS });
  var lowCount = lowStockItems(readInventory_()).length;

  sh.getRange(DASH.SUBTITLE).setValue(SAMPLE_DATA_LABEL + '  |  Last refreshed ' +
    Utilities.formatDate(new Date(), SCRIPT_TIMEZONE, 'yyyy-MM-dd HH:mm'));
  sh.getRange(DASH.KPI_VALUES).setValues([
    [k.revenue], [k.orders], [k.avgOrderValue], [k.unitsSold], [k.marginPct], [lowCount],
    [k.topProducts.length ? k.topProducts[0].name : '-']
  ]);
  sh.getRange(DASH.MONTH_DATA).setValues(padRows_(
    k.revenueByMonth.slice(-DASH.MONTH_ROWS).map(function (m) { return [m.label, m.revenue]; }), DASH.MONTH_ROWS, 2));
  sh.getRange(DASH.CAT_DATA).setValues(padRows_(
    k.revenueByCategory.map(function (c) { return [c.category, c.revenue]; }), DASH.CAT_ROWS, 2));
  sh.getRange(DASH.TOP_DATA).setValues(padRows_(
    k.topProducts.map(function (p) { return [p.name, p.revenue, p.units]; }), DASH.TOP_ROWS, 3));
  sh.getRange('B9').setFontColor(lowCount ? '#b3261e' : '#274e13');
  return k;
}
