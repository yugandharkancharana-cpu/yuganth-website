'use strict';
(async()=>{
 const api=YuganthAPI,message=document.querySelector('#message');const say=e=>message.textContent=e.message||String(e);
 async function refresh(){
  const [vs,cs,os,settings]=await Promise.all([api.request('/admin/variants'),api.request('/admin/coupons'),api.request('/admin/orders'),api.request('/settings')]);
  document.querySelector('#bannerText').value=settings.banner;
  const tbody=document.querySelector('#variants');tbody.replaceChildren();
  for(const variant of vs.variants){const row=document.createElement('tr');const label=document.createElement('td');label.textContent=variant.name+' · '+variant.weight_g+' g';row.append(label);const fields={};
   for(const [key,min,max]of [['price_paise',1,1000000],['stock',0,1000000],['active',0,1]]){const td=document.createElement('td');const input=document.createElement('input');input.type='number';input.min=min;input.max=max;input.step='1';input.value=variant[key];input.setAttribute('aria-label',variant.id+' '+key);fields[key]=input;td.append(input);row.append(td);}
   const cell=document.createElement('td');const save=document.createElement('button');save.textContent='Save';save.onclick=async()=>{save.disabled=true;try{const body={id:variant.id,expected_stock:Number(variant.stock)};for(const key in fields)body[key]=Number(fields[key].value);await api.request('/admin/variant',body);variant.stock=body.stock;say('Variant saved.');}catch(e){say(e)}finally{save.disabled=false}};cell.append(save);row.append(cell);tbody.append(row);
  }
  const coupons=document.querySelector('#coupons');coupons.replaceChildren();for(const c of cs.coupons){const p=document.createElement('p');p.textContent=c.code+' · '+c.percent+'% · '+(Number(c.active)?'enabled':'disabled')+' · '+c.uses+' reserved/used';coupons.append(p);}
  const orders=document.querySelector('#orders');orders.replaceChildren();for(const o of os.orders){const card=document.createElement('div');card.className='order-card';const p=document.createElement('p');p.textContent=o.id+' · '+o.status+' · '+api.money(o.total_paise);card.append(p);
   if(['pending_payment','processing','shipped'].includes(o.status)){const tracking=document.createElement('input');tracking.type='url';tracking.placeholder='https://courier.example/tracking';tracking.setAttribute('aria-label','Tracking URL for '+o.id);if(o.status==='processing')card.append(tracking);const action=document.createElement('button');const next={pending_payment:'cancelled',processing:'shipped',shipped:'delivered'}[o.status];action.textContent={cancelled:'Cancel unpaid reservation',shipped:'Mark shipped',delivered:'Mark delivered'}[next];action.onclick=async()=>{action.disabled=true;try{await api.request('/admin/order',{id:o.id,status:next,tracking_url:tracking.value});await refresh();say('Order updated.');}catch(e){say(e);action.disabled=false}};card.append(action);}orders.append(card);
  }
 }
 document.querySelector('#banner').onsubmit=async e=>{e.preventDefault();try{await api.request('/admin/banner',Object.fromEntries(new FormData(e.target)));say('Banner saved.');}catch(e){say(e)}};
 document.querySelector('#couponForm').onsubmit=async e=>{e.preventDefault();try{const f=new FormData(e.target),body={code:f.get('code'),starts_at:Math.floor(new Date(f.get('starts')).getTime()/1000),ends_at:Math.floor(new Date(f.get('ends')).getTime()/1000),active:f.has('active')?1:0};for(const k of ['percent','minimum_paise','max_discount_paise','usage_limit'])body[k]=Number(f.get(k));await api.request('/admin/coupon',body);await refresh();say('Coupon saved.');}catch(e){say(e)}};
 try{const s=await api.session();if(s.user?.role!=='admin')throw new Error('Sign in with an administrator account to manage this store.');await refresh();document.querySelector('#admin').hidden=false;}catch(e){say(e)}
})();
