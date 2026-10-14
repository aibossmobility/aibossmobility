import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const script = html.match(/<script>\s*(document\.getElementById\('estimate-form'\)[\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'The estimate submission script must exist');

async function simulateSubmission(response) {
  const button = { disabled: false };
  const status = { textContent: '' };
  let resetCount = 0;
  let submitHandler;
  let request;
  const form = {
    querySelector: () => button,
    reset: () => { resetCount += 1; },
    addEventListener: (_event, handler) => { submitHandler = handler; },
  };
  const document = { getElementById: (id) => id === 'estimate-form' ? form : status };
  class FakeFormData {
    entries() { return Object.entries({ name: 'Test Customer', email: 'test@example.invalid', organization: 'Test Org', service: 'Custom consulting — $750', details: 'Workflow consultation' }); }
  }
  const fetch = async (url, options) => {
    request = { url, ...options };
    return { ok: response.httpOk, json: async () => response.body };
  };
  vm.runInNewContext(script, { document, FormData: FakeFormData, fetch, console }, { timeout: 1000 });
  await submitHandler({ preventDefault() {}, currentTarget: form });
  return { status: status.textContent, resetCount, button, request };
}

test('acknowledged GoHighLevel delivery shows confirmation and resets form', async () => {
  const result = await simulateSubmission({ httpOk: true, body: { ok: true, crm_received: true } });
  assert.equal(result.request.url, '/api/business-intake');
  assert.match(result.request.body, /written_estimate_request/);
  assert.match(result.status, /received for review/);
  assert.equal(result.resetCount, 1);
  assert.equal(result.button.disabled, false);
});

test('failed CRM delivery does not claim estimate received', async () => {
  const result = await simulateSubmission({ httpOk: false, body: { ok: false, error: 'CRM not confirmed' } });
  assert.match(result.status, /delivery could not be confirmed/);
  assert.equal(result.resetCount, 0);
  assert.equal(result.button.disabled, false);
});

test('HTTP 200 without explicit CRM acknowledgement is not accepted', async () => {
  const result = await simulateSubmission({ httpOk: true, body: { ok: true } });
  assert.match(result.status, /delivery could not be confirmed/);
  assert.equal(result.resetCount, 0);
});
