 'use strict';
(()=>{
 const dialog=document.createElement('dialog');dialog.className='auth-popup';dialog.setAttribute('aria-label','Sign in or create a Yuganth account');
 const close=document.createElement('button');close.type='button';close.className='auth-close';close.textContent='×';close.setAttribute('aria-label','Close account');
 const frame=document.createElement('iframe');frame.title='Yuganth sign in and signup';dialog.append(close,frame);document.body.append(dialog);
 close.onclick=()=>dialog.close();dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
 document.addEventListener('click',async e=>{const link=e.target.closest('a[data-account-popup]');if(!link||e.ctrlKey||e.metaKey||e.shiftKey)return;e.preventDefault();try{const s=await YuganthAPI.session();if(s.user){location.href='account.html';return;}}catch{}if(dialog.open)return;frame.src='account.html?embed=1';dialog.showModal();});
 addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==frame.contentWindow||e.data?.type!=='yuganth-signed-in')return;dialog.close();document.dispatchEvent(new CustomEvent('yuganth-auth-changed'));});
})();
