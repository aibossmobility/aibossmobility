import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const page=fs.readFileSync(new URL("../public/start-project.html",import.meta.url),"utf8");
const services=fs.readFileSync(new URL("../public/consulting-services.html",import.meta.url),"utf8");
test("fixed-price self-service entrypoint is present with valid client script",()=>{
 assert.match(page,/<title>Choose Your AI Service/);
 assert.match(page,/https:\/\/papalifecoach.com\/api\/public\/ai-boss/);
 assert.match(page,/privateStatusToken/);
 assert.match(page,/acceptedTerms/);
 assert.match(page,/No charge occurred/);
 assert.match(page,/Ask Brian's digital twin/);
 const code=page.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert(code);assert.doesNotThrow(()=>new vm.Script(code));
});
test("services 08–13 route to the safe estimate checklist, not unverified payment",()=>{
 for(let i=8;i<=13;i++){const id="service-"+String(i).padStart(2,"0");assert(services.includes("/estimate-checklist?offer="+id),id);}
 for(const price of ["$350 fixed package","$750 fixed package","$1,250 fixed package","$450 fixed package","$500 fixed package"])
  assert(services.includes(price),price);
 assert.match(services,/Online full-price checkout is intentionally disabled/);
 assert.match(page,/No charge occurred/);
 assert.doesNotMatch(page,/fastpaydirect\.com/);
});
