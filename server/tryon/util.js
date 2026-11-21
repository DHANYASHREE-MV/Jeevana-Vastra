const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function dataUriParts(uri) {
  const m = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(uri || '');
  if (!m) throw new Error('Invalid image data');
  return { mime: m[1], b64: m[2] };
}

async function urlToDataUri(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('Could not download generated image');
  const type = r.headers.get('content-type') || 'image/png';
  return `data:${type};base64,${Buffer.from(await r.arrayBuffer()).toString('base64')}`;
}

module.exports = { sleep, dataUriParts, urlToDataUri };
