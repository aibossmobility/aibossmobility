import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read=(p)=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const offers=JSON.parse(read('public/estimate-offers.json')).offers;
const catalog=read('public/consulting-services.html');
const estimate=read('public/estimate-checklist.html');
const prompt=read('public/gemini-voice.js');
const smart=read('smart-outreach-scope-packet.js');
const server=read('server.js');
test('all thirteen listed custom services retain estimate-first intake rather than direct payment',()=>{
 assert.equal(offers.length,13);
 for(const offer of offers){
  assert.equal(offer.kind,'project');
  assert.match(offer.id,/^service-(0[1-9]|1[0-3])$/);
  assert.match(catalog,new RegExp('/estimate-checklist\\?offer='+offer.id));
  const deposit=Math.ceil(offer.priceCents/2),balance=offer.priceCents-deposit;
  assert.equal(deposit+balance,offer.priceCents);
 }
 assert.match(catalog,/Online full-price checkout is intentionally disabled/);
});
test('customer copy agrees on deposit then verified signature, independent QA, preview and acceptance',()=>{
 for(const [name,text] of [['catalog',catalog],['estimate',estimate],['gemini',prompt]]){
  assert.match(text,/deposit/i,name+' deposit missing');
  assert.match(text,/sign/i,name+' signature missing');
  assert.match(text,/independent/i,name+' independent verification missing');
  assert.match(text,/acceptance/i,name+' acceptance missing');
 }
 assert.match(catalog,/After independent QA, real customer preview/);
 assert.match(estimate,/payment and signature are independently matched/);
 assert.match(prompt,/explicit verified customer acceptance/);
});
test('no existing server checkout or Smart Outreach scope packet authorizes unverified fulfillment',()=>{
 assert.match(server,/checkout_ready:false/);
 assert.match(server,/direct_paypal_checkout_enabled:false/);
 assert.match(smart,/readyToInvoice:false,readyToBuild:false/);
 assert.match(smart,/after matching deposit, signed agreement and access authorization/i);
});
