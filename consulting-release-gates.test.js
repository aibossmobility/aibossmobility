"use strict";
const assert=require("node:assert/strict");
const {matchDepositAgreement,authorizeFinalInvoice}=require("./consulting-release-gates");
const test=require("node:test");
const locationId="qJ83IIaK5y2ZPHzLfGG1";
const base=()=>{
 const ids={locationId,customerId:"c1",orderId:"o1",scopeId:"s1",scopeDigest:"sha256:fixed-approved-scope"};
 return {
  scope:{...ids,totalCents:99500,approved:true},
  deposit:{...ids,amountCents:49750,status:"succeeded",provider:"ghl",providerVerified:true,providerTransactionId:"txn1",paidAt:"2026-11-23T17:00:00Z"},
  agreement:{...ids,status:"signed",provider:"ghl",providerVerified:true,providerDocumentId:"doc1",signedAt:"2026-11-23T17:01:00Z"},
  authority:{locationId,scopeId:"s1",approved:true,paymentReviewerId:"review1",fulfillmentOperatorId:"builder1",paymentVerified:true,documentReviewerId:"review2",documentVerified:true,finalInvoiceApproved:true,finalReviewerId:"review3",finalInvoiceAlreadyIssued:false},
  fulfillment:{completed:true,deliveryId:"delivery1",scopeDigest:ids.scopeDigest,operatorId:"builder1"},
  qa:{passed:true,reviewerId:"qa1",deliveryId:"delivery1",passedAt:"2026-11-23T18:00:00Z"},
  preview:{accessVerified:true,deliveryId:"delivery1",previewId:"preview1",verifiedAt:"2026-11-23T18:05:00Z"},
  acceptance:{providerVerified:true,status:"accepted",tokenConsumed:true,tokenUseCount:1,previewId:"preview1",customerId:"c1",acceptedAt:"2026-11-23T18:06:00Z"}
 };
};
test("fully corroborated synthetic case is eligible in pure policy only",()=>{
 assert.equal(matchDepositAgreement(base()).allowed,true);
 assert.equal(authorizeFinalInvoice(base()).allowed,true);
});
for(const [label,alter] of [
 ["missing deposit",x=>delete x.deposit.providerTransactionId],
 ["wrong amount",x=>x.deposit.amountCents=49000],
 ["wrong location",x=>x.deposit.locationId="BYx4g32AidgEkTBg7nLQ"],
 ["wrong customer",x=>x.agreement.customerId="c2"],
 ["wrong order",x=>x.agreement.orderId="o2"],
 ["altered scope",x=>x.agreement.scopeDigest="other"],
 ["false payment",x=>x.deposit.status="pending"],
 ["unverified document",x=>x.agreement.providerVerified=false],
 ["signature before deposit",x=>x.agreement.signedAt="2026-11-23T16:00:00Z"],
 ["unapproved scope",x=>x.scope.approved=false],
 ["wrong permission",x=>x.authority.approved=false],
 ["same person verifies payment and builds",x=>x.authority.paymentReviewerId="builder1"],
 ["document reviewer not independent",x=>x.authority.documentReviewerId="builder1"],
 ["missing reviewer proof",x=>x.authority.documentVerified=false]
]){
 test("blocks work for "+label,()=>{let x=base();alter(x);assert.equal(matchDepositAgreement(x).allowed,false);assert.equal(authorizeFinalInvoice(x).allowed,false);});
}
for(const [label,alter] of [
 ["unfinished deliverable",x=>x.fulfillment.completed=false],
 ["different delivered scope",x=>x.fulfillment.scopeDigest="wrong"],
 ["failed QA",x=>x.qa.passed=false],
 ["self-review",x=>x.qa.reviewerId="builder1"],
 ["QA from other delivery",x=>x.qa.deliveryId="wrong"],
 ["preview not accessible",x=>x.preview.accessVerified=false],
 ["rejected customer",x=>x.acceptance.status="rejected"],
 ["unverified acceptance",x=>x.acceptance.providerVerified=false],
 ["unused link",x=>x.acceptance.tokenConsumed=false],
 ["replayed acceptance link",x=>x.acceptance.tokenUseCount=2],
 ["revoked link",x=>x.acceptance.revoked=true],
 ["wrong preview",x=>x.acceptance.previewId="other"],
 ["wrong accepting customer",x=>x.acceptance.customerId="other"],
 ["acceptance before preview",x=>x.acceptance.acceptedAt="2026-11-23T18:03:00Z"],
 ["invoice reviewer missing",x=>x.authority.finalInvoiceApproved=false],
 ["same invoice reviewer and builder",x=>x.authority.finalReviewerId="builder1"],
 ["duplicate final invoice",x=>x.authority.finalInvoiceAlreadyIssued=true]
]){
 test("blocks final invoice for "+label,()=>{let x=base();alter(x);assert.equal(matchDepositAgreement(x).allowed,true);assert.equal(authorizeFinalInvoice(x).allowed,false);});
}
test("no provider integrations or network side effects",()=>{
 const fs=require("node:fs");const s=fs.readFileSync("consulting-release-gates.js","utf8");
 assert.doesNotMatch(s,/\bfetch\(|https?:\/\/|require\(["'](?:https?|node:http|node:https)/);
});
