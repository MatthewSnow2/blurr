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
| Working software that "runs on" Nebius Token Factory or AI Cloud and uses at least one NVIDIA open model | The hosted app makes a runtime call: "Run live coaching" sends one bundled session to `nvidia/nemotron-3-super-120b-a12b` on Token Factory through a Netlify Function and shows the validated reply (G1 changed to the live path on 28 October, section 12). Eight earlier calls produced the saved reports. |
| Track | Physical AI, simulation only. The FAQ allows simulation. |
| Demo URL (not required for Physical AI) and Testing access until the Judging Period ends (15 December 2026) | Production `strong-strudel-8072a3.netlify.app` serves main `be1ab6e`, which lacks the baseline/retest files. Deploy preview 4 serves PR 4 head `8bc5d86` (28 October; same app bundle as `7491717` and `116d943`). The site's primary custom domain does not resolve. See section 10. Gate G3. |
| Public repo with a detectable OSI license in About | https://github.com/MatthewSnow2/blurr, public, Apache-2.0 detected |
| README with setup, Nemotron usage, where Token Factory helped | README sections "Quick start", "Viewing the Silverstone baseline and retest lap attempts", "How Nemotron and Token Factory are used" |
| Video under 3 minutes, public on YouTube, at least 1 minute of key modules if no hardware | Silent screen-recorded draft with captions, checked start to finish (2:50; key modules 20.4 to 145.0 s), see `demo-sequence-draft.md`. The rules do not ask for narration, so a voiceover is optional. Not uploaded. Gate G2. |
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
produced every report in the repository, under one US cent in total. On the
hosted demo, "Run live coaching" makes a fresh call for any bundled session,
capped at 60 calls a day, and the reply passes the same checks before it is
shown.

**What we showed.** On Silverstone, a full-lap attempt with the default
controller ended after 12.14 s, when the simulator terminated the episode
(the manifest labels it a collision), about 30 m along the raceline. The controller was then swept
over 100 settings on four simple practice tracks and the most accurate setting
was kept. With it, the held-out Silverstone retest stayed within 7 mm of the
raceline and reached about 68 m before its run also terminated, at 27.44 s,
with the same manifest label; why is not diagnosed. In the browser, each report validated
against its own run and was refused on the other.

**Limits, stated plainly.** Simulation only. Neither attempt completed a lap.
The improvement came from offline parameter tuning, not from the coach and not
from learning; nothing feeds a report back into the controller. Speed is fixed
at 2.5 m/s. The coaching is shallow (measurements plus a drill suggestion) and
has not been shown to help a human driver.

**What's next.** Diagnose why the retest run terminated, add a measured braking channel, and
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
| Nemotron outputs in saved reports | NVIDIA Nemotron Open Model License; Nebius Token Factory terms | See the source facts below |

Repo files state that Silverstone redistribution under GPL-3.0 was "cleared on
23 October 2026". This audit did not verify that decision and gives no legal
opinion.

### Source facts (read 2026-10-27, 05:12Z to 05:17Z)

Quotes are verbatim. None of them settles a question below; they are what a
decision would rest on.

- **F1TENTH tracks** at `b95c4ef`: the only license file is the stock FSF
  GPL-3.0 text, with no named copyright holder and no per-track exception
  (https://github.com/f1tenth/f1tenth_racetracks/tree/b95c4eff766f6367d66b310ea20cd2c9563712c0).
  Its README says the maps are "based on the f1 racketrack database
  (https://github.com/TUMFTM/racetrack-database)" and that "the original center
  lines ... were fetched as GPS points from the OpenStreetMap project".
  TUMFTM's repository is LGPL-3.0 today (license at the time of derivation not
  checked). OpenStreetMap data is ODbL: "you may distribute the result only
  under the same license" (https://www.openstreetmap.org/copyright).
  `THIRD-PARTY-NOTICES.txt` names F1TENTH but not TUMFTM or OpenStreetMap.
- **NVIDIA Nemotron Open Model License** (v. 15 December 2025, linked from the
  model card
  https://huggingface.co/nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-BF16):
  "NVIDIA does not claim ownership to any outputs generated using the Works or
  Derivative Works." Sec. 7: "You will indemnify and hold harmless NVIDIA from
  and against any claim by any third party arising out of or related to your
  use or distribution of ... output from the Works". No clause read restricts
  publishing outputs. Which license version Nebius serves was not verified.
- **Nebius Token Factory Supplemental Terms**, effective 22 October 2026
  (https://docs.nebius.com/legal/token-factory), Sec. 3.1: "Customer retains
  ownership of Customer Content, including its Input and Output." Sec. 2.7
  incorporates model-card EULAs. The old Token Factory terms apply only to
  accounts with an active reserve on 15 September 2026; whether this account
  had one was not checked.
- **Nebius Services Agreement** 18.7 (https://docs.nebius.com/legal/agreement):
  "Any references to Nebius shall only be published ... with the prior written
  consent of Nebius". The README, saved reports and submission copy name Nebius
  Token Factory, which the hackathon rules require entrants to describe.
- **Hackathon rules** (https://nebiusglobalaihackathon.devpost.com/rules),
  Sec. 4: the submission must "be solely owned by you ... with no other person
  or entity having any right or interest in it", and an entrant "may submit a
  Submission that includes the use of open source software or hardware,
  provided the Entrant complies with applicable open source licenses". Sec. 11:
  an entrant who believes a term "is or may be ambiguous ... must submit a
  written request for clarification". The FAQ says nothing on third-party data.
- **GPL-3.0 Sec. 5**: "Inclusion of a covered work in an aggregate does not
  cause this License to apply to the other parts of the aggregate." The FSF
  FAQ calls the line between separate and combined works "a legal question,
  which ultimately judges will decide"
  (https://www.gnu.org/licenses/gpl-faq.en.html#MereAggregation).

Full notes: `/home/apexaipc/.claude/agents/.artifacts/blurr-licensing-rules-research.md`
(outside the repo).

### Open questions for Matt (gate G5)

1. The rules require a submission "solely owned by the Entrant". The GPL-3.0
   Silverstone data is not solely owned. Does that conflict, and should the
   submission describe the data as a separately licensed third-party input?
   Options: (a) describe `data/f1tenth-silverstone/` as a separately licensed
   aggregate and rely on the open-source sentence; (b) send Devpost a Sec. 11
   clarification request before 30 October; (c) drop the Silverstone files
   from the judged build and use only the original-geometry tracks.
2. Should `THIRD-PARTY-NOTICES.txt` also credit TUMFTM (Alexander Heilmeier)
   and OpenStreetMap contributors, as the F1TENTH README does?
3. Does naming Nebius in the README and submission need Nebius's written
   consent under Agreement 18.7, or does the Nebius-sponsored hackathon's
   own requirement to describe Token Factory use cover it?
4. Are you comfortable with the Nemotron Sec. 7 and Token Factory Sec. 8.1
   indemnities for publishing the saved reports?
5. `windsurf_test.txt` is a tracked stray test file at the repo root (from
   commit `c5d098f`). Remove it?

## 8. Acceptance checklist

| Item | Status | Evidence |
|---|---|---|
| Recovery branch matches PR 3 intent on current main | Done | PR 4, head `116d943` |
| Rules and FAQ verified with URLs and time | Done | Section 1 |
| Browser QA: Run A, imports, wrong report, switching, malformed and missing input, no stale leaks, console and network | Done, no blocking defect | `blurr-qa` notes in the handoff; Chromium only |
| README matches the verified experience | Done | README diff in this commit |
| Submission copy, architecture, evidence index | Done (draft) | Sections 2 to 4 |
| Video script rehearsed | Done | `demo-sequence-draft.md` |
| Silent captioned video draft recorded and checked start to finish | Done; voiceover optional | `demo-sequence-draft.md`, "Recorded draft" |
| License audit with owner flags | Done; questions open | Section 7 |
| Judge-access facts | Done; decision open | Section 10 |
| Nebius credit check before any new call | Owner-verified 28 Oct; no call made | Section 11 |
| Checks at final head | See commit message and handoff | |
| Video recorded and public on YouTube | Open | Gate G2 |
| Judge-accessible build with these files | Owner-reported resolved 28 Oct | Gate G3; readiness review, Update 28 October |
| Submitted with confirmation receipt | Open | Gate G6 |

## 9. Owner gates

- **G1 runtime call (changed 28 October to the live path):** the hosted
  app now calls Token Factory at runtime (README "Live coaching on the hosted
  site"). This supersedes the earlier option 1 decision. Spend is bounded at
  60 calls and USD 0.343 a day. Open for Matt: push the branch, then use the
  new deploy-preview permalink as the judge link.
- **G2 video:** watch the captioned draft, optionally add a voiceover, then
  upload it publicly to YouTube.
- **G3 judge access (owner-reported resolved 28 October):** previously: merge PR 4 and let Netlify deploy main, or name another
  link that stays up until 15 December 2026. Separately, decide what to do
  about the unresolved custom domain (section 10).
- **G4 Devpost:** fill the form; the Devpost connector here needs `/mcp`
  re-authorization.
- **G5 licensing:** questions in section 7.
- **G6 submit:** only Matt submits; record the confirmation receipt.

## 10. Judge access facts (read-only, 27 October 2026)

| URL | Serves | Notes |
|---|---|---|
| https://strong-strudel-8072a3.netlify.app/ | main `be1ab6e` (bundle `main-DFd3u24-.js`) | HTTP 200; no baseline/retest files |
| https://deploy-preview-4--strong-strudel-8072a3.netlify.app/ | PR 4 head, `8bc5d86` on 28 October (bundle `main-Dttd0-9S.js`, unchanged from `116d943`) | HTTP 200; has baseline/retest; `x-robots-tag: noindex` |
| https://drivingcoachapexai.com/ | nothing | Listed as the Netlify project's primary URL, but DNS does not resolve |

- The local docs commit builds the same bundle as `116d943`, so pushing it
  changes no app behavior on the preview.
- The Netlify team is on the Pro plan. Netlify deletes deploys after 30 days,
  or 90 on paid plans, and always keeps the published deploy, the latest
  production deploy and the latest deploy of each branch
  (https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/).
  That page does not mention deploy previews, so preview 4 alone is not a
  safe judge link through 15 December.
- Recommendation: merging PR 4 makes this build the protected production
  deploy at the `netlify.app` URL. Give judges that URL, not the custom domain,
  unless its DNS is fixed first.

## 11. Runtime call and Nebius credit

- On 28 October, testing the live path made 3 calls (one local, two on a
  Netlify draft deploy), each bounded at USD 0.0057216. Judges' calls are
  funded by Matt's key through the hosted function, at most 60 a day.
- Matt approved spending from existing credit on 27 October, conditional on
  verifying the balance first. Token Factory documents no balance API; the
  balance appears only in the logged-in console
  (https://docs.tokenfactory.nebius.com/other-capabilities/billing-new.md),
  and a public feature request asks for one
  (https://ideas.nebius.com/p/account-balance-api-endpoint-for-nebius-token-factory).
  The same page says card payers are charged automatically when the balance
  goes negative.
- Owner-verified on 28 October 2026: a console screenshot of organization
  M2AI-3rw shows an account balance of USD 25.00 (hackathon credit, per Matt)
  and USD 0.99 of trial credit with 15 days left. Matt confirmed that "Paid
  usage after trial" is set to continue after the trial ends. At the USD
  0.0057216 per-call ceiling the balance covers about 4,369 calls.
- This closes the credit condition only. A new call still needs a new
  per-call approval (all 7 hard-coded approvals are consumed on ProBook), and
  the credit is reachable only with Matt's key, so it does not fund judges'
  own runs.

## 12. G1: runtime-call requirement (changed to the live path, 28 October)

Update 28 October: Matt chose to build the live path. The hosted app's
"Run live coaching" button makes a runtime call to the Token Factory
inference API, which is the Sec. 4 wording. The history below is kept for
the record.

What the rules say (https://nebiusglobalaihackathon.devpost.com/rules, read
27 October 2026):

- Sec. 4: "'Runs on Nebius Token Factory or Nebius AI Cloud' means the
  project makes a runtime call to the Token Factory inference API, or is
  deployed/run using Nebius AI Cloud compute".
- Sec. 4, Functionality: "The Project must be capable of being successfully
  installed and running consistently on the platform for which it is
  intended and must function as depicted in the video and/or expressed in
  the text description."
- Sec. 6, Stage One: pass/fail on whether the project "reasonably applies
  the required APIs/SDKs featured in the Hackathon".
- FAQ (https://nebiusglobalaihackathon.devpost.com/details/faqs): "Calling an
  NVIDIA model through Token Factory (e.g. via a Serverless Endpoint)
  satisfies this - the rest of your app (web frontend, unrelated backend
  processing) doesn't also need to be hosted on Nebius AI Cloud."

What Blurr does: `server/runApprovedVerification.ts` makes the call
(one approved call per sealed session, no retry); eight such calls produced
the bundled reports. The hosted app makes no call; it validates and shows
the saved responses. The rules do not say whether "the project" means the
repository or the judge-facing demo, or whether a call must happen while
judges test.

Options for Matt:

1. Submit as is, describing the runner and the offline replay plainly.
2. Ask for clarification first (draft below). **Not pursued: Matt decided
   on 28 October not to send it. The draft is kept for the record only.** Sec. 11 requires "a written
   request for clarification" for an ambiguous term but names no recipient.
   Contact routes found (re-checked 2026-10-27, 21:10Z):
   - **Verified:** support@devpost.com. The live rules page, Sec. 15, says
     "For questions, send an email to" an address that Cloudflare obfuscates
     in the page HTML; decoded, it is support@devpost.com. It is the only
     address on the page.
   - **Not verified as a route:** the FAQ says "Please reach out via the
     Nebius Discord!", but no invite link was captured. The one Discord link
     on the rules page (`discord.com/invite/HP4BhW3hnp`) is in the Devpost site
     footer, not shown to be Nebius's.
   - An email gives the written record Sec. 11 asks for.
3. Add a live call path judges can trigger. That needs a server holding a
   key, spend limits and abuse controls: new architecture and spending,
   outside the current goal.

Draft request (revised 27 October 2026, not sent; Matt decides whether and
when to send it, from his own account):

> To: support@devpost.com
>
> Subject: Nebius x NVIDIA Global AI Hackathon: rules clarification on
> "runtime call" and testing for a Physical AI entry
>
> Hello,
>
> Under Section 11 of the Official Rules I am requesting written
> clarification of two terms before the 30 October deadline.
>
> Section 4 says "'Runs on Nebius Token Factory or Nebius AI Cloud' means
> the project makes a runtime call to the Token Factory inference API".
> The Testing provision says "Access must be provided to an Entrant's
> working Project for judging and testing by providing a link to a website,
> functioning demo, or a test build" and that the Entrant "must make the
> Project available free of charge and without any restriction".
>
> Our entry, Blurr (Physical AI track, simulation only, no hardware), has
> three parts:
>
> 1. A free hosted test build that replays recorded F1TENTH simulator
>    sessions and the saved NVIDIA Nemotron reports for them. It checks each
>    report against its session in the browser. It makes no model call, so
>    no API key is exposed.
> 2. A free, offline step in the public repository that builds the exact
>    Token Factory request for any bundled session, with no key and no
>    network access.
> 3. A separate server-side runner in the same repository that sends that
>    request to `nvidia/nemotron-3-super-120b-a12b` on Token Factory, one call
>    per session, with no retry. Eight such calls produced the bundled
>    reports. Running it needs the runner's own Nebius API key and credit.
>
> Our questions:
>
> 1. Do these three parts together satisfy the Section 4 runtime-call
>    requirement and the free-of-charge testing requirement?
> 2. If not, what live access must judges have? For example: a hosted
>    endpoint that makes a Token Factory call on request at our expense, or
>    documented steps that judges run with their own Nebius key, or
>    something else.
>
> Thank you,
> Matthew Snow

What sending it does and does not do:

- It is organizer contact, which is not approved.
- It does not change eligibility by itself; the answer would.
- It is separate from whether to push the local docs commits `f7c4bac` and
  `574455d` (a publication decision).
- It is separate from any commitment to keep a preview deploy alive (a
  Netlify retention and plan decision).
- The request names the parts as they exist today. If Matt adds a hosted
  live endpoint later, that is new architecture and spending, outside the
  current goal.
