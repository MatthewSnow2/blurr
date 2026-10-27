# Draft demo: 2:50, not recorded or published

Screen recording of the built app (`npm run build && npm run preview`) in a
browser with empty site data. Every number below is what the app shows for the
bundled files at commit `116d943`; do not retype, round differently or overlay
other values. No mock output, no new provider call, no physical robot.

App modules are on screen from 0:20 to 2:25 (2:05), above the one-minute
minimum the rules set for Physical AI entries without hardware.

| Time | On screen | Narration (about 300 words, roughly 110 per minute) |
|---|---|---|
| 0:00 to 0:20 | Title card "Blurr: check the evidence before you trust the coach". Then the history screen. | "Blurr is a review tool for simulator driving sessions. A model can write a convincing coaching note about any run. Blurr only shows a note after checking that every claim in it comes from that exact session's data." |
| 0:20 to 1:00 | **Open recorded demo.** Banner "Recorded replay · not live simulation or inference". Label "Silverstone run A", 600 samples. Drag the **Replay sample** slider start to end; position trace, speed, raceline deviation update. Scroll to the saved report: "Saved report, not a fresh response", three measurements, one suggestion, model `nvidia/nemotron-3-super-120b-a12b`, response `chatcmpl-5516fe22...`, 1362 / 594 tokens. Expand provenance. | "This is a recorded F1TENTH gym capture on Silverstone: six simulated seconds of one straight. It's a replay, not a live simulation. The report under it came from one real call to NVIDIA Nemotron 3 Super on Nebius Token Factory. Nemotron doesn't write the text you see. It picks typed claims, like 'mean deviation', and a reviewed suggestion template. The browser checks each claim against this session's samples and the session's sha256 before drawing anything." |
| 1:00 to 1:30 | Back. **Import capture** `baseline-lap-session.json`: label "baseline lap attempt (gain 0.65, lookahead 14), collided at 12.14 s", 1,214 samples, mean 0.038774 m, max 0.182421 m. **Import saved report** `baseline-lap-nebius-report.json`: response `chatcmpl-29bd4e65...`, three claims including the mean-below-max comparison. | "Here's a full-lap attempt with the default controller. It left the line in the first right-hander and crashed after 12 seconds, about 30 meters in. Its saved report cites three claims, all checked against this run." |
| 1:30 to 1:50 | With the baseline open, **Import saved report** `retest-lap-nebius-report.json`. The app refuses: "This report belongs to a different session...". The baseline report is still shown. | "If I load the wrong report, Blurr refuses it and keeps the one that matches. A report can't drift onto a run it wasn't written for." |
| 1:50 to 2:25 | Back. **Import capture** `retest-lap-session.json`: gain 1.05, lookahead 3, collided at 27.44 s, 2,744 samples, mean 0.002096 m, max 0.006944 m. **Import saved report** `retest-lap-nebius-report.json`: response `chatcmpl-d153e03a...`, three measurements, three suggestions. Press End on the slider: sample 2744, 27.440 s, raceline distance 68.457 m, speed 0.000. | "Before this retest, the same controller was swept over a hundred settings on four simple practice tracks, and the most accurate setting was kept. Silverstone was held out. With that setting the car stayed within seven millimeters of the line and got about 68 meters before the run ended in a collision at a tight corner; why is not diagnosed yet. The zero speed in the last sample is the simulator resetting, not a spin." |
| 2:25 to 2:40 | README section "How Nemotron and Token Factory are used", scrolled slowly. | "Eight Nemotron calls produced every report in the repo, under one US cent in total. Viewing is offline replay; new reports are a separate, approved server step." |
| 2:40 to 2:50 | Card: "Simulation only · neither lap completed · offline tuning, not learning · coaching not shown to improve driving". | "Neither run finished a lap, and the gain came from tuning, not the coach. Blurr shows what the evidence supports, no more." |

## Rehearsal record

Rehearsed in Chromium (Playwright) on 27 October 2026 against
`http://10.0.0.46:8843/`, built from commit `116d943`, with empty site data.
Every on-screen value in the table was observed in that pass. Narration was not
timed with a voice recording; read it aloud once before recording and trim the
1:50 to 2:25 line first if it runs long (it is the densest row).

## Recording rules

- Keep the in-app labels ("Recorded replay · not live simulation or inference",
  "Saved report, not a fresh response") visible; they need no overlay.
- Don't show credentials, account pages, terminal history, browser profiles or
  unrelated tabs. Use a clean browser profile.
- No third-party music or logos beyond the model and provider names used as text.
- English, strictly under 3 minutes, public on YouTube: the upload and its
  visibility are Matt's steps.

Official criteria rechecked 2026-10-27T04:38Z:
https://nebiusglobalaihackathon.devpost.com/rules
https://nebiusglobalaihackathon.devpost.com/details/faqs
