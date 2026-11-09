(function(){
  const root=document.getElementById('outreach-workspace');if(!root)return;
  const $=selector=>root.querySelector(selector), topics=window.AIBossConversationTopics;
  const kinds=['Entrepreneur','Business leader','Church leader','Nonprofit leader','Community leader','Partner','Explorer'];
  let token='',records=[],selected=null,view='Upcoming',dirty=false,saving=false;
  const fields=['person','organization','date','kind','purpose','certainty','topic','missing','prompt','useful','steps'];
  function today(){const p=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['year','month','day'].map(k=>p.find(v=>v.type===k).value).join('-');}
  function missing(c){return [...(!c.date?['Date']:[]),...(!c.purpose.trim()||c.certainty==='Unknown'?['Purpose or interest']:[]),...(c.missing.trim()?['Details to clarify']:[])];}
  function inView(c,v){return v==='Upcoming'?!c.completed&&(!c.date||c.date>=today()):v==='Missing information'?!c.completed&&missing(c).length>0:v==='Completed reflections'?c.completed:true;}
  function error(message=''){$('[data-error]').textContent=message;$('[data-error]').hidden=!message;}
  function notice(message){$('[data-save-status]').textContent=message;}
  function leave(){return !dirty||confirm('Discard your unsaved conversation changes?');}
  function completeEnabled(){const b=$('[data-complete]');b.disabled=saving||!selected||!selected.completed&&!selected.useful.trim()&&!selected.takeaways.some(v=>v.trim());}
  function updateTopic(){const topic=topics.find(t=>t.id===selected.topic)||topics[0];$('[data-explore]').href=topic.path;$('[data-explore]').textContent='Explore: '+topic.name+' →';}
  function renderEditor(){
    $('[data-list]').hidden=true;$('[data-editor]').hidden=false;
    for(const f of fields)$('[data-field="'+f+'"]').value=selected[f];
    for(const name of ['questions','takeaways'])selected[name].forEach((v,i)=>$('[data-array="'+name+'"][data-index="'+i+'"]').value=v);
    $('[data-person-heading]').textContent=selected.person||'A new conversation';
    $('[data-complete]').textContent=selected.completed?'Reopen conversation':'Save & complete reflection';
    $('[data-completed]').hidden=!selected.completed;
    notice(dirty?'Unsaved changes':'Saved conversation');updateTopic();completeEnabled();
    switchTab(selected.completed?'Reflect':'Prepare');
  }
  function switchTab(tab){for(const b of root.querySelectorAll('[data-mode]'))b.setAttribute('aria-pressed',String(b.dataset.mode===tab));$('[data-prepare]').hidden=tab!=='Prepare';$('[data-reflect]').hidden=tab!=='Reflect';}
  function create(kind='Explorer'){if(!leave())return;const topic=topics[0];selected={id:crypto.randomUUID(),person:'',organization:'',date:'',kind,purpose:'',certainty:'Unknown',questions:[...topic.questions],topic:topic.id,prompt:topic.prompt,missing:'',useful:'',takeaways:['',''],steps:'',completed:false,revision:0};dirty=true;error();renderEditor();$('[data-field="person"]').focus();}
  function renderList(){
    $('[data-list]').hidden=false;$('[data-editor]').hidden=true;
    for(const b of root.querySelectorAll('[data-view]')){b.setAttribute('aria-pressed',String(b.dataset.view===view));b.querySelector('span').textContent=records.filter(c=>inView(c,b.dataset.view)).length;}
    const q=$('[data-search]').value.toLowerCase();const items=records.filter(c=>inView(c,view)&&[c.person,c.organization,c.purpose,c.kind].join(' ').toLowerCase().includes(q)).sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'));
    const container=$('[data-cards]');container.replaceChildren();
    for(const c of items){const b=document.createElement('button');b.type='button';b.className='ab-card';const kind=document.createElement('small');kind.textContent=c.kind;const title=document.createElement('h3');title.textContent=c.person;const p=document.createElement('p');p.textContent=c.purpose||'Interest still to clarify';const footer=document.createElement('small');footer.textContent=(c.date?new Date(c.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'Date to confirm')+' · '+(c.completed?'Reflection complete':missing(c).join(' · ')||'Ready to explore');b.append(kind,title,p,footer);b.addEventListener('click',()=>{if(!leave())return;selected=structuredClone(c);dirty=false;error();renderEditor();});container.append(b);}
    $('[data-empty]').hidden=items.length>0;$('[data-empty]').textContent=q?'No matching conversations.':view==='Completed reflections'?'Completed reflections will appear here.':view==='Missing information'?'Nothing to clarify right now.':'Create a conversation when you have someone in mind. A name is enough to begin.';
  }
  async function api(method='GET',body){const r=await fetch('/api/outreach-conversations',{method,headers:{'x-admin-token':token,...(body?{'Content-Type':'application/json'}:{})},cache:'no-store',...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok||!data.ok)throw Error(data.error||'Could not connect. Your notes are still on screen.');return data;}
  async function load(e){e?.preventDefault();if(!leave())return;token=$('[data-token]').value;error();$('[data-open]').disabled=true;try{const data=await api();records=data.conversations;selected=null;dirty=false;$('[data-login]').hidden=true;$('[data-work]').hidden=false;$('[data-token]').value='';renderList();}catch(e){error(e.message);}finally{$('[data-open]').disabled=false;}}
  async function save(complete){
    if(!selected||saving)return;
    if(!selected.person.trim()){error('Add the person’s name before saving.');switchTab('Prepare');$('[data-field="person"]').focus();return;}
    saving=true;$('[data-editor-fields]').disabled=true;for(const b of root.querySelectorAll('[data-save],[data-back],[data-new],[data-logout]'))b.disabled=true;completeEnabled();error();notice('Saving…');
    try{const data=await api('POST',{...selected,completed:complete===undefined?selected.completed:complete});selected=data.conversation;records=[selected,...records.filter(c=>c.id!==selected.id)];dirty=false;notice('Saved to AI Boss Mobility');$('[data-person-heading]').textContent=selected.person;$('[data-complete]').textContent=selected.completed?'Reopen conversation':'Save & complete reflection';$('[data-completed]').hidden=!selected.completed;}
    catch(e){error(e.message);notice('Not saved — your notes are still here');}
    finally{saving=false;$('[data-editor-fields]').disabled=false;for(const b of root.querySelectorAll('[data-save],[data-back],[data-new],[data-logout]'))b.disabled=false;completeEnabled();}
  }
  for(const select of root.querySelectorAll('[data-field="kind"]'))for(const k of kinds){const option=document.createElement('option');option.textContent=k;select.append(option);}
  for(const t of topics){const option=document.createElement('option');option.value=t.id;option.textContent=t.name;$('[data-field="topic"]').append(option);}
  for(const kind of ['Entrepreneur','Church leader','Nonprofit leader','Partner','Explorer']){const b=document.createElement('button');b.type='button';b.className='ab-outline';b.textContent='+ '+kind;b.addEventListener('click',()=>create(kind));$('[data-starts]').append(b);}
  $('[data-login]').addEventListener('submit',load);
  $('[data-new]').addEventListener('click',()=>create());
  $('[data-save]').addEventListener('click',()=>save());
  $('[data-complete]').addEventListener('click',()=>save(!selected.completed));
  $('[data-back]').addEventListener('click',()=>{if(!leave())return;selected=null;dirty=false;error();renderList();});
  $('[data-logout]').addEventListener('click',()=>{if(!leave())return;token='';records=[];selected=null;dirty=false;$('[data-work]').hidden=true;$('[data-login]').hidden=false;for(const field of root.querySelectorAll('[data-editor] input,[data-editor] textarea'))field.value='';$('[data-cards]').replaceChildren();error();});
  $('[data-copy-invitation]').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('[data-invitation]').textContent);$('[data-copy-status]').textContent='Copied for your review. Nothing has been sent.';}catch{$('[data-copy-status]').textContent='Select and copy the invitation above. Nothing has been sent.';}});
  $('[data-search]').addEventListener('input',renderList);
  for(const b of root.querySelectorAll('[data-view]'))b.addEventListener('click',()=>{view=b.dataset.view;renderList();});
  for(const b of root.querySelectorAll('[data-mode]'))b.addEventListener('click',()=>switchTab(b.dataset.mode));
  $('[data-capture]').addEventListener('click',()=>switchTab('Reflect'));
  $('[data-suggestions]').addEventListener('click',()=>{const topic=topics.find(t=>t.id===selected.topic);selected.questions=[...topic.questions];selected.prompt=topic.prompt;dirty=true;renderEditor();});
  $('[data-editor-fields]').addEventListener('input',e=>{
    const el=e.target;if(el.dataset.field){selected[el.dataset.field]=el.value;if(el.dataset.field==='topic')updateTopic();}
    else if(el.dataset.array)selected[el.dataset.array][Number(el.dataset.index)]=el.value;
    else return;dirty=true;notice('Unsaved changes');completeEnabled();
  });
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
})();
