import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
test('custom estimate comes before payment and discloses 50/50 schedule',()=>{
 assert.match(html,/review and sign the written estimate and agreement first/);
 assert.match(html,/Once signed, the 50% deposit is due/);
 assert.match(html,/remaining 50% is due when the work is complete/);
 assert.match(html,/final deliverables are released only after the balance is paid/);
 assert.match(html,/No payment is requested when submitting this form/);
});
