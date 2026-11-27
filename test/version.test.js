const { test } = require('node:test');
const assert = require('node:assert/strict');
const { check, compare } = require('../scripts/check-version');
const { version } = require('../package.json');

test('package.json version is X.Y.Z', () => {
  assert.match(version, /^\d+\.\d+\.\d+$/);
});

test('version check rules', () => {
  assert.equal(check('1.0.0', '', []), null, 'first release');
  assert.equal(check('1.2.0', '1.1.3', ['v1.1.3']), null, 'bumped minor');
  assert.match(check('1.1.3', '1.1.3', ['v1.1.3']), /already exists/);
  assert.match(check('1.0.9', '1.1.0', []), /lower than/);
  assert.match(check('1.0', '', []), /X\.Y\.Z/);
  assert.match(check('01.0.0', '', []), /X\.Y\.Z/);
  assert.ok(compare('1.10.0', '1.9.9') > 0);
  assert.ok(compare('2.0.0', '10.0.0') < 0);
});
