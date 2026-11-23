"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {acceptanceStore}=require("./one-time-acceptance-store");
const clock=Date.parse("2026-11-23T20:00:00Z");
function fixture(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"ai-boss-accept-test-"));
 const store=acceptanceStore(dir,{now:()=>clock});
 const input={locationId:"qJ83IIaK5y2ZPHzLfGG1",customerId:"c",orderId:"o",scopeDigest:"approved",deliveryId:"d",
 previewId:"p",qaReviewerId:"reviewer",operatorId:"builder",approvedBy:"manager",
 qaPassedAt:"2026-11-23T19:30:00Z",previewVerifiedAt:"2026-11-23T19:45:00Z",ttlSeconds:600};
 const decision={decision:"accepted",customerId:"c",customerIdentityVerified:true,identityMethod:"verified_customer_session"};
 return {dir,store,input,decision,clean:()=>fs.rmSync(dir,{recursive:true,force:true})};
}
test("one-time accepted decision persists across fresh store instance and denies replay",t=>{
 const f=fixture();t.after(f.clean);
 const a=f.store.issue(f.input);assert.equal(a.ok,true);assert.match(a.token,/^[a-f0-9]{64}$/);
 const b=f.store.consume({...f.decision,token:a.token});assert.equal(b.ok,true);
 assert.equal(f.store.consume({...f.decision,token:a.token}).ok,false);
 const other=acceptanceStore(f.dir,{now:()=>clock});
 assert.equal(other.readReceipt(a.token).status,"accepted");
 assert.equal(other.readReceipt(a.token).tokenUseCount,1);
 assert.equal(other.consume({...f.decision,token:a.token}).ok,false);
 assert.equal(fs.readdirSync(f.dir).filter(x=>x.endsWith(".json")).length,1);
 assert.equal(fs.readFileSync(path.join(f.dir,fs.readdirSync(f.dir).find(x=>x.endsWith(".json"))),"utf8").includes(a.token),false);
});
test("reject is final; no second acceptance",t=>{
 const f=fixture();t.after(f.clean);const issued=f.store.issue(f.input);assert.equal(issued.ok,true);
 assert.equal(f.store.consume({...f.decision,token:issued.token,decision:"rejected"}).status,"rejected");
 assert.equal(f.store.consume({...f.decision,token:issued.token}).ok,false);
 assert.equal(f.store.readReceipt(issued.token).acceptedAt,null);
});
test("unverified identity cannot use or burn link",t=>{
 const f=fixture();t.after(f.clean);const a=f.store.issue(f.input);
 assert.equal(f.store.consume({...f.decision,token:a.token,customerIdentityVerified:false}).ok,false);
 assert.equal(f.store.consume({...f.decision,token:a.token,customerId:"wrong"}).ok,false);
 assert.equal(f.store.readReceipt(a.token).status,"pending");
 assert.equal(f.store.consume({...f.decision,token:a.token}).ok,true);
});
test("issuance blocked without QA and proper business",t=>{
 const f=fixture();t.after(f.clean);
 for(const altered of [{locationId:"BYx4g32AidgEkTBg7nLQ"},{qaReviewerId:"builder"},{approvedBy:"builder"},
 {qaPassedAt:"not-a-date"},{previewId:""},{ttlSeconds:999999}]){
  assert.equal(f.store.issue({...f.input,...altered}).ok,false);
 }
});
test("expired link rejects while never counting acceptance",t=>{
 const f=fixture();t.after(f.clean);const a=f.store.issue(f.input);
 const later=acceptanceStore(f.dir,{now:()=>clock+601000});
 assert.equal(later.consume({...f.decision,token:a.token}).reason,"expired");
 assert.equal(later.readReceipt(a.token).status,"pending");
});
test("nonexistent, malformed and locked tokens fail closed",t=>{
 const f=fixture();t.after(f.clean);const a=f.store.issue(f.input);
 assert.equal(f.store.consume({...f.decision,token:"missing"}).ok,false);
 assert.equal(f.store.consume({...f.decision,token:"0".repeat(64)}).ok,false);
 const id=require("node:crypto").createHash("sha256").update(a.token).digest("hex");
 fs.mkdirSync(path.join(f.dir,id+".lock"));
 assert.equal(f.store.consume({...f.decision,token:a.token}).reason,"locked_or_unavailable");
 assert.equal(f.store.readReceipt(a.token).status,"pending");
});
test("decision chronology and status are validated",t=>{
 const f=fixture();t.after(f.clean);const a=f.store.issue(f.input);
 assert.equal(f.store.consume({...f.decision,token:a.token,at:"2026-11-23T19:40:00Z"}).ok,false);
 assert.equal(f.store.consume({...f.decision,token:a.token,decision:"other"}).ok,false);
 assert.equal(f.store.consume({...f.decision,token:a.token}).ok,true);
});
