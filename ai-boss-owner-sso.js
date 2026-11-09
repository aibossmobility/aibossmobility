"use strict";
const fs=require("node:fs");
const path=require("node:path");
const crypto=require("node:crypto");

const PAPA_ORIGIN="https://papalifecoach.com";
const AI_BOSS_ORIGIN="https://ai.bossmobilelifecoach.com";
const KEY_URL=PAPA_ORIGIN+"/api/auth/ai-boss-sso/public-key";
const STATE_COOKIE="__Host-ai-boss-sso-state";
const SESSION_COOKIE="__Host-ai-boss-sso-session";
const ISSUER=PAPA_ORIGIN;
const AUDIENCE="ai-boss-mobility-owner-os";
const OWNER_EMAIL="brian@bossmobility.net";
const STATE_RE=/^[A-Za-z0-9_-]{43}$/;
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SESSION_MAX_AGE=8*60*60;

function dataDir(){
  return process.env.RAILWAY_VOLUME_MOUNT_PATH ||
    (fs.existsSync("/data") ? "/data" : path.join(__dirname,"data"));
}
function cookies(req){
  const raw=String(req.headers.cookie||"").slice(0,8000);
  const out={};
  for(const part of raw.split(";")){
    const i=part.indexOf("=");
    if(i>0)out[part.slice(0,i).trim()]=part.slice(i+1).trim();
  }
  return out;
}
function constantEqual(a,b){
  if(typeof a!=="string"||typeof b!=="string")return false;
  const x=Buffer.from(a),y=Buffer.from(b);
  return x.length===y.length&&crypto.timingSafeEqual(x,y);
}
function getCookieKey(dir=dataDir()){
  fs.mkdirSync(dir,{recursive:true,mode:0o700});
  const file=path.join(dir,"ai-boss-owner-sso-cookie-key");
  try{fs.writeFileSync(file,crypto.randomBytes(32),{flag:"wx",mode:0o600});}
  catch(e){if(e.code!=="EEXIST")throw e;}
  const stat=fs.lstatSync(file);
  if(!stat.isFile()||(stat.mode&0o077)!==0)throw Error("SSO private key file has unsafe permissions");
  const key=fs.readFileSync(file);
  if(key.length!==32)throw Error("SSO private key file corrupt");
  return key;
}
function mac(data,key){
  return crypto.createHmac("sha256",key).update(data).digest("base64url");
}
function makeSessionTicket(now=Date.now(),dir=dataDir()){
  const body=Buffer.from(JSON.stringify({
    aud:"ai-boss-owner-ui",owner:true,email:OWNER_EMAIL,iat:now,exp:now+SESSION_MAX_AGE*1000
  })).toString("base64url");
  return body+"."+mac(body,getCookieKey(dir));
}
function validSessionTicket(token,now=Date.now(),dir=dataDir()){
  if(typeof token!=="string"||token.length>1800)return false;
  const parts=token.split(".");
  if(parts.length!==2||parts.some(x=>!/^[A-Za-z0-9_-]+$/.test(x)))return false;
  let key;
  try{key=getCookieKey(dir)}catch{return false}
  if(!constantEqual(mac(parts[0],key),parts[1]))return false;
  try{
    const p=JSON.parse(Buffer.from(parts[0],"base64url").toString("utf8"));
    return p.aud==="ai-boss-owner-ui"&&p.owner===true&&p.email===OWNER_EMAIL&&
      Number.isSafeInteger(p.iat)&&Number.isSafeInteger(p.exp)&&
      p.exp>now&&p.iat<=now+2000&&p.exp-p.iat<=SESSION_MAX_AGE*1000;
  }catch{return false}
}
function isBossSsoSession(req){
  return validSessionTicket(cookies(req)[SESSION_COOKIE]);
}
function appendSetCookie(res,value){
  const current=res.getHeader("Set-Cookie");
  const list=current?(Array.isArray(current)?current:[current]):[];
  res.setHeader("Set-Cookie",[...list,value]);
}
function writeCookie(res,name,value,maxAge){
  appendSetCookie(res,name+"="+value+"; Path=/; Max-Age="+maxAge+"; HttpOnly; Secure; SameSite=Lax");
}
function clearCookie(res,name){
  appendSetCookie(res,name+"=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax");
}
function responseHeaders(res){
  res.setHeader("Cache-Control","no-store, private");
  res.setHeader("Referrer-Policy","no-referrer");
  res.setHeader("X-Robots-Tag","noindex, nofollow");
}
function consumeTicketJti(jti,now=Date.now(),dir=dataDir()){
  const file=path.join(dir,"ai-boss-owner-sso-used.json");
  fs.mkdirSync(dir,{recursive:true,mode:0o700});
  let state={};
  try{
    const stats=fs.lstatSync(file);
    if(!stats.isFile()||(stats.mode&0o077)!==0)throw Error("Unsafe used-ticket file");
    state=JSON.parse(fs.readFileSync(file,"utf8"));
    if(!state||typeof state!=="object"||Array.isArray(state))throw Error("Invalid used-ticket file");
  }catch(e){if(e.code!=="ENOENT")throw e;}
  for(const [key,expiry] of Object.entries(state)){
    if(!Number.isSafeInteger(expiry)||expiry<now)delete state[key];
  }
  const hash=crypto.createHash("sha256").update(jti).digest("hex");
  if(Object.prototype.hasOwnProperty.call(state,hash))return false;
  state[hash]=now+120000;
  const temp=file+"."+crypto.randomBytes(8).toString("hex")+".tmp";
  try{
    fs.writeFileSync(temp,JSON.stringify(state),{flag:"wx",mode:0o600});
    fs.renameSync(temp,file);
  }finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
  return true;
}
async function verifyPapaTicket(ticket,state,options={}){
  const now=options.now??Date.now();
  if(typeof ticket!=="string"||ticket.length>3600||!STATE_RE.test(state))return null;
  const parts=ticket.split(".");
  if(parts.length!==3||parts.some(x=>!/^[A-Za-z0-9_-]+$/.test(x)))return null;
  let header,payload;
  try{
    header=JSON.parse(Buffer.from(parts[0],"base64url").toString());
    payload=JSON.parse(Buffer.from(parts[1],"base64url").toString());
  }catch{return null}
  const f=options.fetchPublic||fetch;
  const response=await f(KEY_URL,{redirect:"error",signal:AbortSignal.timeout(7000),headers:{Accept:"application/json"}});
  if(!response.ok)throw Error("Papa Life owner verification unavailable");
  const publicData=await response.json();
  if(!publicData.ok||publicData.alg!=="EdDSA"||publicData.issuer!==ISSUER||
     !/^papa-owner-sso-[a-f0-9]{16}$/.test(publicData.kid)||
     !/^[A-Za-z0-9+/=]{48,200}$/.test(publicData.publicKey))
    return null;
  if(header.alg!=="EdDSA"||header.typ!=="JWT"||header.kid!==publicData.kid)return null;
  const pub=crypto.createPublicKey({key:Buffer.from(publicData.publicKey,"base64"),format:"der",type:"spki"});
  if(pub.asymmetricKeyType!=="ed25519"||
     !crypto.verify(null,Buffer.from(parts[0]+"."+parts[1]),pub,Buffer.from(parts[2],"base64url")))
    return null;
  const nowSeconds=Math.floor(now/1000);
  if(payload.iss!==ISSUER||payload.aud!==AUDIENCE||
    payload.email!==OWNER_EMAIL||payload.owner_verified!==true||
    !STATE_RE.test(payload.state)||!constantEqual(payload.state,state)||
    !UUID_RE.test(String(payload.jti||""))||
    !/^[1-9][0-9]{0,10}$/.test(String(payload.sub||""))||
    !Number.isSafeInteger(payload.iat)||!Number.isSafeInteger(payload.exp)||
    payload.iat>nowSeconds+5||payload.exp<=nowSeconds||payload.exp-payload.iat>90)
    return null;
  return payload;
}

function installBossSso({json}){
  return async(req,res)=>{
    responseHeaders(res);
    const route=(req.url||"").split("?")[0];
    if(route==="/auth/papa/start"&&req.method==="GET"){
      const state=crypto.randomBytes(32).toString("base64url");
      writeCookie(res,STATE_COOKIE,state,300);
      res.writeHead(302,{Location:PAPA_ORIGIN+"/api/auth/ai-boss-sso/authorize?state="+encodeURIComponent(state)});
      return res.end();
    }
    if(route==="/auth/papa/callback"&&req.method==="GET"){
      const query=new URL(req.url,AI_BOSS_ORIGIN).searchParams;
      const state=query.get("state")||"",ticket=query.get("ticket")||"";
      const saved=cookies(req)[STATE_COOKIE]||"";
      clearCookie(res,STATE_COOKIE);
      try{
        if(!STATE_RE.test(state)||!constantEqual(state,saved))
          throw Error("Sign-in state expired");
        const claims=await verifyPapaTicket(ticket,state);
        if(!claims||!consumeTicketJti(claims.jti))
          throw Error("Sign-in ticket not valid");
        writeCookie(res,SESSION_COOKIE,makeSessionTicket(),SESSION_MAX_AGE);
        res.writeHead(303,{Location:"/ai-boss-os"});
      }catch{
        res.writeHead(303,{Location:"/ai-boss-os?sso_error=signin_failed"});
      }
      return res.end();
    }
    if(route==="/auth/papa/logout"&&req.method==="POST"){
      const origin=req.headers.origin;
      if(origin&&origin!==AI_BOSS_ORIGIN)return json(res,403,{ok:false,error:"Invalid sign-out origin"});
      clearCookie(res,SESSION_COOKIE);
      return json(res,200,{ok:true});
    }
    return json(res,405,{ok:false,error:"Method not allowed"});
  };
}
module.exports={installBossSso,isBossSsoSession,validSessionTicket,makeSessionTicket,verifyPapaTicket,consumeTicketJti,constantEqual};
