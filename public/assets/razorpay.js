'use strict';
(()=>{
 let scriptPromise;
 function loadCheckout(){
  if(typeof window.Razorpay==='function')return Promise.resolve();
  if(scriptPromise)return scriptPromise;
  scriptPromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://checkout.razorpay.com/v1/checkout.js';script.onload=()=>typeof window.Razorpay==='function'?resolve():reject(new Error('Payment window unavailable.'));script.onerror=()=>reject(new Error('Unable to load Razorpay. Check your connection.'));document.head.append(script);}).catch(e=>{scriptPromise=null;throw e;});return scriptPromise;
 }
 window.YuganthPayment={async open(checkout,{orderId}){
  if(checkout.mode!=='razorpay'||!/^rzp_(test|live)_[A-Za-z0-9]+$/.test(checkout.key)||!/^order_[A-Za-z0-9]+$/.test(checkout.order_id)||!Number.isSafeInteger(checkout.amount)||checkout.amount<=0||checkout.currency!=='INR')throw new Error('Invalid checkout details.');
  await loadCheckout();
  return new Promise((resolve,reject)=>{let settled=false;const fail=message=>{if(!settled){settled=true;reject(new Error(message));}};
   const payment=new window.Razorpay({key:checkout.key,order_id:checkout.order_id,amount:checkout.amount,currency:'INR',name:'Yuganth',description:checkout.description,theme:{color:'#153d30'},handler:async response=>{if(settled)return;settled=true;try{const verified=await YuganthAPI.request('/orders/'+orderId+'/payment/verify',{razorpay_payment_id:response.razorpay_payment_id,razorpay_order_id:response.razorpay_order_id,razorpay_signature:response.razorpay_signature});resolve(verified);}catch(e){reject(new Error(e.message+' If payment was debited, check My account before paying again.'));}},modal:{ondismiss:()=>fail('Payment window closed. Your order is still reserved; check My account for payment status.')}});
   // Failed attempts can be retried inside Razorpay; do not mark the local order failed or paid.
   payment.on('payment.failed',()=>{const message=document.querySelector('#message');if(message)message.textContent='Payment attempt failed. Retry in the payment window, or close it to return.';});
   try{payment.open();}catch(e){fail('Unable to open Razorpay checkout. Your order remains unpaid.');}
  });
 }};
})();
