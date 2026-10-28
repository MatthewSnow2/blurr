# Submission readiness review (27 October 2026, not submitted)

Pass, gap or owner decision for each requirement, with the next action for
each genuine blocker. Deadline: 30 October 2026, 17:00 UTC (12:00 CDT,
10:00 PDT). Evidence labels: **saved** (an earlier file or receipt),
**new** (a check run for this review, 27 October 2026 about 20:20 to
20:40 UTC), **assertion** (stated in repo docs, not rechecked here).

## Verdict

The package is not ready to submit; only owner gates remain. G1 changed on
28 October from option A to a live path: the hosted app now makes a runtime
Token Factory call (see Update below); it goes live for judges once Matt
pushes and the new preview permalink replaces the judge link.
Judge access (G3) is owner-reported resolved (28 October). G5, ownership of
the GPL-3.0 Silverstone data, can still block. G2 (video upload), G4
(Devpost form) and G6 (submitting) are open and mechanical. Nothing below
has been accepted on Matt's behalf.

## Update 28 October 2026, live path (about 20:00 to 20:20 UTC)

- Branch `feat/live-nemotron-coaching` (local, not pushed) adds
  `POST /api/live-coach` (Netlify Function) and a "Run live coaching" button
  for the 7 bundled captures. Plan reviewed by Codex in checkmate run
  `2026-10-28-1501-blurr-live-path` (consensus after 3 rounds).
- Checks (new): `npm test` 91 pass, `npm run typecheck`, `npm run lint`,
  `npm run build` all exit 0; `python3 -m unittest discover -s tests -p
  'test_*.py'` 53 OK.
- Real calls (new, 3 of the 5 Matt approved): one local through the handler
  (HTTP 200, 6 claims, 7.2 s), one `curl` on draft deploy
  `6ae257b5392f5e09d1d12342` (HTTP 200, 8.7 s) and one by clicking the
  button in Chromium on that draft. Each reply validated against run A and
  carried the pinned request sha256. Unknown digest: HTTP 404; GET serves
  the SPA, not the function.
- Netlify env vars set 28 October: `NEBIUS_API_KEY` (secret, Functions scope,
  production, deploy-preview and branch-deploy contexts),
  `LIVE_COACHING_ENABLED=true`, `LIVE_COACHING_DAILY_CAP=60`. Production
  still serves `be1ab6e`; it gets the function only when the branch reaches
  `main`.
- Not run: other browsers, the 429 rate-limit and daily-cap paths against
  the real Netlify edge (covered by unit tests only).

## Update 28 October 2026 (fresh checks about 06:05 to 06:20 UTC)

- **Judge access:** owner-reported resolved, relayed in Chad/Codex's
  overnight review ("judge-access requirement is resolved"). The mechanism
  was not stated and is not verified here. Supporting facts, fresh: the
  Netlify project `strong-strudel-8072a3` reports plan `nf_team_pro` and no
  password or SSO gate; the pinned permalink `6ae0f4e0...`, the newest PR 4
  preview deploy `6ae18445...` (built from `8bc5d86`) and
  `deploy-preview-4--strong-strudel-8072a3.netlify.app` all return HTTP 200
  with bundle `main-Dttd0-9S.js`, the same as a fresh local build.
  Production still serves `be1ab6e` (`main-DFd3u24-.js`). No organizer
  contact was requested or sent.
- **Repo:** host `im4tlai-dev`; worktree
  `/home/apexaipc/Documents/Codex/2026-10-13/task-2/worktrees/blurr-sweep-recovery`;
  branch `feat/f1tenth-parameter-sweep-on-main` at `8bc5d86`, equal to origin
  and `refs/pull/4/head`; base `main` at `be1ab6e` (merge base), 11 commits
  and 29 files ahead; tree clean.
- **PR 4:** open, draft, mergeable, `CLEAN`. Netlify checks: deploy preview
  pass, redirect rules pass, header rules and pages changed skipping. These
  are the only checks; the repo has no GitHub Actions workflows, so "CI
  green" means the Netlify checks only.
- **Local checks (fresh, Node 24.22.0, Python 3.14.4):** `npm test` 73/73
  pass; `npm run typecheck` exit 0; `npm run lint` exit 0; `npm run build`
  exit 0 (`main-Dttd0-9S.js`); `python3 -m unittest discover -s tests -p
  'test_*.py'` 53 OK. Not run: other browsers, Windows, a live provider call.
- **Deployment effect of publication:** `netlify.toml` builds with `npm run
  build` and publishes `dist`. The 28 October push automatically produced a
  new deploy preview (`6ae18445...`) with no manual step, so any further push
  to the PR 4 branch will too. Merging to `main` would, by the same
  integration, replace the production deploy at
  `strong-strudel-8072a3.netlify.app` (inferred from the project's
  production deploy tracking `main`; not exercised).
- **Overclaims scan:** README, these docs and `captions.srt` contain no claim
  of learned driving or a completed Silverstone lap. The copy says the
  improvement came from offline parameter tuning, not learning, and the
  captions say "Neither run finished a lap".

## 1. Runtime path to Nemotron via Nebius (traced in code, new)

| Item | What the code does |
|---|---|
| Entry point | `server/runApprovedVerification.ts`. It has no npm script and no UI; the hosted app never calls it. |
| Command | `node --experimental-strip-types server/runApprovedVerification.ts --prepare\|--execute <outdir> <session.json> <ApprovalName>` (argv order, line 30) |
| Endpoint and model | `https://api.tokenfactory.nebius.com/v1/chat/completions`, `nvidia/nemotron-3-super-120b-a12b` (lines 28 to 29); host allowlist in `server/nebiusAdapter.ts:41` and `server/nebiusHttpExchange.ts:33` |
| Input | The sealed session's evidence bundle, the template catalogue and the report schema. Settings are temperature 0, `max_completion_tokens` 1024, `n` 1, `store` false, `response_format` json_object. In the new prepare run for the baseline lap, the request was 5,769 bytes, with a system message of 415 characters and a user message of 4,441. |
| Output | `<outdir>/result.json` (receipt: provider id, model, usage, HTTP observation, validated `coaching-report.v1`). The bundled `*-nebius-report.json` files are saved forms of these. |
| Prerequisites for `--execute` | 1. Session digest equal to one of 7 hard-coded approvals (lines 17 to 25). 2. A hand-written `<outdir>/cost-proof.json` whose fields match lines 74 to 78. 3. No earlier attempt for that approval in `<outdir>` or `~/.local/state/blurr/nebius-approvals/`. 4. `NEBIUS_API_KEY` in `~/.env.shared` (`server/sharedCredential.ts:14`). |
| Credential ownership | The key belongs to whoever runs it. It is read from the runner's own home directory and never shipped. Matt's key is not, and must not be, shared with judges. |
| Hard-coded owner values | The receipt records `ownerReportedBalanceUsd: 25` (line 100) whoever runs it. |

**What a judge can reproduce today**

- **Pass (new):** the hosted replay. The preview serves the 7 app files byte for byte identical to the local build, and the earlier Chromium QA covers that build.
- **Pass (new):** the offline prepare step. `--prepare` for `Approval_f1tenth_silverstone_baseline_lap_20261026` printed `OFFLINE_PREPARATION_COMPLETE_NO_CREDENTIAL_OR_DISPATCH`. It wrote `request.json` and read no key.
- **Gap:** a live call by a judge. It is possible on paper with the judge's own key, because the ledger is per machine and a fresh machine has consumed no approvals. But neither the command, nor the `cost-proof.json` format, nor the `~/.env.shared` location is documented in the README. The README says only that it "needs a Nebius key and an explicit per-call approval". A judge can also only re-coach the 7 bundled sessions.

**Historical receipts vs a reproducible path.** The eight calls (15 to 27 October) are saved evidence that the project did call Token Factory. Each saved report carries the model, a response ID, token usage and the session sha256. They do not show that a judge can run a call, and the browser does not authenticate the provider (README "Evidence"). The cost-proof receipts are not bundled (`docs/qualification-review-2026-10-25.md:27`).

## 2. Rule text (live page re-read 2026-10-27T20:24:30Z, new)

Source: https://nebiusglobalaihackathon.devpost.com/rules. The extracted text
has sha256 `6115d92d...0397`. Each clause below matched the 04:38Z capture
(`~/Documents/playwright-output/nebius-rules-plain.txt`).

- "'Runs on Nebius Token Factory or Nebius AI Cloud' means the project makes a runtime call to the Token Factory inference API, or is deployed/run using Nebius AI Cloud compute (Serverless Jobs, Serverless Endpoints, or DevPods)."
- "Functionality: The Project must be capable of being successfully installed and running consistently on the platform for which it is intended and must function as depicted in the video and/or expressed in the text description."
- "Provide a URL to a working demo, hosted application, or test build of your Project (not required for Physical AI submissions, which are evaluated per the hardware-access provision below)."
- "The repository must contain all necessary source code, assets, and instructions required for the project to be functional."
- Testing: "Access must be provided to an Entrant's working Project for judging and testing by providing a link to a website, functioning demo, or a test build. [...] available free of charge and without any restriction [...] until the Judging Period ends. Judges are not required to test the Project and may choose to judge based solely on the text description, images, and video provided in the Submission."
- Hardware access: "If the Project includes software that runs on proprietary or third party hardware that is not widely available to the public [...] the Sponsor and/or Administrator reserve the right [...] to require the Entrant to provide physical access to the Project hardware upon request."
- FAQ (saved capture): Physical AI may use simulation "as long as the project runs on Nebius Token Factory or AI Cloud and uses at least one NVIDIA open-source model, per the Official Rules."

**Interpretation (not rule text, not a ruling)**

- The demo-URL exemption gives the hardware-access provision as its reason. Blurr has no hardware, so that provision has nothing to apply to. The Testing clause still asks for "a link to a website, functioning demo, or a test build".
- Giving judges the Netlify link costs nothing and removes this question.
- Whether "the project makes a runtime call" is met by a project whose hosted part replays saved responses, while a separate repo script makes the call, is not settled by the text. That question is G1.

## 3. Assessment

| Area | Status | Evidence | Next action |
|---|---|---|---|
| Runtime call (G1) | **Decided 28 Oct: option A** | Section 1 above; rules quote | None. Matt accepts the eligibility risk; the copy states the replay plainly (`submission-package.md` sec. 2) |
| Judge link through 15 Dec (G3) | **Owner-reported resolved 28 Oct** (see Update) | The pinned permalink `6ae0f4e0854374c78f8c6656--strong-strudel-8072a3.netlify.app` serves `7491717`. It is public and noindex (new). It is not protected from Netlify's automatic deletion: about 2027-01-25 at 90 days on a paid plan, or 2026-11-26 at 30 days on a free plan. Production serves `be1ab6e` (saved); the custom domain does not resolve (saved). See `judge-access-draft.md` sec. 5. | None for this review. Matt pastes the judge link he chose into the Devpost form (G4). |
| Public repo, OSI license | Pass | GitHub API (new): public, `license: Apache-2.0`, default branch `main` | None |
| Repo default branch content | **Gap** | `origin/main` is `be1ab6e`, 11 commits behind PR 4 at `8bc5d86` (28 Oct). Judges reading `main` see the old README without baseline/retest or the Nemotron section. `refs/pull/4/head` is now `8bc5d86` (28 Oct); the app code is unchanged from `7491717`. | Put the pinned tree URL in the testing instructions; a merge would also fix this (publication choice) |
| Setup instructions | Pass with gap | README Quick start: Node 24, `npm ci`, build, preview, no credentials. Checks were green at `1ac7127`; the code is unchanged since (saved). But `.env.example` still asks for Supabase credentials, and legacy `src/App.tsx`, `Auth.tsx` and `supabase/functions/analyze-telemetry` (ElevenLabs TTS) sit in the repo unused by `src/main.tsx` (new). | Owner decision: delete or label the legacy files and `.env.example`. A small docs/cleanup commit, no architecture change. |
| Live-call instructions | Pushed to PR 4 (`8bc5d86`), not on `main` | `judge-access-draft.md` sec. 2 to 4. Prepare is byte-identical to the 26 Oct request, and the import `jq` maps the saved receipt to the bundled report exactly (both new). The live call itself was not run. A judge's own key is not free reproduction, and judge credit coverage is unresolved. Receipts hard-code `ownerReportedBalanceUsd: 25`. | None; G1 decided as option A |
| Code license | Pass | `LICENSE` Apache-2.0; `THIRD-PARTY-NOTICES.txt` lists react, react-dom and scheduler (MIT) | None |
| Silverstone data (G5) | **Owner decision** | `data/f1tenth-silverstone/LICENSE` is GPL-3.0 (new). Rules Sec. 4 require "solely owned" but allow open source if licenses are complied with and the entrant "creates software that enhances and builds upon" it. | Matt answers G5 Q1 (options a/b/c in `submission-package.md` sec. 7) |
| Model output terms | **Owner decision** | `~/.claude/agents/.artifacts/blurr-licensing-rules-research.md` Q2 and Q3 (saved): NVIDIA claims no output ownership; Nebius gives the customer Output ownership but Agreement 18.7 needs consent for public references | Matt answers G5 Q3 and Q4 |
| Header logo | Pass (assertion) | `docs/public-assets-review.json`: owner confirmed on 23 October. It is only referenced by legacy `Header.tsx`. | None |
| Stray file | Gap, trivial | `windsurf_test.txt` (from `c5d098f`) | G5 Q5 |
| Significant update | **Owner decision** | First commit 2026-10-09; 0 commits before 26 Aug and 30 after (new). The first commit imports 54 earlier files (saved, sec. 6). | Matt states whether Blurr existed before 26 Aug; if it did, use the sec. 6 text |
| Video length and format | Pass | Captioned MP4 sha256 `8b029f72...7153`: 170.000 s, 1280x720, no audio (re-hashed, new). | None |
| Video footage requirement | Pass | Key modules on screen 20.36 to 145.04 s, 124.7 s, against a 60 s minimum (saved, `demo-sequence-draft.md`) | None |
| Video claims | Pass | Wording matches the script and data; "ended", not "crashed" (saved) | None |
| Video third-party names | **Owner decision** | Captions name NVIDIA (1), Nebius (1), Nemotron (3), F1TENTH (1) and Silverstone (2) (new). The rule says the video "must not include third party trademarks [...] unless the Entrant has permission". These are text references; this review did not check frames for logos. | Matt decides whether the names need permission or a change. NVIDIA/Nebius naming is what the rules ask entrants to describe. |
| Video on YouTube (G2) | Open | Not uploaded | Matt watches it, then uploads it publicly |
| Devpost form fields (G4) | **Not verified** | The Devpost connector rejected its token this session (`get_submission_requirements` failed, new). Fields known from the rules text only: demo URL, repo URL, video URL, description, Nemotron/Token Factory use, feedback, update explanation. | Matt re-authorizes `/mcp`, then reads the form's custom questions before the deadline |
| Submission copy | Pass (draft) | `submission-package.md` sec. 2 to 5 | Matt edits as he likes |
| Submit (G6) | Open | None | Matt submits and keeps the confirmation |

## 4. G1 options, smallest first (none built)

| Option | What it changes | Uses existing code | Needs |
|---|---|---|---|
| A. Submit as is | Nothing. The description states that saved Token Factory outputs are replayed and that the call runs from `server/runApprovedVerification.ts`. | Yes | Matt accepts the eligibility risk |
| B. Document the live call for judges | Drafted in `judge-access-draft.md`: the exact `--prepare`, `cost-proof.json`, `--execute` and import steps for one bundled session with the judge's own key. Docs only, no code change. | Yes | Matt's approval to push it. It does not make the live call free for judges. |
| C. Ask the organizers | Dropped: Matt decided on 28 Oct not to send the draft in `submission-package.md` sec. 12 | n/a | None |
| D. Show a fresh call | One more approved call recorded on camera | Yes | Credit owner-verified 28 Oct (`submission-package.md` sec. 11); still needs a new per-call approval constant; still not judge-triggerable |

Not proposed: wiring a live call into the hosted app. That needs a server, a
key on Netlify and spending controls: new architecture outside this goal.

B and C can run together. B is the smallest step that turns "a judge cannot
reproduce the call" into "a judge with a Nebius key can reproduce it from the
README". It does not by itself settle the interpretation in section 2.

## 5. Gates that stay closed

Console credit was owner-verified on 28 October (USD 25.00 balance, paid
usage continues after the trial). No provider call without a new per-call
approval. No new credentials or
security changes. No merge, deploy, publication, YouTube upload, organizer
contact or submission without Matt's approval for that action.
