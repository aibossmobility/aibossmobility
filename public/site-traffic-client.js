(function(){
  "use strict";
  if(!navigator.sendBeacon||window.location.hostname!=="ai.bossmobilelifecoach.com")return;
  var path=window.location.pathname.replace(/\/+$/,"")||"/";
  function send(kind,target){
    try{
      var b={kind:kind,page:path};
      if(kind==="page_view"){
        b.referrer=document.referrer?new URL(document.referrer).origin:"";
        b.utmSource=(new URLSearchParams(window.location.search).get("utm_source")||"").slice(0,80);
      }
      if(target)b.target=target;
      navigator.sendBeacon("/api/site-traffic/event",new Blob([JSON.stringify(b)],{type:"application/json"}));
    }catch(_){}
  }
  function targetFor(a){
    var url;try{url=new URL(a.href,location.href);}catch{return null;}
    if(url.protocol==="mailto:")return "email";
    if(url.hostname==="link.fastpaydirect.com")return "checkout";
    if(url.origin!==location.origin)return null;
    if(url.pathname==="/ask-brian")return "ai_twin";
    if(url.pathname==="/consulting-services")return "consulting";
    if(url.pathname==="/start-project")return "project";
    if(url.pathname==="/digital-courses")return "course";
    if(url.hash==="#estimate"||url.pathname==="/explore"&&url.hash==="#estimate")return "estimate";
    return null;
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){send("page_view");},{once:true});
  else send("page_view");
  document.addEventListener("click",function(event){
    var a=event.target&&event.target.closest?event.target.closest("a[href]"):null;
    if(!a){if(event.target&&event.target.closest&&event.target.closest("#hero-start-twin, #start-twin"))send("cta_click","ai_twin");return;}
    var target=targetFor(a);if(target)send("cta_click",target);
  },true);
})();
