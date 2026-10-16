'use strict';
(async () => {
  const checkout = document.querySelector('#checkout');
  checkout.onclick = () => { location.href = 'checkout.html'; };
  const accountLinks = document.querySelector('.account-links');
  accountLinks.replaceChildren();
  for (const [title, href] of [['Sign in / Create account', 'account.html'], ['My orders & tracking', 'account.html#orders'], ['Saved addresses', 'account.html#addresses']]) {
    const link = document.createElement('a'); link.textContent = title; link.href = href; accountLinks.append(link);
  }
  document.querySelector('.account-note').textContent = 'Your Yuganth account, orders and saved delivery addresses.';
  const notice = document.querySelector('#cart .notice');
  notice.textContent = 'Connecting to the store…';
  const ids = ['guntur-gold', 'araku-gold', 'spice-loom', 'pure-gold'];
  let connected = false;
  const previousUpdate = update;
  update = function () { previousUpdate(); if (!connected) checkout.disabled = true; };
  checkout.disabled = true;
  try {
    const [session, catalog, settings] = await Promise.all([YuganthAPI.session(), YuganthAPI.request('/catalog'), YuganthAPI.request('/settings')]);
    const byId = new Map(catalog.products.map(p => [p.id, p]));
    items.forEach((item, index) => {
      const product = byId.get(ids[index]);
      item.variants = product?.variants || [];
      item.sold = !item.variants.some(v => Number(v.stock) > 0);
      if (product) {
        // Names/copy remain the approved editorial content; prices and stock come from the server.
        item.base = Number(item.variants.find(v => Number(v.weight_g) === 100)?.price_paise || 0) / 100;
      }
    });
    price = (index, grams) => Number(items[index].variants.find(v => Number(v.weight_g) === Number(grams))?.price_paise || 0) / 100;
    const previousAdd = add;
    add = function (index, grams) {
      const variant = items[index]?.variants.find(v => Number(v.weight_g) === Number(grams));
      const inCart = bag.find(x => x.i === index && x.w === grams)?.q || 0;
      if (!variant || inCart >= Number(variant.stock)) {
        const toast = document.querySelector('#toast'); toast.textContent = 'This pack size has insufficient stock.'; toast.style.display = 'block'; setTimeout(() => toast.style.display = 'none', 2500); return;
      }
      previousAdd(index, grams);
    };
    connected = true; route(); update();
    notice.textContent = session.checkout_enabled ? 'Delivery and any coupon are calculated securely at checkout. Stock is checked again before ordering.' : 'The store is being prepared. Online checkout is not enabled yet.';
    // Browse and account features remain usable with checkout disabled.
    if (!session.checkout_enabled) { const prev = update; update = function () { prev(); checkout.disabled = true; }; checkout.disabled = true; }
    document.querySelectorAll('.offer-track span').forEach(span => span.textContent = settings.banner);
    if (/^[1-9][0-9]{7,14}$/.test(settings.whatsapp_number)) {
      const chat = document.createElement('a'); chat.className = 'chat-link'; chat.href = 'https://wa.me/' + settings.whatsapp_number; chat.textContent = 'Chat with Yuganth'; chat.target = '_blank'; chat.rel = 'noopener'; document.body.append(chat);
    }
  } catch {
    connected = false; checkout.disabled = true;
    notice.textContent = 'Design preview only. The store backend is not connected; prices and stock shown are illustrative.';
  }
})();
