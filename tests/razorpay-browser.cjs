'use strict';
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../public/assets/razorpay.js'),'utf8');let checks=0;
function make(){let options,listeners={},calls=[],message={textContent:''};function Razorpay(o){options=o;this.on=(name,fn)=>listeners[name]=fn;this.open=()=>{};}const context={window:{Razorpay},YuganthAPI:{request:async(...args)=>{calls.push(args);return {order:{status:'processing'}};}},document:{querySelector:()=>message}};vm.runInNewContext(source,context);return {context,get options(){return options;},listeners,calls,message};}
const checkout={mode:'razorpay',key:'rzp_test_Fake',order_id:'order_Fake',amount:25000,currency:'INR'};
(async()=>{
 let f=make();let promise=f.context.window.YuganthPayment.open(checkout,{orderId:'local-order'});await Promise.resolve();assert.equal(f.options.amount,25000);checks++;assert.equal(f.options.key,'rzp_test_Fake');checks++;
 f.listeners['payment.failed']();assert.match(f.message.textContent,/failed/);checks++;assert.equal(f.calls.length,0);checks++;
 await f.options.handler({razorpay_order_id:'order_Fake',razorpay_payment_id:'pay_Fake',razorpay_signature:'signed'});const verified=await promise;assert.equal(verified.order.status,'processing');checks++;assert.equal(f.calls[0][0],'/orders/local-order/payment/verify');checks++;assert.equal(f.calls[0][1].razorpay_payment_id,'pay_Fake');checks++;
 f.options.modal.ondismiss();assert.equal(f.calls.length,1);checks++;
 f=make();promise=f.context.window.YuganthPayment.open(checkout,{orderId:'local-order'});await Promise.resolve();f.options.modal.ondismiss();await assert.rejects(promise,/closed/);checks++;assert.equal(f.calls.length,0);checks++;
 f=make();f.context.YuganthAPI.request=async()=>{throw new Error('Not captured');};promise=f.context.window.YuganthPayment.open(checkout,{orderId:'local-order'});await Promise.resolve();await f.options.handler({});await assert.rejects(promise,/check My account before paying again/);checks++;
 await assert.rejects(f.context.window.YuganthPayment.open({...checkout,amount:1.5},{orderId:'x'}),/Invalid/);checks++;
 const checkoutSource=fs.readFileSync(require('node:path').join(__dirname,'../public/assets/checkout.js'),'utf8');assert(checkoutSource.includes("['processing','shipped','delivered'].includes(confirmed.order.status)"));checks++;
 console.log(`PASS: ${checks} Razorpay browser checks`);
})().catch(e=>{console.error(e);process.exit(1);});
