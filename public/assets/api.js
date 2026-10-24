'use strict';
window.YuganthAPI = {
  csrf: '',
  async request(route, body, options = {}) {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) { headers['Content-Type'] = 'application/json'; headers['X-CSRF-Token'] = this.csrf; }
    if (options.key) headers['Idempotency-Key'] = options.key;
    let response;
    try { response = await fetch('api/index.php?route=' + encodeURIComponent(route), { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
    catch { throw new Error('Unable to connect. Check your connection and try again.'); }
    let data;
    try { data = await response.json(); } catch { throw new Error('The server is not configured. Please contact Yuganth.'); }
    if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
    if (data.csrf) this.csrf = data.csrf;
    return data;
  },
  async upload(file) {
    const body=new FormData();body.append('image',file);
    const response=await fetch('api/index.php?route=%2Fadmin%2Fimage',{method:'POST',credentials:'same-origin',headers:{'X-CSRF-Token':this.csrf},body});
    const data=await response.json();if(!response.ok)throw new Error(data.error||'Upload failed.');return data;
  },
  session() { return this.request('/session'); },
  money(paise) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(paise) / 100); }
};
