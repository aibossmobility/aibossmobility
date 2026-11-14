"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const os = require("node:os");
const {spawn} = require("node:child_process");
const catalog = require("./public/estimate-offers.json");
assert.equal(catalog.offers.filter(x=>x.kind==="project").length,12);
assert.equal(catalog.offers.filter(x=>x.kind==="course").length,0);
assert.equal(catalog.offers.length,12);
assert.equal(catalog.scope,"custom consulting and project services only");
assert(new Set(catalog.offers.map(x=>x.id)).size===catalog.offers.length);
for(const offer of catalog.offers){
 const half=Math.ceil(offer.priceCents/2),balance=offer.priceCents-half;
 assert.equal(half+balance,offer.priceCents);
 assert(half>=balance && half-balance<=1);
}
for(const id of ["service-01","service-08","service-12"]) {
 assert(catalog.offers.some(x=>x.id===id));
}
for(const id of ["course-01-pdf","course-10-complete","academy-bundle","bundle-ai-essentials"]) {
 assert(!catalog.offers.some(x=>x.id===id),"fixed-price products are not estimate-eligible");
}
const main=fs.readFileSync("./public/consulting-services.html","utf8");
const courses=fs.readFileSync("./public/digital-courses.html","utf8");
for(let n=1;n<=12;n++)assert(main.includes("/estimate-checklist?offer=service-"+String(n).padStart(2,"0")));
assert(!courses.includes("/estimate-checklist?offer="),"digital courses and bundles cannot use consulting estimates");
assert.equal((courses.match(/Coming soon · One-time payment only when the course is ready/g)||[]).length,10);
assert.equal((courses.match(/Coming soon · One-time purchase when available/g)||[]).length,5);
assert(courses.includes("No estimate, signed consulting agreement, or 50% deposit is required"));
assert(!main.includes("link.fastpaydirect.com/payment-link/"),"No unconditional full-price payment shortcut in project catalog");

async function run() {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"ai-boss-estimate-test-"));
 const calls=[];
 const ghl=http.createServer(async (req,res) => {
  let body="";
  for await(const chunk of req) body+=chunk;
  calls.push(JSON.parse(body));
  res.writeHead(200,{"Content-Type":"application/json"});res.end('{"ok":true}');
 });
 await new Promise(resolve=>ghl.listen(0,"127.0.0.1",resolve));
 const port=ghl.address().port;
 const socket=http.createServer();
 await new Promise(resolve=>socket.listen(0,"127.0.0.1",resolve));
 const appPort=socket.address().port;
 await new Promise(resolve=>socket.close(resolve));
 const app=spawn(process.execPath,["server.js"],{cwd:__dirname,env:{
  ...process.env,PORT:String(appPort),RAILWAY_VOLUME_MOUNT_PATH:dir,
  GHL_INTAKE_WEBHOOK:"http://127.0.0.1:"+port+"/webhook",
  GOOGLE_HUB_WEBHOOK:"",AI_BOSS_LEAD_WEBHOOK:"",AIRTABLE_GUIDE_WEBHOOK:"",AI_BOSS_INTAKE_SECRET:""
 },stdio:"ignore"});
 try {
  const url="http://127.0.0.1:"+appPort;
  let ready=false;
  for(let tries=0;tries<35;tries++){
   try{const r=await fetch(url+"/estimate-offers.json");if(r.ok){ready=true;break;}}catch{}
   await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert(ready,"local app did not start");
  const j=await fetch(url+"/estimate-offers.json");
  assert.equal(j.headers.get("content-type").split(";")[0],"application/json");
  const post=body=>fetch(url+"/api/business-intake",{
   method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)
  });
  const request=(offerId)=>({
   path:"estimate-checklist",offerId,name:"Estimate Test Only",email:"test@example.invalid",
   organization:"Example Project",estimateTermsAccepted:true,
   checklist:{goal:"Improve our fictional onboarding process",deliverables:"One specified demonstration and checklist",
    timeline:"Next quarter",tools:"Existing email",constraints:"No live credentials",acceptance:"Test data passes"}
  });
  assert.equal((await post(request("does-not-exist"))).status,422);
  assert.equal((await post({...request("service-08"),estimateTermsAccepted:false})).status,422);
  assert.equal((await post({...request("service-08"),checklist:{goal:"short"}})).status,422);
  for(const id of ["course-01-pdf","course-10-complete","academy-bundle","bundle-ai-essentials"]) {
   assert.equal((await post(request(id))).status,422,"Digital content must not create consulting estimate");
  }
  for(const offerId of ["service-08","service-12"]) {
   const r=await post(request(offerId));assert.equal(r.status,200);
   const reply=await r.json();assert(reply.crm_received);
   assert.equal(reply.estimate.offerId,offerId);
   assert.equal(reply.estimate.customerChargeAuthorized,false);
   assert.equal(reply.estimate.state,"estimate_requested_not_signed");
  }
  assert.equal(calls.length,2);
  assert.equal(calls[0].estimate.totalCents,35000);
  assert.equal(calls[0].estimate.depositCents,17500);
  assert.equal(calls[0].estimate.finalBalanceCents,17500);
  assert.equal(calls[1].estimate.totalCents,50000);
  assert.equal(calls[1].estimate.depositCents,25000);
  assert.equal(calls[1].estimate.finalBalanceCents,25000);
  assert(!JSON.stringify(calls).includes("privateStatusToken"));
  const saved=fs.readFileSync(path.join(dir,"business-intake.ndjson"),"utf8").trim().split("\n");
  assert.equal(saved.length,2);
  console.log("PASS: consulting 50/50 estimate only; rejects all digital product requests, no charge, local CRM callbacks only for projects.");
 } finally {
  app.kill("SIGTERM");
  await new Promise(resolve=>ghl.close(resolve));
  fs.rmSync(dir,{recursive:true,force:true});
 }
}
run().catch(e=>{console.error(e);process.exitCode=1});
