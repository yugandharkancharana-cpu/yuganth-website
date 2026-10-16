'use strict';
(async()=>{
  const api=YuganthAPI,message=document.querySelector('#message');let current=null;
  const say=e=>message.textContent=e.message||String(e);
  async function refresh(){
    const s=await api.session();current=s.user;document.querySelector('#auth').hidden=!!current;document.querySelector('#profile').hidden=!current;
    if(!current)return;
    document.querySelector('#greeting').textContent='Welcome, '+current.name+'.';document.querySelector('#adminLink').hidden=current.role!=='admin';
    const {orders}=await api.request('/orders');const holder=document.querySelector('#orders');holder.replaceChildren();
    if(!orders.length)holder.textContent='Your first flavour is waiting. No orders yet.';
    for(const order of orders){const card=document.createElement('article');card.className='order-card';const title=document.createElement('strong');title.textContent=order.id;card.append(title);const p=document.createElement('p');p.textContent=order.status.replaceAll('_',' ')+' · '+api.money(order.total_paise)+' · '+new Date(Number(order.created_at)*1000).toLocaleDateString();card.append(p);
      const details=document.createElement('button');details.textContent='View order details';details.onclick=async()=>{try{const {order:full}=await api.request('/orders/'+order.id);const text=document.createElement('p');text.textContent=full.items.map(x=>x.name+' '+x.weight_g+' g × '+x.quantity).join(' · ')+' | Delivery: '+[full.address.name,full.address.line1,full.address.city,full.address.pincode].join(', ');card.append(text);details.disabled=true;}catch(e){say(e)}};card.append(details);
      if(order.tracking_url&&/^https:\/\//.test(order.tracking_url)){const link=document.createElement('a');link.textContent='Track delivery ↗';link.href=order.tracking_url;link.target='_blank';link.rel='noopener';card.append(document.createElement('br'),link);}
      if(order.status==='pending_payment'){const cancel=document.createElement('button');cancel.textContent='Cancel unpaid order';cancel.onclick=async()=>{try{await api.request('/orders/'+order.id+'/cancel',{});await refresh();}catch(e){say(e)}};card.append(cancel);}holder.append(card);
    }
    const {addresses}=await api.request('/addresses');const target=document.querySelector('#addresses');target.replaceChildren();
    for(const entry of addresses){const card=document.createElement('div');card.className='order-card';const p=document.createElement('p');p.textContent=Object.values(entry.address).filter(Boolean).join(', ');const remove=document.createElement('button');remove.textContent='Remove address';remove.onclick=async()=>{try{await api.request('/addresses',{action:'delete',id:entry.id});await refresh();}catch(e){say(e)}};card.append(p,remove);target.append(card);}
  }
  for(const [formId,route]of [['login','/auth/login'],['register','/auth/register']])document.getElementById(formId).onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;try{await api.request(route,Object.fromEntries(new FormData(e.target)));e.target.reset();message.textContent='You are signed in.';await refresh();}catch(error){say(error)}finally{button.disabled=false}};
  document.querySelector('#logout').onclick=async()=>{try{await api.request('/auth/logout',{});await refresh();message.textContent='Signed out.';}catch(e){say(e)}};
  document.querySelector('#forgot').onclick=async()=>{try{const email=document.querySelector('#loginEmail').value;if(!email)throw new Error('Enter your email in the sign-in form first.');const result=await api.request('/auth/forgot',{email});say(result.message);}catch(e){say(e)}};
  document.querySelector('#addressForm').onsubmit=async e=>{e.preventDefault();try{await api.request('/addresses',{address:Object.fromEntries(new FormData(e.target))});e.target.reset();await refresh();say('Address saved.');}catch(e){say(e)}};
  const token=location.hash.startsWith('#reset=')?location.hash.slice(7):'';
  if(token){document.querySelector('#reset').hidden=false;document.querySelector('#reset').onsubmit=async e=>{e.preventDefault();try{await api.request('/auth/reset',{token,password:new FormData(e.target).get('password')});e.target.reset();document.querySelector('#reset').hidden=true;history.replaceState(null,'','account.html');await refresh();say('Password changed. Please sign in.');}catch(e){say(e)}};}
  try{await refresh();}catch(e){say(e)}
})();
