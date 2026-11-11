/**
 * Date parsing for messy input. PURE (no Apps Script services).
 * Internally every date is an ISO string "YYYY-MM-DD".
 */

var MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
};
var MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function isValidYmd(y, m, d) {
  if (!(y >= 1900 && y <= 2100) || !(m >= 1 && m <= 12) || !(d >= 1)) return false;
  var dim = [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d <= dim[m - 1];
}

function ymdToIso(y, m, d) {
  return isValidYmd(y, m, d) ? y + '-' + pad(m, 2) + '-' + pad(d, 2) : null;
}

function expandYear(y) {
  var n = Number(y);
  return String(y).length === 2 ? 2000 + n : n;
}

function monthFromName(name) {
  var key = String(name).toLowerCase().slice(0, 3);
  return MONTHS[key] || null;
}

/**
 * Parse many date shapes into "YYYY-MM-DD", or null.
 *  - Date objects (local calendar date, i.e. the script/test timezone)
 *  - Sheets/Excel serial numbers (e.g. 46143)
 *  - 2026-05-03, 2026/5/3, 20260503, with optional time part
 *  - 03/05/2026, 3-5-26, 03.05.2026  (day-first unless a part is > 12)
 *  - 3 May 2026, 03-May-26, May 3, 2026, May 3rd 2026
 *  - Arabic-Indic digits in any of the above
 * options.dayFirst (default true) decides ambiguous a/b/yyyy dates.
 */
function parseFlexibleDate(value, options) {
  var dayFirst = !options || options.dayFirst !== false;
  if (value === null || value === undefined || value === '') return null;

  if (Object.prototype.toString.call(value) === '[object Date]') {
    if (isNaN(value.getTime())) return null;
    return ymdToIso(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  if (typeof value === 'number') return serialToIso(value);

  var s = cleanText(value).toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  // Drop a trailing time part: "2026-05-03 14:30", "2026-05-03T14:30:00Z", "3/5/2026 2:30 pm"
  s = s.replace(/[t ]\d{1,2}:\d{2}(:\d{2}(\.\d+)?)?(z|[+-]\d{2}:?\d{2})?( ?[ap]\.?m\.?)?$/, '').trim();
  var m;

  if ((m = s.match(/^(\d{4})[-\/. ](\d{1,2})[-\/. ](\d{1,2})$/))) {
    return ymdToIso(+m[1], +m[2], +m[3]);
  }
  if ((m = s.match(/^(\d{4})(\d{2})(\d{2})$/))) {
    return ymdToIso(+m[1], +m[2], +m[3]);
  }
  if ((m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2}|\d{4})$/))) {
    var a = +m[1], b = +m[2], y = expandYear(m[3]);
    if (a > 12) return ymdToIso(y, b, a);
    if (b > 12) return ymdToIso(y, a, b);
    return dayFirst ? ymdToIso(y, b, a) : ymdToIso(y, a, b);
  }
  if ((m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?[ \-\/]([a-z]{3,9})\.?[ \-\/](\d{2}|\d{4})$/))) {
    var mon1 = monthFromName(m[2]);
    return mon1 ? ymdToIso(expandYear(m[3]), mon1, +m[1]) : null;
  }
  if ((m = s.match(/^([a-z]{3,9})\.? (\d{1,2})(?:st|nd|rd|th)? (\d{4})$/))) {
    var mon2 = monthFromName(m[1]);
    return mon2 ? ymdToIso(+m[3], mon2, +m[2]) : null;
  }
  if ((m = s.match(/^\d{5}(\.\d+)?$/))) {
    return serialToIso(Number(s));
  }
  return null;
}

/** Sheets/Excel serial day number (days since 1899-12-30) -> ISO. Plausible range only. */
function serialToIso(serial) {
  if (!isFinite(serial) || serial < 20000 || serial > 80000) return null;
  var d = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000);
  return ymdToIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** ISO -> [y, m, d] numbers. */
function isoParts(iso) {
  return String(iso).split('-').map(Number);
}

function addDaysIso(iso, days) {
  var p = isoParts(iso);
  var d = new Date(Date.UTC(p[0], p[1] - 1, p[2]) + days * 86400000);
  return ymdToIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

function daysBetweenIso(fromIso, toIso) {
  var a = isoParts(fromIso), b = isoParts(toIso);
  return Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 86400000);
}

/**
 * True when the month is not finished as of todayIso (the current month, or a
 * future one). Without todayIso every month counts as complete.
 */
function isPartialMonth(yyyyMm, todayIso) {
  return !!todayIso && String(yyyyMm) >= String(todayIso).slice(0, 7);
}

/** "2026-11" + today in Nov 2026 -> "Nov 2026 (to date)"; complete months -> "May 2026". */
function monthLabelAsOf(yyyyMm, todayIso) {
  return monthLabel(yyyyMm) + (isPartialMonth(yyyyMm, todayIso) ? ' (to date)' : '');
}

/** "2026-05" -> "May 2026" */
function monthLabel(yyyyMm) {
  var p = String(yyyyMm).split('-');
  return MONTH_NAMES[Number(p[1]) - 1] + ' ' + p[0];
}
