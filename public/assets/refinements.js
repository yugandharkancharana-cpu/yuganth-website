'use strict';
(()=>{
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 if(!reduce.matches&&'IntersectionObserver' in window){
  const observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){e.target.classList.add('is-visible');observer.unobserve(e.target);}},{threshold:.06});
  for(const el of document.querySelectorAll('.site-footer section,.policy-content section,.policy-title')){el.classList.add('soft-reveal');observer.observe(el);}
 }
 // Native links and content remain fully usable if JavaScript is unavailable.
 const cart=document.querySelector('#listCount');
 if(cart&&!reduce.matches){let old=cart.textContent;new MutationObserver(()=>{if(cart.textContent!==old){old=cart.textContent;cart.animate([{transform:'scale(1)'},{transform:'scale(1.22)'},{transform:'scale(1)'}],{duration:320});}}).observe(cart,{childList:true,characterData:true,subtree:true});}
})();
