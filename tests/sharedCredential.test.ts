import assert from 'node:assert/strict';
import test from 'node:test';
import { parseNebiusCredential } from '../server/sharedCredential.ts';
test('literal credential parsing ignores unrelated entries and never evaluates expressions', () => {
  const fake = 'fake-fixture-value-only';
  for (const line of [`NEBIUS_API_KEY=${fake}`, `export NEBIUS_API_KEY="${fake}"`, `NEBIUS_API_KEY='${fake}'`])
    assert.equal(parseNebiusCredential('UNRELATED=$(no-command)\n' + line), fake);
  for (const text of ['', 'NEBIUS_API_KEY=', 'NEBIUS_API_KEY=$(command)', `NEBIUS_API_KEY=${fake}\nNEBIUS_API_KEY=${fake}`, 'NEBIUS_API_KEY="unterminated'])
    assert.throws(() => parseNebiusCredential(text), /CREDENTIAL_/u);
});
