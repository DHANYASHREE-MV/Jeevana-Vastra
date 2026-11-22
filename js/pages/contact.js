// Contact Us: messages are delivered to the store's inbox through FormSubmit (free form-to-email
// service; works on static hosting). The first message triggers a one-time activation email to the
// inbox; after it is confirmed, every message arrives as a normal email with reply-to set to the customer.
import { state } from '../store.js';
import { $, esc, icons, setMeta, toast } from '../ui.js';

export const CONTACT_EMAIL = 'dhanyashree63@gmail.com';
const ENDPOINT = `https://formsubmit.co/ajax/${CONTACT_EMAIL}`;
const TOPICS = ['Order or delivery', 'Product question', 'Size help', 'Virtual Try-On', 'Returns & exchange', 'Bulk / wedding orders', 'Something else'];

export async function render({ el, query }) {
  setMeta('Contact Us', 'Get in touch with Jeevana Vastra: orders, sizing, styling help and bulk wedding orders.');
  const u = state.user;
  el.innerHTML = `
  <section class="contact-hero">
    <div class="container">
      <span class="eyebrow">We're here to help</span>
      <h1>Contact <em>Jeevana Vastra</em></h1>
      <p>Questions about an order, sizing, a saree you love or a wedding order? Send us a message and we'll reply by email, usually within a day.</p>
    </div>
  </section>
  <div class="container contact-wrap">
    <aside class="contact-cards">
      <a class="contact-card" href="mailto:${CONTACT_EMAIL}">
        <span class="ic"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg></span>
        <span><b>Email us</b><small>${CONTACT_EMAIL}</small></span>
      </a>
      <a class="contact-card" href="account/orders">
        <span class="ic">${icons.bag}</span>
        <span><b>Track an order</b><small>Live status in your account</small></span>
      </a>
      <a class="contact-card" href="virtual-try-on">
        <span class="ic">${icons.spark}</span>
        <span><b>Not sure it suits you?</b><small>Try it on with our AI studio</small></span>
      </a>
      <div class="contact-note">
        <b>Store hours</b>
        <span>Monday – Saturday · 10:00 am – 7:00 pm IST</span>
      </div>
    </aside>
    <form class="panel contact-form" id="contactForm" novalidate>
      <h3>Send us a message</h3>
      <div class="form-grid">
        <div class="field"><label for="cName">Your name</label><input class="input" id="cName" name="name" required autocomplete="name" value="${esc(u?.name || '')}"></div>
        <div class="field"><label for="cEmail">Email</label><input class="input" id="cEmail" name="email" type="email" required autocomplete="email" value="${esc(u?.email || '')}"></div>
        <div class="field"><label for="cPhone">Mobile (optional)</label><input class="input" id="cPhone" name="phone" inputmode="tel" autocomplete="tel" value="${esc(u?.phone || '')}"></div>
        <div class="field"><label for="cTopic">Topic</label><select class="select" id="cTopic" name="topic">${TOPICS.map((t) => `<option ${query.topic === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="field full"><label for="cOrder">Order number (optional)</label><input class="input" id="cOrder" name="order" placeholder="e.g. JV123456789" value="${esc(query.order || '')}"></div>
        <div class="field full"><label for="cMsg">Message</label><textarea class="input" id="cMsg" name="message" rows="6" required placeholder="How can we help?"></textarea></div>
        <input type="text" name="_honey" class="sr-only" tabindex="-1" autocomplete="off" aria-hidden="true">
      </div>
      <div class="form-error" id="cErr"></div>
      <button class="btn btn-block" id="cSend">Send message</button>
      <p class="secure-note">${icons.lock} Your details are only used to reply to you.</p>
    </form>
  </div>`;

  $('#contactForm', el).addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target; const err = $('#cErr', el); const btn = $('#cSend', el);
    const data = Object.fromEntries(new FormData(f));
    if (data._honey) return; // bot
    if (!data.name.trim()) { err.textContent = 'Please enter your name'; return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) { err.textContent = 'Please enter a valid email so we can reply'; return; }
    if (data.message.trim().length < 5) { err.textContent = 'Please write a short message'; return; }
    err.textContent = '';
    btn.classList.add('is-loading');
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          _subject: `Jeevana Vastra enquiry: ${data.topic}${data.order ? ` (order ${data.order})` : ''}`,
          _replyto: data.email, _template: 'table', _captcha: 'false',
          Name: data.name, Email: data.email, Mobile: data.phone || '-', Topic: data.topic, 'Order number': data.order || '-', Message: data.message,
        }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || String(out.success) !== 'true') throw new Error(out.message || 'send failed');
      f.outerHTML = `<div class="panel contact-done"><div class="tick">${icons.check}</div><h3>Thank you, ${esc(data.name.split(' ')[0])}!</h3>
        <p>Your message has been sent. We'll reply to <b>${esc(data.email)}</b> soon.</p><a class="btn btn-outline" href="shop">Continue shopping</a></div>`;
    } catch {
      btn.classList.remove('is-loading');
      const body = encodeURIComponent(`Name: ${data.name}\nMobile: ${data.phone || '-'}\nOrder: ${data.order || '-'}\n\n${data.message}`);
      err.innerHTML = `We couldn't send that just now. Please <a class="link" href="mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Jeevana Vastra enquiry: ${data.topic}`)}&body=${body}">email us directly</a> instead.`;
      toast('Message not sent. Use the email link instead', { type: 'error' });
    }
  });
}
