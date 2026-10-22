'use strict';
(async()=>{
  try{
    const [session,catalog,settings]=await Promise.all([YuganthAPI.session(),YuganthAPI.request('/catalog'),YuganthAPI.request('/settings')]);
    store.catalog=new Map(catalog.products.map(p=>[p.id,p]));store.connected=true;store.checkoutEnabled=!!session.checkout_enabled;
    for(const p of products){
      const live=store.catalog.get(p.id);p.hidden=!live;
      if(!live)continue;
      p.name=live.name;p.description=live.description;p.origin=live.origin;p.category=live.category;p.new=live.launch_status!=='available';
    }
    const announcement=document.querySelector('.announcement>span');if(announcement)announcement.textContent=settings.banner;
    renderHome();renderSpotlight();route();updateBag();
    if(/^[1-9][0-9]{7,14}$/.test(settings.whatsapp_number)){
      const link=document.createElement('a');link.className='chat-link';link.href='https://wa.me/'+settings.whatsapp_number;link.textContent='Chat with Yuganth';link.target='_blank';link.rel='noopener';document.body.append(link);
    }
  }catch{
    store.connected=false;store.checkoutEnabled=false;updateBag();
    const banner=document.querySelector('.announcement>span');if(banner)banner.textContent='STORE CONNECTION UNAVAILABLE · PLEASE TRY AGAIN LATER';
  }
})();
