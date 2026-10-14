import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export type AttemptOutcome = 'response_received' | 'http_error' | 'delivery_unknown';
export interface AttemptRecord {
  schemaVersion: 'blurr.inference-attempt.v1';
  requestKey: string;
  state: 'reserved' | AttemptOutcome;
  startedAtUtc: string;
  completedAtUtc?: string;
  httpStatus?: number;
  responseBytes?: number;
}
export interface AttemptStore {
  reserve(requestKey: string): void;
  finish(requestKey: string, outcome: AttemptOutcome, details?: { httpStatus?: number; responseBytes?: number }): void;
}

/** Exclusive create blocks duplicates across processes/restarts, including crashes. */
export class FileAttemptJournal implements AttemptStore {
  private readonly directory: string;
  constructor(directory: string) { this.directory = directory; }
  private path(key: string): string {
    if (!/^[a-f0-9]{64}$/u.test(key)) throw new Error('ATTEMPT_KEY_INVALID');
    return join(this.directory, `${key}.json`);
  }
  reserve(requestKey: string): void {
    const path = this.path(requestKey);
    mkdirSync(this.directory, { recursive: true });
    const record: AttemptRecord = { schemaVersion: 'blurr.inference-attempt.v1', requestKey,
      state: 'reserved', startedAtUtc: new Date().toISOString() };
    try { writeFileSync(path, JSON.stringify(record, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new Error('DUPLICATE_ATTEMPT_BLOCKED');
      throw new Error('ATTEMPT_RESERVATION_FAILED');
    }
  }
  finish(requestKey: string, outcome: AttemptOutcome, details: { httpStatus?: number; responseBytes?: number } = {}): void {
    const path = this.path(requestKey);
    try {
      const prior = JSON.parse(readFileSync(path, 'utf8')) as AttemptRecord;
      if (prior.requestKey !== requestKey || prior.state !== 'reserved') throw new Error('invalid reservation');
      const record: AttemptRecord = { ...prior, state: outcome, completedAtUtc: new Date().toISOString(), ...details };
      const temporary = `${path}.${randomUUID()}.tmp`;
      writeFileSync(temporary, JSON.stringify(record, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
      renameSync(temporary, path);
    } catch { throw new Error('ATTEMPT_RECORD_UPDATE_FAILED'); }
  }
}
