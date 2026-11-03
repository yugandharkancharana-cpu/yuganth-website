'use strict';
(()=>{
 const script=document.currentScript;
 const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('auth-popup.css?v=compact-20261030',script.src).href;document.head.append(css);
 const dialog=document.createElement('dialog');dialog.className='auth-popup';dialog.setAttribute('aria-label','Your Yuganth account');
 const close=document.createElement('button');close.type='button';close.className='auth-close';close.textContent='×';close.setAttribute('aria-label','Close account');
 const frame=document.createElement('iframe');frame.title='Your Yuganth account';dialog.append(close,frame);document.body.append(dialog);
 let opener=null,overflow='';
 close.onclick=()=>dialog.close();dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
 dialog.addEventListener('close',()=>{document.body.style.overflow=overflow;opener?.focus();});
 document.addEventListener('click',e=>{
  const link=e.target.closest('a');if(!link||e.defaultPrevented||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||link.hasAttribute('download')||link.target==='_blank')return;
  const url=new URL(link.href,location.href);
  if(url.origin!==location.origin||!url.pathname.endsWith('/account.html')||url.hash||url.search||typeof dialog.showModal!=='function')return;
  e.preventDefault();if(dialog.open)return;opener=link;overflow=document.body.style.overflow;
  url.searchParams.set('embed','1');frame.src=url.href;dialog.showModal();document.body.style.overflow='hidden';close.focus();
 });
 addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==frame.contentWindow||!['yuganth-signed-in','yuganth-signed-out'].includes(e.data?.type))return;dialog.close();document.dispatchEvent(new CustomEvent('yuganth-auth-changed'));});
})();
