"use strict";
// Common public-page JSON-LD, without removing existing page schema or offers.
const SITE="https://ai.bossmobilelifecoach.com";
const ORG=SITE+"/#organization", WEB=SITE+"/#website", PERSON=SITE+"/meet-brian#brian";
const HIDDEN=new Set(["/404","/ai-boss-os","/project-delivery","/media-consents-admin","/purchase-support-admin","/ai-human-preview","/trellis-trial","/start"]);
const COLLECTIONS=new Set(["/consulting-services","/digital-courses","/monthly-website-support","/site-directory"]);
function attr(tag,name){
  const m=new RegExp("(?:^|\\s)"+name+"\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)')","i").exec(tag);
  return m?(m[1]===undefined?m[2]:m[1]):"";
}
function tagWith(html,tagName,attrName,value){
  return (html.match(new RegExp("<"+tagName+"\\b[^>]*>","gi"))||[])
    .find(tag=>attr(tag,attrName).toLowerCase()===value)||"";
}
function decode(value){
  const e={amp:"&",quot:'"',apos:"'",lt:"<",gt:">",nbsp:" ","#39":"'"};
  return String(value).replace(/&(?:amp|quot|apos|lt|gt|nbsp|#39);/gi,
    s=>e[s.slice(1,-1).toLowerCase()]||s).trim();
}
function addStructuredData(html,requestPath){
  if(typeof html!=="string"||!/<\/head\s*>/i.test(html))return html;
  if(html.includes('data-source="ai-boss-sitewide"'))return html;
  let route;
  try{route=new URL(requestPath||"/",SITE).pathname;}catch{return html;}
  if(route.endsWith(".html"))route=route.slice(0,-5);
  if(route==="/index")route="/";
  if(HIDDEN.has(route))return html;
  const robots=(html.match(/<meta\b[^>]*>/gi)||[])
    .filter(tag=>/^(robots|googlebot)$/.test(attr(tag,"name").toLowerCase()))
    .map(tag=>attr(tag,"content").toLowerCase()).join(",");
  if(/(^|[,;\s])noindex([,;\s]|$)/i.test(robots))return html;
  let canonical;
  try{
    const url=new URL(attr(tagWith(html,"link","rel","canonical"),"href")||route,SITE);
    if(url.origin!==SITE)return html;
    canonical=url.origin+url.pathname;
  }catch{return html;}
  const m=/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if(!m)return html;
  const name=decode(m[1].replace(/<[^>]*>/g," "));
  if(!name)return html;
  const description=decode(attr(tagWith(html,"meta","name","description"),"content"));
  const page={"@type":route==="/meet-brian"?"AboutPage":COLLECTIONS.has(route)?"CollectionPage":"WebPage",
    "@id":canonical+"#webpage",url:canonical,name,inLanguage:"en-US",
    isPartOf:{"@id":WEB},publisher:{"@id":ORG}};
  if(description)page.description=description;
  if(route==="/meet-brian")page.mainEntity={"@id":PERSON};
  const graph=[page];
  if(route==="/")graph.unshift(
    {"@type":"ProfessionalService","@id":ORG,name:"AI Boss Mobility Consulting",url:SITE+"/",
      description:"Human-centered AI strategy, practical consulting, automation and education for entrepreneurs and community organizations.",
      logo:SITE+"/images/ai-boss-journey-logo.webp",founder:{"@id":PERSON},
      sameAs:["https://www.linkedin.com/in/brian-hill-bossmobility/"]},
    {"@type":"WebSite","@id":WEB,name:"AI Boss Mobility Consulting",url:SITE+"/",
      inLanguage:"en-US",publisher:{"@id":ORG}});
  const json=JSON.stringify({"@context":"https://schema.org","@graph":graph}).replace(/</g,"\\u003c");
  return html.replace(/<\/head\s*>/i,
    '<script type="application/ld+json" data-source="ai-boss-sitewide">'+json+'</script></head>');
}
module.exports={addStructuredData};
