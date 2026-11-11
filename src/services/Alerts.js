/**
 * Email automation. Trigger handlers + "send now" menu items.
 * Content comes from the pure builders in src/lib/Emails.js.
 */

/** Daily trigger: email only when something is LOW or OUT. */
function runDailyLowStockAlert() {
  var settings = readSettings_().values;
  var items = lowStockItems(readInventory_());
  var mail = buildLowStockEmail(items, settings, ss_().getUrl(), todayIso_());
  if (!mail) {
    console.log('Low-stock check: everything is OK, no email sent.');
    return 'nothing';
  }
  return sendOwnerMail_(settings, mail);
}

/** Weekly trigger: KPIs for the last 7 full days. */
function runWeeklySummary() {
  var to = addDaysIso(todayIso_(), -1);
  return sendWeeklySummaryFor_(addDaysIso(to, -6), to);
}

function sendWeeklySummaryFor_(fromIso, toIso) {
  var settings = readSettings_().values;
  var kpis = computeKpis(filterSalesByDate(readSales_(), fromIso, toIso), readProducts_(), { topN: 5 });
  var lowCount = lowStockItems(readInventory_()).length;
  return sendOwnerMail_(settings, buildWeeklySummaryEmail(kpis, settings, ss_().getUrl(), fromIso, toIso, lowCount));
}

function sendOwnerMail_(settings, mail) {
  if (isPlaceholderEmail(settings.ownerEmail)) {
    console.warn('Owner email in Settings is a placeholder (' + settings.ownerEmail + '); email not sent.');
    return 'placeholder';
  }
  MailApp.sendEmail({
    to: settings.ownerEmail,
    subject: mail.subject,
    body: mail.body,
    htmlBody: mail.htmlBody,
    name: settings.shopName
  });
  return 'sent';
}

var SEND_RESULT_TEXT = {
  sent: 'Email sent to the owner email in Settings.',
  nothing: 'Nothing is LOW or OUT, so no alert was sent.',
  placeholder: 'Set a real "Owner email" in the Settings sheet first (it still uses the example.com placeholder).'
};

/** Menu: run the daily alert now. */
function sendLowStockAlertNow() {
  SpreadsheetApp.getUi().alert(SEND_RESULT_TEXT[runDailyLowStockAlert()]);
}

/**
 * Menu: send the weekly summary now. Uses the 7 days ending on the latest sale,
 * so the demo email has numbers even when the sample data is older than today.
 */
function sendWeeklySummaryNow() {
  var dates = readSales_().map(function (s) { return s.date; }).sort();
  var to = dates.length ? dates[dates.length - 1] : addDaysIso(todayIso_(), -1);
  SpreadsheetApp.getUi().alert(SEND_RESULT_TEXT[sendWeeklySummaryFor_(addDaysIso(to, -6), to)]);
}
