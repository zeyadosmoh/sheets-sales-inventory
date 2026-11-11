/**
 * Installable time triggers. Hour and weekday come from the Settings sheet.
 * Re-installing first removes this project's existing alert triggers (no duplicates).
 */

var TRIGGER_HANDLERS = ['runDailyLowStockAlert', 'runWeeklySummary'];

function installTriggers() {
  var ui = SpreadsheetApp.getUi();
  var parsed = readSettings_();
  if (parsed.errors.length) {
    ui.alert('Fix the Settings sheet first:\n\n- ' + parsed.errors.join('\n- '));
    return;
  }
  var s = parsed.values;
  if (isPlaceholderEmail(s.ownerEmail)) {
    ui.alert('Set a real "Owner email" in the Settings sheet first (it still uses the example.com placeholder).');
    return;
  }
  removeTriggers_();
  ScriptApp.newTrigger('runDailyLowStockAlert').timeBased()
    .everyDays(1).atHour(s.alertHour).inTimezone(SCRIPT_TIMEZONE).create();
  ScriptApp.newTrigger('runWeeklySummary').timeBased()
    .onWeekDay(ScriptApp.WeekDay[s.weeklyDay]).atHour(s.alertHour).inTimezone(SCRIPT_TIMEZONE).create();
  ui.alert('Triggers installed:\n\n- Low-stock alert: every day around ' + pad(s.alertHour, 2) + ':00\n' +
    '- Weekly summary: every ' + s.weeklyDay.charAt(0) + s.weeklyDay.slice(1).toLowerCase() + ' around ' + pad(s.alertHour, 2) + ':00\n\n' +
    'Time zone: ' + SCRIPT_TIMEZONE + '. Emails go to ' + s.ownerEmail + '.');
}

function removeTriggers() {
  var n = removeTriggers_();
  SpreadsheetApp.getUi().alert(n ? 'Removed ' + n + ' trigger(s).' : 'No alert triggers were installed.');
}

function removeTriggers_() {
  var removed = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (TRIGGER_HANDLERS.indexOf(t.getHandlerFunction()) >= 0) {
      ScriptApp.deleteTrigger(t);
      removed++;
    }
  });
  return removed;
}
