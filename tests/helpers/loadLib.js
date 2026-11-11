// Loads every src/lib/*.js file into one vm context, like Apps Script's single
// global scope (no modules). Returns the context so tests can call the functions.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const LIB_DIR = path.join(__dirname, '..', '..', 'src', 'lib');

function libFiles() {
  return fs.readdirSync(LIB_DIR).filter((f) => f.endsWith('.js')).sort();
}

function loadLib() {
  const context = vm.createContext({ console });
  for (const file of libFiles()) {
    const code = fs.readFileSync(path.join(LIB_DIR, file), 'utf8');
    vm.runInContext(code, context, { filename: `src/lib/${file}` });
  }
  return context;
}

// Values created inside the vm have different prototypes; JSON round-trip
// turns them into plain objects so assert.deepStrictEqual works.
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = { loadLib, plain, libFiles, LIB_DIR };
