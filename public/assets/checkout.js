'use strict';
(async () => {
  const api = YuganthAPI, form = document.querySelector('#checkoutForm'), message = document.querySelector('#message'), place = document.querySelector('#place');
  const names = ['Guntur Gold', 'Araku Gold', 'Spice Loom', 'Pure Gold'];
  const ids = ['guntur-gold', 'araku-gold', 'spice-loom', 'pure-gold'];
  let lines = [], enabled = false, loggedIn = false, quoteFingerprint = '', pending = null;
  try { const saved = JSON.parse(localStorage.getItem('yuganth-demo-bag') || '[]'); lines = Array.isArray(saved) ? saved.filter(x => Number.isInteger(x.i) && ids[x.i] && [100,250,500,1000].includes(x.w) && Number.isInteger(x.q) && x.q > 0 && x.q <= 99) : []; } catch {}
  for (const line of lines) { const div = document.createElement('div'); div.className = 'line-row'; div.textContent = `${names[line.i]} · ${line.w} g × ${line.q}`; document.querySelector('#summary').append(div); }
  if (!lines.length) { message.textContent = 'Your bag is empty. Return to the collection to add products.'; return; }
  const payload = () => { const data = Object.fromEntries(new FormData(form)); return { items: lines.map(x => ({ variant_id: ids[x.i] + '-' + x.w, quantity: x.q })), address: { name:data.name,phone:data.phone,line1:data.line1,line2:data.line2,city:data.city,state:data.state,pincode:data.pincode }, coupon:data.coupon }; };
  function showTotal(data) { const total = document.querySelector('#totals'); total.replaceChildren(); for (const [label,key] of [['Subtotal','subtotal_paise'],['Discount','discount_paise'],['Delivery','shipping_paise'],['Total','total_paise']]) { const row = document.createElement('div'); row.className='line-row'; row.textContent = label + ': ' + api.money(data[key]); total.append(row); } }
  form.addEventListener('input', () => { place.disabled = true; quoteFingerprint = ''; pending = null; document.querySelector('#payment').replaceChildren(); });
  document.querySelector('#quote').onclick = async () => {
    if (!form.reportValidity()) return;
    try { const body=payload();const quote=await api.request('/cart/quote',{items:body.items,coupon:body.coupon,pincode:body.address.pincode});showTotal(quote);quoteFingerprint=JSON.stringify(body);place.disabled=!(enabled&&loggedIn);message.textContent=!loggedIn?'Sign in using My account, then return to checkout.':enabled?'Delivery checked. Review your total and continue.':'Checkout is not enabled yet.'; }
    catch(e){message.textContent=e.message;place.disabled=true;}
  };
  form.onsubmit = async e => {
    e.preventDefault();const body=payload();if (!enabled||!loggedIn||quoteFingerprint!==JSON.stringify(body)) return;
    place.disabled=true;message.textContent='Preparing your order…';
    // Keep the idempotency key across network failures and page refreshes for the same payload.
    const fingerprint=JSON.stringify(body);
    try { const saved=JSON.parse(sessionStorage.getItem('yuganth-checkout-attempt')||'null');pending=saved?.fingerprint===fingerprint?saved:{key:crypto.randomUUID(),fingerprint};sessionStorage.setItem('yuganth-checkout-attempt',JSON.stringify(pending)); }
    catch { pending ||= {key:crypto.randomUUID(),fingerprint}; }
    try {
      const {order}=await api.request('/orders',body,{key:pending.key});
      // A price change since the quote is shown for explicit review before starting provider checkout.
      showTotal(order);
      message.textContent='Order '+order.id+' reserved. Review the final total before opening payment.';
      const holder=document.querySelector('#payment');holder.replaceChildren();const button=document.createElement('button');button.textContent='Open secure payment';holder.append(button);
      button.onclick=async()=>{button.disabled=true;try {const {checkout}=await api.request('/orders/'+order.id+'/payment',{});if(checkout.mode==='manual_test'){message.textContent=checkout.message+' View the reservation in My account.';return;}
        // Developers implement this provider-specific browser hook; no client response marks an order paid.
        if (typeof window.YuganthPayment?.open!=='function') throw new Error('Payment interface is not configured. Your order remains unpaid.');
        await window.YuganthPayment.open(checkout,{orderId:order.id});
        message.textContent='Payment submitted. Check My account for server-confirmed status.';
      }catch(error){message.textContent=error.message;button.disabled=false;}};
    }catch(error){message.textContent=error.message;place.disabled=false;}
  };
  try { const s=await api.session();enabled=s.checkout_enabled;loggedIn=!!s.user;message.textContent=enabled?(loggedIn?'Enter your address to check delivery.':'Please sign in before ordering.'):'The store is being prepared. Checkout is disabled.'; }
  catch(e){message.textContent=e.message;}
})();
