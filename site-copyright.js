"use strict";
const COPYRIGHT="© 2026 Brian Keith Hill. All rights reserved.";
const CURRICULUM_PAGES=new Set(["/digital-courses","/critical-thinking-practice"]);
const OWNED_CURRICULUM='<section aria-label="Curriculum Use and Licensing" style="max-width:1050px;margin:0 auto 1.5rem;padding:1rem 1.25rem;border-top:1px solid #bdbdbd;color:#333;font:14px/1.55 system-ui,-apple-system,sans-serif">'+
'<h2 style="font-size:17px;margin:.2rem 0 .6rem">Curriculum Use and Licensing</h2>'+
'<p>The original written lessons, instructional materials, worksheets, and educational content created and owned by Brian Keith Hill are protected by copyright.</p>'+
'<p>Reproduction, redistribution, publication, or use of these materials to teach courses requires prior written permission, except as permitted by law.</p>'+
'<p>For educational partnerships, institutional licensing, or permission to use these materials, contact <a href="mailto:brian@bossmobility.net">brian@bossmobility.net</a>.</p></section>';
function addCopyright(html,route){
  if(typeof html!=="string"||!/<\/body>/i.test(html))return html;
  if(!html.includes('data-source="ai-boss-sitewide"'))return html;
  if(html.includes('data-site-copyright="brian-2026"'))return html;
  let pathname;
  try{pathname=new URL(route||"/","https://ai.bossmobilelifecoach.com").pathname.replace(/\.html$/,"")||"/";}
  catch{return html;}
  if(pathname==="/index")pathname="/";
  const notice='<div data-site-copyright="brian-2026" aria-label="Copyright notice" style="background:#111;color:#fff;text-align:center;padding:16px 12px;font:14px/1.5 system-ui,-apple-system,sans-serif">'+COPYRIGHT+'</div>';
  const extra=CURRICULUM_PAGES.has(pathname)?OWNED_CURRICULUM:"";
  return html.replace(/<\/body>/i,extra+notice+"</body>");
}
module.exports={addCopyright,COPYRIGHT};
