const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const topics = require('./public/conversation-topics');
const kinds = ['Entrepreneur', 'Business leader', 'Church leader', 'Nonprofit leader', 'Community leader', 'Partner', 'Explorer'];
const textLimits = {person:200,organization:200,date:10,purpose:3000,missing:2000,prompt:2000,useful:4000,steps:3000};
function validateConversation(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('Please check the conversation fields.');
  if (typeof raw.id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(raw.id)) throw Error('Invalid conversation reference.');
  const out = {id:raw.id,business:'ai_boss_mobility'};
  for (const [key,max] of Object.entries(textLimits)) {
    if (typeof raw[key] !== 'string' || raw[key].length > max) throw Error('Please shorten or check the '+key+' field.');
    out[key] = raw[key].trim();
  }
  if (!out.person) throw Error('Add the person’s name before saving.');
  if (out.date && (!/^\d{4}-\d{2}-\d{2}$/.test(out.date) || Number.isNaN(Date.parse(out.date)) || new Date(out.date).toISOString().slice(0,10) !== out.date)) throw Error('Enter a valid conversation date.');
  if (!kinds.includes(raw.kind) || !['Unknown','Stated interest','Confirmed purpose'].includes(raw.certainty) || !topics.some(t=>t.id===raw.topic)) throw Error('Choose a valid conversation type, purpose status, and topic.');
  for (const [key,min,max,len] of [['questions',2,3,1000],['takeaways',2,2,1500]]) {
    if (!Array.isArray(raw[key]) || raw[key].length < min || raw[key].length > max || raw[key].some(s=>typeof s!=='string'||s.length>len)) throw Error('Please check your '+key+'.');
    out[key]=raw[key].map(s=>s.trim());
  }
  if (typeof raw.completed !== 'boolean' || !Number.isInteger(raw.revision) || raw.revision < 0) throw Error('Please reload this conversation before saving.');
  if (raw.completed && !out.useful && !out.takeaways.some(Boolean)) throw Error('Add what was useful or one takeaway before completing.');
  return {...out,kind:raw.kind,certainty:raw.certainty,topic:raw.topic,completed:raw.completed,revision:raw.revision};
}
function createConversationStore(directory) {
  const file=path.join(directory,'outreach-conversations.json');
  function read() { if(!fs.existsSync(file)) return []; const records=JSON.parse(fs.readFileSync(file,'utf8')); if(!Array.isArray(records))throw Error('Invalid notes file');return records; }
  return {
    list:read,
    save(raw) {
      const data=validateConversation(raw), records=read(), i=records.findIndex(c=>c.id===data.id), previous=i<0?null:records[i];
      if((previous?.revision||0)!==data.revision){const error=Error('This conversation changed in another tab. Keep your notes open, then reload the saved version in another tab before trying again.');error.status=409;throw error;}
      const next={...data,revision:data.revision+1,updated_at:new Date().toISOString()};
      if(i<0)records.push(next);else records[i]=next;
      fs.mkdirSync(directory,{recursive:true});const temporary=file+'.'+crypto.randomUUID()+'.tmp';
      try{fs.writeFileSync(temporary,JSON.stringify(records),{mode:0o600});fs.renameSync(temporary,file);}finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
      return next;
    }
  };
}
function installOutreachConversations({readBody,json,isAdmin}) {
  const dir=process.env.RAILWAY_VOLUME_MOUNT_PATH || (fs.existsSync('/data')?'/data':path.join(__dirname,'data'));
  const store=createConversationStore(dir);
  return async(req,res)=>{
    res.setHeader('X-Robots-Tag','noindex, nofollow');
    if(!isAdmin(req))return json(res,401,{ok:false,error:'Enter your existing private back-office access code.'});
    if(req.headers.origin && req.headers.origin!=='https://ai.bossmobilelifecoach.com')return json(res,403,{ok:false,error:'Open your workspace on ai.bossmobilelifecoach.com.'});
    if(req.method==='GET'){
      try{return json(res,200,{ok:true,conversations:store.list()});}catch{return json(res,503,{ok:false,error:'Saved conversations could not be read. Your existing notes have not been replaced.'});}
    }
    if(req.method==='POST'){
      let body;
      try{body=validateConversation(JSON.parse(await readBody(req)));}catch(e){return json(res,400,{ok:false,error:e.message});}
      try{return json(res,200,{ok:true,conversation:store.save(body)});}catch(e){return json(res,e.status===409?409:503,{ok:false,error:e.status===409?e.message:'Saving failed. Your notes are still on screen. Please retry.'});}
    }
    res.setHeader('Allow','GET, POST');return json(res,405,{ok:false,error:'Method not allowed'});
  };
}
module.exports={createConversationStore,installOutreachConversations,validateConversation,kinds};
