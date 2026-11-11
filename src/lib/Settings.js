/**
 * Settings sheet: defaults, parsing and validation. PURE (no Apps Script services).
 */

var WEEKDAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

var SETTINGS_FIELDS = [
  { key: 'shopName', label: 'Shop name', def: 'Demo Shop (synthetic)', note: 'Shown on invoices and emails.' },
  { key: 'ownerEmail', label: 'Owner email', def: 'owner@example.com', note: 'Receives alerts. Replace the placeholder before installing triggers.' },
  { key: 'alertHour', label: 'Alert hour (0-23)', def: 8, note: 'Hour (Africa/Cairo) when the daily and weekly emails run.' },
  { key: 'currency', label: 'Currency', def: 'EGP', note: '3-letter code used on the dashboard and invoices.' },
  { key: 'weeklyDay', label: 'Weekly summary day', def: 'SUNDAY', note: 'Day the weekly summary email is sent.' }
];

function defaultSettings() {
  var out = {};
  SETTINGS_FIELDS.forEach(function (f) { out[f.key] = f.def; });
  return out;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email || ''));
}

function isPlaceholderEmail(email) {
  return /@(example\.(com|org|net)|[^@]*\.example)$/i.test(String(email || ''));
}

/**
 * rows: [[label, value], ...] from the Settings sheet.
 * Returns { values, errors } - invalid values fall back to defaults.
 */
function parseSettings(rows) {
  var values = defaultSettings();
  var errors = [];
  var byLabel = {};
  (rows || []).forEach(function (r) { byLabel[cleanText(r[0]).toLowerCase()] = r[1]; });

  SETTINGS_FIELDS.forEach(function (f) {
    var raw = byLabel[f.label.toLowerCase()];
    if (raw === undefined || cleanText(raw) === '') return;
    var v = cleanText(raw);
    switch (f.key) {
      case 'ownerEmail':
        if (isValidEmail(v)) values.ownerEmail = v.toLowerCase();
        else errors.push('Owner email is not valid: "' + v + '"');
        break;
      case 'alertHour':
        var h = parseNumber(v);
        if (h === Math.floor(h) && h >= 0 && h <= 23) values.alertHour = h;
        else errors.push('Alert hour must be a whole number 0-23: "' + v + '"');
        break;
      case 'currency':
        if (/^[A-Za-z]{3}$/.test(v)) values.currency = v.toUpperCase();
        else errors.push('Currency must be a 3-letter code: "' + v + '"');
        break;
      case 'weeklyDay':
        if (WEEKDAYS.indexOf(v.toUpperCase()) >= 0) values.weeklyDay = v.toUpperCase();
        else errors.push('Weekly summary day must be a weekday name: "' + v + '"');
        break;
      default:
        values[f.key] = v;
    }
  });
  return { values: values, errors: errors };
}
