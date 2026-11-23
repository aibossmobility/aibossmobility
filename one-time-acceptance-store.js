"use strict";
// Offline, unconnected persistence primitive. NEVER exposes a public endpoint,
// sends customer links, identifies a customer, or issues an invoice.
const fs=require("node:fs");
const path=require("node:path");
const crypto=require("node:crypto");
const TOKEN=/^[a-f0-9]{64}$/;
const hash=s=>crypto.createHash("sha256").update(s).digest("hex");
const text=x=>typeof x==="string"?x.trim():"";
const time=x=>typeof x==="string"&&Number.isFinite(Date.parse(x))?Date.parse(x):NaN;
function acceptanceStore(dir,{now=()=>Date.now()}={}){
  function directory(){
    fs.mkdirSync(dir,{recursive:true,mode:0o700});
    if(!fs.statSync(dir).isDirectory())throw Error("Unavailable store");
  }
  function recordPath(hashId){return path.join(dir,hashId+".json");}
  function lock(hashId,fn){
    const lockDir=path.join(dir,hashId+".lock");
    // No automatic stale-lock breaking: unavailable == safe denial.
    try{fs.mkdirSync(lockDir,{mode:0o700});}
    catch{return {ok:false,reason:"locked_or_unavailable"};}
    try{return fn();}
    finally{fs.rmdirSync(lockDir);}
  }
  function issue({locationId,customerId,orderId,scopeDigest,deliveryId,previewId,qaReviewerId,operatorId,qaPassedAt,previewVerifiedAt,approvedBy,ttlSeconds=86400}={}){
    if(locationId!=="qJ83IIaK5y2ZPHzLfGG1"||[customerId,orderId,scopeDigest,deliveryId,previewId,qaReviewerId,operatorId,approvedBy].some(x=>!text(x))||
       qaReviewerId===operatorId||approvedBy===operatorId||!Number.isInteger(ttlSeconds)||ttlSeconds<60||ttlSeconds>604800||
       !Number.isFinite(time(qaPassedAt))||!Number.isFinite(time(previewVerifiedAt))||
       time(qaPassedAt)>now()||time(previewVerifiedAt)>now())return {ok:false,reason:"unverified_issue_prerequisites"};
    directory();
    const token=crypto.randomBytes(32).toString("hex"),id=hash(token);
    const record={id,locationId,customerId,orderId,scopeDigest,deliveryId,previewId,
      qaReviewerId,operatorId,approvedBy,qaPassedAt,previewVerifiedAt,issuedAt:new Date(now()).toISOString(),
      expiresAt:new Date(now()+ttlSeconds*1000).toISOString(),status:"pending",
      tokenUseCount:0,customerIdentityVerified:false,acceptedAt:null,revoked:false};
    // O_EXCL prevents duplicate records, token itself never persisted.
    fs.writeFileSync(recordPath(id),JSON.stringify(record),{flag:"wx",mode:0o600});
    return {ok:true,token,expiresAt:record.expiresAt};
  }
  function consume({token,decision,customerId,customerIdentityVerified=false,identityMethod,at}={}){
    if(typeof token!=="string"||!TOKEN.test(token)||!["accepted","rejected"].includes(decision))
      return {ok:false,reason:"invalid_request"};
    directory();
    const id=hash(token);
    return lock(id,()=>{
      const f=recordPath(id);
      let rec;
      try{rec=JSON.parse(fs.readFileSync(f,"utf8"));}catch{return {ok:false,reason:"missing_or_unavailable"};}
      if(rec.id!==id||rec.status!=="pending"||rec.revoked===true||rec.tokenUseCount!==0)
        return {ok:false,reason:"already_decided_or_revoked"};
      if(now()>=time(rec.expiresAt))return {ok:false,reason:"expired"};
      if(customerIdentityVerified!==true||!text(identityMethod)||!text(customerId)||customerId!==rec.customerId)
        return {ok:false,reason:"customer_identity_not_verified"};
      const decidedAt=at||new Date(now()).toISOString();
      if(!Number.isFinite(time(decidedAt))||time(decidedAt)>now()||time(decidedAt)<time(rec.previewVerifiedAt)||time(decidedAt)<time(rec.qaPassedAt))
        return {ok:false,reason:"invalid_decision_time"};
      rec.status=decision;rec.tokenUseCount=1;rec.tokenConsumed=true;
      rec.customerIdentityVerified=true;rec.identityMethod=identityMethod;
      rec.acceptedAt=decision==="accepted"?decidedAt:null;rec.decisionAt=decidedAt;
      const tmp=path.join(dir,id+"."+crypto.randomBytes(8).toString("hex")+".tmp");
      try{fs.writeFileSync(tmp,JSON.stringify(rec),{flag:"wx",mode:0o600});fs.renameSync(tmp,f);}
      finally{try{fs.unlinkSync(tmp)}catch{}}
      // Never return the raw record; provide only a safe decision receipt.
      return {ok:true,status:decision,tokenUseCount:1,receiptId:id};
    });
  }
  function readReceipt(token){
    if(typeof token!=="string"||!TOKEN.test(token))return null;
    try{const x=JSON.parse(fs.readFileSync(recordPath(hash(token)),"utf8"));
      return {status:x.status,customerId:x.customerId,previewId:x.previewId,tokenUseCount:x.tokenUseCount,
        tokenConsumed:x.tokenConsumed===true,acceptedAt:x.acceptedAt,revoked:x.revoked===true,
        customerIdentityVerified:x.customerIdentityVerified===true};
    }catch{return null}
  }
  return {issue,consume,readReceipt};
}
module.exports={acceptanceStore};
