(function(){
  const root=document.getElementById('conversation-together');if(!root)return;
  const choices=root.querySelector('[data-topic-choices]'),question=root.querySelector('[data-topic-question]'),link=root.querySelector('[data-topic-link]');
  function choose(topic){
    for(const button of choices.querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.topic===topic.id));
    question.textContent=topic.prompt;link.href=topic.path;link.textContent='Explore: '+topic.name+' →';
  }
  for(const topic of window.AIBossConversationTopics){const button=document.createElement('button');button.type='button';button.textContent=topic.name;button.dataset.topic=topic.id;button.addEventListener('click',()=>choose(topic));choices.append(button);}
  choose(window.AIBossConversationTopics[0]);
})();
