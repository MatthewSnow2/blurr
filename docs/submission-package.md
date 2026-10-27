# Submission package: draft for Matt, not submitted

Prepared 27 October 2026 (UTC) against branch `feat/f1tenth-parameter-sweep-on-main`
(draft PR https://github.com/MatthewSnow2/blurr/pull/4). Nothing here has been
uploaded, published or submitted. Owner gates are listed at the end.

## 1. Official requirements checked

Rules and FAQ read 2026-10-27T04:38Z:
https://nebiusglobalaihackathon.devpost.com/rules and
https://nebiusglobalaihackathon.devpost.com/details/faqs

| Requirement (rules) | Blurr status |
|---|---|
| Submission Period ends 30 October 2026, 10:00 PT (17:00 UTC) | Open |
| Working software that "runs on" Nebius Token Factory or AI Cloud and uses at least one NVIDIA open model | Eight real Token Factory calls to `nvidia/nemotron-3-super-120b-a12b` produced the bundled reports. The judged app replays them offline; judges cannot trigger a new call. Owner framing decision (gate G1). |
| Track | Physical AI, simulation only. The FAQ allows simulation. |
| Demo URL (not required for Physical AI) and Testing access until the Judging Period ends (15 December 2026) | Production `strong-strudel-8072a3.netlify.app` serves main `be1ab6e`, which lacks the baseline/retest files. Deploy preview 4 serves `116d943`. Gate G3. |
| Public repo with a detectable OSI license in About | https://github.com/MatthewSnow2/blurr, public, Apache-2.0 detected |
| README with setup, Nemotron usage, where Token Factory helped | README sections "Quick start", "Viewing the Silverstone baseline and retest lap attempts", "How Nemotron and Token Factory are used" |
| Video under 3 minutes, public on YouTube, at least 1 minute of key modules if no hardware | Script and rehearsal in `demo-sequence-draft.md` (2:50, 2:05 of app). Not recorded. Gate G2. |
| Existing projects explain significant updates | Owner to confirm when work began; see section 6 |
| Original work, solely owned, no third-party IP violation | Gate G5 (GPL-3.0 track data) |
| English | All materials in English |

## 2. Submission copy (draft)

**Name:** Blurr

**Tagline:** Check the evidence before you trust the coach.

**What it does.** Blurr is a review tool for simulated driving sessions. It
opens a sealed F1TENTH gym capture, replays every recorded sample (position,
speed, raceline deviation) and shows a coaching report from NVIDIA Nemotron
only after checking that each claim in the report resolves to that exact
session's data. A report written for another run, edited bytes, an unknown
claim or a malformed file is refused, and the last valid view stays.

**How it uses Nemotron and Token Factory.** After a session is sealed, a
server-only runner sends its evidence bundle, a catalogue of reviewed
suggestion templates and a JSON schema to Nemotron 3 Super on Nebius Token
Factory. Nemotron returns typed claims (which measurement, which comparison)
and picks templates; it writes no free text that reaches the screen. The
browser re-validates every claim and renders it with local code. Eight calls
produced every report in the repository, under one US cent in total.

**What we showed.** On Silverstone, a full-lap attempt with the default
controller ended in a collision after 12.14 s (about 30 m along the raceline). The controller was then swept
over 100 settings on four simple practice tracks and the most accurate setting
was kept. With it, the held-out Silverstone retest stayed within 7 mm of the
raceline and reached about 68 m before its run also ended in a collision, at
27.44 s; that crash is not diagnosed. In the browser, each report validated
against its own run and was refused on the other.

**Limits, stated plainly.** Simulation only. Neither attempt completed a lap.
The improvement came from offline parameter tuning, not from the coach and not
from learning; nothing feeds a report back into the controller. Speed is fixed
at 2.5 m/s. The coaching is shallow (measurements plus a drill suggestion) and
has not been shown to help a human driver.

**What's next.** Diagnose the retest crash, add a measured braking channel, and
test whether a validated report changes what a driver or controller does.

## 3. Architecture

```
f1tenth_gym capture (Python, scripts/)        -> sealed session JSON + sha256
        |
server/runApprovedVerification.ts (one-shot, approved, journaled)
        |  evidence bundle + template catalogue + schema
        v
Nebius Token Factory -> nvidia/nemotron-3-super-120b-a12b (temperature 0)
        |  coaching-report.v1 JSON (typed claims, template IDs)
        v
saved report JSON (model, response ID, usage, session sha256)
        |
Browser app (React, Vite; static, no backend)
  import -> canonical digest -> manifest label (fixtures/provenance.json)
  report -> session binding + claim validation -> local rendering
  history -> localStorage, per browser and origin
```

The browser never holds a key or calls a provider. Model output is untrusted
data until validated (`docs/report-contract.md`).

## 4. Evidence index

| Claim | Evidence | Checked |
|---|---|---|
| Baseline ended at 12.14 s at raceline position 30.258 m; retest at 27.44 s at 68.457 m; both `stop_reason: terminated` with no lap completed, labelled "collided" in the manifest | `data/f1tenth-silverstone/{baseline,retest}-lap-session.json` (`outcome`, last sample `s_frenet`), `fixtures/provenance.json`, browser End-of-slider values | Files and browser, 27 Oct |
| Final-sample zero speed and heading are the simulator's reset on termination, not a spin (position is not reset) | Last samples of both lap files; reset behavior per PR 4 body | Zeros checked in files; reset cause recorded, not re-run |
| Sweep winner gain 1.05 / lookahead 6 (3 on Silverstone, 0.6 m); default ranked 38th | `data/f1tenth-sweep/selection.json`, `tests/test_select_sweep_setting.py` | Python suite, 53 OK |
| Eight Nemotron calls, about USD 0.0088 | the eight `*-nebius-report.json` files; table below | Files read, 27 Oct |
| Each report validates only against its own session | `tests/savedProviderReport.test.ts` (generic mismatch); baseline/retest cross-refusal in the browser only | npm 73/73; browser, 27 Oct |
| Viewing makes no provider call or cross-origin request | browser network log during QA | Chromium, 27 Oct |
| Run A demo: 600 samples, mean 0.006260 m, max 0.018428 m | README "What you should see", browser | Browser, 27 Oct |

### Nebius call inventory

| Report | Response time (UTC) | Input / output tokens | USD at 0.30 / 0.90 per M |
|---|---|---|---|
| `fixtures/autodrive-synthetic-nebius-report.json` | 2026-10-15T02:13Z | 1182 / 655 | 0.0009441 |
| `data/f1tenth-silverstone/run-a-nebius-report.json` | 2026-10-23T22:32Z | 1362 / 594 | 0.0009432 |
| `data/f1tenth-ladder/turn-run-a-nebius-report.json` | 2026-10-26T23:25Z | 1364 / 909 | 0.0012273 |
| `data/f1tenth-circle/run-a-nebius-report.json` | 2026-10-26T23:26Z | 1359 / 920 | 0.0012357 |
| `data/f1tenth-ladder/twoturns-run-a-nebius-report.json` | 2026-10-26T23:26Z | 1358 / 722 | 0.0010572 |
| `data/f1tenth-ladder/chicane-run-a-nebius-report.json` | 2026-10-26T23:26Z | 1360 / 699 | 0.0010371 |
| `data/f1tenth-silverstone/baseline-lap-nebius-report.json` | 2026-10-27T00:47Z | 1362 / 890 | 0.0012096 |
| `data/f1tenth-silverstone/retest-lap-nebius-report.json` | 2026-10-27T01:29Z | 1360 / 765 | 0.0010965 |
| Total | | 10,707 / 6,154 | 0.0087507 |

Costs are calculated from published rates; invoices were not observed. The
00:47Z and 01:29Z calls fell on 26 October in US Central time, which is the
date the data READMEs use.

## 5. Token Factory feedback (draft)

- The OpenAI-compatible endpoint let a plain native `fetch` call replace an
  SDK, which kept the request bounded and auditable.
- Reasoning-token counts in `usage` let each call be costed from published
  rates without an invoice; please keep them.
- Machine-readable prices at `/api/public/models_info` were easy to cite; the
  interactive catalog was harder to read without a browser.

## 6. Significant-update explanation (draft, owner to confirm)

The repo's first commit (9 October 2026) imports 54 files of earlier code, so
it does not date the start of the work; the rules put the Submission Period
start at 26 August 2026. Matt must say whether Blurr existed before then
(`docs/historical-vision.md` describes earlier ideas). If it did, the October
work added: sealed capture import and replay, the typed report
contract and validator, the bounded Token Factory runner, all eight Nemotron
reports, the F1TENTH ladder sweep, and the Silverstone baseline and retest.

## 7. License and provenance audit

| Material | License | Note |
|---|---|---|
| Code and docs | Apache-2.0 (`LICENSE`) | GitHub detects Apache-2.0 |
| `data/f1tenth-silverstone/*` (captures and reports) | GPL-3.0 (`data/f1tenth-silverstone/LICENSE`) | Derived from `f1tenth/f1tenth_racetracks@b95c4ef` Silverstone assets |
| Circle and ladder tracks and captures | Apache-2.0 | Original geometry |
| Bundled UI runtime (react, react-dom, scheduler) | MIT | `THIRD-PARTY-NOTICES.txt` |
| Nemotron outputs in saved reports | Not assessed here | Owner question |

Repo files state that Silverstone redistribution under GPL-3.0 was "cleared on
23 October 2026". This audit did not verify that decision and gives no legal
opinion. Open questions for Matt (gate G5):

1. The rules require a submission "solely owned by the Entrant". The GPL-3.0
   Silverstone data is not solely owned. Does that conflict, and should the
   submission describe the data as a separately licensed third-party input?
2. Do the Nemotron model's terms impose anything on redistributing its outputs
   in a public repo?
3. `windsurf_test.txt` is a tracked stray test file at the repo root (from
   commit `c5d098f`). Remove it?

## 8. Acceptance checklist

| Item | Status | Evidence |
|---|---|---|
| Recovery branch matches PR 3 intent on current main | Done | PR 4, head `116d943` |
| Rules and FAQ verified with URLs and time | Done | Section 1 |
| Browser QA: Run A, imports, wrong report, switching, malformed and missing input, no stale leaks, console and network | Done, no blocking defect | `blurr-qa` notes in the handoff; Chromium only |
| README matches the verified experience | Done | README diff in this commit |
| Submission copy, architecture, evidence index | Done (draft) | Sections 2 to 4 |
| Video script rehearsed | Done; not recorded | `demo-sequence-draft.md` |
| License audit with owner flags | Done; questions open | Section 7 |
| Checks at final head | See commit message and handoff | |
| Video recorded and public on YouTube | Open | Gate G2 |
| Judge-accessible build with these files | Open | Gate G3 |
| Submitted with confirmation receipt | Open | Gate G6 |

## 9. Owner gates

- **G1 runtime-call framing:** present the app as offline replay of real
  Token Factory outputs, with the runner shown in the README and video.
- **G2 video:** record from the script, upload publicly to YouTube.
- **G3 judge access:** merge PR 4 and let Netlify deploy main, or name another
  link that stays up until 15 December 2026.
- **G4 Devpost:** fill the form; the Devpost connector here needs `/mcp`
  re-authorization.
- **G5 licensing:** questions in section 7.
- **G6 submit:** only Matt submits; record the confirmation receipt.
