import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { sha256, sha256Portable } from '../src/lib/sha256.ts';

test('portable SHA-256 matches independent Node digest across padding boundaries and binary views', () => {
  for (const length of [0, 1, 3, 55, 56, 63, 64, 65, 127, 128, 129, 1212, 65536]) {
    const backing = Uint8Array.from({ length: length + 13 }, (_, i) => (i * 37 + 19) % 256);
    const bytes = backing.subarray(7, 7 + length);
    assert.equal(sha256Portable(bytes), createHash('sha256').update(bytes).digest('hex'));
  }
  const bytes = new TextEncoder().encode('Unicode telemetry: 🏁 Δ');
  assert.equal(sha256Portable(bytes), createHash('sha256').update(bytes).digest('hex'));
});

test('native and LAN fallback hash paths preserve byte identity and detect changes', async () => {
  const bytes = new TextEncoder().encode('sealed replay');
  assert.equal(await sha256(bytes), sha256Portable(bytes));
  const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });
  try {
    assert.equal(await sha256(bytes), createHash('sha256').update(bytes).digest('hex'));
    assert.notEqual(await sha256(bytes), await sha256(new TextEncoder().encode('sealed replay ')));
  } finally {
    if (original) Object.defineProperty(globalThis, 'crypto', original);
    else delete globalThis.crypto;
  }
});
