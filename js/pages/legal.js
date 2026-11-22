// Privacy Policy and Terms of Service (also used as the app home / privacy / terms links for Google Cloud).
import { setMeta } from '../ui.js';
import { CONTACT_EMAIL } from './contact.js';

const UPDATED = '22 November 2026';

const PRIVACY = `
<h2>Who we are</h2>
<p>Jeevana Vastra ("we", "us") is an Indian ethnic-wear store selling sarees, kurta sets, kurtis, anarkalis and co-ord sets through this website. For any privacy question, write to <a class="link" href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>

<h2>Information we collect</h2>
<ul>
  <li><b>Account details</b> you enter (name, email, mobile number, password). On this website these are stored only in your own browser (local storage); passwords are stored as a one-way hash.</li>
  <li><b>Delivery addresses, bag, wishlist and orders</b> you create, stored in your browser so the site can show them to you.</li>
  <li><b>Contact form messages</b> (name, email, optional mobile and order number, and your message), which are emailed to us so we can reply.</li>
  <li><b>Photos you use in the Virtual Try-On studio</b>, handled as described below.</li>
</ul>

<h2>Virtual Try-On photos</h2>
<ul>
  <li><b>Instant (on-device) mode:</b> your photo is processed entirely inside your browser and is never uploaded.</li>
  <li><b>Photoreal (free AI) mode:</b> to create the look, your photo and the selected garment image are sent to a third-party AI service (the public IDM-VTON demo hosted on Hugging Face). We do not store your photo, and we use it only to generate the look you asked for. That service's own terms and privacy practices apply to its processing.</li>
  <li><b>Saved looks</b> stay in your browser until you remove them.</li>
</ul>

<h2>How we use information</h2>
<p>To show you your account, bag, wishlist and orders; to reply to your messages; to process and deliver orders you place with us; and to create try-on images you request. We do not sell or rent your personal information, and we do not use it for advertising.</p>

<h2>Service providers</h2>
<ul>
  <li><b>GitHub Pages</b> hosts this website and may log technical data such as IP addresses for security.</li>
  <li><b>FormSubmit</b> delivers contact-form messages to our email inbox.</li>
  <li><b>Hugging Face</b> (IDM-VTON demo) processes photos in Photoreal try-on mode.</li>
  <li><b>Google Fonts and jsDelivr / Google Storage</b> deliver fonts and the on-device AI models.</li>
</ul>

<h2>Cookies and local storage</h2>
<p>We use your browser's local and session storage to remember your session, bag, wishlist, orders, saved looks and small preferences. We do not use advertising or tracking cookies. You can clear this data at any time from your browser settings.</p>

<h2>Retention and your choices</h2>
<p>Data stored in your browser stays there until you sign out, remove it, or clear your browser data. Contact messages are kept in our inbox for as long as needed to help you. You can ask us to access, correct or delete information we hold about you by emailing <a class="link" href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>

<h2>Google user data</h2>
<p>If we connect Google services (such as Google Business Profile) to manage our own business listing, we only access our own business account data, use it solely to manage that listing, do not share it with third parties, and do not use it for advertising. Our use of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.</p>

<h2>Children</h2>
<p>This website is intended for adults. We do not knowingly collect information from children under 18.</p>

<h2>Changes</h2>
<p>We may update this policy. The latest version is always on this page, with the date it was last updated.</p>`;

const TERMS = `
<h2>About these terms</h2>
<p>These terms apply to your use of the Jeevana Vastra website and any order you place with us. By using the website you agree to them. Questions: <a class="link" href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>

<h2>Products and pricing</h2>
<ul>
  <li>Prices are in Indian Rupees (₹) and include applicable taxes unless stated otherwise.</li>
  <li>We photograph our products carefully, but colours can look slightly different on different screens. Mannequin presentations are styled views of the actual product.</li>
  <li>We may correct errors in prices or descriptions, and may limit quantities.</li>
</ul>

<h2>Orders and payment</h2>
<ul>
  <li>An order is confirmed only when we confirm it with you by phone, WhatsApp or email.</li>
  <li>Payment is by cash on delivery or by UPI / other methods we confirm with you. Online card payments on this website are currently not active.</li>
  <li>We may decline or cancel an order, for example if an item is out of stock; any payment made will be refunded in full.</li>
</ul>

<h2>Shipping</h2>
<p>We ship across India. Delivery usually takes 3–6 business days after dispatch. Shipping is free on orders above ₹1,499; a delivery fee applies below that and is shown at checkout.</p>

<h2>Returns and exchanges</h2>
<ul>
  <li>Unused items with original tags and packaging can be exchanged within 7 days of delivery.</li>
  <li>For hygiene reasons, altered, stitched or used items cannot be returned.</li>
  <li>To start an exchange, contact us with your order number.</li>
</ul>

<h2>Virtual Try-On</h2>
<p>Try-on images are AI-generated previews to help you imagine a look. They are illustrative only and may not exactly match fit, drape, colour or size. Only upload photos of yourself, or of someone who has agreed to it. Do not upload photos of children.</p>

<h2>Your account</h2>
<p>Keep your login details private. You are responsible for activity on your account. Please do not misuse the website, attempt to break its security, or use it for anything unlawful.</p>

<h2>Content</h2>
<p>Product photos, text, the Jeevana Vastra name and logo belong to Jeevana Vastra and may not be copied for commercial use without our permission.</p>

<h2>Liability</h2>
<p>We are responsible for supplying the products you order as described. To the extent allowed by law, we are not liable for indirect losses. Nothing in these terms affects your rights under Indian consumer law.</p>

<h2>Governing law</h2>
<p>These terms are governed by the laws of India, and the courts of Karnataka have jurisdiction.</p>

<h2>Changes</h2>
<p>We may update these terms. The latest version is always on this page, with the date it was last updated.</p>`;

export async function render({ params }) {
  const terms = params.doc === 'terms';
  setMeta(terms ? 'Terms of Service' : 'Privacy Policy', terms ? 'Terms of service for shopping at Jeevana Vastra.' : 'How Jeevana Vastra handles your information.');
  document.getElementById('app').innerHTML = `
  <section class="contact-hero"><div class="container">
    <span class="eyebrow">Jeevana Vastra</span>
    <h1>${terms ? 'Terms of <em>Service</em>' : 'Privacy <em>Policy</em>'}</h1>
    <p>Last updated: ${UPDATED}</p>
  </div></section>
  <article class="container legal">${terms ? TERMS : PRIVACY}</article>`;
}
