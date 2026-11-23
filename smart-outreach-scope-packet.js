"use strict";
const fixedScope=[
 "One discovery map for a single authorized inbound inquiry workflow",
 "One existing website/contact form connected to an approved CRM destination",
 "One organized CRM/contact-review pipeline",
 "One consent-based inquiry acknowledgment and follow-up workflow",
 "One scheduling destination and simple activity report",
 "End-to-end testing, owner-access instructions and a handoff checklist"
];
const excluded=[
 "New websites or landing pages",
 "Multiple CRM systems, multiple outreach channels, or custom API development",
 "Purchased lead lists, unsolicited mass outreach or guaranteed sales",
 "Third-party software subscription fees, data migrations, voice AI and sensitive-data integrations",
 "Optional ongoing monitoring/support (quoted and consented separately)"
];
function bounded(value,max=500){return String(value||"").replace(/[\x00-\x1f\x7f]/g," ").trim().slice(0,max)}
function buildSmartOutreachScopePacket(raw={}){
 const q=raw.qualification||{};
 if(q.status!=="standard_scope_candidate"||q.offerId!=="service-13")
  throw Error("Standard Service 13 scope candidate required");
 if(q.readyForAutomaticInvoice!==false||q.readyForAutomaticBuild!==false)
  throw Error("Unverified invoice or build authorization");
 const name=bounded(raw.name,160),org=bounded(raw.organization,160);
 const objective=bounded(raw.goal,1000),deliverables=bounded(raw.deliverables,1000);
 if(!name||!org||objective.length<30||deliverables.length<25)throw Error("Complete customer brief required");
 const lines=[
 "AI BOSS MOBILITY CONSULTING - PRELIMINARY SMART OUTREACH SCOPE",
 "STANDARD CORE PACKAGE - SERVICE 13",
 "This is an automated scope summary, not a signed agreement, invoice, promise of completion, or authorization to charge.",
 "",
 "Contact: "+name,
 "Organization: "+org,
 "Customer goal: "+objective,
 "Requested deliverables: "+deliverables,
 "",
 "POTENTIAL STANDARD INCLUSIONS",
 ...fixedScope.map((s,i)=>(i+1)+". "+s),
 "",
 "OUT OF SCOPE - SEPARATE QUOTE REQUIRED",
 ...excluded.map(s=>"- "+s),
 "",
 "LISTED STANDARD CORE PRICE: $995.00 USD",
 "DEPOSIT AFTER WRITTEN SCOPE IS SIGNED: $497.50",
 "FINAL BALANCE AFTER AGREED COMPLETION AND ACCEPTANCE: $497.50",
 "Nothing in this summary authorizes a charge, new tool purchase or access to customer systems.",
 "",
 "AUTOMATED PROJECT STAGES (ONLY AFTER INTEGRATIONS PASS LIVE VERIFICATION)",
 "1. Customer confirms scope, acceptance criteria, costs and timeline, then signs the agreement.",
 "2. Payment provider independently verifies the $497.50 deposit.",
 "3. An authorized implementation agent builds only within agreed accounts and granted permissions.",
 "4. Automated tests verify the signed acceptance checklist; failures open a technical exception.",
 "5. After completion and acceptance the remaining $497.50 is invoiced.",
 "6. When final payment is verified, secure access and handoff materials are delivered.",
 "",
 "CUSTOMER RESPONSIBILITIES",
 "- Confirm the scope and consent to authorized inbound follow-up.",
 "- Grant least-privilege access to existing tools using their official sharing controls.",
 "- Provide approved content, branding, domain access and any necessary service accounts.",
 "- Never send passwords, payment-card details or sensitive records in email.",
 "",
 "PRELIMINARY SCOPE STATUS: candidate, awaiting explicit customer confirmation.",
 "No signatures or payments are collected by this summary."
 ];
 return {kind:"preliminary_scope_not_contract",offerId:"service-13",totalCents:99500,depositCents:49750,finalCents:49750,readyToInvoice:false,readyToBuild:false,text:lines.join("\n")};
}
module.exports={buildSmartOutreachScopePacket,fixedScope,excluded};
