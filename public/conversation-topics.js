(function () {
  const topics = [
    {id:'clarity',name:'Find a clear starting point',path:'/explore#how-brian-helps',prompt:'What would make this conversation useful for you today?',questions:['What are you trying to accomplish?','Where are you feeling stuck?','What would a useful first step look like?']},
    {id:'strategy',name:'Plan a practical use for AI',path:'/consulting-services#service-9',prompt:'Which real need should the technology serve?',questions:['What outcome matters most to your organization?','How do you handle this today?','What would you need to know before trying AI?']},
    {id:'workflow',name:'Simplify repetitive work',path:'/consulting-services#service-10',prompt:'What burden could be reduced so you have more time for people?',questions:['Which repeated task takes the most time?','Where does your current process get held up?','What should stay under human review?']},
    {id:'website',name:'Help people understand your offer',path:'/consulting-services#building-studio',prompt:'What should someone understand or be able to do after visiting your website?',questions:['Who are you trying to reach?','What do you want them to understand?','What next step should they be able to choose?']},
    {id:'learning',name:'Learn with your team',path:'/consulting-services#learning-studio',prompt:'What would help your people use AI with confidence and good judgment?',questions:['What does your team want to learn?','What concerns would you like to work through?','What practical example would make learning useful?']},
    {id:'results',name:'Explore possible outcomes',path:'/consulting-services#results-gallery',prompt:'What result would make this work worthwhile to you?',questions:['What would success look like?','What time, budget, or access limits should we respect?','What would help you decide whether to take a next step?']}
  ];
  if (typeof module !== 'undefined' && module.exports) module.exports = topics;
  else window.AIBossConversationTopics = topics;
})();
