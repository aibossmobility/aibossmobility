const assert=require("node:assert/strict");
const {test}=require("node:test");
const {buildSmartOutreachScopePacket}=require("./smart-outreach-scope-packet");
const original={name:"Internal Tester",organization:"AI Boss Mobility Internal QA",goal:"Connect our authorized inbound website form to existing GoHighLevel CRM.",deliverables:"One intake form, CRM record, scheduling link and QA report.",qualification:{offerId:"service-13",status:"standard_scope_candidate",readyForAutomaticInvoice:false,readyForAutomaticBuild:false}};
test("standard scope packet is fixed-price, nonbinding and unchargeable",()=>{
 const q=buildSmartOutreachScopePacket(original);
 assert.equal(q.totalCents,99500);assert.equal(q.depositCents,49750);assert.equal(q.readyToInvoice,false);assert.match(q.text,/not a signed agreement/i);assert.match(q.text,/New websites/);
});
test("cannot create standard scope for custom quote",()=>assert.throws(()=>buildSmartOutreachScopePacket({...original,qualification:{...original.qualification,status:"custom_quote_required"}})));
test("cannot treat a payment-authorized result as scope-only",()=>assert.throws(()=>buildSmartOutreachScopePacket({...original,qualification:{...original.qualification,readyForAutomaticInvoice:true}})));
test("does not accept incomplete customer details",()=>assert.throws(()=>buildSmartOutreachScopePacket({...original,goal:"test"})));
test("does not include raw control characters from customer fields",()=>{
 const q=buildSmartOutreachScopePacket({...original,name:"Test\nOrganization"});
 assert.doesNotMatch(q.text,/Contact: Test\nOrganization/);
});
