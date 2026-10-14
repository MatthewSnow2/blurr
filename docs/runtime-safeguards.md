# Prepared transport safeguards; no sponsor execution

The injectable HTTP exchange is implemented, but there is no default client,
environment/key lookup, live CLI, browser import, or network service. Account setup
reported by Matthew does not authorize inference or establish credits/key access.
All current executions use in-memory `Response` fixtures and fake test headers.

The exchange checks the exact documented HTTPS endpoint before touching its
injected credential function. It denies redirects, caps input at 64 KiB, cancels
at 20 seconds, and counts streamed response bytes before UTF-8 decoding or JSON
parsing (128 KiB maximum). Error text is local fixed codes, not remote body or
arbitrary exception text. HTTP metadata records status, byte count, request ID
when safe, duration, outcome and an explicitly false sponsor-verification flag.
The existing adapter still validates selected model, completed JSON report,
evidence and bounded token usage. No synthetic HTTP object proves sponsor usage.

FileAttemptJournal reserves an endpoint+request-body digest with exclusive file
creation **before** sending. It retains a completed or uncertain record and blocks
the identical request across restarts, failures, timeouts and process crashes.
It contains no key or raw prompt. Completion uses atomic replacement. Different
payloads have different keys; the journal is not an account-wide budget lock and
does not authorize a new paid attempt. Do not delete/reset records to bypass a
blocked duplicate. Any charged-delivery uncertainty needs owner reconciliation.

Run the whole synthetic HTTP path using installed Node24:

```sh
npm run test:nebius
npm run demo:transport-offline -- /path/to/synthetic-session.json /path/to/fresh-journal
```

The demo uses a local fake credential and fake response, imports and minimizes a
real retained synthetic session, validates the fixture report and writes an
attempt journal. Repeating it with the same directory is expected to fail before
the injected client runs. Keep that journal as evidence. A new directory is only
for a new offline fixture exercise, never a mechanism for another paid request.

Future live use remains gated on exact account/credit/endpoint/model/payload/spend
authorization. Bind a server-only native HTTP client and an already authorized
secret source only after that decision; neither is configured here. Stop on
timeout/invalid output, never silently retry or change model. Observe and save a
genuine receipt separately; these code/tests cannot grant sponsor eligibility.
