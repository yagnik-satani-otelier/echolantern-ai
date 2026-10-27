'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'..','public','fallback.js'),'utf8');
test('static preview has a browser-only fallback and no hosted-model claim', () => {
  assert.match(source,/window\.EchoLanternFallback/);
  assert.match(source,/details you want to keep close/i);
  assert.doesNotMatch(source,/fetch\(/);
});
