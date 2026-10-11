import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../public/", import.meta.url));
const asset = "/images/brian-keith-hill-heygen-original.webp";
const pathToAsset = join(root, asset.slice(1));
const expectedSha256 = "3df5adde1180d8461582aa48cbbdb038f530ff0456695fb9a5b8a887cd9e12b4";

test("The website preserves the exact approved HeyGen portrait", () => {
  const digest = createHash("sha256").update(readFileSync(pathToAsset)).digest("hex");
  assert.equal(digest, expectedSha256, "Do not replace the approved portrait with a lookalike");
});

test("Every shared page banner references the exact approved portrait", () => {
  const css = readFileSync(join(root, "styles.css"), "utf8");
  const approvedRule = css.slice(css.indexOf("/* Exact approved HeyGen portrait"));
  assert.ok(approvedRule.includes(asset));
  assert.ok(approvedRule.includes(".site-hero::before"));
  assert.ok(approvedRule.includes("@media(max-width:600px)"));
  for (const name of [
    "ai-consulting-east-bay", "ask-brian", "consent", "glossary",
    "human-centered-ai-strategy", "journey", "meet-brian",
    "privacy", "site-directory"
  ]) {
    const html = readFileSync(join(root, name + ".html"), "utf8");
    assert.match(html, /class="site-hero"/, `Shared portrait banner missing from ${name}`);
  }
});

test("Homepage welcome video poster uses original HeyGen image and video stays intact", () => {
  const html = readFileSync(join(root, "index.html"), "utf8");
  assert.ok(html.includes(`poster="${asset}"`));
  assert.ok(html.includes('src="/videos/ai-boss-mobility-welcome.mp4"'));
});
