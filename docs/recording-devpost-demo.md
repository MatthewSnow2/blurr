# Devpost demo recording package (under 3 minutes)

Prepared 29 October 2026 for Matt. Nothing here has been recorded or uploaded.
Labels: **fresh** (checked 2026-10-29 about 04:30 to 04:45 UTC on this
branch), **saved** (earlier evidence, cited), **gate** (needs Matt).

## What to record on

| Surface | Use | Status |
|---|---|---|
| https://6ae26ba8c26b4d3556338de4--strong-strudel-8072a3.netlify.app/ | Every scene, including the live call. It is the only public build with the `live-coach` function. | **Fresh, HTTP-load only:** 200, noindex, bundle `main-DRslsfw3.js` = local build of `34619ae`. No inference was run on it. |
| Local `npm run build && npx vite preview --host 0.0.0.0 --port 8843`, then http://10.0.0.46:8843/ | Rehearsal of every scene except the live call (the local preview has no function, so the button shows "This build has no live coaching service"). | **Fresh:** all values in the table below were re-read on this build. |

Files to import (in the repo): `data/f1tenth-silverstone/baseline-lap-session.json`,
`baseline-lap-nebius-report.json`, `retest-lap-session.json`,
`retest-lap-nebius-report.json`. Copy them to one plain folder first so the file
picker shows nothing else.

Clean browser profile, page viewport only (no address bar, tabs, terminal,
Netlify or Nebius console). Clear site data before the take so history starts
empty.

## Live call budget (gate)

The 1:00 scene clicks **Run live coaching**, which makes one real Token Factory
call on Matt's key: at most USD 0.0057216 per click, at most 60 clicks a day
across all deploys (resets 00:00 UTC). This package does not authorize those
calls; each take is Matt's decision. Observed on 28 October: replies took 6.3
to 8.7 s, and the number of claims varied between takes (3 and 6), so do not
script specific live numbers. If a click fails, the app shows a plain message
and the saved report stays; do not edit the failure out and present a
different take as the same call.

## Shot list and script (target 2:45)

| Time | On screen (exact UI text) | Narration |
|---|---|---|
| 0:00 to 0:08 | Title card. Reuse 0:00 to 0:08.12 of the 27 October clean footage (`blurr-demo-draft-silent-clean.mp4`): "Blurr / Check the evidence before you trust the coach. / Recorded F1TENTH simulator sessions · NVIDIA Nemotron on Nebius Token Factory". | "Blurr is a review tool for simulator driving sessions." |
| 0:08 to 0:15 | History screen, "Sealed simulator sessions", card "Recorded Nebius demo". | "A model can write a convincing coaching note about any run. Blurr only shows one after every claim checks out against that exact session." |
| 0:15 to 0:45 | **Open recorded demo.** Banner "RECORDED REPLAY · NOT A LIVE SIMULATION", "Silverstone run A · 5.99 s simulated over 600 steps at 0.01 s". Drag **Replay sample** start to end. Scroll to "Saved Nebius coaching": "Saved report, not a fresh response: recorded 2026-10-23T22:32:50.976Z by nvidia/nemotron-3-super-120b-a12b (response chatcmpl-5516fe22…)". Evidence: 0.006 m mean, 0.018 m max deviation, 2.411 m/s mean speed. | "This is a recorded F1TENTH gym capture on Silverstone, six simulated seconds. Under it is a saved report from Nemotron 3 Super on Nebius Token Factory. Nemotron doesn't write the text: it picks typed claims and a reviewed template, and the browser checks each one against this session's data and hash." |
| 0:45 to 1:20 | Scroll to "Live Nemotron coaching". Click **Run live coaching** ("Asking Nemotron…"). When "Live response, validated against this session" appears, expand **Live call provenance**: model, response ID, tokens, provider round trip, request SHA-256, "Cost ceiling per call USD 0.0057216 (at most 60 live calls a day on this demo)". | "This button calls Nemotron on Token Factory right now, through a serverless function. The request is pinned: same bytes every time, so the cost is bounded, and there's a daily cap. The reply goes through the same checks before it is shown, next to the saved one, not over it." |
| 1:20 to 1:50 | **Back to local history.** **Import capture** `baseline-lap-session.json`: "Silverstone baseline lap attempt (gain 0.65, lookahead 14), collided at 12.14 s · 12.13 s simulated over 1214 steps". **Import saved report** `baseline-lap-nebius-report.json`: response `chatcmpl-29bd4e65…`, 0.039 m mean, 0.182 m max, and "0.039 m was lower than 0.182 m". | "Here's a full-lap attempt with the default controller. It ended after about twelve seconds. Its saved report cites three claims, all checked against this run." |
| 1:50 to 2:00 | **Import saved report** `retest-lap-nebius-report.json` while the baseline is open: "This report belongs to a different session. Open its matching capture and try again." The baseline report stays. | "Load the wrong report and Blurr refuses it and keeps the one that matches." |
| 2:00 to 2:30 | **Back**, **Import capture** `retest-lap-session.json`: "gain 1.05, lookahead 3, collided at 27.44 s · 2744 steps". **Import saved report** `retest-lap-nebius-report.json`: response `chatcmpl-d153e03a…`, 0.002 m mean, 0.007 m max, 2.48 m/s. Focus the slider, press End: sequence 2744, 27.440 s, raceline distance 68.457 m, speed 0.000 m/s. | "The controller was then tuned offline over a hundred settings on four simple practice tracks; Silverstone was held out. With that setting the car stayed within seven millimeters of the line and got about 68 meters before the run ended at a tight corner. The zero speed is the simulator resetting." |
| 2:30 to 2:45 | Limits card. Reuse 2:39.96 to 2:50 of the 27 October clean footage: "Simulation only · Neither lap attempt completed a lap · The retest gain came from offline tuning, not learning, not the coach · Coaching has not been shown to improve driving · github.com/MatthewSnow2/blurr". | "Neither run finished a lap, and the gain came from tuning, not the coach. Blurr shows what the evidence supports, no more." |

About 290 words at about 110 words a minute. If the live wait runs long, trim
the 2:00 to 2:30 narration first.

## Reusing the 27 October footage

`/home/apexaipc/content/blurr/2026-10-27-submission-video-draft/`, sha256
re-checked fresh and equal to `docs/demo-sequence-draft.md`: both MP4s
170.000 s, 1280x720, 25 fps, no audio.

- **Usable as is:** the title card (0 to 8.12 s) and the Limits card (159.96
  to 170 s) of `blurr-demo-draft-silent-clean.mp4`.
- **Do not reuse:** the app scenes (8.12 to 145.04 s). They show the old banner
  "Recorded replay · not live simulation or inference" and the old demo-card
  text, which contradict the live scene. The "How Nemotron and Token Factory
  are used" card (145.04 to 159.96 s) and captions 37 to 38 say "new reports
  are a separate, approved server step", which is no longer true on this build.
- The captioned file is the fallback only if Matt decides not to show the
  live call; it then describes the 27 October build, not the judged one.

## Honest gaps to keep out of the script

- No completed lap, no learned driving, no coaching-caused improvement.
- "collided" is the dataset label; the capture's stop reason is
  `terminated`. Say "ended".
- The live reply's provider metadata comes from the server's call; the
  browser authenticates the claims and session binding, not the provider.
- Third-party names in the video (NVIDIA, Nebius, Nemotron, F1TENTH,
  Silverstone) are still an owner decision (`submission-readiness.md`).

## Gates

Record (Matt), decide the live clicks (Matt), upload publicly to YouTube
(Matt), paste the URL into Devpost (Matt).
