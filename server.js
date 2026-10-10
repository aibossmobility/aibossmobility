const http=require("http");
const fs=require("fs");
const path=require("path");
const root=path.join(__dirname,"public");
const port=process.env.PORT||3000;
const mime={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"application/javascript; charset=utf-8",".xml":"application/xml; charset=utf-8",".txt":"text/plain; charset=utf-8",".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".webp":"image/webp"};

function resolveFile(url){
  const clean=decodeURIComponent((url||"/").split("?")[0]);
  const route=clean==="/"?"/index.html":clean;
  const target=path.extname(route)?route:route+".html";
  const file=path.normalize(path.join(root,target));
  return file.startsWith(root)?file:null;
}
function json(res,status,payload){res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});res.end(JSON.stringify(payload));}
function readBody(req){return new Promise((resolve,reject)=>{let raw="";req.on("data",chunk=>{raw+=chunk;if(raw.length>25000){reject(new Error("payload too large"));req.destroy();}});req.on("end",()=>resolve(raw));req.on("error",reject);});}
async function postWebhook(url,payload,label,extraHeaders={}){if(!url)return false;try{const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json",...extraHeaders},body:JSON.stringify(payload)});if(!response.ok){let detail="";try{const raw=await response.text();try{const parsed=JSON.parse(raw);detail=String(parsed.error||parsed.message||"");}catch{detail=String(raw||"");}}catch{}detail=detail.replace(/\s+/g," ").trim();console.error(`${label} webhook failed`,response.status,detail.slice(0,400));}return response.ok;}catch(err){console.error(`${label} webhook error`,err);return false;}}

async function handleGuideLead(req,res){
  try{
    const body=JSON.parse(await readBody(req)||"{}");
    const name=String(body.name||"").trim().slice(0,160),email=String(body.email||"").trim().slice(0,254),organization=String(body.organization||"").trim().slice(0,240),need=String(body.need||"").trim().slice(0,3000);
    if(!name||!email||!email.includes("@"))return json(res,400,{ok:false,error:"Name and valid email are required."});
    const lead={name,email,organization,need,source:"AI Boss Mobility Website",resource:"Free AI & Tech Language Guide",marketing_consent:false,submitted_at:new Date().toISOString()};
    await postWebhook(process.env.AIRTABLE_GUIDE_WEBHOOK,lead,"Guide lead");
    return json(res,200,{ok:true});
  }catch(err){console.error("Guide lead error",err);return json(res,400,{ok:false,error:"Unable to process request."});}
}

async function handleBusinessIntake(req,res){
  try{
    const body=JSON.parse(await readBody(req)||"{}");
    const name=String(body.name||"").trim().slice(0,160),email=String(body.email||"").trim().toLowerCase().slice(0,254),organization=String(body.organization||"").trim().slice(0,240),need=String(body.need||"").trim().slice(0,3000),pathKey=String(body.path||"").trim().slice(0,80);
    if(!name||!email||!email.includes("@"))return json(res,400,{ok:false,error:"Name and valid email are required."});
    const lead={record_type:"ai_boss_business_intake",name,email,organization,need,path:pathKey,source:"AI Boss Mobility Interactive Homepage",site:"https://ai.bossmobilelifecoach.com",submitted_at:new Date().toISOString()};
    try{const dataDir=process.env.RAILWAY_VOLUME_MOUNT_PATH||path.join(__dirname,"data");fs.mkdirSync(dataDir,{recursive:true});fs.appendFileSync(path.join(dataDir,"business-intake.ndjson"),JSON.stringify(lead)+"\n","utf8");}catch(err){console.error("Business intake local record failed");}
    const urls=[
      [process.env.GOOGLE_HUB_WEBHOOK,"Google Hub"],
      [process.env.AI_BOSS_LEAD_WEBHOOK,"AI Boss lead"],
      [process.env.AIRTABLE_GUIDE_WEBHOOK,"Current lead fallback"]
    ].filter(([url],index,arr)=>url&&arr.findIndex(([candidate])=>candidate===url)===index);
    const results=await Promise.all(urls.map(([url,label])=>postWebhook(url,lead,label)));
    if(process.env.GHL_INTAKE_WEBHOOK){
      const secret=String(process.env.AI_BOSS_INTAKE_SECRET||"").trim();
      const ghlOk=await postWebhook(
        process.env.GHL_INTAKE_WEBHOOK,
        lead,
        "GoHighLevel",
        secret?{"X-AI-Boss-Intake-Secret":secret}:{}
      );
      results.push(ghlOk);
    }
    const routed=results.filter(Boolean).length;
    const ghlConfigured=Boolean(process.env.GHL_INTAKE_WEBHOOK);
    const ghlDelivered=ghlConfigured && results.length>0 && results[results.length-1]===true;
    if(!ghlDelivered){
      console.error("Business intake CRM delivery unconfirmed",{ghlConfigured,otherEndpointsAcknowledged:routed-(ghlDelivered?1:0)});
      return json(res,503,{ok:false,error:"We couldn't confirm delivery to our client system. Please email brian@bossmobility.net directly."});
    }
    return json(res,200,{ok:true,crm_received:true});
  }catch(err){console.error("Business intake error",err);return json(res,400,{ok:false,error:"Unable to process request."});}
}

function consentDataPath(){
  const base=(process.env.RAILWAY_VOLUME_MOUNT_PATH&&fs.existsSync(process.env.RAILWAY_VOLUME_MOUNT_PATH))?process.env.RAILWAY_VOLUME_MOUNT_PATH:path.join(__dirname,"data");
  fs.mkdirSync(base,{recursive:true});
  return path.join(base,"media-ai-consents.ndjson");
}
function safeConsentRecord(record){
  const copy={...record};
  delete copy.ip_address; delete copy.user_agent; delete copy.consent_text;
  return copy;
}
function isConsentAdmin(req){
  const token=String(process.env.MEDIA_CONSENT_ADMIN_TOKEN||"");
  const supplied=String(req.headers["x-admin-token"]||"");
  return Boolean(token)&&supplied===token;
}
async function handleMediaAiConsent(req,res){
  try{
    const body=JSON.parse(await readBody(req)||"{}");
    const full_name=String(body.full_name||"").trim().slice(0,160),email=String(body.email||"").trim().slice(0,254).toLowerCase(),typed_signature=String(body.typed_signature||"").trim().slice(0,160),consent_text=String(body.consent_text||"").trim().slice(0,5000);
    if(!full_name||!email||!email.includes("@")||!typed_signature||!consent_text)return json(res,400,{ok:false,error:"Name, valid email, signature, and consent are required."});
    const flags=["allow_photo","allow_video","allow_voice","allow_name_likeness","allow_testimonial","allow_website_social","allow_education_training","allow_marketing","allow_ai_assisted_editing","consent_all"];
    const record={record_type:"media_ai_consent",consent_version:"2026-09-29-v2",full_name,email,project_or_purpose:String(body.project_or_purpose||"").trim().slice(0,500),typed_signature,consent_text,submitted_at:new Date().toISOString(),ip_address:String(req.headers["x-forwarded-for"]||req.socket.remoteAddress||"").split(",")[0].trim().slice(0,120),user_agent:String(req.headers["user-agent"]||"").slice(0,500)};
    for(const key of flags)record[key]=Boolean(body[key]);
    if(!(record.consent_all||record.allow_photo||record.allow_video||record.allow_voice||record.allow_name_likeness||record.allow_testimonial))return json(res,400,{ok:false,error:"Select at least one type of material you permit us to use."});
    fs.appendFileSync(consentDataPath(),JSON.stringify(record)+"\n","utf8");
    const consentWebhook=process.env.AIRTABLE_CONSENT_WEBHOOK||process.env.AIRTABLE_GUIDE_WEBHOOK;
    const confirmPayload={record_type:"media_ai_consent_confirmation",to_email:email,to_name:full_name,subject:"Your Media & AI Permission was received",message:`Hi ${full_name}, thank you. We received your Media & AI Permission choices for AI Boss Mobility / Papa Life on ${new Date(record.submitted_at).toLocaleDateString("en-US")}. We’ll only use the materials you approved. If you ever have a question about your permission, reply to Brian directly.`,consent_version:record.consent_version,submitted_at:record.submitted_at};
    const [stored,noted]=await Promise.all([
      postWebhook(consentWebhook,record,"Consent"),
      postWebhook(process.env.MEDIA_CONSENT_CONFIRMATION_WEBHOOK,confirmPayload,"Consent confirmation")
    ]);
    return json(res,200,{ok:true,consent_version:record.consent_version,submitted_at:record.submitted_at,external_record:stored,confirmation_sent:noted});
  }catch(err){console.error("Consent error",err);return json(res,400,{ok:false,error:"Unable to record permission."});}
}
async function handleConsentAdminList(req,res){
  if(!isConsentAdmin(req))return json(res,401,{ok:false,error:"Unauthorized"});
  try{
    const file=consentDataPath();
    if(!fs.existsSync(file))return json(res,200,{ok:true,records:[]});
    const rows=fs.readFileSync(file,"utf8").split(/\r?\n/).filter(Boolean).map(line=>{try{return JSON.parse(line)}catch{return null}}).filter(Boolean);
    rows.sort((a,b)=>String(b.submitted_at||"").localeCompare(String(a.submitted_at||"")));
    return json(res,200,{ok:true,records:rows.map(safeConsentRecord)});
  }catch(err){console.error("Consent admin read error",err);return json(res,500,{ok:false,error:"Unable to load records."});}
}


// Google AI Studio free-tier voice pilot. Permanent API keys never leave the server.
// Deliberately off until a free (not billed) API key and explicit pilot flag are set.
const VOICE_MODEL="models/gemini-2.5-flash-native-audio-preview-12-2025";
const voiceDaily=new Map();
let voiceCount=0,voiceDay="";
function voiceAvailable(){return process.env.GEMINI_FREE_VOICE_ENABLED==="true" && Boolean(process.env.GEMINI_API_KEY);}
function voiceStatus(res){return json(res,200,{available:voiceAvailable(),model:"Gemini 2.5 Flash native audio",maxSessionSeconds:120});}
async function voiceToken(req,res){
  if(!voiceAvailable())return json(res,503,{ok:false,error:"The free voice pilot is not active yet. Use the existing conversation option."});
  const origin=String(req.headers.origin||"");
  if(origin){
    try{const host=new URL(origin).host; if(host!==req.headers.host)return json(res,403,{ok:false,error:"Site origin not allowed."});}
    catch{return json(res,403,{ok:false,error:"Site origin not allowed."});}
  }
  let payload;
  try{payload=JSON.parse(await readBody(req)||"{}");}catch{return json(res,400,{ok:false,error:"Invalid request."});}
  if(payload.agreeToGoogleReview!==true || payload.isAdult!==true){
    return json(res,400,{ok:false,error:"Confirm that you are 18+ and accept Google's free-tier data-use notice."});
  }
  const today=new Date().toISOString().slice(0,10);
  if(voiceDay!==today){voiceDaily.clear();voiceCount=0;voiceDay=today;}
  const ip=String(req.headers["x-forwarded-for"]||req.socket.remoteAddress||"").split(",")[0].trim();
  const used=voiceDaily.get(ip)||0;
  // One replica. Deliberately conservative; AI Studio's own free-tier quota is an additional ceiling.
  if(used>=2 || voiceCount>=12)return json(res,429,{ok:false,error:"Today's free voice pilot sessions are used. Please try again another day or book a conversation."});
  const tokenRequest={
    uses:1,
    expireTime:new Date(Date.now()+4*60*1000).toISOString(),
    newSessionExpireTime:new Date(Date.now()+50*1000).toISOString()
  };
  try{
    const response=await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens",{
      method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":process.env.GEMINI_API_KEY},
      body:JSON.stringify(tokenRequest),signal:AbortSignal.timeout(12000)
    });
    if(!response.ok){
      let detail="";try{const problem=await response.json();detail=String(problem.error?.status||"unknown")+" "+String(problem.error?.message||"").slice(0,180);}catch{}
      detail=detail.replace(/AQ[.A-Za-z0-9_-]{15,}|AIza[A-Za-z0-9_-]{15,}/g,"[redacted]");
      console.error("Gemini voice token request failed: HTTP",response.status,detail);
      return json(res,503,{ok:false,error:"Google's free voice service is currently unavailable. No payment is required."});
    }
    const result=await response.json();
    if(!result.name)return json(res,503,{ok:false,error:"Google did not return a session token."});
    voiceDaily.set(ip,used+1);voiceCount++;
    res.writeHead(200,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});
    return res.end(JSON.stringify({ok:true,token:result.name,model:VOICE_MODEL,maxSessionSeconds:120}));
  }catch(err){console.error("Gemini voice token request could not complete");return json(res,503,{ok:false,error:"The free voice service could not connect. Please try again later."});}
}

http.createServer(async(req,res)=>{
  const route=(req.url||"").split("?")[0];
  if(req.method==="GET"&&route==="/api/gemini-voice/status")return voiceStatus(res);
  if(req.method==="POST"&&route==="/api/gemini-voice/session")return voiceToken(req,res);
  if(req.method==="POST"&&route==="/api/guide")return handleGuideLead(req,res);
  if(req.method==="POST"&&route==="/api/business-intake")return handleBusinessIntake(req,res);
  if(req.method==="POST"&&route==="/api/media-ai-consent")return handleMediaAiConsent(req,res);
  if(req.method==="GET"&&route==="/api/media-ai-consents")return handleConsentAdminList(req,res);
  if(req.method!=="GET"&&req.method!=="HEAD")return json(res,405,{ok:false,error:"Method not allowed"});
  if(route==="/favicon.ico"){res.writeHead(302,{Location:"/favicon.svg","Cache-Control":"public, max-age=86400"});return res.end();}
  const file=resolveFile(req.url);if(!file){res.writeHead(400);return res.end("Bad request");}
  fs.readFile(file,(err,data)=>{if(!err){res.writeHead(200,{"Content-Type":mime[path.extname(file).toLowerCase()]||"application/octet-stream","X-Content-Type-Options":"nosniff","Referrer-Policy":"strict-origin-when-cross-origin"});return res.end(req.method==="HEAD"?"":data);}fs.readFile(path.join(root,"404.html"),(_,fallback)=>{res.writeHead(404,{"Content-Type":"text/html; charset=utf-8"});res.end(fallback||"Not found");});});
}).listen(port,"0.0.0.0",()=>console.log(`AI Boss Mobility listening on ${port}`));
