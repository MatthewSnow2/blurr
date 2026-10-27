# Draft demo: 2:50, silent draft recorded, not published

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
| 1:00 to 1:30 | Back. **Import capture** `baseline-lap-session.json`: label "baseline lap attempt (gain 0.65, lookahead 14), collided at 12.14 s", 1,214 samples, mean 0.038774 m, max 0.182421 m. **Import saved report** `baseline-lap-nebius-report.json`: response `chatcmpl-29bd4e65...`, three claims including the mean-below-max comparison. | "Here's a full-lap attempt with the default controller. It left the line in the first right-hander and ended after 12 seconds, about 30 meters in. Its saved report cites three claims, all checked against this run." |
| 1:30 to 1:50 | With the baseline open, **Import saved report** `retest-lap-nebius-report.json`. The app refuses: "This report belongs to a different session...". The baseline report is still shown. | "If I load the wrong report, Blurr refuses it and keeps the one that matches. A report can't drift onto a run it wasn't written for." |
| 1:50 to 2:25 | Back. **Import capture** `retest-lap-session.json`: gain 1.05, lookahead 3, collided at 27.44 s, 2,744 samples, mean 0.002096 m, max 0.006944 m. **Import saved report** `retest-lap-nebius-report.json`: response `chatcmpl-d153e03a...`, three measurements, three suggestions. Press End on the slider: sample 2744, 27.440 s, raceline distance 68.457 m, speed 0.000. | "Before this retest, the same controller was swept over a hundred settings on four simple practice tracks, and the most accurate setting was kept. Silverstone was held out. With that setting the car stayed within seven millimeters of the line and got about 68 meters before the run ended at a tight corner; why is not diagnosed yet. The zero speed in the last sample is the simulator resetting, not a spin." |
| 2:25 to 2:40 | README section "How Nemotron and Token Factory are used", scrolled slowly. | "Eight Nemotron calls produced every report in the repo, under one US cent in total. Viewing is offline replay; new reports are a separate, approved server step." |
| 2:40 to 2:50 | Card: "Simulation only · neither lap completed · offline tuning, not learning · coaching not shown to improve driving". | "Neither run finished a lap, and the gain came from tuning, not the coach. Blurr shows what the evidence supports, no more." |

## Rehearsal record

Rehearsed in Chromium (Playwright) on 27 October 2026 against
`http://10.0.0.46:8843/`, built from commit `116d943`, with empty site data.
Every on-screen value in the table was observed in that pass. Narration was not
timed with a voice recording; read it aloud once before recording and trim the
1:50 to 2:25 line first if it runs long (it is the densest row).

## Recorded draft

A silent draft was screen-recorded on 27 October 2026 with Playwright
Chromium (1280x720) against `http://10.0.0.46:8843/`, a `vite preview` of
the build at `116d943` (the docs-only commit after it builds the same
bundle). It follows the table above, with the narration burned in as
captions. Frame checks confirmed each scene cut and every on-screen value in
the table. Files are outside the repo, in
`/home/apexaipc/content/blurr/2026-10-27-submission-video-draft/`:

| File | sha256 |
|---|---|
| `blurr-demo-draft-silent-captioned.mp4` (the upload candidate) | `8b029f722aadc7851b0248635c411ea75cb6ef15f9e38aadb08a895e0d937153` |
| `blurr-demo-draft-silent-clean.mp4` (no captions, for an optional voiceover) | `9ca3b54dd4d8b3984764bed344f359be10d5451b90258cfb4134fb6a16a29aa9` |
| `captions.srt` (41 timed captions) | `3fdebbc551566803502227a879e20a1d44d9b1db3d33f0b0a7ae6b11c8963810` |
| `record.cjs` (recording script) | `d514f813206f17a0b59fb33ed171ef896a726b533d5f01f20151dd902de76d8f` |

### Start-to-finish check (27 October 2026)

Both MP4s: 170.000 s, 4,250 frames, H.264 1280x720 at 25 fps, no audio
track. The captioned file was checked with frames every 2.5 s across the
whole run, a frame every 5 s after the fix below, full-size frames at caption
changes, and ffmpeg scene, freeze and black detection.

- **Scenes:** cuts at 8.12, 20.36, 59.96, 91.2, 110.0, 145.04 and 159.96 s
  match the script's marks (8, 20, 60, 90, 110, 145, 160). No black frames.
  Static spans of 5 to 8 s (history screen, wrong-report refusal, retest
  report, both closing cards) carry captions throughout.
- **App footage:** the app is on screen from 8.12 to 145.04 s (136.9 s); the
  key modules (replay, report validation, refusal) from 20.36 to 145.04 s
  (124.7 s), above the one-minute minimum for Physical AI entries without
  hardware.
- **Opening and ending:** title card 0 to 8.12 s; README-points card 145.04
  to 159.96 s; "Limits" card with the repo URL to 170 s.
- **Captions:** 41, 0.30 to 169.65 s, no overlaps, single line, at most 60
  characters, shortest 1.78 s, fastest 15.2 characters per second. Each
  caption's wording matches the narration column above, including
  "ended after 12 seconds" and "ended at a tight corner" (the capture
  records `stop_reason: terminated`; "collided" appears on screen only as
  the manifest's dataset label).
- **On-screen values:** match the table (600 / 1214 / 2744 samples, the
  three response IDs, deviations, the refusal message with the baseline
  report kept, sample 2744 at 27.440 s and 0.000 m/s).
- **Nothing private:** the recording is the page viewport only. No browser
  address bar, tabs, terminal, account page, key, token or unrelated screen
  appears. Visible identifiers are the public model name, response IDs,
  file names and sha256 digests already in the repo.
- **Defect fixed:** the first render burned captions over the app, so
  fragments of UI text showed beside the caption box (for example at 1:41).
  The current render scales the footage to 1152x648 and puts captions in a
  72 px band below it. The clean file is unchanged.

What is not done: no human review and no YouTube upload. A spoken voiceover
is optional: the rules ask for a video under three minutes, public on
YouTube, showing the project working and, for Physical AI without hardware,
at least one minute of "the key application modules in action"; they say
nothing about narration or audio (rules read 27 October 2026, live page
rechecked).
 Title and closing cards are plain HTML
cards; the 2:25 to 2:40 scene shows a card with the README's "How Nemotron
and Token Factory are used" points instead of the README page itself.

To re-record: serve the build on port 8843, copy the four Silverstone
baseline/retest JSON files into one folder, then run
`node record.cjs <that folder> <output folder>`. The script hardcodes ProBook's
playwright-core and Chromium paths; edit them on another machine. Burn captions with
`ffmpeg -i clean.mp4 -vf "scale=1152:648:flags=lanczos,pad=1280:720:64:0:color=0x05070f,subtitles=captions.srt:force_style='FontName=DejaVu Sans,FontSize=11,BorderStyle=1,Outline=0,Shadow=0,Alignment=2,MarginV=9'" -c:v libx264 -crf 20 -pix_fmt yuv420p -an out.mp4`.

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
