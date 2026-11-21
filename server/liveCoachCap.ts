/** Daily cap for hosted live calls: one store key per call slot, claimed once per UTC day. */
export const HARD_DAILY_CAP = 60;

export interface CapStore {
  /** Keys under a prefix. May be stale; it only chooses where to start claiming. */
  list(prefix: string): Promise<string[]>;
  /** Create only if absent. A `true` here is not trusted on its own (see reserveDailySlot). */
  createIfNew(key: string, value: string): Promise<boolean>;
  /** Strongly consistent read. */
  read(key: string): Promise<string | null>;
}

/**
 * Claims one of `cap` slots for `utcDate`. A slot counts only when a strong read-back
 * returns this request's nonce: some SDK versions report a lost race or a failed
 * conditional write as written. Store errors propagate so the caller fails closed.
 */
export const reserveDailySlot = async (store: CapStore, utcDate: string, cap: number, nonce: string): Promise<boolean> => {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(utcDate)) throw new Error('CAP_DATE_INVALID');
  if (!Number.isInteger(cap) || cap < 1 || cap > HARD_DAILY_CAP) throw new Error('CAP_INVALID');
  if (!/^[A-Za-z0-9-]{16,64}$/u.test(nonce)) throw new Error('CAP_NONCE_INVALID');
  const prefix = `${utcDate}/`;
  const taken = new Set((await store.list(prefix)).filter((key) => key.startsWith(prefix)));
  for (let slot = 0; slot < cap; slot++) {
    const key = prefix + String(slot).padStart(2, '0');
    if (taken.has(key)) continue;
    if (!await store.createIfNew(key, nonce)) continue;
    if (await store.read(key) === nonce) return true;
  }
  return false;
};

export const utcDateKey = (now: Date): string => now.toISOString().slice(0, 10);
