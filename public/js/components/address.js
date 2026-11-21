// Address card + add/edit form (used by checkout and account).
import { api } from '../api.js';
import { esc, openModal, closeModal } from '../ui.js';

const STATES = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu & Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'];

export const addressText = (a) => `${esc(a.line1)}${a.line2 ? `, ${esc(a.line2)}` : ''}<br>${esc(a.city)}, ${esc(a.state)} – ${esc(a.pincode)}<br>Phone: ${esc(a.phone)}`;

export function addressForm(existing, user) {
  const a = existing || { name: user?.name || '', phone: user?.phone || '', label: 'Home', state: 'Karnataka' };
  return new Promise((resolve) => {
    const card = openModal(`<form style="padding:30px" id="addrForm" novalidate>
      <h2 style="font-size:32px;margin-bottom:18px">${existing ? 'Edit address' : 'Add a new address'}</h2>
      <div class="form-grid">
        <div class="field"><label for="aName">Full name</label><input class="input" id="aName" name="name" required value="${esc(a.name)}" autocomplete="name"></div>
        <div class="field"><label for="aPhone">Mobile number</label><input class="input" id="aPhone" name="phone" required inputmode="numeric" maxlength="10" value="${esc(a.phone)}" autocomplete="tel-national"></div>
        <div class="field full"><label for="aL1">House / flat, street</label><input class="input" id="aL1" name="line1" required value="${esc(a.line1 || '')}" autocomplete="address-line1"></div>
        <div class="field full"><label for="aL2">Area, landmark (optional)</label><input class="input" id="aL2" name="line2" value="${esc(a.line2 || '')}" autocomplete="address-line2"></div>
        <div class="field"><label for="aCity">City</label><input class="input" id="aCity" name="city" required value="${esc(a.city || '')}" autocomplete="address-level2"></div>
        <div class="field"><label for="aPin">PIN code</label><input class="input" id="aPin" name="pincode" required inputmode="numeric" maxlength="6" value="${esc(a.pincode || '')}" autocomplete="postal-code"></div>
        <div class="field"><label for="aState">State</label><select class="select" id="aState" name="state">${STATES.map((s) => `<option ${s === a.state ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div class="field"><label for="aLabel">Save as</label><select class="select" id="aLabel" name="label">${['Home', 'Work', 'Other'].map((s) => `<option ${s === a.label ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <label class="check full" style="margin-bottom:10px"><input type="checkbox" name="is_default" ${a.is_default ? 'checked' : ''}> Make this my default address</label>
      </div>
      <div class="form-error" id="aErr"></div>
      <button class="btn btn-block">Save address</button>
    </form>`, { narrow: true });
    const form = card.querySelector('#addrForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      data.is_default = !!data.is_default;
      const btn = form.querySelector('button.btn');
      btn.classList.add('is-loading');
      try {
        const res = existing ? await api.put(`/account/addresses/${existing.id}`, data) : await api.post('/account/addresses', data);
        closeModal();
        resolve(res);
      } catch (err) { form.querySelector('#aErr').textContent = err.message; } finally { btn.classList.remove('is-loading'); }
    });
  });
}
