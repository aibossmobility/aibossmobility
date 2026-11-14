"use strict";
(() => {
  const byId = id => document.getElementById(id);
  const offerSelect = byId("offer");
  const form = byId("estimate-form");
  const status = byId("status");
  const submit = byId("submit");
  const money = cents => new Intl.NumberFormat("en-US", {style:"currency",currency:"USD"}).format(cents / 100);
  const fields = ["goal","deliverables","timeline","tools","constraints","acceptance"];
  let offers = new Map();
  let selected = null;
  function showOffer() {
    selected = offers.get(offerSelect.value) || null;
    const panel = byId("price-panel");
    panel.hidden = !selected;
    if (!selected) return;
    const deposit = Math.ceil(selected.priceCents / 2);
    const balance = selected.priceCents - deposit;
    byId("offer-name").textContent = selected.title;
    byId("total-price").textContent = money(selected.priceCents);
    byId("deposit-price").textContent = money(deposit);
    byId("balance-price").textContent = money(balance);
    byId("offer-note").textContent = selected.deliveryReady
      ? "Indicative catalog price for the defined scope. The signed estimate will confirm deliverables, costs, and timing."
      : "Pre-launch course: enrollment and files are not yet verified as available. No payment will be requested until content and access are confirmed and the agreement is signed.";
    const title = selected.kind === "course" ? "course" : "project";
    byId("deliverables").placeholder = title === "course"
      ? "Describe the course format (PDF, audio, or complete) and accessible material you expect."
      : "List the pages, reports, integrations, training materials, or other measurable deliverables.";
  }
  async function load() {
    try {
      const r = await fetch("/estimate-offers.json", {cache:"no-store"});
      if (!r.ok) throw Error("Catalog unavailable.");
      const payload = await r.json();
      if (!Array.isArray(payload.offers) || payload.offers.length < 22) throw Error("Catalog incomplete.");
      const projects = document.createElement("optgroup");
      projects.label = "Consulting projects (01–12)";
      const courses = document.createElement("optgroup");
      courses.label = "Digital courses & academy (pre-launch)";
      for (const offer of payload.offers) {
        offers.set(offer.id, offer);
        const option = document.createElement("option");
        option.value = offer.id;
        option.textContent = offer.title + " · " + money(offer.priceCents);
        (offer.kind === "project" ? projects : courses).appendChild(option);
      }
      offerSelect.append(projects, courses);
      const params = new URLSearchParams(location.search);
      let wanted = params.get("offer");
      const legacy = {
        "ai.feasibility.readiness":"service-08",
        "ai.strategy.planning":"service-09",
        "ai.workflow.automation":"service-10",
        "ai.cost.benefit.roi":"service-11",
        "ai.leadership.education":"service-12"
      };
      if (legacy[wanted]) wanted=legacy[wanted];
      if (offers.has(wanted)) offerSelect.value = wanted;
      offerSelect.disabled = false;
      submit.disabled = false;
      showOffer();
    } catch (error) {
      offerSelect.disabled = true;
      submit.disabled = true;
      status.hidden = false;
      status.className = "status error";
      status.textContent = "The estimate catalog is temporarily unavailable. Please use Service help instead of sending payment.";
    }
  }
  offerSelect.addEventListener("change", showOffer);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (!selected) { offerSelect.focus(); return; }
    const payload = {
      path: "estimate-checklist",
      offerId: selected.id,
      name: byId("name").value.trim(),
      email: byId("email").value.trim(),
      organization: byId("organization").value.trim(),
      checklist: Object.fromEntries(fields.map(field => [field, byId(field).value.trim()])),
      estimateTermsAccepted: byId("scope-ack").checked && byId("payment-ack").checked && byId("contact-ack").checked
    };
    submit.disabled = true;
    status.hidden = false;
    status.className = "status";
    status.textContent = "Submitting your checklist securely…";
    try {
      const response = await fetch("/api/business-intake", {
        method:"POST", headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok || !result.ok || result.crm_received !== true) throw Error("We could not confirm delivery to the client system.");
      const deposit = Math.ceil(selected.priceCents / 2);
      const balance = selected.priceCents - deposit;
      status.className = "status success";
      status.textContent = "Your estimate checklist was accepted by our client system. No payment was taken. Your listed total is " + money(selected.priceCents) +
        "; the planned first invoice is " + money(deposit) + " only after the written estimate/agreement is signed. The remaining " +
        money(balance) + " is invoiced after agreed completion and acceptance." +
        (selected.deliveryReady ? "" : " This course is pre-launch; no invoice should be issued until its materials and access are ready.");
      submit.textContent = "Estimate checklist submitted";
      form.querySelectorAll("input,textarea,select").forEach(el => {el.disabled=true;});
    } catch {
      status.className = "status error";
      status.textContent = "We could not confirm delivery to the client system. Your request may have been recorded locally; please contact Service help with the selected offer. Do not submit payment or repeat the request until its status is confirmed.";
      submit.disabled = false;
    }
  });
  load();
})();
