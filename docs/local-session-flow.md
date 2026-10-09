# Local sealed-session flow

The current product flow is intentionally local-only:

1. Generate a sealed F1TENTH capture or a telemetry-only AutoDRIVE capture with the authorized simulator adapters.
2. Import the `blurr.telemetry-session.v1` JSON in the browser.
3. The importer bounds bytes and samples, validates source/reference identity, verifies finite measurements and monotonic simulator/reception time, recomputes the F1TENTH lateral-deviation summary, and creates raw-file and canonical SHA-256 digests. AutoDRIVE source coordinates remain explicitly unit-unspecified; speed, reference, braking, and collision metrics remain unavailable.
4. A validated session is stored in browser `localStorage` under its stable canonical session ID. Reimporting identical evidence is idempotent and preserves the first import timestamp.
5. History and replay read only stored validated values. The replay exposes sample sequence, simulator-relative seconds, metric positions, speed, steering, lateral/heading deviation, raceline distance, curvature, units, capabilities, and digests.
6. Optional video is a temporary revocable object URL. It is not persisted, uploaded, or interpreted as telemetry.
7. Nebius remains unavailable without the separate owner account/model/spend/data decision. The offline metrics and replay do not depend on the provider.

The runtime validator in `src/lib/sessionStore.ts` is authoritative at import time. `schemas/telemetry-session.v1.schema.json` documents the interoperable envelope. The schema does not replace semantic checks such as strict ordering, timestep agreement, finite values, or summary recomputation.

## Verification

```powershell
npm ci --no-audit --no-fund
npm test
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev --json
```

The browser should be launched only on a loopback-bound dev server for this local checkpoint.
