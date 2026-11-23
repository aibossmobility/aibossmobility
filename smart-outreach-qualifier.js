"use strict";

// Conservative, no-charge scope guard for AI Boss Mobility's defined $995
// Smart Outreach core package. This preflight is NOT a contract or an AI quote.
const CUSTOM=/\b((?:new|build(?:ing)?|create|redesign|develop)\s+(?:a\s+)?(?:website|web site|webpage|landing page)|ecommerce|e-commerce|online store|mobile app|app development|chatbot|voice bot|voice assistant|multiple systems|multiple crm|complex integration|custom api|scrap(?:e|ing)|buy leads|purchased leads|cold email|blast|mass sms|bulk outreach|unsolicited|guaranteed leads|guaranteed sales)\b/i;
const SENSITIVE=/\b(health records|medical records|patient data|hipaa|social security number|ssn|credit card numbers|bank login|passwords|financial account|minor(?:s)? data)\b/i;
const EXISTING=/\b(existing|already|currently|we use|our crm|hubspot|gohighlevel|highlevel|google workspace|gmail|salesforce|zoho|airtable|notion|spreadsheet|sheets|mailchimp|calendly|website|wordpress|wix|squarespace)\b/i;
const PERMISSION=/\b(consent|opt.in|inbound|inquiry|contact form|people who ask|existing customers|authorized|permission)\b/i;
function words(x,max=1200){return String(x||"").trim().slice(0,max)}
function qualifySmartOutreach({offerId,goal,deliverables,tools,constraints,timeline,acceptance}={}){
 const result={version:"smart-outreach-core-v1",offerId:String(offerId||""),status:"custom_quote_required",readyForAutomaticInvoice:false,readyForAutomaticBuild:false,requiresFounderApproval:false,reasons:[],customerQuestions:[],priceCents:null,depositCents:null,finalBalanceCents:null};
 if(result.offerId!=="service-13"){result.status="other_service";result.reasons.push("This is not the Smart Outreach core offer.");return result;}
 const detail=[goal,deliverables,tools,constraints,timeline,acceptance].map(x=>words(x));
 const full=detail.join(" ");
 if(CUSTOM.test(full)||SENSITIVE.test(full)){
  result.status="custom_quote_required";
  result.reasons.push("Requested capabilities, regulated data, or new builds may exceed the standard one-workflow setup.");
  result.customerQuestions.push("Which single inquiry or follow-up workflow should we automate first using tools you already own?");
  return result;
 }
 if(words(goal).length<30||words(deliverables).length<25){
  result.status="clarification_required";
  result.reasons.push("The desired business result or deliverables are not specific enough.");
  result.customerQuestions.push("What should start the automation, and what exact outcome should happen?");
  return result;
 }
 if(!EXISTING.test(detail[2])||!PERMISSION.test(detail[3])){
  result.status="clarification_required";
  result.reasons.push("Existing system or permission-based communication path is not confirmed.");
  result.customerQuestions.push("Which existing website, inbox, CRM, and scheduler should we connect?");
  result.customerQuestions.push("Will the follow-up be limited to authorized inbound inquiries or opted-in contacts?");
  return result;
 }
 result.status="standard_scope_candidate";
 result.reasons.push("Candidate for one form, one CRM/pipeline, one authorized acknowledgment/follow-up, one scheduler, simple reporting and tests.");
 result.priceCents=99500;
 result.depositCents=49750;
 result.finalBalanceCents=49750;
 // Payment and access remain locked until customer confirms the final scope,
 // signs an agreement, and the payment/fulfillment integrations are verified.
 result.customerQuestions.push("Confirm that the defined single-workflow scope is sufficient and no extra channels or new website are required.");
 return result;
}
module.exports={qualifySmartOutreach};
