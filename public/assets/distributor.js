'use strict';
(() => {
  let csrf = '';
  const $ = selector => document.querySelector(selector);
  const money = paise => YuganthAPI.money(paise);
  async function request(route, body, key) {
    const headers = {Accept: 'application/json'};
    if (body !== undefined) Object.assign(headers, {'Content-Type': 'application/json', 'X-CSRF-Token': csrf});
    if (key) headers['Idempotency-Key'] = key;
    const response = await fetch('api/distributor.php?route=' + encodeURIComponent(route), {
      method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', headers,
      ...(body === undefined ? {} : {body: JSON.stringify(body)})
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
    const payment = $('#bulkPayment'), pay = $('#bulkPay');
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
      const payable = value.status === 'pending_payment' && Number(value.expires_at) * 1000 > Date.now();
      pay.hidden = !payable;
      $('#bulkNew').hidden = payable;
      message.textContent = payable ? 'Review your order and total before paying.' :
        (['processing','shipped','delivered'].includes(value.status) ? 'Payment verified. Yuganth will review the phone quote and contact you to arrange delivery.' : 'This order is no longer payable. If you were charged, contact Yuganth with the reference above.');
    }
    pay.onclick = async () => {
      pay.disabled = true;
      try {
        const {checkout: details} = await request(`/orders/${order.id}/payment`, {});
        const verified = await YuganthPayment.open(details, {orderId: order.id, request});
        showOrder(verified.order);
      } catch (error) {
        message.textContent = error.message;
        try {
          const latest = await request(`/orders/${order.id}`);
          if (latest.order.status !== order.status) showOrder(latest.order);
        } catch { /* Keep the payment reference and original error visible. */ }
      } finally { pay.disabled = false; }
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
    const status = $('#bulkAdminStatus'), productsBox = $('#bulkAdminProducts'), ordersBox = $('#bulkAdminOrders');
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
    const {orders} = await request('/admin/orders');
    ordersBox.replaceChildren();
    if (!orders.length) node('p', 'No distributor orders yet.', ordersBox);
    for (const order of orders) {
      const item = node('article', undefined, ordersBox); item.className = 'bulk-order';
      const reviewed = order.address.distributor.reviewed_at;
      node('h4', order.status === 'processing' ? (reviewed ? 'Paid · Phone quote verified' : 'Paid · Check phone quote') : order.status.replaceAll('_', ' '), item);
      describe(order, item);
      if (order.status !== 'processing' || reviewed) continue;
      const form = node('form', undefined, item);
      const amount = field(form, 'Original phone quote before GST (₹)', input('text', 'quote', '', '')); amount.inputMode = 'decimal';
      const review = node('button', 'Confirm phone quote', form);
      form.onsubmit = async event => {
        event.preventDefault(); review.disabled = true;
        try { await request('/admin/reconcile', {id:order.id, agreed:amount.value}); await admin(); status.textContent = 'Phone quote verified. Arrange delivery with your chosen carrier.'; }
        catch (error) { status.textContent = error.message; }
        finally { review.disabled = false; }
      };
    }
  }
  if ($('#distributorCheckout')) checkout().catch(error => { $('#message').textContent = error.message; });
  const refresh = $('#bulkAdminRefresh');
  if (refresh) refresh.onclick = async () => {
    refresh.disabled = true;
    try { await admin(); $('#bulkAdminStatus').textContent = 'Distributor products and orders loaded.'; }
    catch (error) { $('#bulkAdminStatus').textContent = error.message; }
    finally { refresh.disabled = false; }
  };
})();
