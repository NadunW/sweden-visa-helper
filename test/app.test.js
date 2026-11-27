const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const JSZip = require('jszip');
// Test-only shim: jsdom's ArrayBuffers come from another JS realm, which Node's JSZip
// doesn't recognise. Browsers load JSZip in the page itself, so they don't need this.
const origFile = JSZip.prototype.file;
JSZip.prototype.file = function (name, data, opts) {
  if (data && typeof data === 'object' && typeof data.byteLength === 'number' && !(data instanceof ArrayBuffer) && !ArrayBuffer.isView(data)) {
    data = Buffer.from(new Uint8Array(data));
  }
  return arguments.length === 1 ? origFile.call(this, name) : origFile.call(this, name, data, opts);
};

const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
let w, d, errors;
const saved = [];

const wait = (ms = 250) => new Promise(r => setTimeout(r, ms));
const fire = (el, type) => el.dispatchEvent(new w.Event(type, { bubbles: true }));
const bytes = async data => (data && typeof data.arrayBuffer === 'function' ? Buffer.from(await data.arrayBuffer()) : data);
const text = sel => d.querySelector(sel).textContent.replace(/\s+/g, ' ');

before(async () => {
  errors = [];
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'https://example.test/',
    beforeParse(win) {
      win.JSZip = JSZip;
      // Stand-in for the artifact runtime's downloads capability
      win.claude = { use: async name => name === 'downloads'
        ? { save: async req => { saved.push(req); return { status: 'saved' }; } }
        : null };
    }
  });
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

test('checklist links to the official forms', () => {
  const hrefs = [...d.querySelectorAll('#checks a')].map(a => a.href);
  assert.ok(hrefs.some(h => h.includes('241011')), 'invitation form 241011');
  assert.ok(hrefs.some(h => h.includes('sweden-visa-application-form-english.pdf')), 'form 119031');
  assert.ok(hrefs.some(h => h.includes('Visiting_Relatives_And_Friends_Visa.pdf')), 'Embassy checklist');
  assert.ok(hrefs.some(h => h.includes('skatteverket.se')), 'personbevis');
  assert.ok(hrefs.some(h => h.includes('book-an-appointment')), 'VFS booking');
});

test('every checklist item offers an upload', () => {
  assert.equal(d.querySelectorAll('#checks li').length, d.querySelectorAll('#checks input[type=file][data-up]').length);
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

test('uploading a scan stores it, ticks the item and shows it', async () => {
  const input = d.querySelector('input[data-up="t:t1:pass"]');
  const file = new w.File(['%PDF-1.4 test passport scan'], 'passport-sunil.pdf', { type: 'application/pdf' });
  Object.defineProperty(input, 'files', { value: [file] });
  fire(input, 'change');
  await wait();
  assert.ok(d.querySelector('[data-c="t:t1:pass"]').checked);
  assert.match(text('#checks'), /passport-sunil\.pdf/);
  assert.match(text('#pkg'), /1 file uploaded/);
  assert.match(text('#meter'), /^1 of \d+ documents ready/);
});

test('downloads a Word (.docx) letter', async () => {
  d.querySelector('[data-doc="host"]').click();
  d.querySelector('#dlDoc').click();
  await wait(400);
  const req = saved.at(-1);
  assert.match(req.filename, /\.docx$/);
  const z = await JSZip.loadAsync(await bytes(req.data));
  const xml = await z.file('word/document.xml').async('string');
  assert.match(xml, /Kasun Perera/);
  assert.ok(z.file('[Content_Types].xml'));
});

test('downloads the complete package as one ZIP in Embassy order', async () => {
  d.querySelector('#dlPkg').click();
  await wait(800);
  const req = saved.at(-1);
  assert.match(req.filename, /^Sweden-visa-package-.*\.zip$/);
  const z = await JSZip.loadAsync(await bytes(req.data));
  const names = Object.keys(z.files);
  assert.ok(names.some(n => n.endsWith('/README.txt')));
  assert.ok(names.some(n => n.includes('/1 Host - Kasun Perera/Host cover letter.docx')));
  assert.ok(names.some(n => /\/2 Sunil Perera\/\d+ Current passport\/passport-sunil\.pdf$/.test(n)));
  assert.ok(names.some(n => n.includes('/3 Kamala Perera/Cover letter - Kamala Perera.docx')));
  const pdf = names.find(n => n.endsWith('passport-sunil.pdf'));
  assert.equal(await z.file(pdf).async('string'), '%PDF-1.4 test passport scan');
});

test('removing an upload updates the package count', async () => {
  d.querySelector('#checks [data-del]').click();
  await wait();
  assert.match(text('#pkg'), /0 files uploaded/);
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
