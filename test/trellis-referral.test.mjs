import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const trellis = html.match(/<section class="compact-section" id="trellis"[\s\S]*?<\/section>/)?.[0];
test('Trellis uses both specifically approved manual referral destinations', () => {
  assert.ok(trellis);
  assert.match(trellis, /https:\/\/trellis\.hortus\.ai\/marketplace/);
  assert.match(trellis, /https:\/\/trellis\.hortus\.ai\/sign-up\?ref=HdygwSij/);
  assert.match(trellis, /Referral disclosure:/);
  assert.match(trellis, /manual only/);
  assert.match(trellis, /AI Digital Twin does not promote or automate Trellis referrals/);
  assert.doesNotMatch(trellis, /link is pending confirmation/);
});
