# Judge access and reproduction (draft for Matt, not published)

Draft written 27 October 2026. Nothing here has been pushed, deployed or sent.
It uses only existing entry points; the runner is not changed. Labels:
**demonstrated** (run or fetched for this draft, 27 October 2026 about 20:40
to 21:00 UTC), **saved** (earlier evidence), **documented only** (instructions
not executed here), **unverified**.

Three things are kept apart below: free paths a judge can use, live inference
(not free, coverage unresolved), and the rule interpretation (section 6).

## 1. Free path A: replay in the browser (no account, key or cost)

- Hosted test build, pinned: https://6ae0f4e0854374c78f8c6656--strong-strudel-8072a3.netlify.app/
  (Netlify deploy `6ae0f4e0854374c78f8c6656`, `commit_ref` `7491717`).
  **Demonstrated:** HTTP 200 with no login prompt, `x-robots-tag: noindex`.
  It serves `main-Dttd0-9S.js`, and the checked assets are byte-identical to
  the local build that the browser QA covered (Chromium only, saved).
- Moving alias: https://deploy-preview-4--strong-strudel-8072a3.netlify.app/
  points at the latest PR 4 deploy, so a later push changes what it serves.
- Local build: README "Quick start" (`npm ci`, `npm run build`,
  `npm run preview`). Saved: checks green at `1ac7127`; the app code is
  unchanged since `116d943`.
- What it shows: the eight saved Token Factory reports, re-validated in the
  browser. It makes no provider call.

## 2. Free path B: offline request preparation (no key, no network)

From a checkout of `7491717`, with Node 24:

```bash
node --experimental-strip-types server/runApprovedVerification.ts --prepare ./judge-run data/f1tenth-silverstone/baseline-lap-session.json Approval_f1tenth_silverstone_baseline_lap_20261026
```

- Expected stdout: `OFFLINE_PREPARATION_COMPLETE_NO_CREDENTIAL_OR_DISPATCH`.
- Expected file: `./judge-run/request.json`, 5,769 bytes.
- Request contents: model `nvidia/nemotron-3-super-120b-a12b`, temperature 0,
  `max_completion_tokens` 1024, `n` 1, `store` false, JSON response format.
- **Demonstrated:** the output was byte-identical (`cmp`) to the request
  actually sent on 26 October
  (`evidence/f1tenth-sweep-76b3813/nebius-silverstone-baseline/request.json`).
  No credential was read, and the ledger was not written.
- What it proves: a judge can see and hash exactly what Blurr sends to Token
  Factory for a bundled session. It does not prove that a call happens.
- Approval names: each of the 7 bundled sessions has one approval name
  (`server/runApprovedVerification.ts:17-25`). Prepare refuses any other
  session (`SESSION_NOT_APPROVED`).

## 3. Live inference (not free; coverage unresolved; documented only)

Not executed for this draft. No call was made.

### Authorization limits

- The approval constants are historical. They record Matt's per-call approvals
  for his own key on specific dates.
- On a fresh machine the ledger `~/.local/state/blurr/nebius-approvals/` is
  empty, so the code would accept them. That is a property of the code. It is
  not new spending authorization for anyone.
- On ProBook all 7 are consumed. The ledger must not be reset, and no consumed
  approval may be reused.

### Prerequisites for whoever runs it

1. Their own Nebius Token Factory account, with credit or billing that covers
   the call.
   - **Unresolved:** nothing read so far says the organizers give judges
     credit, so a judge pays or uses their own credit.
   - Token Factory has no balance API (saved, `submission-package.md` sec. 11).
2. Exactly one literal line `NEBIUS_API_KEY=<key>` in `~/.env.shared` in the
   runner's home directory. The file is parsed, never executed
   (`server/sharedCredential.ts`).
3. Node 24 and a checkout of `7491717`.
4. A new output directory containing the `request.json` from path B.

### `cost-proof.json`

Write `<outdir>/cost-proof.json` by hand. The runner checks these fields
exactly (`server/runApprovedVerification.ts:74-78`):

| Field | Required value |
|---|---|
| `requestSha256` | sha256 of `request.json` without its trailing newline: `head -c -1 judge-run/request.json \| sha256sum`. Demonstrated for the baseline: `6d1392b9...79f6`, equal to the 26 October proof. |
| `maxCompletionTokens` | `1024` |
| `n` | `1` |
| `inputTokenUpperBound` | `16000` |
| `inputUsdPerMillion` | `0.3` |
| `outputUsdPerMillion` | `0.9` |
| `maximumUsd` | `0.0057216` |
| `officialPricingVerified` | `true` |
| `publishedTemplateByteBoundVerified` | `true` |

- **Not machine-checked:** the two booleans are the runner's own attestations.
  Nothing in the repo fetches prices or renders the chat template, so the
  checks they claim are not reproducible from the repo.
  - On 26 October they were backed by `rendered-prompt.txt` and a price fetch
    outside the repo (saved).
  - If published prices change, the hard-coded 0.3 and 0.9 still pass.
- Matt's 26 October proof also carried informational fields the runner
  ignores: `checkedAtUtc`, `renderedBytes`, `pricingSource`, `boundBasis`,
  `approval`, `sessionSha256`, `ownerCapUsd`, `actualBilledCostUsd`,
  `artifactsSha256`.

### Run

```bash
node --experimental-strip-types server/runApprovedVerification.ts --execute ./judge-run data/f1tenth-silverstone/baseline-lap-session.json Approval_f1tenth_silverstone_baseline_lap_20261026
```

**Expected output (from the code, not observed here)**

- One JSON line: `{"dispatchCount":1,"errorCode":null,"httpStatus":200,"receipt":".../result.json"}`.
- `result.json` is written with mode 600.
- An attempt marker goes in both `./judge-run/` and the ledger.
- `attempt-journal/` is created.

**Refusals and failures** (read from the code, not exercised here)

| Outcome | When |
|---|---|
| Thrown, nothing written: `EXPLICIT_MODE_OUTPUT_SESSION_AND_APPROVAL_REQUIRED`, `APPROVAL_UNKNOWN`, `SESSION_NOT_APPROVED`, `APPROVAL_ALREADY_CONSUMED_DO_NOT_RETRY` | Before any network call. Never retry a consumed approval. |
| `result.json` with `dispatchCount: 0` and `errorCode: PROVIDER_EXCHANGE_FAILED_DELIVERY_UNKNOWN` | A bad `cost-proof.json` or key file. The adapter rewrites `COST_PROOF_INVALID` and `CREDENTIAL_*` into this generic code (`server/nebiusAdapter.ts`, the catch around `exchange`). `dispatchCount: 0` is the reliable sign that nothing was sent. |
| `result.json` with `dispatchCount: 1` and an `errorCode` such as `PROVIDER_TOKEN_BOUND_EXCEEDED` | The call was made and billed, but the response failed a check. For example, output over 1,024 tokens: reasoning counts, and the baseline used 890. |
| `REPORT_CLAIMS_UNSUPPORTED` | At import, if the model cites evidence the session does not hold |

**Use a new output directory after any refusal.** `result.json` is written
with an exclusive-create flag. In a reused directory, a later successful call
would be made and billed, and then fail to write its receipt.

### Cost

- Reservation ceiling per call: USD 0.0057216.
- The 26 October baseline call used 1,362 input and 890 output tokens, which is
  USD 0.0012096 at the published rates. That figure is calculated; no invoice
  was observed (saved).

### Evidence-integrity limits for anyone other than Matt

1. **Hard-coded balance:** `result.json` always records
   `ownerReportedBalanceUsd: 25` (`server/runApprovedVerification.ts:100`),
   whoever runs it. In a judge's receipt that field is false and must be
   ignored. The runner was not changed to fix this.
2. **Self-attested proof:** the cost-proof booleans are attestations (above).
3. **Provider not authenticated:** a receipt is the runner's own record. The
   app validates claims and digests but does not authenticate the provider
   (README "Evidence").
4. **Output not repeatable:** temperature 0 does not promise identical output.
   A new call gets a new response ID and may cite different claims, or fail
   validation. It reproduces the path, not the bundled report.
5. **Fixed session set:** only the 7 bundled sessions have approval names. A
   judge cannot coach a new session without editing the runner, which is not
   proposed.

## 4. Import a runner receipt into the app (free; demonstrated offline)

The repo has no converter from `result.json` (`blurr.approved-verification.v1`)
to the app's `blurr.saved-provider-report.v1`. This `jq` command does it:

```bash
jq --arg kind recorded_simulation '{schemaVersion:"blurr.saved-provider-report.v1", sessionSha256:.result.receipt.sessionSha256, telemetryKind:$kind, model:.provider.model, responseId:.provider.id, completedAtUtc:.completedAtUtc, usage:{inputTokens:.provider.usage.prompt_tokens, outputTokens:.provider.usage.completion_tokens, reasoningTokens:.provider.usage.completion_tokens_details.reasoning_tokens, totalTokens:.provider.usage.total_tokens}, reportJson:.provider.choices[0].message.content}' judge-run/result.json > mapped.json
jq --arg r "$(jq -j .reportJson mapped.json | sha256sum | cut -c1-64)" '. + {reportSha256:$r}' mapped.json > judge-report.json
```

Then, in the app:

1. Choose **Import capture** and pick `data/f1tenth-silverstone/baseline-lap-session.json`.
2. Choose **Import saved coaching report** and pick `judge-report.json`.

**Demonstrated:** applied to Matt's saved 26 October receipt
(`evidence/f1tenth-sweep-76b3813/nebius-silverstone-baseline/result.json`),
the output equals `data/f1tenth-silverstone/baseline-lap-nebius-report.json`
in every field (`diff` of `jq -S`). No call was made.

**Limit:** `reasoningTokens` assumes Token Factory returns
`completion_tokens_details.reasoning_tokens`, as it did on 26 October. If it
is null, the import fails with `REPORT_USAGE_INVALID`.

## 5. Judge-access plan without a merge or new deploy

### Test build

Use the pinned deploy permalink from section 1.

- **Demonstrated:** public, identical build.
- **Retention gap:** Netlify's docs (re-read 27 October, 20:58Z) say "By
  default, Netlify will delete deploys after 30 days (or 90 days on paid
  plans)". It never auto-deletes only "The deploy currently published", "The
  most recent successful production deploy" and "The most recent successful
  branch deploy for a given branch". A deploy preview is not on that list.
- At 90 days, `6ae0f4e0` (created 2026-10-27T19:00:48Z) would expire about
  2027-01-25, after the Judging Period ends on 15 December.
- At 30 days it would expire about 2026-11-26, before 15 December.
- The 90-day figure depends on the team staying on a paid plan. The Pro plan is
  saved evidence from 27 October, not rechecked here.
- A manual deletion or a site or plan change would also remove it.

### Source

Repo URL https://github.com/MatthewSnow2/blurr, plus the pinned tree
https://github.com/MatthewSnow2/blurr/tree/749171739119e9de55d4be44fdb27654f35e611b
in the testing instructions.

- **Demonstrated:** the GitHub API resolves the commit, and
  `refs/pull/4/head` points to it.
- **Gap:** the repo root shows `main` (`be1ab6e`), whose README lacks the
  baseline/retest and Nemotron sections. A judge who ignores the pinned link
  reads the old README.
- **Not included:** the readiness review and this draft are local commits
  after `7491717`, so they are not in the pinned tree.

### Options that change public state (each needs Matt's approval; neither is shown to be required)

| Option | Effect | Demonstrated requirement? |
|---|---|---|
| Merge PR 4 | `main` and the protected production deploy serve this build; the root README is current | No. It is a publication choice that removes the retention and README gaps. |
| Push the local docs commits | The pinned tree could move to a commit that includes this guide; it also creates a new preview deploy with the same app bundle | No |

## 6. Rule interpretation (kept apart from the facts above)

Rule text (live page re-read 2026-10-27T20:24:30Z; quotes in
`submission-readiness.md` sec. 2):

- "Runs on" means "the project makes a runtime call to the Token Factory
  inference API".
- The demo URL is "not required for Physical AI submissions, which are
  evaluated per the hardware-access provision below".
- Testing: "Access must be provided [...] by providing a link to a website,
  functioning demo, or a test build", free of charge until the Judging Period
  ends; "Judges are not required to test the Project".

Reading (not a ruling):

- Paths A and B are free test access.
- Section 3 gives a judge with their own paid Token Factory access a documented
  way to make the call. It is not free, so it may not count as "free of
  charge" testing of the live call.
- Whether replay plus a documented runner satisfies "makes a runtime call" is
  still G1. This draft narrows the reproducibility gap but does not settle it.
- Organizer contact stays separate and unapproved.
