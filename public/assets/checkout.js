'use strict';
(async () => {
  const api = YuganthAPI, form = document.querySelector('#checkoutForm'), message = document.querySelector('#message'), place = document.querySelector('#place');
  let lines = YuganthCart.read(), enabled = false, loggedIn = false, quoteFingerprint = '', pending = null;
  if (!lines.length) { message.textContent = 'Your bag is empty. Return to the collection to add products.'; return; }
  const payload = () => { const data = Object.fromEntries(new FormData(form)); return { items: lines.map(x => ({ variant_id: x.variant_id, quantity: x.quantity })), address: { name:data.name,phone:data.phone,line1:data.line1,line2:data.line2,city:data.city,state:data.state,pincode:data.pincode }, coupon:data.coupon }; };
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
        const confirmed=await api.request('/orders/'+order.id);if(['processing','shipped','delivered'].includes(confirmed.order.status)){YuganthCart.write([]);sessionStorage.removeItem('yuganth-checkout-attempt');message.textContent='Payment confirmed. View your order in My account.';}else message.textContent='Payment submitted. Check My account for server-confirmed status.';
      }catch(error){message.textContent=error.message;button.disabled=false;}};
    }catch(error){message.textContent=error.message;place.disabled=false;}
  };
  try {
    const [s,catalog]=await Promise.all([api.session(),api.request('/catalog')]);enabled=s.checkout_enabled;loggedIn=!!s.user;
    const variants=new Map();for(const p of catalog.products)for(const v of p.variants)variants.set(v.id,{product:p,variant:v});
    const summary=document.querySelector('#summary');summary.replaceChildren();let invalid=false;
    for(const line of lines){const entry=variants.get(line.variant_id);const div=document.createElement('div');div.className='line-row';
      div.textContent=entry?`${entry.product.name} · ${entry.variant.weight_g} g × ${line.quantity}`:`Unavailable pack: ${line.variant_id}`;
      summary.append(div);if(!entry||entry.product.launch_status!=='available'||!Number(entry.variant.price_confirmed)||Number(entry.variant.stock)<line.quantity)invalid=true;
    }
    if(invalid){enabled=false;message.textContent='Some packs are unavailable or awaiting price confirmation. Return to the bag to review them.';}
    else message.textContent=enabled?(loggedIn?'Enter your address to check delivery.':'Please sign in before ordering.'):'The store is being prepared. Checkout is disabled.';
  }
  catch(e){message.textContent=e.message;}
})();
