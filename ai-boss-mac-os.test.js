const assert=require("node:assert/strict");
const fs=require("node:fs"), os=require("node:os"), path=require("node:path"), http=require("node:http");
const {once}=require("node:events");
const {acceptMacEvent,dailyReport,installMacOS,pacificDay}=require("./ai-boss-mac-os");
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"ai-boss-mac-os-"));
 const data=path.join(dir,"ai-boss-mac-os-report.json"),day="2026-11-09";
 const now=new Date("2026-11-09T21:00:00.000Z");
 const base={brand:"ai_boss_mobility",kind:"worker_rollup",date:day,
   source_ref:"mac-proof:2026-11-09",observed_at:now.toISOString(),
   metrics:{proof_records:4,qa_passed:2,qa_pending:1,failed:1}};
 try{
  assert.deepEqual(acceptMacEvent(base,data,now),{accepted:true,duplicate:false});
  assert.deepEqual(acceptMacEvent(base,data,now),{accepted:false,duplicate:true});
  assert.equal(dailyReport(day,data,dir).mac.worker_proof.proof_records,4);
  assert.throws(()=>acceptMacEvent({...base,brand:"papa_life"},data,now));
  assert.throws(()=>acceptMacEvent({...base,metrics:{proof_records:0,qa_passed:8,qa_pending:0,failed:0}},data,now));
  assert.throws(()=>acceptMacEvent({...base,date:"2026-02-30"},data,now));
  assert.throws(()=>acceptMacEvent({...base,date:"2026-11-10"},data,now));
  const voice={brand:"ai_boss_mobility",kind:"voice_recap",date:day,
    source_ref:"mac-voice:sample-0001",observed_at:now.toISOString(),
    authorized_to_store:true,note:"A locally authorized recap without client details."};
  assert.throws(()=>acceptMacEvent({...voice,authorized_to_store:false},data,now));
  assert.equal(acceptMacEvent(voice,data,now).accepted,true);
  assert.equal(acceptMacEvent(voice,data,now).duplicate,true);
  assert.equal(dailyReport(day,data,dir).summary.mac_voice_recaps,1);
  assert.equal(dailyReport("2026-11-08",data,dir).summary.mac_voice_recaps,0);
  assert.equal(pacificDay(new Date("2026-11-10T03:00:00Z")),day);

  const prevToken=process.env.AI_BOSS_MAC_RELAY_TOKEN,prevDir=process.env.RAILWAY_VOLUME_MOUNT_PATH;
  process.env.AI_BOSS_MAC_RELAY_TOKEN="this-is-a-dedicated-test-token-long-enough-to-validate-20261109";
  process.env.RAILWAY_VOLUME_MOUNT_PATH=dir;
  const handler=installMacOS({
   readBody:req=>new Promise((resolve,reject)=>{
    let value="";req.on("data",chunk=>value+=chunk);req.on("end",()=>resolve(value));req.on("error",reject);
   }),
   json:(res,status,body)=>{res.writeHead(status,{"Content-Type":"application/json","Cache-Control":"no-store"});res.end(JSON.stringify(body));},
   isAdmin:req=>req.headers["x-admin-token"]==="owner-test-code"
  });
  const server=http.createServer(handler);
  server.listen(0,"127.0.0.1");await once(server,"listening");
  try{
   const url="http://127.0.0.1:"+server.address().port;
   const get=(headers={})=>fetch(url+"/api/ai-boss-os/daily?date=2026-11-09",{headers});
   const post=(headers,body=base)=>fetch(url+"/api/ai-boss-os/mac-event",{
    method:"POST",headers:{"Content-Type":"application/json",...headers},body:JSON.stringify(body)
   });
   assert.equal((await get()).status,401);
   assert.equal((await get({"x-admin-token":"owner-test-code",Origin:"https://unrelated.example"})).status,403);
   const owner=await get({"x-admin-token":"owner-test-code"});
   assert.equal(owner.status,200);
   assert.equal((await owner.json()).summary.mac_voice_recaps,1,"Owner can read verified Mac recaps");
   assert.equal((await post({})).status,401);
   assert.equal((await post({Authorization:"Bearer invalid"})).status,401);
   const receipt=await post({Authorization:"Bearer "+process.env.AI_BOSS_MAC_RELAY_TOKEN},{...base,observed_at:"2000-01-01T00:00:00.000Z"});
   assert.equal(receipt.status,400,"stale Mac event rejected");
  }finally{
   await new Promise(resolve=>server.close(resolve));
   if(prevToken===undefined)delete process.env.AI_BOSS_MAC_RELAY_TOKEN;else process.env.AI_BOSS_MAC_RELAY_TOKEN=prevToken;
   if(prevDir===undefined)delete process.env.RAILWAY_VOLUME_MOUNT_PATH;else process.env.RAILWAY_VOLUME_MOUNT_PATH=prevDir;
  }
  console.log("PASS Mac daily reporting: authorization, deduplication, source validation, owner privacy and Pacific dates");
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
})().catch(err=>{console.error(err);process.exitCode=1;});
