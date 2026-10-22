'use strict';
(async()=>{
 const api=YuganthAPI,message=document.querySelector('#message');const say=e=>message.textContent=e.message||String(e);
 async function refresh(){
  const [vs,cs,os,settings,ps]=await Promise.all([api.request('/admin/variants'),api.request('/admin/coupons'),api.request('/admin/orders'),api.request('/settings'),api.request('/admin/products')]);
  document.querySelector('#bannerText').value=settings.banner;
  const tbody=document.querySelector('#variants');tbody.replaceChildren();
  for(const variant of vs.variants){const row=document.createElement('tr');const label=document.createElement('td');label.textContent=variant.name+' · '+variant.weight_g+' g';row.append(label);const fields={};
   for(const [key,min,max]of [['price_paise',0,1000000],['stock',0,1000000],['active',0,1],['price_confirmed',0,1]]){const td=document.createElement('td');const input=document.createElement('input');input.type=['active','price_confirmed'].includes(key)?'checkbox':'number';input.min=min;input.max=max;input.step='1';input.value=variant[key];if(input.type==='checkbox')input.checked=!!Number(variant[key]);input.setAttribute('aria-label',variant.id+' '+key);fields[key]=input;td.append(input);row.append(td);}
   const cell=document.createElement('td');const save=document.createElement('button');save.textContent='Save';save.onclick=async()=>{save.disabled=true;try{const body={id:variant.id,expected_stock:Number(variant.stock)};for(const key in fields)body[key]=fields[key].type==='checkbox'?(fields[key].checked?1:0):Number(fields[key].value);await api.request('/admin/variant',body);variant.stock=body.stock;say('Variant saved.');}catch(e){say(e)}finally{save.disabled=false}};cell.append(save);row.append(cell);tbody.append(row);
  }
  const productHolder=document.querySelector('#productsAdmin');productHolder.replaceChildren();
  for(const product of ps.products){
   if(product.id==='pure-gold')continue;
   const form=document.createElement('form');form.className='commerce-panel';const title=document.createElement('h3');title.textContent=product.id;form.append(title);const fields={};
   for(const [key,label,options]of [['name','Product name',null],['description','Description',null],['origin','Origin',null],['category','Category',['spices','seeds','nuts','flours']],['launch_status','Launch status',['available','coming_soon']],['active','Visible in shop',['1','0']]]){
    const id='product-'+product.id+'-'+key;const lab=document.createElement('label');lab.htmlFor=id;lab.textContent=label;const field=document.createElement(options?'select':key==='description'?'textarea':'input');field.id=id;field.name=key;
    if(options)for(const value of options){const option=document.createElement('option');option.value=value;option.textContent=value==='1'?'Yes':value==='0'?'No':value.replaceAll('_',' ');field.append(option);}
    else {field.maxLength=key==='description'?2000:120;if(key!=='origin')field.required=true;}
    field.value=product[key];fields[key]=field;form.append(lab,field);
   }
   const save=document.createElement('button');save.textContent='Save product';form.append(save);form.onsubmit=async event=>{event.preventDefault();save.disabled=true;try{const body={id:product.id};for(const key in fields)body[key]=key==='active'?Number(fields[key].value):fields[key].value;await api.request('/admin/product',body);say('Product saved. Reload the storefront to see the update.');}catch(e){say(e)}finally{save.disabled=false}};const group=document.createElement('details');group.className='product-editor';const summary=document.createElement('summary');summary.textContent=product.name+' · '+product.launch_status.replaceAll('_',' ');group.append(summary,form);productHolder.append(group);
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
