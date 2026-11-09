const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

// The Mac sends verified aggregate activity to AI Boss Mobility's own data volume.
// No raw voice, OAuth credentials, private email contents, or automated outreach.
function dataDirectory() {
  return process.env.RAILWAY_VOLUME_MOUNT_PATH ||
    (fs.existsSync("/data") ? "/data" : path.join(__dirname, "data"));
}
function isDate(day) {
  return typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    !Number.isNaN(Date.parse(day + "T12:00:00Z")) &&
    new Date(day + "T12:00:00Z").toISOString().slice(0,10) === day;
}
function pacificDay(date = new Date()) {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone:"America/Los_Angeles", year:"numeric",month:"2-digit",day:"2-digit"
  }).formatToParts(date);
  return ["year","month","day"].map(key=>p.find(x=>x.type===key).value).join("-");
}
function constantToken(req) {
  const secret=String(process.env.AI_BOSS_MAC_RELAY_TOKEN||"");
  if(secret.length<48) return "not-configured";
  const given=String(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
  const a=Buffer.from(secret),b=Buffer.from(given);
  return a.length===b.length && crypto.timingSafeEqual(a,b)?"valid":"unauthorized";
}
function stateFile(dir=dataDirectory()) {return path.join(dir,"ai-boss-mac-os-report.json");}
function load(file=stateFile()){
  if(!fs.existsSync(file))return {version:1,rollups:{},voice:[],integrations:{},ghl_ui:{},ghl_api:{}};
  const obj=JSON.parse(fs.readFileSync(file,"utf8"));
  if(obj.version!==1 || typeof obj.rollups!=="object" || !Array.isArray(obj.voice))
    throw Error("Mac OS report needs review");
  if(obj.integrations===undefined)obj.integrations={};
  if(obj.ghl_ui===undefined)obj.ghl_ui={};
  if(obj.ghl_api===undefined)obj.ghl_api={};
  if(!obj.integrations || typeof obj.integrations!=="object" || Array.isArray(obj.integrations)) throw Error("Mac OS integration report needs review");
  if(!obj.ghl_ui || typeof obj.ghl_ui!=="object" || Array.isArray(obj.ghl_ui)) throw Error("Mac OS GHL report needs review");
  if(!obj.ghl_api || typeof obj.ghl_api!=="object" || Array.isArray(obj.ghl_api)) throw Error("Mac OS GHL API report needs review");
  return obj;
}
function persist(obj,file=stateFile()){
  fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
  const temporary=file+"."+crypto.randomUUID()+".tmp";
  try{
    fs.writeFileSync(temporary,JSON.stringify(obj),{mode:0o600,flag:"wx"});
    fs.renameSync(temporary,file);
  }finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
}
function count(value) {return Number.isSafeInteger(value) && value>=0 && value<=100000 ? value : null;}
function validRef(v) {return typeof v==="string" && /^[a-zA-Z0-9_.:-]{8,128}$/.test(v);}
function acceptMacEvent(payload,file=stateFile(),now=new Date()){
  if(!payload || typeof payload!=="object" || Array.isArray(payload))throw Error("Invalid Mac event");
  if(payload.brand!=="ai_boss_mobility" || !validRef(payload.source_ref))
    throw Error("AI Boss source reference required");
  const eventTime=new Date(payload.observed_at);
  if(!Number.isFinite(eventTime.getTime()) ||
     eventTime.getTime()>now.getTime()+5*60*1000 ||
     eventTime.getTime()<now.getTime()-100*86400000) throw Error("Invalid observed date");
  if(!isDate(payload.date) || payload.date!==pacificDay(eventTime))throw Error("Pacific report date does not match event");
  // Transport probe intentionally never saves a conversation or a record.
  if(payload.kind==="voice_transport_probe"){
    if(Object.keys(payload).some(k=>!["brand","kind","source_ref","observed_at","date"].includes(k)))
      throw Error("Voice transport probe must not include personal or audio data");
    return {accepted:true,transport_only:true,stored:false};
  }
  const state=load(file);
  if(payload.kind==="worker_rollup"){
    if(Object.keys(payload).some(k=>!["brand","kind","source_ref","observed_at","date","metrics"].includes(k)))
      throw Error("Unexpected Mac worker field");
    const m=payload.metrics||{};
    if(Object.keys(m).some(k=>!["proof_records","qa_passed","qa_pending","failed"].includes(k)))
      throw Error("Unsupported Mac metric");
    const metrics={proof_records:count(m.proof_records),qa_passed:count(m.qa_passed),
      qa_pending:count(m.qa_pending),failed:count(m.failed)};
    if(Object.values(metrics).some(v=>v===null) ||
      metrics.qa_passed+metrics.qa_pending+metrics.failed>metrics.proof_records)
      throw Error("Mac evidence counts are inconsistent");
    const previous=state.rollups[payload.date];
    // Identical retries do not rewrite the owner's report.
    if(previous?.source_ref===payload.source_ref &&
        JSON.stringify(previous.metrics)===JSON.stringify(metrics))return {accepted:false,duplicate:true};
    state.rollups[payload.date]={
      source_ref:payload.source_ref,observed_at:eventTime.toISOString(),
      received_at:now.toISOString(),metrics
    };
  }else if(payload.kind==="integration_rollup"){
    if(Object.keys(payload).some(k=>!["brand","kind","source_ref","observed_at","date","services"].includes(k)))
      throw Error("Unexpected integration data");
    const serviceKeys=["gmail","google_calendar"];
    const allowedKeys=["status","count","scan_limit","truncated"];
    const services=payload.services;
    if(!services || typeof services!=="object" || Object.keys(services).sort().join(",")!==serviceKeys.sort().join(","))
      throw Error("Both scoped Google connectors must be reported");
    const sanitized={};
    for(const service of serviceKeys){
      const entry=services[service];
      if(!entry || typeof entry!=="object" || Object.keys(entry).some(k=>!allowedKeys.includes(k)) ||
         !["connected","unavailable"].includes(entry.status) ||
         count(entry.scan_limit)===null || entry.scan_limit>250 ||
         typeof entry.truncated!=="boolean" ||
         (entry.status==="connected" && (count(entry.count)===null || entry.count>entry.scan_limit)) ||
         (entry.status==="unavailable" && entry.count!==null))
        throw Error("Invalid authenticated connector count");
      sanitized[service]={status:entry.status,count:entry.count,scan_limit:entry.scan_limit,truncated:entry.truncated};
    }
    const old=state.integrations[payload.date];
    if(old?.source_ref===payload.source_ref && JSON.stringify(old.services)===JSON.stringify(sanitized))
      return {accepted:false,duplicate:true};
    state.integrations[payload.date]={
      source_ref:payload.source_ref,received_at:now.toISOString(),
      observed_at:eventTime.toISOString(),services:sanitized
    };
  }else if(payload.kind==="ghl_api_snapshot"){
    const allowed=["brand","kind","source_ref","observed_at","date","location_id","scope","contacts_count","opportunities_count","conversations_count"];
    if(Object.keys(payload).some(key=>!allowed.includes(key)) ||
      payload.location_id!=="qJ83IIaK5y2ZPHzLfGG1" ||
      payload.scope!=="subaccount_readonly" ||
      [payload.contacts_count,payload.opportunities_count,payload.conversations_count]
        .some(value=>value!==null && count(value)===null) ||
      [payload.contacts_count,payload.opportunities_count,payload.conversations_count]
        .every(value=>value===null))
      throw Error("Invalid verified read-only GHL API snapshot");
    const snapshot={
      location_id:payload.location_id,scope:payload.scope,
      contacts_count:payload.contacts_count,
      opportunities_count:payload.opportunities_count,
      conversations_count:payload.conversations_count
    };
    const prior=state.ghl_api[payload.date];
    if(prior?.source_ref===payload.source_ref && JSON.stringify(prior.snapshot)===JSON.stringify(snapshot))
      return {accepted:false,duplicate:true};
    state.ghl_api[payload.date]={source_ref:payload.source_ref,
      received_at:now.toISOString(),observed_at:eventTime.toISOString(),snapshot};
  }else if(payload.kind==="ghl_ui_snapshot"){
    if(Object.keys(payload).some(k=>!["brand","kind","source_ref","observed_at","date","location_id","crm_scope","contacts_visible_count","opportunities_filtered_count","opportunities_filter_applied","pipeline_label"].includes(k)))
      throw Error("Unexpected CRM snapshot field");
    if(payload.location_id!=="qJ83IIaK5y2ZPHzLfGG1" ||
       payload.crm_scope!=="read_only_chrome_ui" ||
       count(payload.contacts_visible_count)===null ||
       (payload.opportunities_filtered_count!==null && count(payload.opportunities_filtered_count)===null) ||
       typeof payload.opportunities_filter_applied!=="boolean" ||
       typeof payload.pipeline_label!=="string" ||
       payload.pipeline_label.length>90 || !/^[\w\s&/-]*$/.test(payload.pipeline_label))
      throw Error("Unverified AI Boss read-only CRM snapshot");
    const snapshot={
      location_id:payload.location_id,scope:payload.crm_scope,
      contacts_visible_count:payload.contacts_visible_count,
      opportunities_filtered_count:payload.opportunities_filtered_count,
      opportunities_filter_applied:payload.opportunities_filter_applied,
      pipeline_label:payload.pipeline_label,
    };
    const old=state.ghl_ui[payload.date];
    if(old?.source_ref===payload.source_ref && JSON.stringify(old.snapshot)===JSON.stringify(snapshot))
      return {accepted:false,duplicate:true};
    state.ghl_ui[payload.date]={
      source_ref:payload.source_ref,observed_at:eventTime.toISOString(),
      received_at:now.toISOString(),snapshot
    };
  }else if(payload.kind==="voice_recap"){
    if(Object.keys(payload).some(k=>!["brand","kind","source_ref","observed_at","date","note","authorized_to_store"].includes(k)))
      throw Error("Unexpected Mac voice field");
    if(payload.authorized_to_store!==true || typeof payload.note!=="string" ||
       payload.note.trim().length<2 || payload.note.length>6000)
      throw Error("An explicitly approved private recap is required");
    if(state.voice.some(x=>x.source_ref===payload.source_ref))return {accepted:false,duplicate:true};
    state.voice.unshift({
      source_ref:payload.source_ref,date:payload.date,observed_at:eventTime.toISOString(),
      received_at:now.toISOString(),note:payload.note.trim(),source:"mac_desktop_commander"
    });
    state.voice=state.voice.slice(0,1000);
  }else throw Error("Unsupported Mac event");
  const cutoff=new Date(now.getTime()-90*86400000);
  for(const day of Object.keys(state.ghl_api)){
    if(Date.parse(day+"T12:00:00Z")<cutoff.getTime())delete state.ghl_api[day];
  }
  for(const day of Object.keys(state.ghl_ui)){
    if(Date.parse(day+"T12:00:00Z")<cutoff.getTime())delete state.ghl_ui[day];
  }
  for(const day of Object.keys(state.integrations)){
    if(Date.parse(day+"T12:00:00Z")<cutoff.getTime())delete state.integrations[day];
  }
  for(const day of Object.keys(state.rollups)){
    if(Date.parse(day+"T12:00:00Z")<cutoff.getTime())delete state.rollups[day];
  }
  persist(state,file);
  return {accepted:true,duplicate:false};
}
function dailyReport(day,file=stateFile(),dir=dataDirectory()){
  if(!isDate(day))throw Error("Invalid report date");
  const state=load(file);
  const rollup=state.rollups[day]||null;
  const google=state.integrations[day]||null;
  const crm=state.ghl_ui[day]||null;
  const api=state.ghl_api[day]||null;
  const gmail=google?.services?.gmail || null;
  const calendar=google?.services?.google_calendar || null;
  const voices=state.voice.filter(x=>x.date===day);
  let notes=[],intakeCount=null,ghlReceipts=0;
  try{
    const raw=JSON.parse(fs.readFileSync(path.join(dir,"outreach-conversations.json"),"utf8"));
    if(Array.isArray(raw))notes=raw.filter(c=>c.date===day).map(c=>({
      person:String(c.person||"").slice(0,120),kind:String(c.kind||""),
      completed:Boolean(c.completed),next_step:String(c.steps||"").slice(0,350)
    }));
  }catch(e){if(e.code!=="ENOENT")notes=[];}
  try{
    const raw=fs.readFileSync(path.join(dir,"business-intake.ndjson"),"utf8");
    intakeCount=raw.split(/\r?\n/).filter(Boolean).reduce((n,line)=>{
      try{return n+(pacificDay(new Date(JSON.parse(line).submitted_at))===day?1:0);}
      catch{return n;}
    },0);
  }catch(e){if(e.code==="ENOENT")intakeCount=0;}
  try{
    const raw=fs.readFileSync(path.join(dir,"ghl-intake-ack.ndjson"),"utf8");
    ghlReceipts=raw.split(/\r?\n/).filter(Boolean).reduce((count_,line)=>{
      try{
        const item=JSON.parse(line);
        return count_+(item.type==="intake_acknowledged" && pacificDay(new Date(item.accepted_at))===day?1:0);
      }catch{return count_;}
    },0);
  }catch(e){if(e.code!=="ENOENT")ghlReceipts=null;}
  return {
    ok:true,date:day,
    primary_connector:"Brian's Mac mini / Desktop Commander",
    voice_identity:"Brian Keith Hill (owner-selected voice ID; dynamic synthesis not verified)",
    mac:{connected:Boolean(rollup && Date.now()-Date.parse(rollup.received_at)<30*60*1000),
      latest_report_at:rollup?.received_at||null,
      source:"Accepted local Mac worker proof; not an external completion claim",
      worker_proof:rollup?.metrics||null},
    summary:{mac_voice_recaps:voices.length,private_conversations_dated:notes.length,
      completed_private_reflections:notes.filter(c=>c.completed).length,
      website_business_intakes:intakeCount,
      gohighlevel_webhook_acks:ghlReceipts,
      gohighlevel_visible_contacts:api?.snapshot.contacts_count??crm?.snapshot.contacts_visible_count??null,
      gohighlevel_filtered_opportunities:crm?.snapshot.opportunities_filtered_count??null,
      gohighlevel_api_opportunities:api?.snapshot.opportunities_count??null,
      gohighlevel_api_conversations:api?.snapshot.conversations_count??null,
      gmail_message_matches:gmail?.status==="connected"?gmail.count:null,
      calendar_ai_boss_events:calendar?.status==="connected"?calendar.count:null},
    crm_api_snapshot:api?{received_at:api.received_at,observed_at:api.observed_at,...api.snapshot,
      caution:"Read-only API totals from the AI Boss sub-account; CRM conversations are not proof of completed sales or phone calls."}:null,
    crm_readonly_snapshot:crm?{
      received_at:crm.received_at,observed_at:crm.observed_at,
      ...crm.snapshot,
      caution:"Live Chrome UI view in AI Boss location; visible contacts are not validated business customers. Opportunities are in the selected pipeline and current filters, not the whole CRM."}:null,
    google_source_snapshot:google?{
      received_at:google.received_at,
      gmail:{...gmail,scope:"AI Boss recipient-address matches, not unique customer conversations"},
      google_calendar:{...calendar,scope:"Calendar events on report date with AI Boss title; not attendance"}
    }:null,
    voice_recaps:voices.slice(0,30).map(x=>({note:x.note,recorded_at:x.observed_at,source:x.source})),
    private_conversations:notes.slice(0,40),
    integrations:{
      website_conversation_notes:"connected",
      website_business_intakes:intakeCount===null?"unavailable":"connected locally",
      mac_worker_evidence:rollup?"verified aggregate received":"awaiting Mac report",
      mac_voice:voices.length?"at least one authorized recap received":"ready for authorized Mac recaps",
      gmail:gmail?.status==="connected"?"Connected: AI Boss-address message matches via authenticated Mac Gmail connector":"Not verified for this report date",
      google_calendar:calendar?.status==="connected"?"Connected: matching dated events via authenticated Mac Calendar connector":"Not verified for this report date",
      gohighlevel:api?"Connected read-only AI Boss sub-account API snapshot for this date":crm?"Connected read-only Chrome 3 UI snapshot for this date; full GHL CRM API is not connected":ghlReceipts===null?"GoHighLevel acknowledgement storage unavailable":ghlReceipts>0?"Confirmed site-to-GoHighLevel webhook acknowledgements (not pipeline or revenue)":"No recorded GoHighLevel webhook acknowledgements for this date; full CRM not connected",
      social_media:"Excluded: Metricool AI Boss-labeled brand currently connects several Papa Life social accounts. No AI Boss-only metrics verified.",
      phone_calls:"Not connected: Mac Google Messages is SMS, not a phone call log. No customer call data is inferred.",
      phone_messages:"Mac has a Google Messages snapshot, but personal/brand boundaries are not verified; content and thread totals excluded from AI Boss reporting."
    }
  };
}
function installMacOS({readBody,json,isAdmin}){
  return async(req,res)=>{
    res.setHeader("X-Robots-Tag","noindex, nofollow");
    const route=(req.url||"").split("?")[0];
    if(route==="/api/ai-boss-os/mac-event" && req.method==="POST"){
      const auth=constantToken(req);
      if(auth==="not-configured")return json(res,503,{ok:false,error:"Private Mac relay not configured"});
      if(auth!=="valid")return json(res,401,{ok:false,error:"Unauthorized Mac"});
      try{
        const event=JSON.parse(await readBody(req));
        return json(res,200,{ok:true,...acceptMacEvent(event)});
      }catch(e){return json(res,e.message?.includes("Mac OS report")?503:400,{ok:false,error:"Mac event not accepted: "+String(e.message||"invalid").slice(0,120)});}
    }
    if(route==="/api/ai-boss-os/daily" && req.method==="GET"){
      if(!isAdmin(req))return json(res,401,{ok:false,error:"Owner login required"});
      if(req.headers.origin && req.headers.origin!=="https://ai.bossmobilelifecoach.com")
        return json(res,403,{ok:false,error:"Open AI Boss OS on its verified site"});
      try{
        const params=new URL(req.url,"https://ai.bossmobilelifecoach.com").searchParams;
        return json(res,200,dailyReport(params.get("date")||pacificDay()));
      }catch(e){return json(res,503,{ok:false,error:"Private daily report could not be read"});}
    }
    return json(res,405,{ok:false,error:"Method not allowed"});
  };
}
module.exports={installMacOS,acceptMacEvent,dailyReport,pacificDay,constantToken};
