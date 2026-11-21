import assert from 'node:assert/strict';
import test from 'node:test';
import { HARD_DAILY_CAP, reserveDailySlot, utcDateKey, type CapStore } from '../server/liveCoachCap.ts';

/** Atomic in-memory store; options inject the SDK and network failure modes the cap must survive. */
const memoryStore = (options: {
  staleList?: boolean; reportLostRaceAsWritten?: boolean; dropWrites?: boolean;
  failList?: boolean; failWrite?: boolean; failRead?: boolean;
} = {}) => {
  const data = new Map<string, string>();
  let writes = 0;
  const store: CapStore = {
    async list(prefix) {
      if (options.failList) throw new Error('list down');
      return options.staleList ? [] : [...data.keys()].filter((key) => key.startsWith(prefix));
    },
    async createIfNew(key, value) {
      if (options.failWrite) throw new Error('write down');
      writes++;
      await new Promise((resolve) => setImmediate(resolve));
      if (options.dropWrites) return true; // SDK reported success for a write that never landed
      if (data.has(key)) return options.reportLostRaceAsWritten === true; // 409 mapped to modified:true
      data.set(key, value);
      return true;
    },
    async read(key) {
      if (options.failRead) throw new Error('read down');
      return data.get(key) ?? null;
    },
  };
  return { store, data, writes: () => writes };
};
const nonce = (i: number) => `nonce-${String(i).padStart(12, '0')}`;

test('concurrent claims never exceed the cap, even when lost races are reported as written', async () => {
  for (const reportLostRaceAsWritten of [false, true]) {
    const { store, data } = memoryStore({ staleList: true, reportLostRaceAsWritten });
    const results = await Promise.all(Array.from({ length: 80 }, (_, i) => reserveDailySlot(store, '2026-10-28', HARD_DAILY_CAP, nonce(i))));
    assert.equal(results.filter(Boolean).length, HARD_DAILY_CAP);
    assert.equal(data.size, HARD_DAILY_CAP);
    // Every winner owns exactly one slot holding its own nonce.
    const owners = new Set(data.values());
    results.forEach((won, i) => assert.equal(won, owners.has(nonce(i))));
  }
});

test('a lower cap is honoured and exhaustion returns false without extra slots', async () => {
  const { store, data } = memoryStore();
  for (let i = 0; i < 3; i++) assert.equal(await reserveDailySlot(store, '2026-10-28', 3, nonce(i)), true);
  assert.equal(await reserveDailySlot(store, '2026-10-28', 3, nonce(9)), false);
  assert.deepEqual([...data.keys()].sort(), ['2026-10-28/00', '2026-10-28/01', '2026-10-28/02']);
});

test('a write the SDK reports but the store never kept is not a reservation', async () => {
  const { store, data, writes } = memoryStore({ dropWrites: true });
  assert.equal(await reserveDailySlot(store, '2026-10-28', 5, nonce(1)), false);
  assert.equal(data.size, 0);
  assert.equal(writes(), 5); // tried each bounded slot once, never past the cap
});

test('the next UTC day starts with a fresh set of slots', async () => {
  const { store } = memoryStore();
  assert.equal(await reserveDailySlot(store, '2026-10-28', 1, nonce(1)), true);
  assert.equal(await reserveDailySlot(store, '2026-10-28', 1, nonce(2)), false);
  assert.equal(await reserveDailySlot(store, '2026-10-29', 1, nonce(3)), true);
  assert.equal(utcDateKey(new Date('2026-10-28T23:59:59.999Z')), '2026-10-28');
  assert.equal(utcDateKey(new Date('2026-10-29T00:00:00.000Z')), '2026-10-29');
});

test('store failures propagate so the caller fails closed', async () => {
  for (const failure of ['failList', 'failWrite', 'failRead'] as const) {
    const { store } = memoryStore({ [failure]: true });
    await assert.rejects(reserveDailySlot(store, '2026-10-28', 5, nonce(1)));
  }
});

test('invalid caps, dates and nonces are refused before touching the store', async () => {
  const { store, writes } = memoryStore();
  for (const cap of [0, HARD_DAILY_CAP + 1, 1.5]) await assert.rejects(reserveDailySlot(store, '2026-10-28', cap, nonce(1)), /CAP_INVALID/u);
  await assert.rejects(reserveDailySlot(store, '2026-10-28/../x', 1, nonce(1)), /CAP_DATE_INVALID/u);
  await assert.rejects(reserveDailySlot(store, '2026-10-28', 1, 'short'), /CAP_NONCE_INVALID/u);
  assert.equal(writes(), 0);
});
