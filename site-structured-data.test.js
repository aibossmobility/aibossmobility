"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {addStructuredData}=require("./site-structured-data");

const folder=path.join(__dirname,"public");
const marker='<script type="application/ld+json" data-source="ai-boss-sitewide">';
const hidden=new Set(["404","ai-boss-os","project-delivery","media-consents-admin","purchase-support-admin","ai-human-preview","trellis-trial","start"]);
const expected=["index","meet-brian","consulting-services","explore","journey","glossary",
  "ai-consulting-east-bay","human-centered-ai-strategy","site-directory",
  "digital-courses","monthly-website-support","critical-thinking-practice",
  "responsible-ai","privacy","start-project","ask-brian"];
const verified=new Set();

for(const filename of fs.readdirSync(folder).filter(f=>f.endsWith(".html"))){
  const pageName=filename.slice(0,-5);
  const route=pageName==="index"?"/":"/"+pageName;
  const original=fs.readFileSync(path.join(folder,filename),"utf8");
  const updated=addStructuredData(original,route);
  const noindex=(original.match(/<meta\b[^>]*>/gi)||[])
    .some(tag=>/\bname=["'](?:robots|googlebot)["']/i.test(tag)&&/\bnoindex\b/i.test(tag));
  if(hidden.has(pageName)||noindex||!/<\/head\s*>/i.test(original)||!/<title\b/i.test(original)){
    assert.equal(updated,original,"Must not add SEO markup to restricted or non-indexable page "+filename);
    continue;
  }
  assert(updated.includes(marker),"Public page missing sitewide JSON-LD: "+filename);
  assert.equal(updated.split(marker).length,2,"Only one sitewide block per page: "+filename);
  const payload=updated.split(marker)[1].split("</script>")[0];
  const schema=JSON.parse(payload);
  const graph=schema["@graph"];
  assert.equal(schema["@context"],"https://schema.org");
  assert(graph.some(node=>node["@id"]&&node["@id"].endsWith("#webpage")));
  const page=graph.find(node=>node["@id"]&&node["@id"].endsWith("#webpage"));
  assert.equal(page.publisher["@id"],"https://ai.bossmobilelifecoach.com/#organization");
  assert.equal(page.isPartOf["@id"],"https://ai.bossmobilelifecoach.com/#website");
  assert.equal(addStructuredData(updated,route).split(marker).length,2,
    "Must not duplicate schema on a second transformation: "+filename);
  if(route==="/"){
    assert(graph.some(node=>node["@type"]==="ProfessionalService"));
    assert(graph.some(node=>node["@type"]==="WebSite"));
  }
  if(route==="/meet-brian")assert.equal(page.mainEntity["@id"],
    "https://ai.bossmobilelifecoach.com/meet-brian#brian");
  if(route==="/consulting-services"){
    assert.equal(page["@type"],"CollectionPage");
    assert(updated.includes('"numberOfItems": 12'),"Retain existing 12 service offers");
  }
  verified.add(pageName);
}
for(const page of expected)assert(verified.has(page),"Expected public page missing schema: "+page);
console.log("Verified "+verified.size+" public HTML pages, existing service offers, and private-page exclusions.");
