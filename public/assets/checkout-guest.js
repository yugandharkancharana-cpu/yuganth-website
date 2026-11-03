'use strict';
(async()=>{
 const api=YuganthAPI,form=document.querySelector('#checkoutForm'),message=document.querySelector('#message'),place=document.querySelector('#place'),consent=document.querySelector('#purchaseTerms');
 const lines=YuganthCart.read();let enabled=false,validBag=true,user=null,quoted='',pending=null,busy=false;
 const payload=()=>{const d=Object.fromEntries(new FormData(form));return {items:lines.map(x=>({variant_id:x.variant_id,quantity:x.quantity})),address:{name:d.name,phone:d.phone,line1:d.line1,line2:d.line2,city:d.city,state:d.state,pincode:d.pincode},coupon:d.coupon||'',terms_accepted:consent.checked,terms_version:'2026-11-03'};};
 const fingerprint=()=>JSON.stringify({...payload(),terms_accepted:undefined});
 function buttons(){place.disabled=busy||!enabled||!validBag||!consent.checked||quoted!==fingerprint();}
 async function guestRequest(route,body,options={}){
  const headers={Accept:'application/json'};
  if(body!==undefined){headers['Content-Type']='application/json';headers['X-CSRF-Token']=api.csrf;}
  if(options.key)headers['Idempotency-Key']=options.key;
  let response;try{response=await fetch('api/guest.php?route='+encodeURIComponent(route),{method:body===undefined?'GET':'POST',credentials:'same-origin',headers,...(body===undefined?{}:{body:JSON.stringify(body)})});}catch{throw new Error('Unable to connect. Keep your order reference and try again.');}
  let data;try{data=await response.json();}catch{throw new Error('Checkout is temporarily unavailable. Contact Yuganth before paying again.');}
  if(!response.ok)throw new Error(data.error||'Your request could not be completed.');return data;
 }
 const requests=guest=>guest?guestRequest:api.request.bind(api);
 function total(data){const el=document.querySelector('#totals');el.replaceChildren();for(const [label,key]of [['Subtotal','subtotal_paise'],['Discount','discount_paise'],['Delivery','shipping_paise'],['Total','total_paise']]){const row=document.createElement('div');row.className='line-row';row.textContent=label+': '+(key==='shipping_paise'&&Number(data[key])===0?'FREE':api.money(data[key]));el.append(row);}}
 function identity(){document.querySelector('#checkoutIdentity').textContent=user?'Signed in as '+user.name:'Continue as a guest — no account needed.';document.querySelector('#checkoutSignIn').hidden=!!user;buttons();}
 function remember(value){try{sessionStorage.setItem('yuganth-order-receipt',JSON.stringify(value));}catch{}}
 function receipt(order,guest){
  const holder=document.querySelector('#orderReceipt');holder.hidden=false;holder.replaceChildren();
  const heading=document.createElement('h2');heading.textContent='Thank you for choosing Yuganth.';
  const status=document.createElement('p');status.textContent='Payment confirmed · '+order.status.replaceAll('_',' ');
  const ref=document.createElement('p');ref.className='order-reference';ref.textContent='Order reference: '+order.id;
  const note=document.createElement('p');note.textContent=guest?'Keep this reference for delivery updates or support. This guest order is available in this browser session.':'Your order is available in My account.';
  const support=document.createElement('a');support.textContent='Ask about this order on WhatsApp ↗';support.href='https://wa.me/919618423344?text='+encodeURIComponent('Hello Yuganth, please help with order '+order.id);support.target='_blank';support.rel='noopener';
  holder.append(heading,status,ref,note,support);
  const account=document.createElement('a');account.href='account.html';account.textContent=guest?'Create an account for future orders':'View My account';holder.append(account);
  if(guest){const explanation=document.createElement('p');explanation.className='small';explanation.textContent='An account is optional. It saves details for future purchases; this guest order remains under the reference above.';holder.append(explanation);}
  remember({id:order.id,guest});holder.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
 }
 form.addEventListener('input',event=>{if(event.target===consent){buttons();return;}quoted='';document.querySelector('#payment').replaceChildren();buttons();});
 document.addEventListener('yuganth-auth-changed',async()=>{try{const s=await api.session();user=s.user;enabled=s.checkout_enabled;identity();message.textContent='Check your delivery details to continue.';}catch(e){message.textContent=e.message;}});
 document.querySelector('#quote').onclick=async()=>{
  if(!form.reportValidity())return;
  const checked=fingerprint(),body=payload();busy=true;buttons();message.textContent='Checking delivery and total…';
  try{const q=await api.request('/cart/quote',{items:body.items,coupon:body.coupon,pincode:body.address.pincode,state:body.address.state});
   if(checked!==fingerprint()){message.textContent='Your details changed. Please check delivery again.';return;}
   total(q);quoted=checked;message.textContent=enabled?'Delivery checked. Review your total and accept the purchase terms to continue.':'Checkout is temporarily unavailable.';
  }catch(e){quoted='';message.textContent=e.message;}finally{busy=false;buttons();}
 };
 form.onsubmit=async e=>{
  e.preventDefault();if(busy||!enabled||!validBag||!consent.checked||quoted!==fingerprint()||!form.reportValidity())return;
  busy=true;buttons();message.textContent='Preparing your order…';
  const body=payload(),guest=!user,request=requests(guest),attempt=JSON.stringify({body,owner:user?.id||'guest'});
  try{const saved=JSON.parse(sessionStorage.getItem('yuganth-checkout-attempt')||'null');pending=saved?.fingerprint===attempt?saved:{key:crypto.randomUUID(),fingerprint:attempt};sessionStorage.setItem('yuganth-checkout-attempt',JSON.stringify(pending));}catch{pending=pending?.fingerprint===attempt?pending:{key:crypto.randomUUID(),fingerprint:attempt};}
  try{
   const {order}=await request('/orders',body,{key:pending.key});total(order);remember({id:order.id,guest});
   message.textContent='Order '+order.id+' reserved. Review the final total, then open secure payment.';
   const holder=document.querySelector('#payment');holder.replaceChildren();const pay=document.createElement('button');pay.type='button';pay.textContent='Open secure payment';holder.append(pay);
   pay.onclick=async()=>{pay.disabled=true;try{
    const {checkout}=await request('/orders/'+order.id+'/payment',{});
    if(checkout.mode==='manual_test'){message.textContent=checkout.message;return;}
    if(typeof window.YuganthPayment?.open!=='function')throw new Error('The payment window is unavailable. Your order remains unpaid.');
    await window.YuganthPayment.open(checkout,{orderId:order.id,request});
    const confirmed=await request('/orders/'+order.id);
    if(['processing','shipped','delivered'].includes(confirmed.order.status)){YuganthCart.write([]);try{sessionStorage.removeItem('yuganth-checkout-attempt');}catch{}message.textContent='Payment confirmed.';receipt(confirmed.order,guest);form.hidden=true;}
    else message.textContent='Payment is being confirmed. Keep order '+order.id+' and contact support before paying again.';
   }catch(error){message.textContent=error.message;pay.disabled=false;}};
  }catch(error){message.textContent=error.message;}finally{busy=false;buttons();}
 };
 try{
  const [s,catalog]=await Promise.all([api.session(),api.request('/catalog')]);user=s.user;enabled=s.checkout_enabled;identity();
  let saved;try{saved=JSON.parse(sessionStorage.getItem('yuganth-order-receipt')||'null');}catch{}
  if(saved&&/^[a-f0-9]{32}$/.test(saved.id)&&typeof saved.guest==='boolean'){
   try{const {order}=await requests(saved.guest)('/orders/'+saved.id);if(['processing','shipped','delivered'].includes(order.status)){receipt(order,saved.guest);if(!lines.length)form.hidden=true;}}catch{}
  }
  if(!lines.length){form.hidden=true;message.textContent=document.querySelector('#orderReceipt').hidden?'Your bag is empty. Explore the pantry to add products.':'Your latest order is shown below.';return;}
  const variants=new Map();for(const p of catalog.products)for(const v of p.variants)variants.set(v.id,{p,v});const summary=document.querySelector('#summary');summary.replaceChildren();
  for(const line of lines){const item=variants.get(line.variant_id),row=document.createElement('div');row.className='line-row';row.textContent=item?`${item.p.name} · ${item.v.weight_g} g × ${line.quantity}`:'Unavailable pack';summary.append(row);if(!item||item.p.launch_status!=='available'||!Number(item.v.price_confirmed)||Number(item.v.stock)<line.quantity)validBag=false;}
  message.textContent=!validBag?'Some packs are unavailable. Return to your bag to review them.':enabled?'Enter your delivery details. No account is needed.':'Checkout is temporarily unavailable. Please contact Yuganth.';buttons();
 }catch(e){enabled=false;message.textContent=e.message;buttons();}
})();
