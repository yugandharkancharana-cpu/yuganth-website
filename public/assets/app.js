'use strict';

let products=[

{id:'guntur-gold',name:'Guntur Gold',type:'RED CHILLI POWDER',category:'spices',bg:'#7d2937',ink:'#f6f0df',disc:'#e9b559',new:false,copy:'Bold colour and character for curries, chutneys and the recipes you keep coming back to.',origin:'Guntur'},

{id:'araku-gold',name:'Araku Gold',type:'TURMERIC POWDER',category:'spices',bg:'#d8a443',ink:'#15372b',disc:'#f6df9e',new:false,copy:'Golden colour and earthy flavour for the dishes that make your kitchen feel like home.',origin:'Araku'},

{id:'spice-loom',name:'Spice Loom',type:'RED CHILLI POWDER',category:'spices',bg:'#efe5cf',ink:'#18382c',disc:'#d6b178',new:false,copy:'Guntur meets Bygadi in a red chilli powder with a character all of its own.',origin:'Guntur & Bygadi'},

{id:'chia-seeds',name:'Chia Seeds',type:'CHIA SEEDS',category:'seeds',bg:'#245544',ink:'#f6f0df',disc:'#ceb278',new:true,copy:'A new addition for breakfast bowls, soaked chia recipes and your everyday kitchen rituals.',origin:'Origin to be confirmed'},

{id:'peanuts',name:'Peanuts',type:'PEANUTS',category:'nuts',bg:'#b95732',ink:'#fff3da',disc:'#ebbd73',new:true,copy:'An everyday favourite for chutneys, cooking and the recipes you make your own. Contains peanuts.',origin:'Origin to be confirmed'},

{id:'ragi-flour',name:'Ragi Flour',type:'FINGER MILLET FLOUR',category:'flours',bg:'#714150',ink:'#fff2df',disc:'#c29475',new:true,copy:'A new staple for ragi dosa, porridge and traditional finger millet recipes.',origin:'Origin to be confirmed'}];

let images=Object.fromEntries(products.map(p=>[p.id,'assets/'+p.id+'.webp']));

const $=s=>document.querySelector(s);const find=id=>products.find(p=>p.id===id);

let featured=0,filter='all',list=[],toastTimer;

try{const saved=JSON.parse(localStorage.getItem('yuganth-motion-shortlist')||'[]');if(Array.isArray(saved))list=[...new Set(saved.filter(id=>find(id)&&!find(id).new))];}catch{}

const categories=[['all','THE FULL PANTRY'],['spices','SPICES'],['seeds','SEEDS'],['nuts','NUTS'],['flours','FLOURS'],['next','COMING NEXT']];

function render(){

 $('#filters').innerHTML=categories.map(([id,label])=>`<button data-filter="${id}" class="${filter===id?'active':''}" aria-pressed="${filter===id}">${label}</button>`).join('');

 const visible=filter==='all'?products:filter==='next'?products.filter(p=>p.new):products.filter(p=>p.category===filter);

 $('#productGrid').innerHTML=visible.map(p=>`<article class="product-card" style="--card-bg:${p.bg};--card-ink:${p.ink};--card-disc:${p.disc}"><div class="product-top"><span>${p.new?'THE NEXT CHAPTER':'THE SPICE COLLECTION'}</span><span>500 g</span></div><h3>${p.name.toUpperCase()}</h3><p class="product-subtitle">${p.type}</p><div class="card-art"><img src="${images[p.id]}" alt="Yuganth ${p.name} 500 g pack" width="800" height="1200" loading="lazy"></div><div class="card-bottom"><span>${p.new?'COMING SOON':'PRICE TO BE CONFIRMED'}</span><button data-product="${p.id}" aria-label="Explore ${p.name}">EXPLORE PACK ↗</button></div></article>`).join('');

}

function updateHero(){const p=products[featured];if(!p)return;$('#heroPack').src=images[p.id];$('#heroPack').alt=p.name+' 500 g pack';$('#heroName').textContent=p.name;$('#heroType').textContent=p.type+' · 500 g'+(p.new?' · COMING SOON':'');$('#heroIndex').textContent=String(featured+1).padStart(2,'0')+' / '+String(products.length).padStart(2,'0');$('.hero-disc').style.background=p.disc;}

function closeMenu(){$('#nav').classList.remove('open');$('#menu').setAttribute('aria-expanded','false');$('#menu').setAttribute('aria-label','Open menu');}

$('#menu').onclick=()=>{const open=$('#nav').classList.toggle('open');$('#menu').setAttribute('aria-expanded',String(open));$('#menu').setAttribute('aria-label',open?'Close menu':'Open menu');};

document.querySelectorAll('header a').forEach(a=>a.addEventListener('click',closeMenu));

$('#heroPrev').onclick=()=>{featured=(featured+products.length-1)%products.length;updateHero();};$('#heroNext').onclick=()=>{featured=(featured+1)%products.length;updateHero();};$('#heroName').setAttribute('aria-live','polite');

function openDialog(dialog){dialog.showModal();document.body.style.overflow='hidden';}

function showProduct(id){const p=find(id);if(!p)return;$('#productDetails').innerHTML=`<div class="product-dialog-grid"><img src="${images[id]}" alt="${p.name} packaging" width="800" height="1200"><div><span class="eyebrow">${p.new?'COMING SOON':'THE YUGANTH PANTRY'}</span><h2 id="dialogName">${p.name.toUpperCase()}</h2><p>${p.copy}</p><div class="dialog-facts">500 g PACK SHOWN<br>${p.origin}</div>${p.new?`<a class="button dark" href="mailto:Support@yuganth.com?subject=${encodeURIComponent('Launch enquiry: '+p.name)}">ASK ABOUT THE LAUNCH ↗</a>`:`<button class="button dark" data-save="${id}">SAVE TO PANTRY LIST +</button>`}<p class="small">Prices, launch dates and final product information are to be confirmed. This concept does not accept orders.</p></div></div>`;openDialog($('#productDialog'));}

function toast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2400);}

function updateList(){

 $('#listCount').textContent=list.length;$('#listItems').innerHTML=list.length?list.map(id=>{const p=find(id);return `<div class="list-line"><img src="${images[id]}" alt="${p.name}" width="65" height="98"><div><h3>${p.name.toUpperCase()}</h3><p>500 g · Price to be confirmed</p><button data-remove="${id}" aria-label="Remove ${p.name}">REMOVE</button></div></div>`;}).join(''):'<p>Your pantry list is empty. Explore the collection to find a favourite.</p>';try{localStorage.setItem('yuganth-motion-shortlist',JSON.stringify(list));}catch{}

}

$('#listOpen').onclick=()=>{updateList();openDialog($('#listDialog'));};

document.addEventListener('click',event=>{const f=event.target.closest('[data-filter]');if(f){filter=f.dataset.filter;render();return;}const p=event.target.closest('[data-product]');if(p){showProduct(p.dataset.product);return;}const save=event.target.closest('[data-save]');if(save){const p=find(save.dataset.save);if(!p||p.new)return;if(!list.includes(p.id)){list.push(p.id);updateList();toast(p.name+' saved to your pantry list.');}else toast(p.name+' is already in your pantry list.');return;}const remove=event.target.closest('[data-remove]');if(remove){list=list.filter(id=>id!==remove.dataset.remove);updateList();return;}const close=event.target.closest('[data-close]');if(close)close.closest('dialog').close();});

document.querySelectorAll('dialog').forEach(dialog=>{dialog.addEventListener('close',()=>{if(!document.querySelector('dialog[open]'))document.body.style.overflow='';});dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});});

document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});

const reduce=matchMedia('(prefers-reduced-motion:reduce)');let ticking=false;let motionPaused=reduce.matches;

function scrollScene(){ticking=false;if(reduce.matches||motionPaused)return;const area=$('.motion-area'),scene=$('.hero-scene'),travel=Math.max(1,area.offsetHeight-scene.offsetHeight);const progress=innerWidth<=600?0:Math.max(0,Math.min(1,(-area.getBoundingClientRect().top+document.querySelector('header').offsetHeight)/travel));scene.style.setProperty('--scroll',progress.toFixed(4));$('#scrollProgress').style.width=(progress*100)+'%';const position=$('#roots').getBoundingClientRect().top;$('#roots').style.setProperty('--roots-shift',Math.max(-75,Math.min(75,(innerHeight-position)*.08)).toFixed(1));}

function schedule(){if(!ticking){ticking=true;requestAnimationFrame(scrollScene);}}

window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);reduce.addEventListener('change',()=>{if(reduce.matches){$('.hero-scene').style.setProperty('--scroll','0');$('#roots').style.setProperty('--roots-shift','0');}else schedule();});

if(matchMedia('(pointer:fine)').matches){$('.hero-art').addEventListener('pointermove',e=>{if(reduce.matches||motionPaused)return;const r=$('.hero-art').getBoundingClientRect();$('#heroPack').style.setProperty('--tilt-x',(((e.clientX-r.left)/r.width-.5)*18)+'deg');$('#heroPack').style.setProperty('--tilt-y',(-((e.clientY-r.top)/r.height-.5)*10)+'deg');});$('.hero-art').addEventListener('pointerleave',()=>{$('#heroPack').style.setProperty('--tilt-x','0deg');$('#heroPack').style.setProperty('--tilt-y','0deg');});}

render();updateHero();updateList();schedule();

// Additional motion and a dedicated reviews route. No customer reviews are fabricated.

const homeSections=[...document.querySelector('main').children].filter(el=>el.id!=='reviewsPage');

let reviewDraft=null;let approvedReviews=[];let tourTimer=null;let reviewRouteActive=false;

try{const saved=JSON.parse(localStorage.getItem('yuganth-review-draft')||'null');if(saved&&find(saved.product)&&Number.isInteger(saved.rating)&&saved.rating>=1&&saved.rating<=5&&typeof saved.name==='string'&&saved.name.length<=80&&typeof saved.title==='string'&&saved.title.length<=100&&typeof saved.text==='string'&&saved.text.length>=15&&saved.text.length<=1500)reviewDraft=saved;}catch{}

function animateElement(el,frames,duration=700,delay=0){if(!el||reduce.matches||motionPaused)return;return el.animate(frames,{duration,delay,easing:'cubic-bezier(.18,.72,.22,1)',fill:'backwards'});}

function heroEntrance(){

 animateElement($('.hero-copy .eyebrow'),[{opacity:0,transform:'translateY(18px)'},{opacity:1,transform:'translateY(0)'}],650,40);

 animateElement($('.hero-copy h1'),[{opacity:0,transform:'translateY(38px)',filter:'blur(7px)'},{opacity:1,transform:'translateY(0)',filter:'blur(0)'}],950,100);

 animateElement($('.hero-description'),[{opacity:0,transform:'translateY(20px)'},{opacity:.78,transform:'translateY(0)'}],750,270);

 animateElement($('.hero-copy>.button'),[{opacity:0,transform:'translateY(18px)'},{opacity:1,transform:'translateY(0)'}],700,380);

 animateElement($('#heroTilt'),[{opacity:0,transform:'translateY(70px) rotate(-18deg) scale(.74)'},{opacity:1,transform:getComputedStyle($('#heroTilt')).transform}],1100,170);

 animateElement($('.hero-disc'),[{opacity:0,transform:'scale(.65)'},{opacity:.95,transform:'scale(1)'}],1000,80);

}

function restartTour(){clearTimeout(tourTimer);if(motionPaused||reduce.matches||reviewRouteActive||!products.length)return;tourTimer=setTimeout(()=>{const box=$('.hero-scene').getBoundingClientRect();if(!document.hidden&&box.top<innerHeight&&box.bottom>100&&!document.querySelector('dialog[open]')){featured=(featured+1)%products.length;updateHero();}else restartTour();},5200);}

const originalUpdateHero=updateHero;

updateHero=function(){originalUpdateHero();animateElement($('#heroTilt'),[{opacity:.2,transform:'translateY(24px) rotate(9deg) scale(.88)'},{opacity:1,transform:getComputedStyle($('#heroTilt')).transform}],700);animateElement($('#heroName'),[{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],500);restartTour();};

const originalOpenDialog=openDialog;openDialog=function(dialog){originalOpenDialog(dialog);animateElement(dialog,[{opacity:0,transform:'translateY(25px) scale(.98)'},{opacity:1,transform:'translateY(0) scale(1)'}],350);};

const revealObserver='IntersectionObserver'in window?new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting)entry.target.classList.add('is-visible');else if(entry.boundingClientRect.top>innerHeight)entry.target.classList.remove('is-visible');}},{threshold:.08,rootMargin:'0px 0px -20px 0px'}):null;

function decorateReveals(){if(!revealObserver)return;document.body.classList.add('motion-ready');document.querySelectorAll('.section-heading,.product-card,.roots-steps article,.roots-intro,.next-copy,.next-art,.questions>div,.review-teaser>div,.reviews-hero h1,.reviews-intro,.review-invitation').forEach((el,index)=>{if(el.dataset.revealReady)return;el.dataset.revealReady='true';el.classList.add('reveal');el.style.setProperty('--reveal-delay',(el.classList.contains('product-card')?(index%3)*.08:0)+'s');revealObserver.observe(el);});}

const originalRender=render;render=function(){originalRender();decorateReveals();};

function syncMotionControl(){document.body.classList.toggle('motion-paused',motionPaused);$('#motionToggle').textContent=reduce.matches?'REDUCED MOTION ON':motionPaused?'▶ PLAY MOTION':'Ⅱ PAUSE MOTION';$('#motionToggle').disabled=reduce.matches;$('#motionToggle').setAttribute('aria-pressed',String(!motionPaused));restartTour();}

$('#motionToggle').onclick=()=>{motionPaused=!motionPaused;if(motionPaused){clearTimeout(tourTimer);document.getAnimations().filter(a=>!('animationName'in a)).forEach(a=>{try{a.finish();}catch{}});}syncMotionControl();if(!motionPaused)schedule();};

reduce.addEventListener('change',()=>{motionPaused=reduce.matches;syncMotionControl();});

for(const p of products){for(const select of [$('#reviewProduct'),$('#reviewProductFilter')]){const option=document.createElement('option');option.value=p.id;option.textContent=p.name;select.append(option);}}

function reviewCard(review,draft=false){

 const card=document.createElement('article');card.className='review-card';

 if(draft){const badge=document.createElement('span');badge.className='draft-badge';badge.textContent='PRIVATE DRAFT · NOT PUBLISHED';card.append(badge);}

 const stars=document.createElement('div');stars.className='stars';stars.textContent='★'.repeat(review.rating)+'☆'.repeat(5-review.rating);stars.setAttribute('aria-label',review.rating+' out of 5 stars');card.append(stars);

 const title=document.createElement('h3');title.textContent=review.title;const body=document.createElement('p');body.textContent=review.text;const meta=document.createElement('p');meta.className='review-meta';meta.textContent=review.name+' · '+(find(review.product)?.name||review.product);card.append(title,body,meta);

 if(draft){const actions=document.createElement('div');actions.className='draft-actions';const edit=document.createElement('button');edit.textContent='Edit draft';edit.onclick=()=>openReviewForm();const remove=document.createElement('button');remove.textContent='Delete draft';remove.onclick=()=>{reviewDraft=null;try{localStorage.removeItem('yuganth-review-draft');}catch{}renderDraft();toast('Your local review draft was removed.');};actions.append(edit,remove);card.append(actions);}

 return card;

}

function renderPublishedReviews(){

 const product=$('#reviewProductFilter').value,rating=$('#reviewRatingFilter').value;

 const reviews=approvedReviews.filter(r=>(product==='all'||r.product===product)&&(rating==='all'||r.rating===Number(rating)));

 $('#publishedCount').textContent=approvedReviews.length?approvedReviews.length+' CUSTOMER REVIEWS':'NO CUSTOMER REVIEWS PUBLISHED YET';

 const holder=$('#publishedReviews');holder.replaceChildren();

 if(!reviews.length){const empty=document.createElement('div');empty.className='reviews-empty';const symbol=document.createElement('div');symbol.className='empty-emblem';symbol.setAttribute('aria-hidden','true');symbol.textContent='✳';const title=document.createElement('h3');title.textContent='BE THE FIRST TO SHARE YOUR STORY.';const text=document.createElement('p');text.textContent='There are no published customer reviews here yet. Tell us what you made with Yuganth.';const button=document.createElement('button');button.className='button dark';button.textContent='WRITE A REVIEW ↗';button.onclick=()=>openReviewForm();empty.append(symbol,title,text,button);holder.append(empty);}

 else {const list=document.createElement('div');list.className='review-list';for(const review of reviews)list.append(reviewCard(review));holder.append(list);}

}

function renderDraft(){$('#draftSection').hidden=!reviewDraft;$('#draftCard').replaceChildren();if(reviewDraft)$('#draftCard').append(reviewCard(reviewDraft,true));}

function openReviewForm(){

 const form=$('#reviewForm');form.reset();$('#reviewFormMessage').textContent='';if(reviewDraft){for(const key of ['product','name','title','text'])form.elements.namedItem(key).value=reviewDraft[key];form.elements.namedItem('rating').value=String(reviewDraft.rating);}

 openDialog($('#reviewDialog'));

}

$('#writeReview').onclick=()=>openReviewForm();$('#writeReviewBottom').onclick=()=>openReviewForm();

$('#reviewProductFilter').onchange=renderPublishedReviews;$('#reviewRatingFilter').onchange=renderPublishedReviews;

$('#reviewForm').onsubmit=event=>{event.preventDefault();const form=event.currentTarget;if(!form.reportValidity())return;const values=new FormData(form);const draft={product:String(values.get('product')),rating:Number(values.get('rating')),name:String(values.get('name')).trim(),title:String(values.get('title')).trim(),text:String(values.get('text')).trim()};if(!find(draft.product)||!Number.isInteger(draft.rating)||draft.rating<1||draft.rating>5||!draft.name||draft.name.length>80||!draft.title||draft.title.length>100||draft.text.length<15||draft.text.length>1500){$('#reviewFormMessage').textContent='Please complete the review fields with valid details.';return;}try{localStorage.setItem('yuganth-review-draft',JSON.stringify(draft));}catch{$('#reviewFormMessage').textContent='This browser cannot save a draft. Please enable local storage or copy your text.';return;}reviewDraft=draft;renderDraft();$('#reviewDialog').close();if(location.hash!=='#reviews')location.hash='#reviews';else $('#draftSection').scrollIntoView({behavior:reduce.matches?'instant':'smooth',block:'center'});toast('Private draft saved. It has not been submitted or published.');};

function showRoute(){

 reviewRouteActive=location.hash==='#reviews';homeSections.forEach(el=>el.hidden=reviewRouteActive);$('#reviewsPage').hidden=!reviewRouteActive;closeMenu();

 document.querySelectorAll('header nav a').forEach(a=>{if(a.hash==='#reviews'&&reviewRouteActive)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});

 document.title=reviewRouteActive?'Customer reviews · Yuganth':'Yuganth · Rooted in flavour';

 if(reviewRouteActive){renderPublishedReviews();renderDraft();window.scrollTo({top:0,behavior:'instant'});const title=$('#reviewsPage h1');title.tabIndex=-1;title.focus({preventScroll:true});}

 else if(location.hash){requestAnimationFrame(()=>{const target=document.getElementById(location.hash.slice(1));if(target)target.scrollIntoView({behavior:reduce.matches?'instant':'smooth'});});}

 decorateReveals();restartTour();

}

window.addEventListener('hashchange',showRoute);decorateReveals();renderPublishedReviews();renderDraft();showRoute();syncMotionControl();if(!reviewRouteActive)heroEntrance();

