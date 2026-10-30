const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const LOCATION = "qJ83IIaK5y2ZPHzLfGG1";
const issues = new Set(["payment", "booking", "delivery", "wrong_email", "refund", "other"]);
function installPurchaseSupport({ readBody, json, isAdmin }) {
  const rates = new Map();
  const file = () => {
    const dir = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, "data");
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, "purchase-support.ndjson");
  };
  const records = () => {
    if (!fs.existsSync(file())) return [];
    return fs.readFileSync(file(), "utf8").split("\n").filter(Boolean).map(line => JSON.parse(line));
  };
  const append = record => fs.appendFileSync(file(), JSON.stringify(record) + "\n", { mode: 0o600 });
  return async function handle(req, res, route) {
    if (route === "/api/purchase-support" && req.method === "POST") {
      try {
        if (req.headers.origin && req.headers.origin !== "https://ai.bossmobilelifecoach.com")
          return json(res, 403, { ok: false, error: "Please submit from the AI Boss Mobility website." });
        const ip = String(req.socket.remoteAddress || "");
        const now = Date.now(), rate = rates.get(ip);
        if (rate && now - rate.at < 3600000 && rate.count >= 10)
          return json(res, 429, { ok: false, error: "Please try later or email brian@bossmobility.net." });
        if (!rate || now - rate.at >= 3600000) rates.set(ip, { at: now, count: 1 });
        else rate.count++;
        if (rates.size > 10000) rates.clear();
        const body = JSON.parse(await readBody(req) || "{}");
        const name = String(body.name || "").trim().slice(0, 160);
        const email = String(body.email || "").trim().toLowerCase();
        const issue = String(body.issue || "");
        const service = String(body.service || "").trim().slice(0, 160);
        const details = String(body.details || "").trim().slice(0, 1000);
        if (!name || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !issues.has(issue))
          return json(res, 400, { ok: false, error: "Enter your name, checkout email, and issue." });
        const recent = records().find(r => r.email === email && now - Date.parse(r.created_at) < 900000);
        if (!recent) append({
          id: crypto.randomUUID(), business: "ai_boss_mobility", location_id: LOCATION,
          name, email, issue, service, details, status: "review", created_at: new Date().toISOString()
        });
        return json(res, 200, { ok: true, message: "Your request is saved for Brian's review. Keep your receipt and do not pay again. No refund, email change, or service delivery has been approved automatically." });
      } catch {
        return json(res, 503, { ok: false, error: "We could not safely save your request. Email brian@bossmobility.net with your receipt number. Do not pay again." });
      }
    }
    if (route === "/api/purchase-support" && req.method === "GET") {
      if (!isAdmin(req)) return json(res, 401, { ok: false, error: "Unauthorized" });
      try { return json(res, 200, { ok: true, business: "ai_boss_mobility", location_id: LOCATION, requests: records().reverse() }); }
      catch { return json(res, 503, { ok: false, error: "Unable to load support requests." }); }
    }
    return false;
  };
}
module.exports = { installPurchaseSupport, LOCATION };
