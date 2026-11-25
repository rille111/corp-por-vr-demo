// Boot: on hosts that can only store text (the GitHub Pages build), binary assets ship as base64 (.b64)
// and are turned into blob URLs before the game starts. Locally the manifest is absent and files load directly.
window.__blobs = {};
async function boot() {
  try {
    const r = await fetch('assets/manifest.json', { cache: 'no-cache' });
    if (r.ok) {
      const m = await r.json();
      if (m.voskModel) window.__VOSK_MODEL_URL = m.voskModel;
      if (m.voskJs) window.__VOSK_JS_URL = m.voskJs;
      const el = document.getElementById('loadstate');
      let done = 0;
      await Promise.all(m.b64.map(async ([path, mime]) => {
        const t = await (await fetch(path + '.b64')).text();
        const bin = atob(t.replace(/\s+/g, '')); const u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        window.__blobs[path] = URL.createObjectURL(new Blob([u8], { type: mime }));
        if (el) el.textContent = `Unpacking assets… ${++done}/${m.b64.length}`;
      }));
    }
  } catch (e) { console.warn('boot: no manifest, loading assets directly', e); }
  await import('./main.js');
}
boot();
