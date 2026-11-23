"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {createGhlReadonly,examineProviderEvidence}=require("./ghl-provider-readonly");
const token="fake-for-local-test-only-do-not-use-live";
test("missing credential blocks before network",async()=>{
 let called=0;const api=createGhlReadonly({fetchImpl:()=>{called++}});
 await assert.rejects(api.listSignedDocuments(),/credential_unavailable/);assert.equal(called,0);
});
test("GET-only location-scoped calls and tokens stay out of query URLs",async()=>{
 const seen=[];const fake=async(u,o)=>{seen.push([u,o]);return {ok:true,json:async()=>({documents:[],data:[]})}};
 const api=createGhlReadonly({documentToken:token,ordersToken:token,transactionsToken:token,fetchImpl:fake});
 await api.listSignedDocuments();await api.listOrders("customer123");await api.listTransactions("customer123");
 assert.equal(seen.length,3);
 for(const [url,opts] of seen){
  assert.equal(opts.method,"GET");assert.match(url,/locationId=qJ83IIaK5y2ZPHzLfGG1/);assert.equal(opts.headers.Version,"v3");
  assert.doesNotMatch(url,/fake-for-local-test/);assert.equal(opts.headers.Authorization,"Bearer "+token);
 }
 assert.match(seen[0][0],/\/proposals\/document/);
 assert.match(seen[1][0],/\/payments\/orders/);
 assert.match(seen[2][0],/\/payments\/transactions/);
});
test("403 never treated as permission granted",async()=>{
 const api=createGhlReadonly({documentToken:token,fetchImpl:async()=>({ok:false,status:403})});
 await assert.rejects(api.listSignedDocuments(),/scope_or_auth_denied/);
});
const sample=()=>{
 const loc="qJ83IIaK5y2ZPHzLfGG1";
 return {
  scope:{locationId:loc,customerId:"c",orderId:"o",documentId:"d",approved:true,scopeDigest:"verified-digest",totalCents:99500},
  document:{locationId:loc,documentId:"d",deleted:false,isExpired:false,status:["completed"],verifiedScopeDigest:"verified-digest",recipients:[{id:"c",role:"signer",hasCompleted:true,signedDate:"2026-11-23T18:00:00Z"}]},
  order:{altId:loc,_id:"o",contactId:"c",verifiedScopeDigest:"verified-digest"},
  transaction:{altId:loc,entityId:"o",contactId:"c",entityType:"order",status:"succeeded",liveMode:true,currency:"USD",amount:497.50,createdAt:"2026-11-23T17:00:00Z"}
 };
};
test("only fully linked synthetic provider evidence passes the strict join",()=>{
 assert.equal(examineProviderEvidence(sample()).allowed,true);
});
for(const [label,change] of [
 ["missing document",x=>delete x.document],
 ["wrong order",x=>x.transaction.entityId="other"],
 ["wrong customer",x=>x.transaction.contactId="other"],
 ["wrong location",x=>x.order.altId="BYx4g32AidgEkTBg7nLQ"],
 ["wrong payment",x=>x.transaction.amount=490],
 ["pending transaction",x=>x.transaction.status="pending"],
 ["test transaction",x=>x.transaction.liveMode=false],
 ["unsigned document",x=>x.document.recipients[0].hasCompleted=false],
 ["signature before payment",x=>x.document.recipients[0].signedDate="2026-11-23T16:00:00Z"],
 ["missing independently bound scope",x=>delete x.document.verifiedScopeDigest],
 ["missing order scope",x=>delete x.order.verifiedScopeDigest],
 ["deleted document",x=>x.document.deleted=true]
])test("blocks "+label,()=>{let x=sample();change(x);assert.equal(examineProviderEvidence(x).allowed,false)});
