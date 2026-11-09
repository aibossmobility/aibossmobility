const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const http=require("node:http");
const crypto=require("node:crypto");
const {once}=require("node:events");
const {
  installBossSso,isBossSsoSession,validSessionTicket,makeSessionTicket,
  verifyPapaTicket,consumeTicketJti
}=require("./ai-boss-owner-sso");

(async()=>{
const directory=fs.mkdtempSync(path.join(os.tmpdir(),"ai-boss-owner-sso-"));
const previous=process.env.RAILWAY_VOLUME_MOUNT_PATH;
process.env.RAILWAY_VOLUME_MOUNT_PATH=directory;
const pair=crypto.generateKeyPairSync("ed25519");
const pub=pair.publicKey.export({format:"der",type:"spki"});
const kid="papa-owner-sso-"+crypto.createHash("sha256").update(pub).digest("hex").slice(0,16);
const fetchPublic=async(url,options)=>{
 assert.equal(url,"https://papalifecoach.com/api/auth/ai-boss-sso/public-key");
 assert.equal(options.redirect,"error");
 return {ok:true,json:async()=>({ok:true,alg:"EdDSA",kid,publicKey:pub.toString("base64"),issuer:"https://papalifecoach.com"})};
};
const json=(res,status,payload)=>{
 res.writeHead(status,{"Content-Type":"application/json","Cache-Control":"no-store"});
 res.end(JSON.stringify(payload));
};
const server=http.createServer(installBossSso({json,fetchPublic}));
try{
 server.listen(0,"127.0.0.1");await once(server,"listening");
 const origin="http://127.0.0.1:"+server.address().port;
 const start=await fetch(origin+"/auth/papa/start",{redirect:"manual"});
 assert.equal(start.status,302);
 const stateCookie=start.headers.get("set-cookie");
 assert.match(stateCookie,/HttpOnly; Secure; SameSite=Lax/);
 const state=/__Host-ai-boss-sso-state=([^;]+)/.exec(stateCookie)[1];
 assert.equal(state.length,43);
 const href=new URL(start.headers.get("location"));
 assert.equal(href.hostname,"papalifecoach.com");
 assert.equal(href.searchParams.get("state"),state);
 const now=Math.floor(Date.now()/1000);
 const claims={iss:"https://papalifecoach.com",aud:"ai-boss-mobility-owner-os",
  sub:"1",email:"brian@bossmobility.net",state,iat:now,exp:now+90,
  jti:crypto.randomUUID(),owner_verified:true};
 const head=Buffer.from(JSON.stringify({alg:"EdDSA",typ:"JWT",kid})).toString("base64url");
 const body=Buffer.from(JSON.stringify(claims)).toString("base64url");
 const signingInput=head+"."+body;
 const ticket=signingInput+"."+crypto.sign(null,Buffer.from(signingInput),pair.privateKey).toString("base64url");
 assert.equal((await verifyPapaTicket(ticket,state,{fetchPublic})).email,"brian@bossmobility.net");
 assert.equal(await verifyPapaTicket(ticket,crypto.randomBytes(32).toString("base64url"),{fetchPublic}),null);
 assert.equal(await verifyPapaTicket(ticket+".forged",state,{fetchPublic}),null);
 const callback="/auth/papa/callback?state="+state+"&ticket="+ticket;
 const unauthorized=await fetch(origin+callback,{redirect:"manual"});
 assert.equal(unauthorized.status,303);
 assert.match(unauthorized.headers.get("location"),/sso_error/);
 const valid=await fetch(origin+callback,{headers:{Cookie:"__Host-ai-boss-sso-state="+state},redirect:"manual"});
 assert.equal(valid.status,303);
 assert.equal(valid.headers.get("location"),"/ai-boss-os");
 const sessionHeaders=valid.headers.get("set-cookie");
 assert.match(sessionHeaders,/__Host-ai-boss-sso-session=/);
 assert.match(sessionHeaders,/__Host-ai-boss-sso-state=; Path=\/; Max-Age=0/);
 const session=/__Host-ai-boss-sso-session=([^;]+)/.exec(sessionHeaders)[1];
 assert.equal(validSessionTicket(session),true);
 assert.equal(isBossSsoSession({headers:{cookie:"__Host-ai-boss-sso-session="+session}}),true);
 const replay=await fetch(origin+callback,{headers:{Cookie:"__Host-ai-boss-sso-state="+state},redirect:"manual"});
 assert.match(replay.headers.get("location"),/sso_error/);
 assert.equal(replay.status,303);
 assert.equal(consumeTicketJti(claims.jti),false);
 const wrongOrigin=await fetch(origin+"/auth/papa/logout",{method:"POST",headers:{Origin:"https://attacker.example"}});
 assert.equal(wrongOrigin.status,403);
 const logout=await fetch(origin+"/auth/papa/logout",{method:"POST",headers:{Origin:"https://ai.bossmobilelifecoach.com"}});
 assert.equal(logout.status,200);
 assert.match(logout.headers.get("set-cookie"),/Max-Age=0/);
 const tampered=session.slice(0,-2)+"AA";
 assert.equal(validSessionTicket(tampered),false);
 console.log("PASS owner SSO: signed Ed25519 tickets, same-browser state, replay rejection, cookie privacy, unauthorized blocks, sign-out");
}finally{
 await new Promise(resolve=>server.close(resolve));
 if(previous===undefined)delete process.env.RAILWAY_VOLUME_MOUNT_PATH;
 else process.env.RAILWAY_VOLUME_MOUNT_PATH=previous;
 fs.rmSync(directory,{recursive:true,force:true});
}
})().catch(e=>{console.error(e);process.exitCode=1;});
