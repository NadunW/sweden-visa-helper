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
const wait = (ms = 250) => new Promise(r => setTimeout(r, ms));
const bytes = async data => (data && typeof data.arrayBuffer === 'function' ? Buffer.from(await data.arrayBuffer()) : data);

function makeDom(setup) {
  const errors = [];
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'https://example.test/',
    beforeParse(win) {
      win.JSZip = JSZip;
      win.addEventListener('error', e => errors.push(e.message));
      if (setup) setup(win);
    }
  });
  const w = dom.window;
  return {
    w, d: w.document, errors,
    fire: (el, type) => el.dispatchEvent(new w.Event(type, { bubbles: true })),
    text: sel => w.document.querySelector(sel).textContent.replace(/\s+/g, ' ')
  };
}

const readBlob = (w, b) => new Promise((res, rej) => {
  const r = new w.FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsText(b);
});

module.exports = { JSZip, makeDom, wait, bytes, readBlob };
