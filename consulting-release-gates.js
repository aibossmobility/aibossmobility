"use strict";

// Provider-adapter-independent safety policy. This module never accesses GHL,
// creates an invoice, contacts a customer, or authorizes payment on its own.
// Fail closed until independently verified, immutable evidence is provided.
const norm=x=>typeof x==="string"?x.trim():"";
const positiveCents=n=>Number.isSafeInteger(n)&&n>0;
function decision(ok,checks){
  return Object.freeze({allowed:ok,blocked:!ok,failures:Object.freeze(checks.filter(c=>!c.ok).map(c=>c.code))});
}
function check(code,ok){return {code,ok:ok===true};}
function matchDepositAgreement(input={}){
  const {scope={},deposit={},agreement={},authority={}}=input;
  const amount=scope.totalCents;
  const verifiedDeposit=deposit.providerVerified===true && deposit.status==="succeeded";
  const verifiedAgreement=agreement.providerVerified===true && agreement.status==="signed";
  const fields=["locationId","customerId","orderId","scopeId","scopeDigest"];
  const checks=[
    check("approved_scope",scope.approved===true && positiveCents(amount)),
    check("scoped_50_percent",positiveCents(amount)&&amount%2===0&&deposit.amountCents===amount/2),
    check("payment_provider_evidence",verifiedDeposit&&!!norm(deposit.providerTransactionId)&&!!norm(deposit.provider)),
    check("signed_document_provider_evidence",verifiedAgreement&&!!norm(agreement.providerDocumentId)&&!!norm(agreement.provider)),
    check("expected_ai_boss_location",norm(scope.locationId)==="qJ83IIaK5y2ZPHzLfGG1"),
    check("matching_identifiers",fields.every(k=>norm(scope[k])!==""&&scope[k]===deposit[k]&&scope[k]===agreement[k])),
    check("deposit_before_signature",verifiedDeposit&&verifiedAgreement&&Number.isFinite(Date.parse(deposit.paidAt))&&Number.isFinite(Date.parse(agreement.signedAt))&&Date.parse(agreement.signedAt)>Date.parse(deposit.paidAt)),
    check("authorized_access",authority.approved===true&&authority.locationId===scope.locationId&&authority.scopeId===scope.scopeId),
    check("independent_payment_review",authority.paymentReviewerId&&authority.paymentReviewerId!==authority.fulfillmentOperatorId&&authority.paymentVerified===true),
    check("independent_document_review",authority.documentReviewerId&&authority.documentReviewerId!==authority.fulfillmentOperatorId&&authority.documentVerified===true)
  ];
  return decision(checks.every(c=>c.ok),checks);
}
function authorizeFinalInvoice(input={}){
  const {fulfillment={},qa={},preview={},acceptance={},authority={}}=input;
  const matched=matchDepositAgreement(input);
  const checks=[
    check("deposit_agreement_not_verified",matched.allowed),
    check("completed_deliverables",fulfillment.completed===true&&norm(fulfillment.deliveryId)!==""&&norm(fulfillment.scopeDigest)===norm(input.scope?.scopeDigest)),
    check("independent_quality_review",qa.passed===true&&norm(qa.reviewerId)!==""&&qa.reviewerId!==fulfillment.operatorId&&norm(qa.deliveryId)===norm(fulfillment.deliveryId)),
    check("actual_customer_preview",preview.accessVerified===true&&norm(preview.deliveryId)===norm(fulfillment.deliveryId)&&norm(preview.previewId)!==""),
    check("one_time_acceptance",acceptance.providerVerified===true&&acceptance.status==="accepted"&&acceptance.tokenConsumed===true&&acceptance.tokenUseCount===1&&acceptance.revoked!==true&&norm(acceptance.previewId)===norm(preview.previewId)),
    check("acceptance_customer_matches",norm(acceptance.customerId)!==""&&norm(acceptance.customerId)===norm(input.scope?.customerId)),
    check("acceptance_after_qa_preview",Number.isFinite(Date.parse(qa.passedAt))&&Number.isFinite(Date.parse(preview.verifiedAt))&&Number.isFinite(Date.parse(acceptance.acceptedAt))&&Date.parse(acceptance.acceptedAt)>Date.parse(preview.verifiedAt)&&Date.parse(acceptance.acceptedAt)>Date.parse(qa.passedAt)),
    check("independent_final_review",authority.finalInvoiceApproved===true&&norm(authority.finalReviewerId)!==""&&authority.finalReviewerId!==fulfillment.operatorId&&authority.finalReviewerId!==qa.reviewerId),
    check("no_prior_final_invoice",authority.finalInvoiceAlreadyIssued!==true)
  ];
  const failed=checks.filter(c=>!c.ok).map(c=>c.code);
  return Object.freeze({allowed:matched.allowed&&failed.length===0,blocked:matched.blocked||failed.length>0,failures:Object.freeze([...matched.failures,...failed])});
}
module.exports={matchDepositAgreement,authorizeFinalInvoice};
