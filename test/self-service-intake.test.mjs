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
test("five new services are fixed price and route to a private intake, not unverified payment",()=>{
 for(const code of ["ai.feasibility.readiness","ai.strategy.planning","ai.workflow.automation","ai.cost.benefit.roi","ai.leadership.education"])
  assert(services.includes("/start-project?service="+code),code);
 for(const price of ["$350 fixed package","$750 fixed package","$1,250 fixed package","$450 fixed package","$500 fixed package"])
  assert(services.includes(price),price);
 assert.match(services,/Payment checkout is not yet active for these packages/);
 assert.match(page,/Checkout safety/);
 assert.doesNotMatch(page,/fastpaydirect\.com/);
});
