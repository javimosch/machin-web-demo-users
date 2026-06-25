// host.js — the generic JS host + this app's API orchestration. The client is a
// pure view: it renders whatever load() gives it. Every mutation goes through the
// server (SQLite is the source of truth), then we reload the client from the API —
// the keyed list patches only the rows that changed.
let mem;
const dec = new TextDecoder(), enc = new TextEncoder();
const cstr = (p) => { const b = new Uint8Array(mem.buffer); let e = p; while (b[e]) e++; return dec.decode(b.subarray(p, e)); };

const env = {
  dom_mount: (r, h) => { document.getElementById(cstr(r)).innerHTML = cstr(h); },
  dom_patch: (s, v) => { const el = document.querySelector('[data-s="' + cstr(s) + '"]'); if (el) el.textContent = cstr(v); },
  list_insert: (c, k, h) => { const li = document.createElement('li'); li.dataset.k = cstr(k); li.innerHTML = cstr(h); document.getElementById(cstr(c)).appendChild(li); },
  list_remove: (c, k) => { const el = document.querySelector('#' + cstr(c) + ' > [data-k="' + cstr(k) + '"]'); if (el) el.remove(); },
  list_order: (c, csv) => { const ct = document.getElementById(cstr(c)); for (const k of cstr(csv).split(',').filter(Boolean)) { const el = ct.querySelector('[data-k="' + k + '"]'); if (el) ct.appendChild(el); } },
};
const wasi = { fd_write: () => 0, fd_seek: () => 0, fd_close: () => 0, fd_fdstat_get: () => 0 };

const { instance } = await WebAssembly.instantiateStreaming(fetch('/app.wasm'), { env, wasi_snapshot_preview1: wasi });
mem = instance.exports.memory;
instance.exports._initialize?.();
instance.exports.start();

// hand a string INTO wasm: write its UTF-8 into a buffer the module alloc'd.
const sendString = (s, allocFn, useFn) => {
  const b = enc.encode(s);
  const p = Number(allocFn(BigInt(b.length)));
  new Uint8Array(mem.buffer).set(b, p);
  useFn(BigInt(p));
};

// fetch the current users and reload the reactive view.
const reload = async () => {
  const json = await (await fetch('/api/users')).text();
  sendString(json, instance.exports.load_buf, instance.exports.load);
};

const addUser = async () => {
  const name = document.getElementById('u_name').value.trim();
  const email = document.getElementById('u_email').value.trim();
  if (!name) return;
  await fetch('/api/users?name=' + encodeURIComponent(name) + '&email=' + encodeURIComponent(email), { method: 'POST' });
  document.getElementById('u_name').value = '';
  document.getElementById('u_email').value = '';
  document.getElementById('u_name').focus();
  reload();
};

document.getElementById('app').addEventListener('click', async (e) => {
  if (e.target.id === 'u_add') return addUser();
  const row = e.target.closest('[data-id]');
  const act = e.target.dataset.act;
  if (!row || !act) return;
  const id = row.dataset.id;
  if (act === 'active') await fetch('/api/users/active?id=' + id, { method: 'POST' });
  else if (act === 'del') await fetch('/api/users/del?id=' + id, { method: 'POST' });
  reload();
});
document.getElementById('app').addEventListener('keydown', (e) => {
  if (e.target.id === 'u_email' && e.key === 'Enter') addUser();
});

reload();   // initial load
