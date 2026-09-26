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
function json(res,status,payload){
  res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});
  res.end(JSON.stringify(payload));
}
function readBody(req){
  return new Promise((resolve,reject)=>{
    let raw="";
    req.on("data",chunk=>{
      raw+=chunk;
      if(raw.length>25000){reject(new Error("payload too large"));req.destroy();}
    });
    req.on("end",()=>resolve(raw));
    req.on("error",reject);
  });
}
async function handleGuideLead(req,res){
  try{
    const raw=await readBody(req);
    const body=JSON.parse(raw||"{}");
    const name=String(body.name||"").trim().slice(0,160);
    const email=String(body.email||"").trim().slice(0,254);
    const organization=String(body.organization||"").trim().slice(0,240);
    const need=String(body.need||"").trim().slice(0,3000);
    if(!name || !email || !email.includes("@")) return json(res,400,{ok:false,error:"Name and valid email are required."});

    const lead={
      name,email,organization,need,
      source:"AI Boss Mobility Website",
      resource:"Free AI & Tech Language Guide",
      marketing_consent:false,
      submitted_at:new Date().toISOString()
    };

    const hook=process.env.AIRTABLE_GUIDE_WEBHOOK;
    if(hook){
      const response=await fetch(hook,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(lead)
      });
      if(!response.ok) console.error("Guide lead webhook failed",response.status);
    }else{
      console.warn("AIRTABLE_GUIDE_WEBHOOK is not configured");
    }
    return json(res,200,{ok:true});
  }catch(err){
    console.error("Guide lead error",err);
    return json(res,400,{ok:false,error:"Unable to process request."});
  }
}

async function handleMediaAiConsent(req,res){
  try{
    const raw=await readBody(req);
    const body=JSON.parse(raw||"{}");
    const full_name=String(body.full_name||"").trim().slice(0,160);
    const email=String(body.email||"").trim().slice(0,254).toLowerCase();
    const typed_signature=String(body.typed_signature||"").trim().slice(0,160);
    const consent_text=String(body.consent_text||"").trim().slice(0,5000);
    if(!full_name || !email || !email.includes("@") || !typed_signature || !consent_text){
      return json(res,400,{ok:false,error:"Name, valid email, signature, and consent are required."});
    }
    const flags=[
      "allow_photo","allow_video","allow_voice","allow_name_likeness","allow_testimonial",
      "allow_website_social","allow_education_training","allow_marketing","allow_ai_assisted_editing","consent_all"
    ];
    const record={
      record_type:"media_ai_consent",
      consent_version:"2026-09-26-v1",
      full_name,email,
      project_or_purpose:String(body.project_or_purpose||"").trim().slice(0,500),
      typed_signature,consent_text,
      submitted_at:new Date().toISOString(),
      ip_address:String(req.headers["x-forwarded-for"]||req.socket.remoteAddress||"").split(",")[0].trim().slice(0,120),
      user_agent:String(req.headers["user-agent"]||"").slice(0,500)
    };
    for(const key of flags) record[key]=Boolean(body[key]);
    const hasMaterialPermission=record.consent_all||record.allow_photo||record.allow_video||record.allow_voice||record.allow_name_likeness||record.allow_testimonial;
    if(!hasMaterialPermission) return json(res,400,{ok:false,error:"Select at least one type of material you permit us to use."});

    const dataDir=path.join(__dirname,"data");
    try{
      fs.mkdirSync(dataDir,{recursive:true});
      fs.appendFileSync(path.join(dataDir,"media-ai-consents.ndjson"),JSON.stringify(record)+"\n","utf8");
    }catch(fileErr){
      console.error("Consent local record failed",fileErr);
    }

    const hook=process.env.AIRTABLE_CONSENT_WEBHOOK||process.env.AIRTABLE_GUIDE_WEBHOOK;
    if(hook){
      try{
        const response=await fetch(hook,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(record)});
        if(!response.ok) console.error("Consent webhook failed",response.status);
      }catch(hookErr){
        console.error("Consent webhook error",hookErr);
      }
    }
    return json(res,200,{ok:true,consent_version:record.consent_version,submitted_at:record.submitted_at});
  }catch(err){
    console.error("Consent error",err);
    return json(res,400,{ok:false,error:"Unable to record permission."});
  }
}

http.createServer(async(req,res)=>{
  if(req.method==="POST" && (req.url||"").split("?")[0]==="/api/guide") return handleGuideLead(req,res);\n  if(req.method==="POST" && (req.url||"").split("?")[0]==="/api/media-ai-consent") return handleMediaAiConsent(req,res);
  if(req.method!=="GET" && req.method!=="HEAD") return json(res,405,{ok:false,error:"Method not allowed"});

  const file=resolveFile(req.url);
  if(!file){res.writeHead(400);return res.end("Bad request");}
  fs.readFile(file,(err,data)=>{
    if(!err){
      res.writeHead(200,{"Content-Type":mime[path.extname(file).toLowerCase()]||"application/octet-stream","X-Content-Type-Options":"nosniff","Referrer-Policy":"strict-origin-when-cross-origin"});
      return res.end(req.method==="HEAD"?"":data);
    }
    fs.readFile(path.join(root,"404.html"),(_,fallback)=>{
      res.writeHead(404,{"Content-Type":"text/html; charset=utf-8"});
      res.end(fallback||"Not found");
    });
  });
}).listen(port,"0.0.0.0",()=>console.log(`AI Boss Mobility listening on ${port}`));
