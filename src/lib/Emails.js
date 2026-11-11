/**
 * Email content builders. PURE (no Apps Script services).
 * Return { subject, body, htmlBody } for MailApp.sendEmail, or null when there is nothing to send.
 */

function buildLowStockEmail(items, settings, sheetUrl, todayIso) {
  if (!items || !items.length) return null;
  var shop = settings.shopName;
  var outCount = items.filter(function (i) { return i.status === STATUS.OUT; }).length;
  var subject = '[' + shop + '] Stock alert: ' + items.length + ' item(s) need reordering' +
    (outCount ? ' (' + outCount + ' out of stock)' : '');

  var textLines = items.map(function (i) {
    return '- ' + i.status + '  ' + i.sku + '  ' + i.name + '  on hand: ' + i.onHand + ' (reorder at ' + i.reorderLevel + ')';
  });
  var body = 'Stock alert for ' + todayIso + '\n\n' + textLines.join('\n') +
    '\n\nOpen the sheet: ' + sheetUrl + '\n\n' + SAMPLE_DATA_LABEL + '.';

  var rows = items.map(function (i) {
    var color = i.status === STATUS.OUT ? '#b3261e' : '#8a5300';
    return '<tr><td style="color:' + color + ';font-weight:bold">' + escapeHtml(i.status) + '</td>' +
      '<td>' + escapeHtml(i.sku) + '</td><td>' + escapeHtml(i.name) + '</td>' +
      '<td style="text-align:right">' + i.onHand + '</td><td style="text-align:right">' + i.reorderLevel + '</td></tr>';
  }).join('');
  var htmlBody = '<p>Stock alert for <b>' + escapeHtml(todayIso) + '</b>:</p>' +
    '<table cellpadding="6" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px">' +
    '<tr style="background:#f1f3f4"><th>Status</th><th>SKU</th><th>Product</th><th>On hand</th><th>Reorder level</th></tr>' +
    rows + '</table>' +
    '<p><a href="' + escapeHtml(sheetUrl) + '">Open the sheet</a></p>' +
    '<p style="color:#777;font-size:11px">' + SAMPLE_DATA_LABEL + '.</p>';
  return { subject: subject, body: body, htmlBody: htmlBody };
}

function buildWeeklySummaryEmail(kpis, settings, sheetUrl, fromIso, toIso, lowStockCount) {
  var cur = settings.currency;
  var subject = '[' + settings.shopName + '] Weekly summary ' + fromIso + ' to ' + toIso;
  var facts = [
    ['Revenue', formatMoney(kpis.revenue, cur)],
    ['Orders', String(kpis.orders)],
    ['Avg order value', formatMoney(kpis.avgOrderValue, cur)],
    ['Units sold', String(kpis.unitsSold)],
    ['Low / out of stock items', String(lowStockCount)]
  ];
  var top = (kpis.topProducts || []).slice(0, 5);

  var body = 'Weekly summary ' + fromIso + ' to ' + toIso + '\n\n' +
    facts.map(function (f) { return f[0] + ': ' + f[1]; }).join('\n') +
    '\n\nTop products:\n' +
    (top.length ? top.map(function (p, i) { return (i + 1) + '. ' + p.name + ' - ' + formatMoney(p.revenue, cur); }).join('\n') : '(no sales)') +
    '\n\nDashboard: ' + sheetUrl + '\n\n' + SAMPLE_DATA_LABEL + '.';

  var htmlBody = '<h3 style="font-family:Arial,sans-serif">Weekly summary ' + escapeHtml(fromIso) + ' to ' + escapeHtml(toIso) + '</h3>' +
    '<table cellpadding="6" style="font-family:Arial,sans-serif;font-size:13px">' +
    facts.map(function (f) { return '<tr><td>' + escapeHtml(f[0]) + '</td><td style="font-weight:bold;text-align:right">' + escapeHtml(f[1]) + '</td></tr>'; }).join('') +
    '</table><p style="font-family:Arial,sans-serif"><b>Top products</b></p><ol style="font-family:Arial,sans-serif;font-size:13px">' +
    (top.length ? top.map(function (p) { return '<li>' + escapeHtml(p.name) + ' - ' + escapeHtml(formatMoney(p.revenue, cur)) + '</li>'; }).join('') : '<li>No sales this week</li>') +
    '</ol><p><a href="' + escapeHtml(sheetUrl) + '">Open the dashboard</a></p>' +
    '<p style="color:#777;font-size:11px">' + SAMPLE_DATA_LABEL + '.</p>';
  return { subject: subject, body: body, htmlBody: htmlBody };
}
