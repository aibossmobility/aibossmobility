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

http.createServer(async(req,res)=>{
  if(req.method==="POST" && (req.url||"").split("?")[0]==="/api/guide") return handleGuideLead(req,res);
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
