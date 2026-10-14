import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
const read = path => readFileSync(new URL('../public/' + path, import.meta.url), 'utf8');
test('service CTA links direct customers to an estimate rather than an appointment', () => {
 for (const name of ['site-directory.html','ai-consulting-east-bay.html','meet-brian.html']) {
  const markup = read(name);
  assert.match(markup, /href="\/#estimate"[^>]*>Request an? (Written )?Estimate/);
  assert.doesNotMatch(markup, /Schedule a Business Conversation|Talk with Brian on Google Meet|Book on Original Site/);
 }
});
test('AI Twin does not send visitors to booking by default', () => {
 const script = read('gemini-voice.js');
 assert.match(script, /written estimate form/);
 assert.doesNotMatch(script, /suggest the site's Google booking link/);
});
