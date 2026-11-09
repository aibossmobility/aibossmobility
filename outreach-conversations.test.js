const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const http=require('node:http');const {once}=require('node:events');
const {createConversationStore,installOutreachConversations,validateConversation}=require('./outreach-conversations');
const topics=require('./public/conversation-topics');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ai-boss-conversations-'));process.env.RAILWAY_VOLUME_MOUNT_PATH=dir;
 const record={id:'cb9316c2-153d-454b-93e4-a5c130be495b',person:'Local test only',organization:'Test organization',date:'',kind:'Partner',purpose:'',certainty:'Unknown',questions:topics[0].questions,topic:'clarity',prompt:topics[0].prompt,missing:'',useful:'',takeaways:['',''],steps:'',completed:false,revision:0};
 const store=createConversationStore(dir);const first=store.save(record);assert.equal(first.revision,1);assert.equal(createConversationStore(dir).list()[0].person,record.person);
 assert.throws(()=>store.save(record),e=>e.status===409,'Stale tab cannot overwrite a newer note');
 assert.throws(()=>validateConversation({...record,date:'2026-02-30'}));assert.throws(()=>validateConversation({...record,completed:true}));
 const complete=store.save({...first,completed:true,takeaways:['Let them choose the next step',''],steps:'Review a possible follow-up.'});assert.equal(complete.revision,2);assert.equal(complete.business,'ai_boss_mobility');
 const handler=installOutreachConversations({readBody:req=>new Promise((resolve,reject)=>{let data='';req.on('data',c=>data+=c);req.on('end',()=>resolve(data));req.on('error',reject);}),json:(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));},isAdmin:req=>req.headers['x-admin-token']==='test-only-token'});
 const server=http.createServer(handler);server.listen(0,'127.0.0.1');await once(server,'listening');
 try{const base='http://127.0.0.1:'+server.address().port;const headers={'Content-Type':'application/json','x-admin-token':'test-only-token'};
 assert.equal((await fetch(base)).status,401);assert.equal((await fetch(base,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(record)})).status,401);
 assert.equal((await fetch(base,{headers:{...headers,Origin:'https://papalifecoach.com'}})).status,403);
 const response=await fetch(base,{headers});assert.equal(response.headers.get('cache-control'),'no-store');assert.equal((await response.json()).conversations[0].takeaways[0],'Let them choose the next step');
 assert.equal((await fetch(base,{method:'POST',headers,body:JSON.stringify(record)})).status,409);
 assert.equal((await fetch(base,{method:'POST',headers,body:JSON.stringify({...record,person:''})})).status,400);
 assert.equal((await fetch(base,{method:'DELETE',headers})).status,405);
 const reopened=await fetch(base,{method:'POST',headers,body:JSON.stringify({...complete,completed:false,business:'papa_life'})});assert.equal(reopened.status,200);assert.equal((await reopened.json()).conversation.business,'ai_boss_mobility');
 fs.writeFileSync(path.join(dir,'outreach-conversations.json'),'broken');
 assert.equal((await fetch(base,{method:'POST',headers,body:JSON.stringify({...complete,revision:3})})).status,503);assert.equal(fs.readFileSync(path.join(dir,'outreach-conversations.json'),'utf8'),'broken');
 assert.equal((await fetch(base,{headers})).status,503);
 }finally{await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
 for(const topic of topics){const [url,anchor]=topic.path.split('#');const file=path.join(__dirname,'public',(url==='/'?'index':url.slice(1))+'.html');assert.ok(fs.existsSync(file),topic.path);if(anchor)assert.ok(fs.readFileSync(file,'utf8').includes('id="'+anchor+'"'),topic.path);}
 const explore=fs.readFileSync('public/explore.html','utf8');assert.ok(explore.includes('id="conversation-together"'));assert.ok(explore.includes('/conversation-explore.js'));
 console.log('PASS: owner authentication, private persistence, safe revisions, validation, business isolation, corrupt-file protection, and existing topic destinations.');
})().catch(e=>{console.error(e);process.exitCode=1;});
