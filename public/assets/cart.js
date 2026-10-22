'use strict';
// Shared variant-ID cart for the storefront and checkout. Server prices always win.
window.YuganthCart = (() => {
  const key='yuganth-cart-v2';
  function sanitize(value){
    if(!Array.isArray(value))return [];
    const lines=new Map();
    for(const line of value.slice(0,50)){
      if(!line||typeof line.variant_id!=='string'||!/^[a-z0-9-]{1,60}$/.test(line.variant_id)||!Number.isInteger(line.quantity)||line.quantity<1||line.quantity>99)continue;
      lines.set(line.variant_id,Math.min(99,(lines.get(line.variant_id)||0)+line.quantity));
    }
    return [...lines].map(([variant_id,quantity])=>({variant_id,quantity}));
  }
  return {key,sanitize,read(){try{return sanitize(JSON.parse(localStorage.getItem(key)||'[]'));}catch{return [];}},write(lines){const clean=sanitize(lines);try{localStorage.setItem(key,JSON.stringify(clean));}catch{}return clean;}};
})();
