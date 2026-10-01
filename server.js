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
async function postWebhook(url,payload,label,extraHeaders={}){if(!url)return false;try{const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json",...extraHeaders},body:JSON.stringify(payload)});if(!response.ok){let detail="";try{const raw=await response.text();try{const parsed=JSON.parse(raw);detail=String(parsed.error||parsed.message||"");}catch{detail=String(raw||"");}}catch{}console.error(`${label} webhook failed`,response.status,detail.slice(0,240));}return response.ok;}catch(err){console.error(`${label} webhook error`,err);return false;}}

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
    try{const dataDir=path.join(__dirname,"data");fs.mkdirSync(dataDir,{recursive:true});fs.appendFileSync(path.join(dataDir,"business-intake.ndjson"),JSON.stringify(lead)+"\n","utf8");}catch(err){console.error("Business intake local record failed",err);}
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
    return json(res,200,{ok:true,routed:results.filter(Boolean).length,ghl_connected:Boolean(process.env.GHL_INTAKE_WEBHOOK)});
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

http.createServer(async(req,res)=>{
  const route=(req.url||"").split("?")[0];
  if(req.method==="POST"&&route==="/api/guide")return handleGuideLead(req,res);
  if(req.method==="POST"&&route==="/api/business-intake")return handleBusinessIntake(req,res);
  if(req.method==="POST"&&route==="/api/media-ai-consent")return handleMediaAiConsent(req,res);
  if(req.method==="GET"&&route==="/api/media-ai-consents")return handleConsentAdminList(req,res);
  if(req.method!=="GET"&&req.method!=="HEAD")return json(res,405,{ok:false,error:"Method not allowed"});
  if(route==="/favicon.ico"){res.writeHead(302,{Location:"/favicon.svg","Cache-Control":"public, max-age=86400"});return res.end();}
  const file=resolveFile(req.url);if(!file){res.writeHead(400);return res.end("Bad request");}
  fs.readFile(file,(err,data)=>{if(!err){res.writeHead(200,{"Content-Type":mime[path.extname(file).toLowerCase()]||"application/octet-stream","X-Content-Type-Options":"nosniff","Referrer-Policy":"strict-origin-when-cross-origin"});return res.end(req.method==="HEAD"?"":data);}fs.readFile(path.join(root,"404.html"),(_,fallback)=>{res.writeHead(404,{"Content-Type":"text/html; charset=utf-8"});res.end(fallback||"Not found");});});
}).listen(port,"0.0.0.0",()=>console.log(`AI Boss Mobility listening on ${port}`));
