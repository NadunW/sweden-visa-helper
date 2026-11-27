const { test } = require('node:test');
const assert = require('node:assert/strict');
const { makeDom, wait, readBlob } = require('./helpers');

// A small in-memory stand-in for the Google Drive v3 REST API.
function fakeDrive(w, seed = []) {
  const files = new Map(seed.map(f => [f.id, { trashed: false, ...f }]));
  let n = 100;
  const calls = [];
  const res = (obj, content) => ({ ok: true, status: 200, json: async () => obj, blob: async () => new w.Blob([content ?? '']) });
  const fetch = async (url, opt = {}) => {
    const u = new URL(url), method = opt.method || 'GET';
    calls.push(`${method} ${u.pathname}`);
    assert.equal(opt.headers.Authorization, 'Bearer test-token');
    if (u.pathname === '/oauth2/v3/userinfo') return res({ email: 'kasun@example.com' });
    const up = u.pathname.match(/^\/upload\/drive\/v3\/files\/?(.*)$/);
    if (up) {
      const meta = JSON.parse(await readBlob(w, opt.body.get('metadata')));
      const content = await readBlob(w, opt.body.get('file'));
      const id = up[1] || 'f' + (n++);
      const f = files.get(id) || { id, trashed: false };
      Object.assign(f, meta, { content, size: String(content.length) });
      files.set(id, f);
      return res({ id, name: f.name, size: f.size, appProperties: f.appProperties });
    }
    const m = u.pathname.match(/^\/drive\/v3\/files\/?(.*)$/);
    if (m && m[1] && u.searchParams.get('alt') === 'media') {
      const f = files.get(m[1]);
      return { ok: true, status: 200, json: async () => JSON.parse(f.content), blob: async () => new w.Blob([f.content]) };
    }
    if (m && m[1] && method === 'PATCH') { Object.assign(files.get(m[1]), JSON.parse(opt.body)); return res({ id: m[1] }); }
    if (m && method === 'POST') { const id = 'f' + (n++); files.set(id, { id, trashed: false, ...JSON.parse(opt.body) }); return res({ id }); }
    if (m && method === 'GET') {
      const q = u.searchParams.get('q');
      const live = [...files.values()].filter(f => !f.trashed);
      const parent = q.match(/^'([^']+)' in parents/);
      const out = parent ? live.filter(f => (f.parents || []).includes(parent[1]))
        : live.filter(f => f.mimeType === 'application/vnd.google-apps.folder' && f.name === 'Sweden Visa Helper');
      return res({ files: out.map(({ content, ...meta }) => meta) });
    }
    throw new Error('unexpected ' + method + ' ' + url);
  };
  return { files, calls, fetch };
}

function googleSetup(win, drive) {
  win.APP_CONFIG = { googleClientId: 'test-client.apps.googleusercontent.com' };
  win.google = { accounts: { oauth2: {
    initTokenClient: cfg => ({ requestAccessToken: () => cfg.callback({ access_token: 'test-token', expires_in: 3600 }) }),
    revoke: (t, cb) => cb && cb()
  } } };
  win.URL.createObjectURL = () => 'blob:test';
  win.URL.revokeObjectURL = () => {};
  win.fetch = (...a) => drive.current.fetch(...a);
}

test('Google sign-in syncs details and moves uploads into the Drive folder', async () => {
  const holder = {};
  const { w, d, errors, fire, text } = makeDom(win => { holder.current = fakeDrive(win); googleSetup(win, holder); });
  await wait();
  assert.deepEqual(errors, []);
  assert.equal(d.querySelector('#gbar').hidden, false);
  assert.match(text('#gbar'), /Sign in with Google/);

  // Upload a scan before signing in: it stays in the browser for now
  const input = d.querySelector('input[data-up="t:t1:pass"]');
  Object.defineProperty(input, 'files', { value: [new w.File(['passport bytes'], 'passport.pdf', { type: 'application/pdf' })] });
  fire(input, 'change');
  await wait();

  d.querySelector('[data-g="in"]').click();
  await wait(400);
  const drive = holder.current;
  const all = [...drive.files.values()];
  const folder = all.find(f => f.mimeType === 'application/vnd.google-apps.folder');
  assert.equal(folder.name, 'Sweden Visa Helper');
  const data = all.find(f => f.appProperties?.svh === 'data');
  assert.equal(data.name, 'visa-helper-data.json');
  assert.deepEqual(data.parents, [folder.id]);
  assert.match(data.content, /Kasun Perera/);
  const moved = all.find(f => f.appProperties?.svh === 'file');
  assert.equal(moved.content, 'passport bytes');
  assert.equal(moved.appProperties.key, 't:t1:pass');
  assert.match(moved.name, /^Sunil Perera - Current passport - passport\.pdf$/);
  assert.match(text('#gbar'), /Saved in your Google Drive · kasun@example\.com/);

  // Editing details saves them back to Drive
  const city = d.querySelector('[data-s="host"][data-f="city"]');
  city.value = '411 01 Göteborg'; fire(city, 'input');
  await wait(1600);
  assert.match(data.content, /Göteborg/);

  // Uploading while signed in goes straight to Drive
  const input2 = d.querySelector('input[data-up="t:t2:photo"]');
  Object.defineProperty(input2, 'files', { value: [new w.File(['photo bytes'], 'photo.jpg', { type: 'image/jpeg' })] });
  fire(input2, 'change');
  await wait();
  assert.ok([...drive.files.values()].some(f => f.appProperties?.key === 't:t2:photo' && f.content === 'photo bytes'));

  // The ZIP package pulls file contents from Drive
  const saved = [];
  w.HTMLAnchorElement.prototype.click = function () { saved.push(this.download); };
  d.querySelector('#dlPkg').click();
  await wait(800);
  assert.match(saved.at(-1), /^Sweden-visa-package-.*\.zip$/);

  // Removing an upload moves the Drive file to the trash
  const chip = [...d.querySelectorAll('#checks .chip')].find(c => c.textContent.includes('photo.jpg'));
  chip.querySelector('[data-del]').click();
  await wait();
  assert.equal([...drive.files.values()].find(f => f.appProperties?.key === 't:t2:photo').trashed, true);

  // Sign out
  d.querySelector('[data-g="out"]').click();
  await wait();
  assert.match(text('#gbar'), /Sign in with Google/);
});

test('signing in on a new device loads saved details from Drive', async () => {
  const remote = {
    sample: false, updatedAt: Date.now() + 60000, checks: { 'h:h241011': true },
    trip: { arrive: '2027-05-01', depart: '2027-06-15', from: 'Colombo (CMB)', to: 'Stockholm Arlanda (ARN)', purpose: 'a family visit', payer: 'host', plans: '', other: '', flightOut: '', flightBack: '' },
    host: { name: 'Nadun Example', gender: 'male', pnr: '', street: 'Testgatan 1', city: '111 22 Stockholm', phone: '', email: '', status: 'citizen', job: '', employer: '', salary: '' },
    travellers: [{ id: 'r1', name: 'Remote Parent', relation: 'Mother', dob: '1960-01-01', nic: '', passport: 'N1111111', issued: '2022-01-01', expiry: '2032-01-01', address: '', phone: '', status: 'retired', occupation: '', income: '', ties: '' }]
  };
  const holder = {};
  const { d, errors } = makeDom(win => {
    holder.current = fakeDrive(win, [
      { id: 'F1', name: 'Sweden Visa Helper', mimeType: 'application/vnd.google-apps.folder' },
      { id: 'D1', name: 'visa-helper-data.json', parents: ['F1'], appProperties: { svh: 'data' }, content: JSON.stringify(remote) },
      { id: 'U1', name: 'Remote Parent - Current passport - p.pdf', parents: ['F1'], mimeType: 'application/pdf', size: '5', appProperties: { svh: 'file', key: 't:r1:pass', orig: 'p.pdf' }, content: 'scan!' }
    ]);
    googleSetup(win, holder);
  });
  await wait();
  d.querySelector('[data-g="in"]').click();
  await wait(400);
  assert.deepEqual(errors, []);
  assert.equal(d.querySelector('[data-s="host"][data-f="name"]').value, 'Nadun Example');
  assert.equal(d.querySelectorAll('.tcard').length, 1);
  assert.ok(d.querySelector('[data-c="h:h241011"]').checked);
  assert.match(d.querySelector('#checks').textContent, /p\.pdf/);
  assert.equal(holder.current.calls.filter(c => c.startsWith('POST')).length, 0, 'nothing new created');
});

test('outside Claude, downloads use the browser directly and Google stays hidden without a client ID', async () => {
  const saved = [];
  const { w, d, errors } = makeDom(win => {
    win.URL.createObjectURL = () => 'blob:test';
    win.URL.revokeObjectURL = () => {};
  });
  w.HTMLAnchorElement.prototype.click = function () { saved.push(this.download); };
  await wait();
  assert.deepEqual(errors, []);
  assert.equal(d.querySelector('#gbar').hidden, true);
  assert.equal(d.querySelector('#dlPkg').hidden, false);
  d.querySelector('#dlPkg').click();
  await wait(600);
  assert.match(saved.at(-1), /\.zip$/);
});
