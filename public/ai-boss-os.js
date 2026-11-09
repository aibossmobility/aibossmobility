(function(){
"use strict";
const $=id=>document.getElementById(id);
let token="";
function today(){
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Los_Angeles",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
 return ["year","month","day"].map(k=>parts.find(p=>p.type===k).value).join("-");
}
$("report-date").value=today();
function text(id,value){$(id).textContent=value;}
function setMessage(value,error=false){const p=$("message");p.textContent=value;p.classList.toggle("error",error);}
function renderItems(containerId,emptyId,items,make){
 const list=$(containerId);list.replaceChildren();$(emptyId).hidden=items.length>0;
 for(const item of items){const li=document.createElement("li");make(li,item);list.append(li);}
}
function line(li,main,secondary){
 const strong=document.createElement("strong");strong.textContent=main;li.append(strong);
 if(secondary){const p=document.createElement("p");p.className="muted";p.textContent=secondary;li.append(p);}
}
async function load(){
 const date=$("report-date").value;
 const response=await fetch("/api/ai-boss-os/daily?date="+encodeURIComponent(date),{
  headers:{"x-admin-token":token},cache:"no-store",credentials:"same-origin"
 });
 let data={};try{data=await response.json();}catch{}
 if(!response.ok||!data.ok)throw Error(data.error||"Daily report is unavailable.");
 $("login").hidden=true;$("workspace").hidden=false;$("access").value="";
 text("proof",data.mac.worker_proof?.proof_records ?? "—");
 text("voice",String(data.summary.mac_voice_recaps));
 text("outreach",String(data.summary.private_conversations_dated));
 text("intake",data.summary.website_business_intakes ?? "—");
 text("gmail-matches",data.summary.gmail_message_matches ?? "—");
 text("calendar-matches",data.summary.calendar_ai_boss_events ?? "—");
 text("ghl-acks",data.summary.gohighlevel_webhook_acks ?? "—");
 text("ghl-contacts",data.summary.gohighlevel_visible_contacts ?? "—");
 text("ghl-filtered",data.summary.gohighlevel_filtered_opportunities ?? "—");
 text("ghl-api-opportunities",data.summary.gohighlevel_api_opportunities ?? "—");
 text("ghl-api-conversations",data.summary.gohighlevel_api_conversations ?? "—");
 const g=data.crm_readonly_snapshot;
 const a=data.crm_api_snapshot;
 text("ghl-coverage",a?
   "Verified read-only AI Boss location API counts from "+new Date(a.observed_at).toLocaleString()+". This does not classify contacts as customers, calls or sales.":
   g?"Read-only Mac Chrome 3 view checked "+new Date(g.observed_at).toLocaleString()+". Contacts visible in this location: "+g.contacts_visible_count+". Opportunity view: "+(g.pipeline_label||"unspecified pipeline")+(g.opportunities_filter_applied?" with active filters":"; current view only")+". No full CRM API synchronization or contact-level customer classification.":
   "No live GHL snapshot for this date. A site webhook receipt is separate from CRM access.");
 const gs=data.google_source_snapshot;
 text("google-coverage",gs?"Last verified Google scan: "+new Date(gs.received_at).toLocaleString()+". Gmail scans at most "+gs.gmail.scan_limit+" matching IDs and Calendar scans at most "+gs.google_calendar.scan_limit+" events. "+(gs.gmail.truncated||gs.google_calendar.truncated?"At least one source may be truncated.":"Unknown events and unsourced conversations are not inferred."):"No authenticated Google snapshot received for this date.");
 text("mac-status",data.mac.connected?"Mac summary recently received":data.mac.latest_report_at?"Mac summary saved (not recent)":"No Mac summary received yet");
 text("mac-updated",data.mac.latest_report_at?"Latest Mac evidence received: "+new Date(data.mac.latest_report_at).toLocaleString():"No confirmed Mac evidence received for this date.");
 const m=data.mac.worker_proof;
 text("qa",m?m.qa_passed+" local QA passed · "+m.qa_pending+" QA pending · "+m.failed+" failed. External outcomes unverified.":"Mac worker-proof counts not yet confirmed for this date.");
 renderItems("recaps","no-recaps",data.voice_recaps,(li,item)=>line(li,item.note,"Received from Brian's Mac voice recap · "+new Date(item.recorded_at).toLocaleString()));
 renderItems("conversations","no-conversations",data.private_conversations,(li,item)=>line(li,item.person+" · "+item.kind+(item.completed?" · reflection complete":""),item.next_step||"Follow-up not recorded"));
 const labels={website_conversation_notes:"Private conversation workspace",website_business_intakes:"Website inquiries",mac_worker_evidence:"Mac worker evidence",mac_voice:"Mac voice recaps",gmail:"Gmail",google_calendar:"Google Calendar",gohighlevel:"GoHighLevel",social_media:"Social media"};
 const coverage=$("coverage");coverage.replaceChildren();
 for(const [key,state] of Object.entries(data.integrations)){
   const li=document.createElement("li"),label=document.createElement("strong");
   label.textContent=(labels[key]||key)+": ";li.append(label,document.createTextNode(state));coverage.append(li);
 }
 setMessage("");
}
$("unlock").addEventListener("submit",async e=>{
 e.preventDefault();token=$("access").value;
 try{await load();}catch(e){token="";setMessage(e.message,true);}
});
$("controls").addEventListener("submit",async e=>{e.preventDefault();try{await load();}catch(e){setMessage(e.message,true);}});
$("lock").addEventListener("click",()=>{
 token="";$("workspace").hidden=true;$("login").hidden=false;
 $("access").value="";$("coverage").replaceChildren();$("recaps").replaceChildren();$("conversations").replaceChildren();
 setMessage("Report locked.");
});
})();