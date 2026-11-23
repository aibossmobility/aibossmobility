"use strict";
// Read-only provider adapter; no customer records, tokens or response payloads in logs.
// This does NOT authenticate a customer or turn provider results into approval by itself.
const HOST="https://services.leadconnectorhq.com";
const LOCATION="qJ83IIaK5y2ZPHzLfGG1";
class ProviderReadError extends Error { constructor(code){super(code);this.name="ProviderReadError";this.code=code;} }
function createGhlReadonly({documentToken,ordersToken,transactionsToken,fetchImpl=globalThis.fetch}={}){
  const tokens={document:documentToken,order:ordersToken,transaction:transactionsToken};
  async function get(kind,urlPath,query={}){
    const token=tokens[kind];
    if(typeof token!=="string"||token.trim().length<20)throw new ProviderReadError("credential_unavailable");
    if(!["document","order","transaction"].includes(kind))throw new ProviderReadError("resource_denied");
    if(typeof urlPath!=="string"||!/^\/(?:proposals\/document|payments\/(?:orders|transactions))$/.test(urlPath))
      throw new ProviderReadError("endpoint_not_allowlisted");
    const allowed={document:"/proposals/document",order:"/payments/orders",transaction:"/payments/transactions"};
    if(urlPath!==allowed[kind])throw new ProviderReadError("scope_endpoint_mismatch");
    const u=new URL(HOST+urlPath);
    u.searchParams.set("locationId",LOCATION);
    if(kind!=="document"){u.searchParams.set("altId",LOCATION);u.searchParams.set("altType","location");}
    u.searchParams.set("limit","10");
    for(const [k,v] of Object.entries(query)){
      if(!["contactId","status","paymentStatus"].includes(k)||typeof v!=="string"||v.length>160)throw new ProviderReadError("query_denied");
      u.searchParams.set(k,v);
    }
    let response;
    try{response=await fetchImpl(u.toString(),{method:"GET",headers:{"Authorization":"Bearer "+token,"Version":"v3","Accept":"application/json"},redirect:"error",signal:AbortSignal.timeout(7000)});}
    catch{throw new ProviderReadError("provider_unreachable");}
    // Document endpoint explicitly supports v3; transactions/order v3. Do not
    // silently retry with broader permission or an alternate location.
    if(!response?.ok)throw new ProviderReadError(response?.status===401||response?.status===403?"scope_or_auth_denied":"provider_read_failed");
    let body;try{body=await response.json();}catch{throw new ProviderReadError("provider_payload_invalid");}
    if(typeof body!=="object"||body===null||Array.isArray(body))throw new ProviderReadError("provider_payload_invalid");
    return body;
  }
  return Object.freeze({
    listSignedDocuments:()=>get("document","/proposals/document",{status:"completed"}),
    listOrders:contactId=>get("order","/payments/orders",{contactId}),
    listTransactions:contactId=>get("transaction","/payments/transactions",{contactId})
  });
}
// Strict joining: never infer a matching agreement or transaction from names,
// a "paid" label on the document, amount alone, or mere API HTTP success.
function examineProviderEvidence({scope,document,order,transaction}={}){
 const failures=[];
 const need=(key,valid)=>{if(valid!==true)failures.push(key);};
 const same=(key)=>typeof scope?.[key]==="string"&&scope[key].length>0&&scope[key]===document?.[key]&&scope[key]===order?.[key]&&scope[key]===transaction?.[key];
 need("expected_location",scope?.locationId===LOCATION&&document?.locationId===LOCATION&&order?.altId===LOCATION&&transaction?.altId===LOCATION);
 need("matching_customer",typeof scope?.customerId==="string"&&scope.customerId.length>0&&scope.customerId===order?.contactId&&scope.customerId===transaction?.contactId&&document?.recipients?.some(r=>r.role==="signer"&&r.id===scope.customerId&&r.hasCompleted===true));
 need("matching_order",typeof scope?.orderId==="string"&&scope.orderId.length>0&&scope.orderId===(order?._id)&&scope.orderId===transaction?.entityId);
 need("matching_signed_document",typeof scope?.documentId==="string"&&scope.documentId.length>0&&scope.documentId===document?.documentId&&document?.deleted===false&&document?.isExpired===false&&Array.isArray(document?.status)&&document.status.includes("completed"));
 const signer=document?.recipients?.find(r=>r.role==="signer"&&r.id===scope?.customerId&&r.hasCompleted===true);
 const paidAt=Date.parse(transaction?.createdAt),signedAt=Date.parse(signer?.signedDate);
 need("deposit_before_signature",Number.isFinite(paidAt)&&Number.isFinite(signedAt)&&paidAt<signedAt);
 need("successful_live_transaction",transaction?.status==="succeeded"&&transaction?.liveMode===true&&transaction?.entityType==="order"&&transaction?.currency==="USD");
 need("approved_scope_digest",scope?.approved===true&&typeof scope?.scopeDigest==="string"&&scope.scopeDigest.length>0&&document?.verifiedScopeDigest===scope.scopeDigest&&order?.verifiedScopeDigest===scope.scopeDigest);
 need("exact_50_percent",Number.isSafeInteger(scope?.totalCents)&&scope.totalCents>0&&scope.totalCents%2===0&&Math.round(transaction?.amount*100)===scope.totalCents/2&&transaction?.amount*100===Math.round(transaction?.amount*100));
 // GHL document fields generally do not carry verifiedScopeDigest; provider
 // normalization must be backed by an independently signed scope artifact.
 return Object.freeze({allowed:failures.length===0,blocked:failures.length>0,failures:Object.freeze(failures)});
}
module.exports={createGhlReadonly,examineProviderEvidence,ProviderReadError};
