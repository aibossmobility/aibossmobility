"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const html = fs.readFileSync(require("node:path").join(__dirname, "public/start-project.html"), "utf8");
const source = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)?.[1];
assert.ok(source, "the service request page must contain its controller");
new vm.Script(source, { filename: "start-project.inline.js" });
assert.ok(html.includes('id="name" required'));
assert.ok(html.includes("signed service agreement"));
assert.ok(!html.includes('href="https://links.fastpayments.co/'), "no unapproved public payment shortcut");

async function simulate(crmReady) {
  const inputs = {
    name: "Sample Buyer",
    email: "buyer@example.com",
    org: "Sample Company",
    objective: "Automate a customer follow-up process responsibly",
    workflow: "A team member currently tracks inquiries by hand",
    tools: "Google Workspace",
    limits: "No client data shared without consent"
  };
  class Element {
    constructor(id) {
      this.id = id;
      this.value = inputs[id] || "";
      this.checked = id === "terms";
      this.hidden = id === "track" || id === "delivery";
      this.disabled = false;
      this.children = [];
      this.events = {};
      this.textContent = "";
    }
    addEventListener(kind, fn) { this.events[kind] = fn; }
    dispatchEvent(event) { return this.events[event.type]?.(event); }
    replaceChildren() { this.children = []; }
    appendChild(child) { this.children.push(child); }
  }
  const nodes = new Map();
  const byId = id => {
    if (!nodes.has(id)) nodes.set(id, new Element(id));
    return nodes.get(id);
  };
  const location = { search: "?service=ai.feasibility.readiness", pathname: "/start-project", hash: "" };
  let intake = null, lead = null, leadCallCount = 0;
  const privateStatusToken = "private_test_token_1234567890";
  const intakeId = "11111111-1111-4111-8111-111111111111";
  const fetchMock = async (url, options) => {
    if (url.endsWith("/fixed-services")) return {
      ok: true, json: async () => ({
        ok: true, products: [{ code: "ai.feasibility.readiness", title: "AI Feasibility & Readiness",
          priceCents: 35000, includedSections: ["Readiness summary"] }]
      })
    };
    if (url.endsWith("/intakes")) {
      intake = JSON.parse(options.body);
      return { ok: true, json: async () => ({ ok: true, intakeId, privateStatusToken, priceCents: 35000 }) };
    }
    if (url === "/api/business-intake") {
      leadCallCount++;
      lead = JSON.parse(options.body);
      return { ok: crmReady, json: async () => ({ ok: crmReady, crm_received: crmReady }) };
    }
    if (String(url).includes("/intakes/") && String(url).includes("/status?token=")) {
      return { ok: true, json: async () => ({ ok: true, state: "awaiting_payment", deliveryReady: false }) };
    }
    throw Error("Unexpected fetch " + url);
  };
  const context = vm.createContext({
    document: {
      getElementById: byId,
      createElement: tag => new Element(tag),
      createTextNode: text => ({ textContent: text })
    },
    Event: class { constructor(type) { this.type = type; } },
    fetch: fetchMock,
    history: { replaceState: (_a, _b, value) => { location.hash = value.slice(value.indexOf("#")); } },
    location,
    URLSearchParams, Intl, console
  });
  vm.runInContext(source, context);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(byId("service").value, "ai.feasibility.readiness");
  await byId("intake").events.submit({ preventDefault() {} });
  assert.equal(intake.productCode, "ai.feasibility.readiness");
  assert.equal(leadCallCount, 1);
  assert.equal(lead.name, "Sample Buyer");
  assert.equal(lead.email, "buyer@example.com");
  assert.equal(lead.organization, "Sample Company");
  assert.ok(lead.need.includes("AI Feasibility & Readiness"));
  assert.ok(lead.need.includes(intakeId));
  assert.ok(!JSON.stringify(lead).includes(privateStatusToken), "private status token must remain private");
  assert.ok(location.hash.includes(privateStatusToken), "buyer retains private status link");
  assert.equal(byId("send")?.disabled, false);
  assert.equal(byId("result").className, "success");
  const copy = byId("result").children.map(x => x.textContent).join(" ");
  assert.ok(copy.includes("No charge occurred."));
  if (crmReady) assert.ok(copy.includes("acknowledged by the AI Boss Mobility client system"));
  else {
    assert.ok(copy.includes("automatic delivery to the client follow-up system could not be confirmed"));
    assert.ok(copy.includes("Do not pay or submit again"));
  }
}
(async () => {
  await simulate(true);
  await simulate(false);
  console.log("PASS: five-service intake form creates CRM follow-up without leaking buyer status token; graceful failure path verified.");
})().catch(error => { console.error(error); process.exitCode = 1; });
