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
  if(!fs.existsSync(file))return {version:1,rollups:{},voice:[]};
  const obj=JSON.parse(fs.readFileSync(file,"utf8"));
  if(obj.version!==1 || typeof obj.rollups!=="object" || !Array.isArray(obj.voice))
    throw Error("Mac OS report needs review");
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
  const voices=state.voice.filter(x=>x.date===day);
  let notes=[],intakeCount=null;
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
      website_business_intakes:intakeCount},
    voice_recaps:voices.slice(0,30).map(x=>({note:x.note,recorded_at:x.observed_at,source:x.source})),
    private_conversations:notes.slice(0,40),
    integrations:{
      website_conversation_notes:"connected",
      website_business_intakes:intakeCount===null?"unavailable":"connected locally",
      mac_worker_evidence:rollup?"verified aggregate received":"awaiting Mac report",
      mac_voice:voices.length?"at least one authorized recap received":"ready for authorized Mac recaps",
      gmail:"not included in site report",
      google_calendar:"not included in site report",
      gohighlevel:"delivery not independently verified by this report",
      social_media:"not connected"
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
