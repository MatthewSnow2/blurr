# Full-project YouTube video outline (no length limit)

Prepared 29 October 2026 for Matt. Not recorded, not uploaded. The Devpost
demo (`docs/recording-devpost-demo.md`) is the short, judge-facing cut; this
one tells the whole story. Every segment is tagged **Proof** (shown working,
with a file or run behind it) or **Vision** (planned or concept, not built).
Keep the tag on screen as a lower third so a viewer never mistakes one for
the other.

## Segments

| # | Segment | Tag | What to show | Source |
|---|---|---|---|---|
| 1 | Why Blurr | Vision | The goal: a performance driving coach that enhances the driver, not autonomy. Matt to camera, or over Matt's own C8 drone footage. | `docs/historical-vision.md` (archived, says itself it is not current functionality); `/home/apexaipc/content/blurr/dji.mp4` (93 s, 1080p, a blue C8 on a parking lot; Matt to confirm it is his footage) |
| 2 | The three-layer plan | Vision | Wheelie (1/10 F1TENTH car), ACC VR proof of concept, C8 production, as a diagram. Say plainly none of the hardware layers runs in this build. | `docs/historical-vision.md` "Architecture" |
| 3 | The trust problem | Proof (concept) | A model can write a plausible note about any run. Blurr's rule: a claim is shown only if it resolves to a measurement in that exact session. | README intro; `docs/report-contract.md` |
| 4 | Simulator evidence | Proof | F1TENTH gym captures: run A (600 samples), baseline lap attempt (1,214), retest (2,744). Scrub the replay. | Devpost package scenes 0:15 and 1:20 to 2:30; `data/f1tenth-silverstone/` |
| 5 | Offline controller tuning | Proof | 100 gain and lookahead settings on 4 original practice tracks (Circle, Turn, TwoTurns, Chicane), 400 runs; winner gain 1.05, lookahead 0.6 m; Silverstone held out. Say "tuning, not learning". | `data/f1tenth-sweep/README.md`, `selection.json`, `data/f1tenth-ladder/*_map.png` |
| 6 | Baseline vs retest | Proof, with limits | Baseline ended at 12.14 s (mean deviation 0.039 m); retest ended at 27.44 s, about 68 m in (0.002 m). Neither completed a lap; why the retest ended is not diagnosed. | Same as segment 4 |
| 7 | Nemotron on Token Factory | Proof | How a report is made: pinned evidence bundle, temperature 0, typed claims, reviewed templates. Eight saved calls (15 to 27 October, about USD 0.0088). | README "How Nemotron and Token Factory are used"; `docs/submission-package.md` sec. 4 |
| 8 | Live coaching | Proof (saved) or live take (gate) | The hosted "Run live coaching" button, the pin, the 60-a-day cap, the refusal of a wrong report. Saved evidence: 3 live calls on 28 October, all validated. A new on-camera click is Matt's call (at most USD 0.0057216 each). | README "Live coaching on the hosted site"; `docs/submission-readiness.md` live-path update |
| 9 | Engineering choices | Proof | Fail-closed cap (nonce read-back), pinned request hash, no retry, key never echoed, Netlify secret scan 0 matches. Short code walk-through. | `server/liveCoachCap.ts`, `server/liveCoaching.ts`, `tests/liveCoach*.test.ts` |
| 10 | What is not done | Proof of limits | No physical car, no voice, no video telemetry extraction, no completed lap, no evidence that coaching improves driving. AutoDRIVE is import compatibility only (a synthetic two-frame fixture). | README "Simulators: what is and is not here" |
| 11 | Next | Vision | Close a full Silverstone lap in simulation, diagnose the retest stop, then Wheelie data collection. Mark each as planned. | Matt's call |

## Asset rules

- **Usable:** the app itself (record fresh), the 27 October title and Limits
  cards (see the Devpost package), ladder track maps, repo code, Matt's own
  footage once he confirms ownership.
- **Label "AI-generated concept" if used at all:**
  `/home/apexaipc/content/blurr/blurr_seedance_v1.mp4` and
  `f1tenth_seedance_v2.mp4` (15 s each, Seedance generations from April).
  They are not footage of Blurr running.
- **Do not use:** `blurr_seedance_v1_reversed.mp4` (reversed footage);
  `/home/apexaipc/content/blurr/sim.mp4` (80 s; frames show a stock-style C8
  sensor graphic with LiDAR, radar and camera cones whose source and rights
  are unknown, and it depicts sensors Blurr does not have).
- The 27 October app scenes carry the old "not live simulation or inference"
  banner; record fresh rather than mixing builds.
- Keep the Silverstone GPL-3.0 attribution in the description
  (`THIRD-PARTY-NOTICES.txt`).

## Claims to avoid

No "learned", "self-driving", "completed a lap", "improved the driver" or
"real-time voice". Say "ended", not "crashed". Live-reply numbers vary per
call; show them, don't promise them.
