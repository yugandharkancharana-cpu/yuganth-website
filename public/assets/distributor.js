'use strict';
(() => {
  let csrf = '';
  const $ = selector => document.querySelector(selector);
  const money = paise => YuganthAPI.money(paise);
  async function request(route, body, key) {
    const headers = {Accept: 'application/json'};
    if (body !== undefined) Object.assign(headers, {...(body instanceof FormData ? {} : {'Content-Type': 'application/json'}), 'X-CSRF-Token': csrf});
    if (key) headers['Idempotency-Key'] = key;
    const response = await fetch('api/distributor.php?route=' + encodeURIComponent(route), {
      method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', headers,
      ...(body === undefined ? {} : {body: body instanceof FormData ? body : JSON.stringify(body)})
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
    if (data.csrf) csrf = data.csrf;
    return data;
  }
  function node(tag, text, parent) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (parent) parent.append(element);
    return element;
  }
  function field(parent, title, element) {
    node('label', title, parent).append(element);
    return element;
  }
  function input(type, name, min, max) {
    const element = node('input');
    Object.assign(element, {type, name, min, max, required: true});
    return element;
  }
  function packing(value) { return value === 'branded' ? 'Yuganth branded packets' : 'Loose bulk packing'; }
  function describe(order, target) {
    const address = order.address, details = address.distributor;
    node('p', `Reference: ${order.id}`, target);
    node('p', `${details.company} · ${address.name} · ${address.phone} · ${details.email}`, target);
    node('p', [address.line1,address.line2,address.city,address.state,address.pincode,'India'].filter(Boolean).join(', '), target);
    if (details.gstin) node('p', `GSTIN: ${details.gstin}`, target);
    const list = node('ul', undefined, target);
    for (const line of details.lines) node('li', `${line.name} · ${packing(line.pack)} · ${line.grams} g × ${line.quantity}`, list);
    node('p', `Agreed amount ${money(order.subtotal_paise)} · GST (${details.gst_bps / 100}%) ${money(details.gst_paise)} · Total ${money(order.total_paise)}`, target);
  }

  async function checkout() {
    const form = $('#bulkForm'), lines = $('#bulkLines'), message = $('#message');
    const {products} = await request('/catalog');
    const catalog = new Map(products.map(product => [product.id, product]));
    const payment = $('#bulkPayment'), proof = $('#bulkProof');
    const referenceKey = 'yuganth-distributor-order';
    let order, checkoutKey;
    function totals() {
      const rates = new Set([...lines.querySelectorAll('select[name=product]')].map(element => catalog.get(element.value)?.gst_bps));
      const raw = form.elements.agreed.value;
      const amount = Math.round(Number(raw) * 100);
      if (rates.size > 1) { $('#bulkTotals').textContent = 'Products with different GST rates need separate orders.'; return; }
      const rate = [...rates][0];
      const gst = Math.floor((amount * rate + 5000) / 10000);
      $('#bulkTotals').textContent = amount > 0 && rate !== undefined && form.elements.agreed.validity.valid
        ? `Subtotal ${money(amount)} · GST (${rate / 100}%) ${money(gst)} · Total ${money(amount + gst)}` : '';
    }
    function addLine() {
      if (lines.children.length >= 20) return;
      const line = node('fieldset', undefined, lines); line.className = 'bulk-line';
      node('legend', 'Product line', line);
      const product = field(line, 'Product', node('select')); product.name = 'product';
      for (const entry of products) product.add(new Option(entry.name, entry.id));
      const pack = field(line, 'Packing', node('select')); pack.name = 'pack';
      for (const value of ['branded','loose']) pack.add(new Option(packing(value), value));
      const grams = field(line, 'Size per pack (g)', input('number', 'grams', 1, 100000)); grams.placeholder = 'e.g. 500 or 5000';
      field(line, 'Quantity (packs)', input('number', 'quantity', 1, 10000)).value = '1';
      const remove = node('button', 'Remove line', line); remove.type = 'button';
      remove.onclick = () => { if (lines.children.length > 1) {line.remove(); totals();} };
      totals();
    }
    function showOrder(value) {
      order = value;
      sessionStorage.setItem(referenceKey, value.id);
      form.hidden = true; payment.hidden = false;
      $('#bulkReceipt').replaceChildren(); describe(value, $('#bulkReceipt'));
      const details = value.address.distributor;
      const awaiting = value.status === 'awaiting_transfer';
      proof.hidden = !awaiting;
      $('#bulkNew').hidden = false;
      if (awaiting && details.bank) {
        const bank = details.bank;
        node('h3','Bank transfer details',$('#bulkReceipt'));
        node('p',`${bank.holder} · ${bank.bank}`,$('#bulkReceipt'));
        node('p',`Account: ${bank.account} · IFSC: ${bank.ifsc}`,$('#bulkReceipt'));
        if (bank.branch) node('p','Branch: ' + bank.branch,$('#bulkReceipt'));
        if (bank.upi) node('p','UPI ID: ' + bank.upi,$('#bulkReceipt'));
        if (details.submitted_utr) node('p',`Submitted reference: ${details.submitted_utr}`,$('#bulkReceipt'));
        if (details.receipt) node('p','Screenshot received.',$('#bulkReceipt'));
        const link = node('a','Share proof on WhatsApp',$('#bulkReceipt'));
        link.href = 'https://wa.me/919618423344?text=' + encodeURIComponent('Transfer proof for Yuganth bulk order ' + value.id);
      }
      message.textContent = awaiting ? 'Awaiting bank payment verification.' :
        (['processing','shipped','delivered'].includes(value.status) ? 'Payment verified.' : 'Contact Yuganth with this reference to check the order.');
    }
    proof.onsubmit = async event => {
      event.preventDefault();
      const button = proof.querySelector('button');
      button.disabled = true;
      try {
        showOrder((await request(`/orders/${order.id}/receipt`,new FormData(proof))).order);
        proof.reset();
        message.textContent = 'Transfer details received. Yuganth will check the bank credit.';
      } catch (error) { message.textContent = error.message; }
      finally { button.disabled = false; }
    };
    $('#bulkNew').onclick = () => { sessionStorage.removeItem(referenceKey); location.reload(); };
    $('#addBulkLine').onclick = addLine;
    form.addEventListener('input', totals);
    form.onsubmit = async event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      const items = [...lines.children].map(line => ({id: line.querySelector('[name=product]').value, pack: line.querySelector('[name=pack]').value, grams: Number(line.querySelector('[name=grams]').value), quantity: Number(line.querySelector('[name=quantity]').value)}));
      const address = Object.fromEntries(['name','phone','line1','line2','city','state','pincode'].map(key => [key,data[key]]));
      const submit = form.querySelector('[type=submit]'); submit.disabled = true;
      checkoutKey ??= crypto.randomUUID().replaceAll('-', '');
      try {
        const result = await request('/orders', {items, address, company:data.company, email:data.email, gstin:data.gstin, agreed:data.agreed, accepted:form.elements.accepted.checked}, checkoutKey);
        showOrder(result.order); payment.scrollIntoView({block:'start'});
      } catch (error) { message.textContent = error.message; }
      finally { submit.disabled = false; }
    };
    const previous = sessionStorage.getItem(referenceKey);
    if (previous) {
      try { showOrder((await request(`/orders/${previous}`)).order); return; }
      catch (error) { message.textContent = `Previous reference: ${previous}. ${error.message} Contact Yuganth before paying again if charged.`; }
    }
    if (!products.length) { message.textContent = 'Contact Yuganth to arrange a bulk order.'; return; }
    addLine(); form.hidden = false;
  }

  async function admin() {
    const status = $('#bulkAdminStatus'), productsBox = $('#bulkAdminProducts');
    const bankForm = $('#distributorBank');
    if (bankForm) {
      const {bank} = await request('/admin/bank');
      bankForm.hidden = false;
      for (const key of ['holder','bank','account','ifsc','branch','upi']) bankForm.elements[key].value = bank?.[key] ?? '';
      bankForm.onsubmit = async event => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(bankForm));
        const save = bankForm.querySelector('button'); save.disabled = true;
        try {
          await request('/admin/bank',{...data,publish:bankForm.elements.publish.checked});
          bankForm.elements.publish.checked = false;
          status.textContent = 'Distributor bank details saved.';
        } catch (error) { status.textContent = error.message; }
        finally { save.disabled = false; }
      };
    }
    const {products} = await request('/admin/products');
    productsBox.replaceChildren();
    for (const product of products) {
      const form = node('form', undefined, productsBox); form.className = 'bulk-admin-form';
      node('strong', product.name, form);
      const available = node('input'); available.type = 'checkbox'; available.checked = product.enabled;
      const label = node('label', undefined, form); label.className = 'bulk-check'; label.append(available, ' Allow bulk orders');
      const rate = field(form, 'GST (%)', input('number', 'rate', 0, 28)); rate.step = '0.01'; rate.value = product.gst_bps / 100;
      const save = node('button', 'Save', form);
      form.onsubmit = async event => {
        event.preventDefault(); save.disabled = true;
        try { await request('/admin/products', {id:product.id, enabled:available.checked, gst_bps:Math.round(Number(rate.value)*100)}); status.textContent = `Saved ${product.name}.`; }
        catch (error) { status.textContent = error.message; }
        finally { save.disabled = false; }
      };
    }
  }

  async function orderWorkspace() {
    const status = $('#bulkAdminStatus'), type = $('#orderType'), filter = $('#orderStatus');
    const search = $('#orderSearch'), holder = $('#bulkAdminOrders'), reload = $('#reloadOrders');
    const dispatch = $('#normalDispatch');
    const labels = {awaiting_transfer:'Awaiting bank transfer', pending_payment:'Pending payment', processing:'Paid', shipped:'Shipped', delivered:'Delivered', cancelled:'Cancelled', expired:'Expired'};
    let orders = [], shipments = new Map(), shippingEnabled = false, loadVersion = 0;

    function actionForm(card, label, action) {
      const form = node('form', undefined, card);
      const button = node('button', label);
      form.onsubmit = async event => {
        event.preventDefault(); button.disabled = true;
        try { const message = await action(); await load(); status.textContent = message; }
        catch (error) { status.textContent = error.message; }
        finally { button.disabled = false; }
      };
      return {form, button};
    }

    function showDispatch(order, card) {
      const details = shipments.get(order.id);
      if (!details) return;
      const section = node('details', undefined, card);
      node('summary', 'Shiprocket dispatch', section);
      const state = details.shipment;
      if (state.status !== 'not_sent') {
        node('p', `${state.status.replaceAll('_',' ')}${state.order_id ? ' · Shiprocket ' + state.order_id : ''}`, section);
        return;
      }
      const {form,button} = actionForm(section, 'Send prepaid order to Shiprocket', async () => {
        const parcel = Object.fromEntries([...new FormData(form)].map(([key,value]) => [key,Number(value)]));
        const {shipment} = await YuganthAPI.request('/admin/shiprocket/send', {id:order.id, parcel});
        return `Sent to Shiprocket. Order ${shipment.order_id}.`;
      });
      for (const [key,label] of [['length','Length (cm)'],['breadth','Width (cm)'],['height','Height (cm)'],['weight','Packed weight (kg)']]) {
        const element = field(form,label,input('number',key,key === 'weight' ? 0.001 : 0.501,key === 'weight' ? 100 : 300));
        element.step = '0.001'; element.value = details.parcel?.[key] ?? '';
      }
      if (!shippingEnabled) node('p','Shiprocket is disabled in the store configuration.',form);
      button.disabled = !shippingEnabled; form.append(button);
    }

    function render() {
      const bulk = type.value === 'bulk', wanted = filter.value, term = search.value.trim().toLowerCase();
      holder.replaceChildren();
      const visible = orders.filter(order => {
        const address = order.address || {}, reviewed = !!address.distributor?.reviewed_at;
        const matches = !wanted || wanted === order.status || (order.status === 'processing' && (wanted === 'review' && !reviewed || wanted === 'accepted' && reviewed));
        return matches && [order.id,address.name,address.phone,address.distributor?.company].join(' ').toLowerCase().includes(term);
      });
      $('#orderCount').textContent = `${visible.length} of ${orders.length} recent ${bulk ? 'bulk' : 'normal'} orders`;
      if (!visible.length) node('p','No matching orders.',holder);
      for (const order of visible) {
        const card = node('article', undefined, holder); card.className = 'bulk-order';
        const details = order.address?.distributor, reviewed = !!details?.reviewed_at;
        node('h3', bulk && order.status === 'processing' ? (reviewed ? 'Paid · Phone quote accepted' : 'Paid · Awaiting quote confirmation') : labels[order.status] || order.status, card);
        node('p',new Date(Number(order.created_at)*1000).toLocaleString('en-IN'),card);
        if (bulk) describe(order,card);
        else {
          node('p',`Reference: ${order.id} · ${money(order.total_paise)}`,card);
          const a = order.address || {};
          node('p',[a.name,a.phone,a.line1,a.line2,a.city,a.state,a.pincode].filter(Boolean).join(' · '),card);
        }
        if (bulk && details?.verified_utr) node('p',`Verified bank reference: ${details.verified_utr}`,card);
        if (bulk && details?.receipt) {
          const link = node('a','Download transfer screenshot',card);
          link.href = 'api/distributor.php?route=' + encodeURIComponent('/admin/receipt/' + order.id);
        }
        if (bulk && order.status === 'awaiting_transfer') {
          if (details.submitted_utr) node('p',`Submitted bank reference: ${details.submitted_utr}`,card);
          const {form,button} = actionForm(card,'Verify bank credit',async () => {
            await request('/admin/verify-transfer',{id:order.id,amount:form.elements.amount.value,utr:form.elements.utr.value});
            return 'Bank payment verified. Check the phone quote before accepting this order.';
          });
          field(form,'Actual credited amount (₹)',input('text','amount','','')).inputMode = 'decimal';
          field(form,'Bank transaction reference',input('text','utr','','')).value = details.submitted_utr ?? '';
          form.append(button);
          continue;
        }
        if (bulk && order.status === 'processing' && !reviewed) {
          const {form,button} = actionForm(card,'Accept bulk order',async () => {
            await request('/admin/reconcile',{id:order.id,agreed:form.elements.quote.value});
            return 'Phone quote accepted. Arrange bulk delivery with your chosen carrier.';
          });
          const amount = field(form,'Original phone quote before GST (₹)',input('text','quote','',''));
          amount.inputMode = 'decimal'; form.append(button);
          continue;
        }
        if (!bulk && order.status === 'processing') showDispatch(order,card);
        const next = {pending_payment:'cancelled',processing:'shipped',shipped:'delivered'}[order.status];
        if (!next) continue;
        const {form,button} = actionForm(card,{cancelled:'Cancel unpaid reservation',shipped:'Mark shipped',delivered:'Mark delivered'}[next],async () => {
          await YuganthAPI.request('/admin/order',{id:order.id,status:next,tracking_url:form.elements.tracking?.value || ''});
          return 'Order status saved.';
        });
        if (next === 'shipped') field(form,'Tracking URL',input('url','tracking','','')).placeholder = 'https://';
        form.append(button);
      }
    }

    async function load() {
      const version = ++loadVersion, bulk = type.value === 'bulk';
      reload.disabled = true;
      holder.replaceChildren(); $('#orderCount').textContent = 'Loading orders…';
      dispatch.textContent = '';
      try {
        const data = await request(bulk ? '/admin/orders' : '/admin/normal-orders');
        if (version !== loadVersion) return;
        orders = data.orders; shipments = new Map(); shippingEnabled = false;
        if (!bulk) {
          try {
            const data = await request('/admin/normal-dispatch');
            if (version !== loadVersion) return;
            shippingEnabled = data.enabled;
            shipments = new Map(data.orders.map(order => [order.id,order]));
          } catch (error) { if (version === loadVersion) dispatch.textContent = `Shiprocket: ${error.message}`; }
        }
        if (version === loadVersion) { status.textContent = ''; render(); }
      } catch (error) {
        if (version === loadVersion) { orders = []; $('#orderCount').textContent = ''; status.textContent = error.message; }
      } finally { if (version === loadVersion) reload.disabled = false; }
    }
    const session = await YuganthAPI.session();
    if (session.user?.role !== 'admin') throw new Error('Sign in with an administrator account to view orders.');
    const adminSession = await request('/admin/products');
    if (!adminSession.csrf) throw new Error('Refresh your admin session.');
    function switchType() {
      const bulk = type.value === 'bulk';
      for (const option of filter.options) if (['review','accepted','awaiting_transfer'].includes(option.value)) option.hidden = !bulk;
      filter.value = ''; orders = []; load();
    }
    type.value = new URLSearchParams(location.search).get('type') === 'bulk' ? 'bulk' : 'normal';
    $('#orderWorkspace').hidden = false;
    type.onchange = switchType; filter.onchange = render; search.oninput = render; reload.onclick = load;
    switchType();
  }
  if ($('#distributorCheckout')) checkout().catch(error => { $('#message').textContent = error.message; });
  const refresh = $('#bulkAdminRefresh');
  if (refresh) refresh.onclick = async () => {
    refresh.disabled = true;
    try { await admin(); $('#bulkAdminStatus').textContent = 'Distributor products loaded.'; }
    catch (error) { $('#bulkAdminStatus').textContent = error.message; }
    finally { refresh.disabled = false; }
  };
  if ($('#ordersAdmin')) orderWorkspace().catch(error => { $('#bulkAdminStatus').textContent = error.message; });
})();
