/**
 * Small RFC-4180-style CSV parser. PURE (no Apps Script services).
 * Handles quotes, escaped quotes (""), CRLF/LF/CR, a UTF-8 BOM, and auto-detects
 * the delimiter (comma, semicolon or tab) from the header line.
 */

function detectDelimiter(text) {
  var firstLine = String(text).split(/\r\n|\n|\r/)[0] || '';
  var best = ',';
  var bestCount = 0;
  [',', ';', '\t'].forEach(function (d) {
    var count = 0;
    var inQuotes = false;
    for (var i = 0; i < firstLine.length; i++) {
      var ch = firstLine[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === d && !inQuotes) count++;
    }
    if (count > bestCount) { best = d; bestCount = count; }
  });
  return best;
}

/** Returns an array of rows; each row is an array of raw string fields. */
function parseCsv(text, delimiter) {
  var src = String(text === null || text === undefined ? '' : text).replace(/^﻿/, '');
  var d = delimiter || detectDelimiter(src);
  var rows = [];
  var row = [];
  var field = '';
  var inQuotes = false;
  var fieldStarted = false;

  function endField() { row.push(field); field = ''; fieldStarted = false; }
  function endRow() { endField(); rows.push(row); row = []; }

  for (var i = 0; i < src.length; i++) {
    var ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && !fieldStarted) { inQuotes = true; fieldStarted = true; continue; }
    if (ch === d) { endField(); continue; }
    if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      endRow();
      continue;
    }
    field += ch;
    fieldStarted = true;
  }
  if (fieldStarted || field !== '' || row.length) endRow();
  return rows;
}
