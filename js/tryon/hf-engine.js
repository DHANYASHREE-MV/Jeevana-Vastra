// Photoreal try-on through the free public IDM-VTON demo on Hugging Face Spaces (Gradio 4 queue API).
// Called straight from the browser with plain, credential-free requests (the official Gradio JS client
// sends cookies, which Hugging Face's CORS policy rejects for other sites). No API key involved.
//
// NOTE for the store owner: this public demo is free but rate-limited per visitor (GPU quota), may queue
// or be offline, and the IDM-VTON model is licensed for non-commercial use (CC BY-NC-SA 4.0). For a real
// commercial launch, switch to a paid provider (Gemini / FASHN) via the Node server's cloud mode.

export const HF_SPACE = 'https://yisol-idm-vton.hf.space';
const FN_INDEX = 2; // the /tryon endpoint in the Space's config

async function toBlob(src) {
  const r = await fetch(src);
  if (!r.ok) throw new Error('Could not read the image');
  return r.blob();
}

export async function tryOnHF({ personDataUrl, garmentUrl, description, onStage = () => {}, timeoutMs = 180000 }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    onStage('Uploading to the photoreal AI…');
    const form = new FormData();
    form.append('files', await toBlob(personDataUrl), 'person.jpg');
    form.append('files', await toBlob(garmentUrl), 'garment.jpg');
    const up = await fetch(`${HF_SPACE}/upload`, { method: 'POST', body: form, signal: ctrl.signal, credentials: 'omit' });
    if (!up.ok) throw new Error('The photoreal AI service is not available right now.');
    const [personPath, garmentPath] = await up.json();
    const file = (path, name) => ({ path, orig_name: name, meta: { _type: 'gradio.FileData' } });

    const session = `jv${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    const join = await fetch(`${HF_SPACE}/queue/join`, {
      method: 'POST', credentials: 'omit', signal: ctrl.signal, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [{ background: file(personPath, 'person.jpg'), layers: [], composite: null }, file(garmentPath, 'garment.jpg'), description, true, true, 30, 42],
        fn_index: FN_INDEX, session_hash: session,
      }),
    });
    if (!join.ok) throw new Error('The photoreal AI queue is not accepting requests right now.');

    onStage('Waiting for a free AI GPU…');
    const stream = await fetch(`${HF_SPACE}/queue/data?session_hash=${session}`, { credentials: 'omit', signal: ctrl.signal });
    const reader = stream.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        let msg; try { msg = JSON.parse(line.slice(5)); } catch { continue; }
        if (msg.msg === 'estimation' && msg.rank > 0) onStage(`In the AI queue: ${msg.rank} ahead of you…`);
        if (msg.msg === 'process_starts') onStage('Draping the garment on you…');
        if (msg.msg === 'process_completed') {
          if (!msg.success) {
            const raw = String(msg.output?.error || '');
            throw new Error(/quota|limit/i.test(raw)
              ? 'The free photoreal AI has reached its usage limit for now.'
              : 'The photoreal AI could not create this look.');
          }
          const out = msg.output?.data?.[0];
          const url = out?.url || (out?.path ? `${HF_SPACE}/file=${out.path}` : null);
          if (!url) throw new Error('The photoreal AI returned no image.');
          onStage('Rendering your look…');
          const blob = await toBlob(url);
          return await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
        }
      }
    }
    throw new Error('The photoreal AI connection closed early.');
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('The photoreal AI took too long.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
