import { sha256Portable } from '../src/lib/sha256.ts';
import type { NebiusChatRequest, NebiusExchange } from './nebiusAdapter.ts';
import type { AttemptStore, AttemptOutcome } from './attemptJournal.ts';

export interface HttpObservation {
  schemaVersion: 'blurr.http-observation.v1';
  requestKey: string;
  httpStatus: number | null;
  responseBytes: number;
  requestId: string | null;
  durationMs: number;
  outcome: AttemptOutcome;
  sponsorRuntimeVerified: false;
}
export interface BoundedExchangeOptions {
  // Required injection: importing/constructing this module never creates a client
  // or reads credentials. Tests inject in-memory Response objects only.
  fetcher: (endpoint: string, init: RequestInit) => Promise<Response>;
  credential: () => string;
  attempts: AttemptStore;
  timeoutMs?: number;
  maxResponseBytes?: number;
}

const abortable = <T>(operation: Promise<T>, signal: AbortSignal): Promise<T> => new Promise((resolve, reject) => {
  const abort = () => reject(new Error('PROVIDER_TIMEOUT'));
  if (signal.aborted) { abort(); return; }
  signal.addEventListener('abort', abort, { once: true });
  operation.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
});
const checkedEndpoint = (value: string): string => {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !['api.tokenfactory.nebius.com', 'api.tokenfactory.us-central1.nebius.com'].includes(url.hostname) ||
      url.pathname !== '/v1/chat/completions' || url.port || url.username || url.password || url.search || url.hash) {
    throw new Error('NEBIUS_ENDPOINT_NOT_ALLOWED');
  }
  return url.href;
};

export const createBoundedNebiusExchange = (options: BoundedExchangeOptions): {
  exchange: NebiusExchange; observation: () => HttpObservation | null;
} => {
  const timeoutMs = options.timeoutMs ?? 20_000;
  const maximum = options.maxResponseBytes ?? 128 * 1024;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000 ||
      !Number.isInteger(maximum) || maximum < 1 || maximum > 128 * 1024) throw new Error('TRANSPORT_BOUND_INVALID');
  let last: HttpObservation | null = null;
  return {
    observation: () => last ? { ...last } : null,
    async exchange(rawEndpoint: string, body: NebiusChatRequest): Promise<unknown> {
      const endpoint = checkedEndpoint(rawEndpoint);
      const encoded = JSON.stringify(body);
      if (new TextEncoder().encode(encoded).length > 64 * 1024) throw new Error('PROVIDER_REQUEST_TOO_LARGE');
      // The selected model/report contract is validated by prepareNebiusAdapter.
      const requestKey = sha256Portable(new TextEncoder().encode(endpoint + '\n' + encoded));
      let key: string;
      try { key = options.credential(); } catch { throw new Error('PROVIDER_CREDENTIAL_UNAVAILABLE'); }
      if (typeof key !== 'string' || !key || /[\r\n]/u.test(key)) throw new Error('PROVIDER_CREDENTIAL_UNAVAILABLE');
      options.attempts.reserve(requestKey); // Never silently reuse/reset a prior attempt.
      last = null;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const started = Date.now();
      let status: number | null = null, bytes = 0, requestId: string | null = null;
      let outcome: AttemptOutcome = 'delivery_unknown';
      let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
      let stream: ReadableStream<Uint8Array> | null = null;
      try {
        const response = await abortable(options.fetcher(endpoint, { method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: encoded, redirect: 'error', signal: controller.signal }), controller.signal);
        status = response.status;
        stream = response.body;
        if (response.redirected || (response.url && response.url !== endpoint)) throw new Error('PROVIDER_REDIRECT_REJECTED');
        const id = response.headers.get('x-request-id');
        requestId = id && /^[A-Za-z0-9._:-]{1,160}$/u.test(id) && !id.includes(key) ? id : null;
        if (!response.ok) { outcome = 'http_error'; throw new Error('PROVIDER_HTTP_ERROR'); }
        if (!/^application\/json(?:;|$)/iu.test(response.headers.get('content-type') ?? '')) throw new Error('PROVIDER_CONTENT_TYPE_INVALID');
        const length = response.headers.get('content-length');
        if (length !== null && (!/^\d+$/u.test(length) || Number(length) > maximum)) throw new Error('PROVIDER_RESPONSE_TOO_LARGE');
        if (!response.body) throw new Error('PROVIDER_RESPONSE_EMPTY');
        reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        while (true) {
          const part = await abortable(reader.read(), controller.signal);
          if (part.done) break;
          bytes += part.value.byteLength;
          if (bytes > maximum) throw new Error('PROVIDER_RESPONSE_TOO_LARGE');
          chunks.push(part.value);
        }
        const buffer = new Uint8Array(bytes);
        let offset = 0;
        for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
        let parsed: unknown;
        try { parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer)); }
        catch { throw new Error('PROVIDER_RESPONSE_NOT_JSON'); }
        outcome = 'response_received';
        return parsed;
      } catch (error) {
        // Never return/log arbitrary transport or provider body text (may include
        // auth material). Known local error codes contain no response/key values.
        const message = error instanceof Error ? error.message : '';
        const allowed = /^PROVIDER_(?:TIMEOUT|REDIRECT_REJECTED|HTTP_ERROR|CONTENT_TYPE_INVALID|RESPONSE_TOO_LARGE|RESPONSE_EMPTY|RESPONSE_NOT_JSON)$/u;
        throw new Error(allowed.test(message) ? message : 'PROVIDER_EXCHANGE_FAILED_DELIVERY_UNKNOWN');
      } finally {
        clearTimeout(timer); controller.abort();
        // Do not await a hostile/stalled stream cancellation after our deadline.
        if (reader) { void reader.cancel().catch(() => {}); }
        else if (stream) { void stream.cancel().catch(() => {}); }
        last = { schemaVersion: 'blurr.http-observation.v1', requestKey, httpStatus: status,
          responseBytes: bytes, requestId, durationMs: Date.now() - started, outcome, sponsorRuntimeVerified: false };
        options.attempts.finish(requestKey, outcome, { ...(status === null ? {} : { httpStatus: status }), responseBytes: bytes });
      }
    },
  };
};
