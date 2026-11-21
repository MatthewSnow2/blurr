# Blurr project status and Devpost retrospective — 2 November 2026

## Outcome

Blurr has a working simulator evidence and coaching-report foundation. It does not yet demonstrate a completed Silverstone lap, learned driving, coaching-caused improvement, or measured benefit to a human driver.

The Nebius x NVIDIA Devpost submission was not completed by the 30 October 2026 deadline. No completed submission receipt, final public video, or accepted entry has been verified. This is a missed submission, not evidence that Devpost rejected an entry. The [official rules](https://nebiusglobalaihackathon.devpost.com/rules), rechecked on 2 November, still specify 10:00 a.m. Pacific / noon Central / 17:00 UTC on 30 October.

The product goal remains a closed-course performance-driving coach: help a driver understand and improve their driving while keeping the driver in control. The Corvette C8 inspiration is product context, not a calibrated digital twin or a proven real-vehicle integration.

## Repository and delivery state

Verified through GitHub on 2 November, before this documentation update:

| Surface | Verified state | Consequence |
| --- | --- | --- |
| Default branch `main` | `be1ab6e580d36c13542ad7e71acefb34542cb700`, dated 27 October | Contains the replay/report foundation and original practice tracks; does not contain the later live-coaching function or sweep package. |
| [Draft PR #4](https://github.com/MatthewSnow2/blurr/pull/4) | Open, draft, unmerged; head `a729bfea240373486f25a4c9b149ea194003de68` | Preserves the 400-run sweep, Silverstone comparison, hosted live-coaching path, and submission/recording documents. |
| PR #3 | Closed unmerged after its base branch was deleted following the squash merge of PR #2 | The work was recovered into PR #4; closure was a branch-workflow event, not proof that the work was lost. |
| Automated checks | PR #4 has a successful Netlify deploy-preview status; repository Actions run count is zero | A successful deployment is not a CI test-suite result. |
| 30 October diagnostic/recorder work | Historical records describe local, unpublished changes; no corresponding later commit appears on `main` or PR #4 | Preserve and reconcile the original worktree before claiming those changes are upstream or deployment-ready. Current remote-host dirty state was not independently inspected. |

A separate local robotics checkout was found during reconciliation, pointing to a different upstream repository. It was clean with one local commit ahead of its tracked branch and was left untouched. It must not be confused with this web application's working tree.

The [pinned 29 October preview](https://6ae3c0277eb05b860561c78a--strong-strudel-8072a3.netlify.app/) is historical delivery evidence. Its exact build had recorded browser GET checks; a fresh provider call on that exact deployment was not established. This update does not claim that an old preview URL remains indefinitely available.

## What was built

The current foundation includes sealed session identities and digests, simulator telemetry import, deterministic measurement extraction, browser-local history and replay, evidence-linked report claims, bounded coaching templates, saved-report import, and Nebius Token Factory integration. A report is accepted only when its claims resolve to the matching session. That validates evidence references; it does not establish the usefulness of the advice.

The F1TENTH route produced recorded simulator captures. AutoDRIVE compatibility is represented in this app by a synthetic fixture; it is not evidence of a current live Unity or vehicle stream. Original code and practice geometry are Apache-2.0; Silverstone-derived captures and reports retain the separate GPL-3.0 distribution.

PR #4 adds a hosted live-coaching path for seven eligible bundled captures. The code pins request bodies, checks session eligibility, limits requests and output, uses a daily reservation cap and kill switch, and validates responses. Saved evidence records three successful real calls on 28 October: one local handler call and two interactions with an earlier draft deployment. These are historical calls, not new validation on 2 November.

No learned policy, validated braking/friction/balance coaching, live vehicle integration, or measured human coaching benefit has been established. Simulation, report validity, controller quality and coaching utility remain separate claims.

## Work completed during the submission effort

| Period | Work and evidence | Boundary |
| --- | --- | --- |
| 8–15 October | Reproduced a mixed centerline/raceline reference error; built grounded reports, corrected measurement handling and a telemetry-only bridge; completed a bounded real Nebius response and local replay/report work. | Review consensus concerned a plan; unit and browser checks did not prove a complete coaching product. |
| 16–23 October | Repaired import/metadata priming while preserving socket restrictions, corrected Gymnasium handling, recorded two sealed 600-step captures and obtained a report bound to the captured session. | Saved receipts were reviewed; they were not fresh simulator reruns during later reviews. |
| 25–27 October | Published the licensed replay foundation, added Circle, Turn, TwoTurns and Chicane practice tracks, ran the 400-setting comparison, and recorded Silverstone baseline/retest attempts. | Short practice episodes and deterministic reproduction are not full laps or learning. |
| 27–29 October | Recovered PR #3 into PR #4, added the hosted live-coaching path, completed preview/readiness work, prepared submission text and recording packages, repaired Devpost OAuth, and delivered a silent captioned review video. | An authenticated account and a review video did not close registration, final video publication, form completion or submission. |
| 30 October | Audited the product story and unsupported claims; prepared a revised 2:52 script, inspected five on-camera clips, and developed additional terminal-evidence/recorder diagnostics. | Planned app footage was not a completed final edit. The two authorized real diagnostic runs were not executed. Final submission was not verified. |

The 30 October local patch was intended to retain terminal flags, reward and normalized simulator information, handle absent/oversized information safely, retain raw observations while excluding the terminal observation from conservative summaries, and express lookahead in physical units. Historical review found that simulator information had been discarded even though terminal flags were retained. The simulator can end for more than one condition, so a generic termination flag cannot identify a collision.

The recorder work added substantial defensive testing, but Windows process cleanup, registration races and interpreter startup remained unqualified. Source comparison after whitespace normalization did not establish a verified Git identity or dirty state. These are preservation and reconciliation tasks, not completed release work.

## What the experiments actually establish

The [sweep package at PR #4's pinned head](https://github.com/MatthewSnow2/blurr/tree/a729bfea240373486f25a4c9b149ea194003de68/data/f1tenth-sweep) contains 100 gain/lookahead combinations on each of four synthetic tracks: 400 trials. Each episode had 600 steps at 0.01 seconds, about six seconds and 14.5 metres. Every setting reached the episode cap on all four tracks. In that context, “completed” means the episode cap, not a completed circuit.

The selection rule minimizes the mean of per-track mean absolute raceline deviation, with a lower-gain tie break. This is offline grid tuning, not a learning curriculum; changing the order of the track summaries does not train a policy.

| Silverstone attempt | Gain / lookahead | End time | Distance along raceline | Mean / maximum absolute deviation |
| --- | --- | --- | --- | --- |
| Baseline | 0.65 / 14 points, approximately 2.8 m | 12.14 s | 30.258 m of approximately 446.2 m | 0.039 / 0.182 m |
| Retest | 1.05 / 3 points, approximately 0.6 m | 27.44 s | 68.457 m of approximately 446.2 m | 0.002 / 0.007 m |

The recorded XY path lengths are approximately 29.8023 m and 68.0523 m, respectively: about 128% farther in the tuned attempt. XY path length and distance along the raceline are different measurements. The tuned attempt still covered only about 15% of the circuit. Neither completed a lap.

The captures record termination without an explicit cause; earlier “collision” labels exceeded what the telemetry established. Very small tracking deviation in the tuned attempt, despite its early stop, remains an unresolved anomaly. Geometry, vehicle footprint, adapter and reset behavior are hypotheses. An offline reproduction conditionally explained the baseline, but did not reproduce the tuned termination cause.

The lap budget was already about 186 seconds, so merely extending the cap does not resolve an early termination. Gain and lookahead changed together. The default 14-point lookahead represents about 1.4 m on the practice tracks but 2.8 m on Silverstone, another confound. Each condition has one deterministic run; repeated identical output is reproducibility, not an independent effectiveness trial. A fresh holdout is needed after any further Silverstone-directed tuning.

## Validation ledger

Counts below refer to separate snapshots and must not be added together.

| Snapshot | Recorded result | What was verified in this reconciliation |
| --- | --- | --- |
| PR #4, 29 October | 91 JavaScript tests; 19 hosted browser GET checks; typecheck/lint/build and 53 Python tests reported in the PR | GitHub PR text and successful deploy-preview status inspected. These suites were not rerun on 2 November; the historical review did not possess every raw log behind all reported checks. No fresh inference was established on the exact final preview. |
| 30 October early local diagnostic patch | Saved results described 66 Python tests, 91 JavaScript tests, typecheck and lint | Historical evidence only; not proof that this patch is committed or that termination was diagnosed. |
| 30 October final recorder package | Saved Linux results: 126 tests on Python 3.14.4 and 3.12.12; 73 of 73 mutation checks caught | Saved-result review, not a fresh Windows qualification or a new simulator run. |
| This documentation update | Remote branch/PR/check inspection, documentation consistency and publication read-back | No new simulation, provider request, runtime change or application test-suite run. |

Earlier suites and a separately rerun focused 20-test PR-recovery check belong to their own snapshots. They are not a cumulative “project tests passed” number.

## Why the Devpost attempt did not finish

The engineering foundation advanced, but the submission was not managed to a verified end-to-end finish.

1. **The product story and acceptance test converged too late.** Work centred on code, evidence and readiness checks before the demonstration clearly explained who the coach helps and what it could honestly show. The owner challenged that framing on deadline day, prompting a revised script.
2. **Evidence gaps consumed the remaining schedule.** Auditing lap completion, learning claims and the unexplained stop was necessary. The diagnostics and recorder became substantial work without producing the two intended real runs.
3. **Delivery gates remained separate and open.** The last recorded Devpost inspection reported no registration for this contest and no corresponding project. OAuth had been repaired, so it should not be treated as the sole continuing explanation. Final form/rules decisions, final video edit, public video URL and submission confirmation were not verified.
4. **Video preparation did not become a final deliverable.** A silent captioned review video existed. The revised script budgeted about 80 seconds of app demonstration, but planned footage is not filmed footage. Five camera clips totaling 142.43 seconds were technically inspected; frames and audio levels were checked, but speech, selects, an approved outro, final edit and public upload were not established.
5. **The deadline needed one unambiguous operational checklist.** “Review cutoff” wording caused confusion, but the relevant time was the official submission deadline. Permission and environment failures contributed friction; they do not explain the whole failure or assign responsibility solely to the owner.

No evidence supports blaming a Devpost rejection, claiming the diagnostics ran, or presenting the unfinished package as an accepted entry.

## Next work, in order

1. Preserve and inventory the unpublished 30 October files and receipts on their original host. Record exact branch, commit, diff, dependencies and checks before any source publication.
2. Resolve terminal evidence and qualify the recorder on the intended simulator host. Retain raw stop information and physical units, then run the bounded diagnostics only under a current execution decision.
3. Define distinct acceptance tests for controller behavior, evidence validity and coaching usefulness. Cover complete corner entry/exit/recovery, unfamiliar combinations and a fresh holdout.
4. Reconcile PR #4 deliberately. Its merge would introduce live server functionality into the default branch and may change production behavior; this documentation update is not that release.
5. Address the model dependency before further live use. The pinned code still names `nvidia/nemotron-3-super-120b-a12b`. [Nebius's November notice](https://docs.tokenfactory.nebius.com/november-2026-deprecation-notice), rechecked on 2 November, removes it from Serverless on 9 November and says requests are not automatically rerouted. Model migration requires contract, prompt, response, cost and pin validation; no migration occurred here. Saved reports remain historical artifacts.
6. Treat the November loop/graph and short direction/magnitude cue ideas as research. Separate FieldLab/CueLab synthetic results are not verified code or tests in this repository. No calibrated steering cue system or vehicle connection is claimed.
7. For the next external submission, track registration, applicable rules decisions, final operating demo, final edit, public URLs, form completion and submission receipt independently. Reserve explicit recording, editing and upload time; a handoff is accepted only when its next action is executable.

## Evidence boundaries

Repository links are public and pinned where branch-specific. Private historical review receipts and the local camera-review report informed this retrospective but are not republished as private transcripts, machine paths or raw media metadata. Current remote GitHub state was inspected; remote development-host state and Matrix ingestion were not established by that inspection.

Historical readiness documents are snapshots, not current completion claims. This retrospective supersedes their forward-looking submission status while preserving the underlying artifacts.
