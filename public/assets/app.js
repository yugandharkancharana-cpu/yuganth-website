'use strict';
const products = [
  { id:'guntur-gold',name:'Guntur Gold',type:'Red chilli powder',category:'spices',colour:'#7d2d39',background:'#642c34',origin:'Guntur',new:false,headline:'A little heat.<br>A lot of character.',short:'The bold beginning of a favourite curry.',description:'For the recipes that call for colour and character. Guntur Gold red chilli powder brings a bold note to curries, chutneys and everyday cooking.',uses:'Stir into curries and gravies, or reach for it when a familiar recipe needs a little heat.' },
  { id:'araku-gold',name:'Araku Gold',type:'Turmeric powder',category:'spices',colour:'#ac6c16',background:'#775020',origin:'Araku',new:false,headline:'A golden touch.<br>An everyday ritual.',short:'Golden colour. A familiar earthy warmth.',description:'A familiar ingredient with a character of its own. Araku Gold turmeric powder brings golden colour and earthy flavour to the dishes you make every day.',uses:'Add to dals, vegetable dishes, curries and the recipes where turmeric feels right at home.' },
  { id:'spice-loom',name:'Spice Loom',type:'Red chilli powder',category:'spices',colour:'#a34725',background:'#603f2d',origin:'Guntur & Bygadi',new:false,headline:'Two origins.<br>One bold story.',short:'Guntur meets Bygadi in a familiar favourite.',description:'Spice Loom brings together the character of Guntur and Bygadi chillies. Discover a red chilli powder made for recipes with a little more personality.',uses:'Explore it in curries, marinades and the family recipes you return to.' },
  { id:'chia-seeds',name:'Chia Seeds',type:'Chia seeds',category:'seeds',colour:'#244c3c',background:'#244c3c',origin:'Origin to be confirmed',new:true,headline:'Small seeds.<br>New possibilities.',short:'A little something for your daily routine.',description:'A new addition to the Yuganth pantry. Explore chia seeds for the breakfasts, bowls and everyday recipes you make your own.',uses:'Try in soaked chia puddings or add to your usual breakfast recipes. Follow the preparation guidance on the final pack.' },
  { id:'peanuts',name:'Peanuts',type:'Peanuts',category:'nuts',colour:'#b35229',background:'#884224',origin:'Origin to be confirmed',new:true,headline:'A familiar crunch.<br>A fresh chapter.',short:'For the recipes, snacks and moments between.',description:'An everyday favourite is joining the Yuganth family. Discover peanuts for chutneys, cooking and the recipes that make your kitchen feel like home.',uses:'Use in peanut chutney, cooking and recipes appropriate to the final product preparation. Contains peanuts; check the final allergen label.' },
  { id:'ragi-flour',name:'Ragi Flour',type:'Finger millet flour',category:'flours',colour:'#704050',background:'#603747',origin:'Origin to be confirmed',new:true,headline:'Something grounded.<br>Something new.',short:'A new staple for familiar kitchen rituals.',description:'Meet the flour joining our next chapter. Yuganth Ragi Flour makes room for finger millet in the recipes and everyday meals you love to prepare.',uses:'Explore in ragi dosa, porridge and traditional recipes. Follow the cooking directions on the final pack.' }
];
const imageAssets=Object.fromEntries(products.map(p=>[p.id,'assets/'+p.id+'-cutout.webp']));
const categories=[['all','All products'],['spices','Spices'],['seeds','Seeds'],['nuts','Nuts'],['flours','Flours'],['new','Coming next']];
const $=s=>document.querySelector(s);
const byId=id=>products.find(p=>p.id===id);
let homeFilter='all',collectionFilter='all',spotlightIndex=0,toastTimer;
const store={connected:false,checkoutEnabled:false,catalog:new Map()};
let bag=YuganthCart.read();
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function safeProduct(p){const clean={...p};for(const key of ['name','description','origin','type','short','uses'])clean[key]=escapeHTML(p[key]||'');return clean;}
function card(p){p=safeProduct(p);return `<article class="product-card"><a class="product-picture" href="#product/${p.id}" aria-label="Explore ${p.name}"><span class="product-tag">${p.new?'COMING SOON':'THE SPICE COLLECTION'}</span><img src="${imageAssets[p.id]}" alt="Yuganth ${p.name} 500 g pack" width="800" height="1200" loading="lazy"><span class="product-arrow" aria-hidden="true">↗</span></a><div class="product-meta"><span><i class="colour-dot" style="background:${p.colour}"></i>${p.category.toUpperCase()}</span><span>500 g</span></div><h3><a href="#product/${p.id}">${p.name}</a></h3><p class="product-description">${p.short}</p><p class="product-note">${p.new?'A new addition. Launch date coming soon.':priceLabel(p.id)}</p></article>`;}
function filtered(category,list=products){list=list.filter(p=>!p.hidden);return category==='all'?list:category==='new'?list.filter(p=>p.new):list.filter(p=>p.category===category);}
function filters(target,current,scope){$(target).innerHTML=categories.map(([id,label])=>`<button type="button" data-filter="${id}" data-scope="${scope}" class="${id===current?'active':''}" aria-pressed="${id===current}">${label}</button>`).join('');}
function renderHome(){filters('#homeFilters',homeFilter,'home');$('#homeGrid').innerHTML=filtered(homeFilter).map(card).join('');}
function renderCollection(){
  const query=$('#productSearch').value.trim().toLowerCase();
  let list=filtered(collectionFilter).filter(p=>(p.name+' '+p.type+' '+p.origin+' '+p.category).toLowerCase().includes(query));
  if($('#productSort').value==='name')list=[...list].sort((a,b)=>a.name.localeCompare(b.name));
  filters('#collectionFilters',collectionFilter,'collection');
  $('#collectionGrid').innerHTML=list.length?list.map(card).join(''):'<div class="empty-results"><h3>No matches just yet.</h3><p>Try a different product name or category.</p><button class="button primary" id="clearSearch">Reset search ↗</button></div>';
  $('#resultCount').textContent=list.length+' '+(list.length===1?'product':'products')+' to explore';
}
function renderSpotlight(){
  const visible=products.filter(p=>!p.hidden);if(!visible.length){$('#spotlight').hidden=true;return;}$('#spotlight').hidden=false;const p=safeProduct(visible[spotlightIndex%visible.length]);$('#spotlight').style.background=p.background;
  $('#spotlightImage').src=imageAssets[p.id];$('#spotlightImage').alt=`Yuganth ${p.name} pack`;
  $('#spotlightIndex').textContent=String(spotlightIndex%visible.length+1).padStart(2,'0')+' / '+String(visible.length).padStart(2,'0');
  $('#spotlightContent').innerHTML=`<span class="eyebrow">MEET ${p.name.toUpperCase()}${p.new?' · COMING SOON':''}</span><h2>${p.headline}</h2><p>${p.description}</p><div class="spotlight-specs"><div><span>IN THE PACK</span>${p.type}</div><div><span>PACK SIZE SHOWN</span>500 g</div></div>`;
  $('#spotlightLink').href='#product/'+p.id;$('#spotlightLink').innerHTML=`Get to know ${p.name} <span>↗</span>`;
}
function productPage(p){p=safeProduct(p);
  $('#productContent').innerHTML=`<div class="product-intro-line"><div class="wrap"><a href="#home">Home</a> / <a href="#collection/${p.category}">${p.category[0].toUpperCase()+p.category.slice(1)}</a> / <span>${p.name}</span></div></div><div class="wrap product-detail"><div class="product-detail-art"><img src="${imageAssets[p.id]}" alt="${p.name} 500 g packaging" width="800" height="1200" fetchpriority="high"></div><div class="product-detail-copy"><span class="eyebrow">${p.new?'THE NEXT CHAPTER · COMING SOON':'THE YUGANTH SPICE COLLECTION'}</span><h1>${p.name}</h1><p class="product-detail-type">${p.type}</p><p class="product-detail-description">${p.description}</p><div class="product-detail-specs"><div><span>PACK SIZE SHOWN</span>500 g</div><div><span>${p.new?'LAUNCH STATUS':'ON THE PACK'}</span>${p.new?'Coming soon':p.origin}</div></div>${purchasePanel(p)}<details open><summary>In your kitchen</summary><p>${p.uses}</p></details><details><summary>Pack & product information</summary><p>This design uses the supplied 500 g front pack. Ingredients, storage, shelf life, allergen information and the final label details will be added before launch.</p></details><details><summary>Delivery & returns</summary><p>Delivery availability, charges and the final returns policy will be confirmed when the store launches. Contact Support@yuganth.com for product enquiries.</p></details></div></div>`;
  const others=products.filter(x=>x.id!==p.id&&!x.hidden);const related=[...others.filter(x=>x.category===p.category),...others.filter(x=>x.category!==p.category)].slice(0,3);$('#relatedGrid').innerHTML=related.map(card).join('');
}
function closeMenu(){$('#navigation').classList.remove('open');$('#menuToggle').setAttribute('aria-expanded','false');$('#menuToggle').setAttribute('aria-label','Open menu');}
function route(){
  const hash=location.hash.slice(1)||'home',parts=hash.split('/');let page=['collection','product','story','contact'].includes(parts[0])?parts[0]:'home';
  const product=page==='product'?products.find(p=>p.id===parts[1]&&!p.hidden):null;if(page==='product'&&!product)page='collection';
  document.querySelectorAll('[data-page]').forEach(section=>section.hidden=section.dataset.page!==page);
  if(page==='collection'){
    collectionFilter=categories.some(([id])=>id===parts[1])?parts[1]:'all';$('#productSearch').value='';
    const titles={all:'Find your<br><em>everyday.</em>',spices:'A little more<br><em>character.</em>',seeds:'Small seeds.<br><em>New rituals.</em>',nuts:'The familiar<br><em>favourites.</em>',flours:'Back to<br><em>the grain.</em>',new:'Our next<br><em>chapter.</em>'};
    const descriptions={all:'Six distinct packs. Spices, seeds, nuts and flours. Explore the Yuganth family and find a little something for your everyday.',spices:'Meet Guntur Gold, Araku Gold and Spice Loom. Three spice packs, each with a character of its own.',seeds:'Meet Chia Seeds, a new addition coming to the Yuganth pantry.',nuts:'Peanuts are joining the collection. A familiar favourite in a fresh new pack.',flours:'Ragi Flour is joining the pantry. Discover our next everyday staple.',new:'Chia Seeds, Peanuts and Ragi Flour are on the way. Explore the new packs while launch dates and prices are being finalised.'};
    $('#collectionTitle').innerHTML=titles[collectionFilter];$('#collectionDescription').textContent=descriptions[collectionFilter];renderCollection();
  }
  if(page==='product')productPage(product);
  document.title=page==='product'?product.name+' · Yuganth':page==='story'?'Our roots · Yuganth':page==='collection'?'The pantry · Yuganth':page==='contact'?'Let’s talk · Yuganth':'Yuganth — A pantry with character';
  const currentNav=page==='collection'&&collectionFilter==='new'?'#collection/new':['collection','product'].includes(page)?'#collection/all':'#'+page;document.querySelectorAll('#navigation a').forEach(a=>{if(a.hash===currentNav)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  document.querySelectorAll('dialog[open]').forEach(d=>d.close());closeMenu();window.scrollTo({top:0,behavior:'instant'});
  const h=document.querySelector(`[data-page="${page}"] h1`);if(h){h.tabIndex=-1;h.focus({preventScroll:true});}
}
function packFor(id){for(const product of store.catalog.values()){const v=product.variants.find(v=>v.id===id);if(v)return {product,variant:v};}return null;}
function priceLabel(id){const p=store.catalog.get(id);const v=p?.variants.find(v=>Number(v.weight_g)===500)||p?.variants[0];return v&&Number(v.price_confirmed)&&Number(v.price_paise)>0?YuganthAPI.money(v.price_paise):'Price to be confirmed';}
function available(variant,product){return !!(store.connected&&product?.launch_status==='available'&&variant&&Number(variant.price_confirmed)&&Number(variant.price_paise)>0&&Number(variant.stock)>0);}
function purchasePanel(p){
 const live=store.catalog.get(p.id),variants=live?.variants||[],v=variants.find(v=>Number(v.weight_g)===500)||variants[0];
 if(p.new)return `<a class="button primary" href="mailto:Support@yuganth.com?subject=${encodeURIComponent('Launch enquiry: '+byId(p.id).name)}">Ask about the launch <span>↗</span></a><p class="small-note">Launch date and price to be confirmed.</p>`;
 const options=variants.length?variants.map(v=>`<option value="${escapeHTML(v.id)}" ${Number(v.weight_g)===500?'selected':''}>${Number(v.weight_g)} g</option>`).join(''):'<option value="">500 g</option>';
 return `<label class="pack-choice">Pack size <select id="packVariant" aria-label="Pack size for ${p.name}">${options}</select></label><p class="product-price" id="packPrice">${priceLabel(p.id)}</p><button class="button primary" id="addPack" data-add="${p.id}" ${available(v,live)?'':'disabled'}>Add to bag <span>+</span></button><p class="small-note" id="packAvailability">${!store.connected?'Connecting to the store…':!v||!Number(v.price_confirmed)?'Price is awaiting confirmation.':Number(v.stock)>0?'Stock and delivery are checked again at checkout.':'Currently out of stock.'}</p>`;
}
function refreshPack(){
 const select=$('#packVariant');if(!select)return;const pack=packFor(select.value),v=pack?.variant,p=pack?.product;
 $('#packPrice').textContent=v&&Number(v.price_confirmed)?YuganthAPI.money(v.price_paise):'Price to be confirmed';$('#addPack').disabled=!available(v,p);
 $('#packAvailability').textContent=!store.connected?'Store unavailable. Please try again later.':!v||!Number(v.price_confirmed)?'Price is awaiting confirmation.':Number(v.stock)>0?'Stock and delivery are checked again at checkout.':'Currently out of stock.';
}
function updateBag(){
 $('#bagCount').textContent=bag.reduce((total,line)=>total+line.quantity,0);
 let subtotal=0,valid=bag.length>0&&store.connected;
 $('#bagItems').innerHTML=bag.length?bag.map(line=>{
  const pack=packFor(line.variant_id),p=pack?.product,v=pack?.variant,known=byId(p?.id);
  if(!p||!v||!available(v,p)||line.quantity>Number(v.stock))valid=false;
  if(v&&Number(v.price_confirmed))subtotal+=Number(v.price_paise)*line.quantity;
  return `<div class="bag-line">${known?`<img src="${imageAssets[p.id]}" alt="${escapeHTML(p.name)}" width="65" height="98">`:'<span></span>'}<div><h3>${escapeHTML(p?.name||'Unavailable pack')}</h3><p>${v?Number(v.weight_g)+' g':'Pack no longer listed'} · ${v&&Number(v.price_confirmed)?YuganthAPI.money(v.price_paise):'Price unconfirmed'}</p><div class="bag-quantity"><button data-quantity="${escapeHTML(line.variant_id)}" data-step="-1" aria-label="Decrease quantity">−</button><span>${line.quantity}</span><button data-quantity="${escapeHTML(line.variant_id)}" data-step="1" aria-label="Increase quantity">+</button></div><button data-remove="${escapeHTML(line.variant_id)}">Remove</button></div></div>`;
 }).join(''):'<p>Your bag is empty. Find a little something for your pantry.</p>';
 $('#bagSubtotal').textContent=bag.length&&valid?'Subtotal: '+YuganthAPI.money(subtotal):'';
 $('#checkoutButton').disabled=!(valid&&store.checkoutEnabled);
 $('#checkoutNotice').textContent=!store.connected?'The store is not connected. Try again later.':!valid&&bag.length?'Review unavailable packs, unconfirmed prices or quantities.':store.checkoutEnabled?'Final stock, delivery and coupons are checked at checkout.':'Checkout is not enabled yet. You can keep browsing.';
 YuganthCart.write(bag);
}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2600);}
document.addEventListener('click',event=>{
  const filter=event.target.closest('[data-filter]');if(filter){if(filter.dataset.scope==='home'){homeFilter=filter.dataset.filter;renderHome();}else{collectionFilter=filter.dataset.filter;location.hash='#collection/'+collectionFilter;}return;}
  const add=event.target.closest('[data-add]');if(add){const pack=packFor($('#packVariant')?.value||''),v=pack?.variant;if(!available(v,pack?.product))return;let line=bag.find(x=>x.variant_id===v.id);if((line?.quantity||0)>=Math.min(99,Number(v.stock))){toast('This pack has insufficient available stock.');return;}if(line)line.quantity++;else bag.push({variant_id:v.id,quantity:1});updateBag();toast(pack.product.name+' added to your bag.');return;}
  const remove=event.target.closest('[data-remove]');if(remove){bag=bag.filter(line=>line.variant_id!==remove.dataset.remove);updateBag();return;}
  const qty=event.target.closest('[data-quantity]');if(qty){const line=bag.find(x=>x.variant_id===qty.dataset.quantity);if(!line)return;const q=line.quantity+Number(qty.dataset.step),v=packFor(line.variant_id)?.variant;if(q<1)bag=bag.filter(x=>x!==line);else if(q<=Math.min(99,Number(v?.stock||0)))line.quantity=q;else toast('This pack has insufficient available stock.');updateBag();return;}
  if(event.target.closest('[data-close]'))event.target.closest('dialog').close();
  if(event.target.closest('#clearSearch')){$('#productSearch').value='';renderCollection();$('#productSearch').focus();}
});
$('#menuToggle').onclick=()=>{const open=$('#navigation').classList.toggle('open');$('#menuToggle').setAttribute('aria-expanded',String(open));$('#menuToggle').setAttribute('aria-label',open?'Close menu':'Open menu');};
$('#bagOpen').onclick=()=>{bag=YuganthCart.read();updateBag();$('#bagDialog').showModal();};$('#accountOpen').onclick=()=>{location.href='account.html';};
$('#checkoutButton').onclick=()=>{if(!$('#checkoutButton').disabled)location.href='checkout.html';};
document.addEventListener('change',e=>{if(e.target.id==='packVariant')refreshPack();});
$('#continueShopping').onclick=()=>$('#bagDialog').close();
$('#searchOpen').onclick=()=>{if(!location.hash.startsWith('#collection/')){location.hash='#collection/all';}else $('#productSearch').focus();setTimeout(()=>$('#productSearch').focus(),0);};
$('#productSearch').oninput=renderCollection;$('#productSort').onchange=renderCollection;
$('#previousProduct').onclick=()=>{spotlightIndex=(spotlightIndex+products.length-1)%products.length;renderSpotlight();};
$('#nextProduct').onclick=()=>{spotlightIndex=(spotlightIndex+1)%products.length;renderSpotlight();};
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});
$('.skip').onclick=e=>{e.preventDefault();$('#main').focus();$('#main').scrollIntoView();};
window.addEventListener('hashchange',route);renderHome();renderSpotlight();updateBag();route();
