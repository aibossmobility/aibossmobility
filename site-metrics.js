"use strict";
const fs=require("fs");
const path=require("path");

const CANONICAL_HOST="ai.bossmobilelifecoach.com";
const PAGES=new Set(["/","/meet-brian","/consulting-services","/journey","/explore","/ask-brian","/digital-courses","/monthly-website-support","/start-project","/ai-consulting-east-bay","/critical-thinking-practice","/consulting-delivery-guide","/glossary","/human-centered-ai-strategy"]);
const TARGETS=new Set(["ai_twin","consulting","estimate","project","email","course","checkout"]);
const BOT_RE=/bot\b|crawler|spider|scraper|headless|lighthouse|monitor|heartbeat|ploy|curl|wget|node-fetch|python-requests|securityscanner|uptime|preview|scan\b|chatgpt-user|exa(search)?bot|barkrowler|mj12/i;
const DATE_RE=/^\d{4}-\d\d-\d\d$/;

function cleanPage(value){
  let p=String(value||"/").split(/[?#]/)[0].replace(/\/+$/,"")||"/";
  if(p.endsWith(".html"))p=p.slice(0,-5)||"/";
  return PAGES.has(p)?p:null;
}
function isPublicHost(host){return String(host||"").split(":")[0].toLowerCase()===CANONICAL_HOST;}
function classifySource(utmSource,referrer){
  let host="";
  try{host=new URL(String(referrer||"")).hostname.toLowerCase();}catch{}
  if(host===CANONICAL_HOST)return "internal";
  const source=String(utmSource||"").toLowerCase().slice(0,80);
  const s=source||host;
  if(/(^|[.-])(google|bing|yahoo|duckduckgo|brave|ecosia)([.-]|$)/.test(s))return "search";
  if(/linkedin|facebook|instagram|tiktok|youtube|twitter|t\.co|threads/.test(s))return "social";
  if(/email|newsletter|gmail|mailchimp/.test(source))return "email";
  if(source)return "campaign_other";
  if(host)return "referral_other";
  return "direct_or_unknown";
}
function metricFile(){
  const directory=process.env.RAILWAY_VOLUME_MOUNT_PATH||path.join(__dirname,"data");
  return path.join(directory,"site-traffic-aggregates.json");
}
function load(){
  try{const obj=JSON.parse(fs.readFileSync(metricFile(),"utf8"));return obj&&obj.version===1&&obj.days&&typeof obj.days==="object"?obj:{version:1,days:{}};}
  catch{return {version:1,days:{}};}
}
function persist(data){
  const file=metricFile();fs.mkdirSync(path.dirname(file),{recursive:true});
  const tempfile=file+".tmp-"+process.pid;
  fs.writeFileSync(tempfile,JSON.stringify(data),{encoding:"utf8",mode:0o600});
  fs.renameSync(tempfile,file);
}
function bump(map,key){map[key]=(map[key]||0)+1;}
function record(type,info={}){
  try{
    const date=new Date().toISOString().slice(0,10);
    const obj=load();
    const day=obj.days[date]||(obj.days[date]={views:{},landingSources:{},cta:{},outcomes:{},engagement:{}});
    if(type==="page_view"){
      const page=cleanPage(info.page);if(!page)return false;
      bump(day.views,page);
      if(info.channel!=="internal")bump(day.landingSources,info.channel||"direct_or_unknown");
    }else if(type==="cta_click"){
      const target=String(info.target||"");
      if(!TARGETS.has(target)||!cleanPage(info.page))return false;
      bump(day.cta,target);
    }else if(type==="voice_connected"){
      if(cleanPage(info.page)!=="/ask-brian")return false;
      day.engagement=day.engagement||{};
      bump(day.engagement,"google_voice_setup_complete");
    }else if(type==="outcome"){
      if(!["crm_intake_ack","crm_intake_unconfirmed","guide_webhook_ack"].includes(info.target))return false;
      bump(day.outcomes,info.target);
    }else return false;
    const cutoff=new Date(Date.now()-90*86400000).toISOString().slice(0,10);
    for(const date of Object.keys(obj.days)){if(!DATE_RE.test(date)||date<cutoff)delete obj.days[date];}
    persist(obj);return true;
  }catch(err){console.error("Site metrics recording failed",err&&err.code||"unknown");return false;}
}
function makeReport(days=28){
  const n=Math.max(1,Math.min(90,Number.parseInt(days,10)||28));
  const now=new Date();
  const start=new Date(now.getTime()-(n-1)*86400000).toISOString().slice(0,10);
  const end=now.toISOString().slice(0,10);
  const a={pageViews:0,landingPageViews:0,ctaClicks:0,crmIntakeAcknowledged:0,crmIntakeUnconfirmed:0,guideDeliveryAcknowledged:0,googleVoiceConnectionsReported:0};
  const perPage={},sources={},ctas={};
  for(const [date,d] of Object.entries(load().days)){if(date<start||date>end)continue;
    for(const [k,v] of Object.entries(d.views||{})){if(!Number.isFinite(v))continue;perPage[k]=(perPage[k]||0)+v;a.pageViews+=v;}
    for(const [k,v] of Object.entries(d.landingSources||{})){if(!Number.isFinite(v))continue;sources[k]=(sources[k]||0)+v;a.landingPageViews+=v;}
    for(const [k,v] of Object.entries(d.cta||{})){if(!Number.isFinite(v))continue;ctas[k]=(ctas[k]||0)+v;a.ctaClicks+=v;}
    a.googleVoiceConnectionsReported+=(d.engagement||{}).google_voice_setup_complete||0;
    const o=d.outcomes||{};
    a.crmIntakeAcknowledged+=o.crm_intake_ack||0;
    a.crmIntakeUnconfirmed+=o.crm_intake_unconfirmed||0;
    a.guideDeliveryAcknowledged+=o.guide_webhook_ack||0;
  }
  return {ok:true,period:{start,end,days:n,timeZone:"UTC"},counts:a,byPage:perPage,landingSources:sources,ctaTargets:ctas,
    definitions:{pageViews:"Browser page loads with JavaScript; not unique people",landingPageViews:"Page loads without an internal-site referrer; not unique sessions",ctaClicks:"Clicks indicating interest; not completed conversations or sales",crmIntakeAcknowledged:"Successful 2xx acknowledgement from configured GoHighLevel intake webhook; not a booked conversation",guideDeliveryAcknowledged:"Successful acknowledgement from configured guide-lead webhook",googleVoiceConnectionsReported:"Browser-reported Google Voice setup completion, not a confirmed two-way conversation"},
    privacy:"Only daily aggregate counts and predefined categories are stored. No names, emails, IP addresses, cookies, session IDs, full referrers or user-agent strings are retained."};
}
function inject(html,route,host){
  if(!isPublicHost(host)||!cleanPage(route)||typeof html!=="string"||!html.includes("</body>"))return html;
  if(html.includes("/site-traffic-client.js"))return html;
  return html.replace("</body>",'<script defer src="/site-traffic-client.js"></script></body>');
}
async function acceptEvent(req,res){
  function end(status){res.writeHead(status,{"Cache-Control":"no-store"});res.end();}
  if(!isPublicHost(req.headers.host)||BOT_RE.test(String(req.headers["user-agent"]||""))){return end(204);}
  const origin=String(req.headers.origin||"");
  if(origin){try{if(new URL(origin).origin!=="https://"+CANONICAL_HOST)return end(403);}catch{return end(403);}}
  if(req.headers["sec-fetch-site"]&&req.headers["sec-fetch-site"]!=="same-origin")return end(403);
  let raw="";try{for await(const chunk of req){raw+=chunk;if(raw.length>1024)return end(413);}}catch{return end(400);}
  let body;try{body=JSON.parse(raw);}catch{return end(400);}
  if(!body||typeof body!=="object")return end(400);
  if(body.kind==="page_view"){
    record("page_view",{page:body.page,channel:classifySource(body.utmSource,body.referrer)});
  }else if(body.kind==="cta_click"){
    record("cta_click",{page:body.page,target:body.target});
  }
  return end(204);
}
function serveReport(req,res,authorized){
  const headers={"Content-Type":"application/json; charset=utf-8","Cache-Control":"private, no-store"};
  if(!authorized){res.writeHead(401,headers);return res.end(JSON.stringify({ok:false,error:"Owner sign-in required"}));}
  const days=new URL(req.url,"https://"+CANONICAL_HOST).searchParams.get("days")||"28";
  res.writeHead(200,headers);res.end(JSON.stringify(makeReport(days)));
}
module.exports={inject,acceptEvent,serveReport,record,makeReport,classifySource,cleanPage};
