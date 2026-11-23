import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
const html=readFileSync(new URL('../public/explore.html',import.meta.url),'utf8');
test('approved scope precedes deposit and signed agreement precedes authorized work',()=>{
 assert.match(html,/review and approve the scope first/i);
 assert.match(html,/initial 50% deposit request follows/i);
 assert.match(html,/after independent verification you sign the matching agreement/i);
 assert.match(html,/Work is prohibited until both records match/i);
 assert.match(html,/independent QA, customer preview and verified acceptance/i);
 assert.match(html,/No payment is requested when submitting this form/i);
});
