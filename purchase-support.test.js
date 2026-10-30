const assert=require("node:assert/strict");
const http=require("node:http");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {installPurchaseSupport,LOCATION}=require("./purchase-support");
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"ai-boss-support-test-"));
process.env.RAILWAY_VOLUME_MOUNT_PATH=dir;
const handler=installPurchaseSupport({
readBody:req=>new Promise(resolve=>{let s="";req.on("data",c=>s+=c);req.on("end",()=>resolve(s));}),
json:(res,status,body)=>{res.writeHead(status,{"Content-Type":"application/json"});res.end(JSON.stringify(body));},
isAdmin:req=>req.headers["x-admin-token"]==="test-access"
});
const server=http.createServer(async(req,res)=>{await handler(req,res,"/api/purchase-support")});
server.listen(0,"127.0.0.1",async()=>{try{
const base="http://127.0.0.1:"+server.address().port;
const post=body=>fetch(base,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
const body={name:"Support Test",email:"buyer@example.com",issue:"delivery",service:"AI Strategy & Planning",details:"Receipt TEST ONLY"};
assert.equal((await post({...body,email:"bad"})).status,400);
assert.equal((await post(body)).status,200);
assert.equal((await post(body)).status,200);
assert.equal((await fetch(base)).status,401);
const rows=await (await fetch(base,{headers:{"x-admin-token":"test-access"}})).json();
assert.equal(rows.requests.length,1);
assert.equal(rows.location_id,LOCATION);
assert.equal(rows.requests[0].status,"review");
assert.equal(rows.requests[0].business,"ai_boss_mobility");
const blocked=await fetch(base,{method:"POST",headers:{"Content-Type":"application/json",Origin:"https://papalifecoach.com"},body:JSON.stringify(body)});
assert.equal(blocked.status,403);
console.log("AI Boss support: validation, durable queue, duplicate suppression, admin protection, and business isolation passed.");
}catch(error){console.error(error);process.exitCode=1;}finally{server.close();fs.rmSync(dir,{recursive:true,force:true})}});
