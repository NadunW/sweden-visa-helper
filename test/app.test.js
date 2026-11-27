const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
let w, d, errors;

const wait = (ms = 250) => new Promise(r => setTimeout(r, ms));
const fire = (el, type) => el.dispatchEvent(new w.Event(type, { bubbles: true }));
const text = sel => d.querySelector(sel).textContent.replace(/\s+/g, ' ');

before(async () => {
  errors = [];
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.test/' });
  w = dom.window; d = w.document;
  w.addEventListener('error', e => errors.push(e.message));
  await wait();
});

test('loads without script errors', () => {
  assert.deepEqual(errors, []);
});

test('opens with sample data: two travellers, checklists and fees', () => {
  assert.equal(d.querySelectorAll('.tcard').length, 2);
  assert.equal(d.querySelectorAll('#checks .panel').length, 3);
  assert.match(text('#fees'), /LKR 117,944/);
});

test('generates host and applicant letters with no missing fields', () => {
  for (const id of ['host', 'app-t1', 'app-t2', 'itin', 'idx-t1']) {
    d.querySelector(`[data-doc="${id}"]`).click();
    assert.equal(d.querySelectorAll('#sheet .hl').length, 0, `${id} has missing fields`);
  }
  d.querySelector('[data-doc="app-t1"]').click();
  assert.match(text('#sheet'), /visit my son, Kasun Perera, who lives in Uppsala/);
  assert.match(text('#sheet'), /pension of LKR 85,000/);
});

test('ticking a checklist item updates progress', () => {
  const cb = d.querySelector('[data-c="t:t2:pass"]');
  cb.checked = true; fire(cb, 'change');
  assert.match(text('#meter'), /^1 of \d+ documents ready/);
});

test('warns when the stay is longer than 90 days', async () => {
  const dep = d.querySelector('[data-s="trip"][data-f="depart"]');
  dep.value = '2027-08-30'; fire(dep, 'input');
  await wait();
  assert.match(text('#alerts'), /at most 90 days in any 180/);
});

test('warns when a passport expires too soon', async () => {
  const exp = d.querySelector('[data-t="t1"][data-f="expiry"]');
  exp.value = '2027-07-01'; fire(exp, 'input');
  await wait();
  assert.match(text('#alerts'), /passport expires/);
});

test('escapes user input in generated letters', async () => {
  const name = d.querySelector('[data-s="host"][data-f="name"]');
  name.value = '<img src=x onerror=alert(1)>'; fire(name, 'input');
  await wait();
  d.querySelector('[data-doc="host"]').click();
  assert.equal(d.querySelector('#sheet img'), null);
});

test('start blank resets to one empty traveller', () => {
  d.querySelector('#blankBtn').click();
  assert.equal(d.querySelectorAll('.tcard').length, 1);
  assert.match(text('#alerts'), /Add arrival and departure dates/);
});
