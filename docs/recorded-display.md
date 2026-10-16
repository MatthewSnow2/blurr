# Recorded telemetry display

The history dashboard links to `recorded.html`, a separate local file-inspection
page. The existing sealed-session import, persistence, coaching evidence and
saved provider reports retain their contracts and validation.

Open the built page, choose the completed recorded-session JSON, and paste its
JSON SHA-256 from the Python importer's completed receipt. The original CSV hash
is a separate declared provenance field; the browser does not possess the CSV or
independently authenticate its producer. The included three-sample fixture is
synthetic. A user-declared `recorded_unverified` session is visibly unverified,
never promoted to genuine or live capture by successful parsing or hashing.

The page checks raw-byte hash, UTF-8, JSON grammar and duplicate fields; validates
the pinned adapter schema, dimensions, capabilities and disabled-output flags;
and recomputes sequence, calendar ordering, wall offsets, span and sample count.
Limits are 15 MiB and 50,000 samples. Empty, malformed, unsupported or mismatched
files fail visibly and preserve the previous valid view. A generation counter
prevents a pending import from undoing Clear or replacing a newer selection.
No source paths, images, LiDAR, network requests, inference or physical outputs
are used. Nothing is persisted by this page; reload returns to an empty view.

Source units remain unspecified; stationary and negative values are preserved.
Encoder values are labeled source floats. Original wall-clock labels are shown
without interpreting them as UTC or monotonic reception. Scalar speed in m/s,
reference deviation, braking and collision evidence remain unavailable.

## Build and preview

With the project's existing dependencies available:

```sh
npm run build            # both index.html and recorded.html
npm run build:recorded   # just recorded.html, no React/dropzone runtime needed
```

Serve the resulting static files through an approved local workflow. The
standalone output directory is `dist-recorded`; the full application uses `dist`.
The browser verification in the implementation evidence instead fulfills local
files directly through Playwright at a virtual test origin, without opening a
listener. It checks the actual rendered history dashboard link and the compiled
recorded page. It does not claim the full older main application was rebuilt.

This host has existing Vite 7.3.0 and TypeScript 5.8.3 tools that can validate the
dependency-light entry. That differs from the project's lockfile environment.
The full main frontend still requires its unavailable `react-dropzone` dependency;
no install, upgrade or remote source transfer is part of this change.

## Simulator-neutral boundary

`RecordedView` is a presentation model: ordered samples, channel labels and
values, original time labels and wall offsets, evidence declaration, source
identity/contract, input/output digests and explicit limitations. A future adapter
can produce this model after validating its own source schema, clock semantics
and units. The display has no Unity, simulator-client or transport dependency.
This is not a new universal capture schema and does not convert arbitrary data
into the existing sealed coaching contract.

The current adapter consumes the already completed AutoDRIVE recorded CSV import;
adding another simulator requires a separately validated adapter. Keep missing
channels unavailable, use the source's actual clock, and do not imply source
authenticity from a digest. The existing F1TENTH metric/raceline path remains a
separate valid option and is unchanged.

## Historical source and genuine-capture gap

The recovered `blurr-nebius-implementation-plan.md`, prepared 8 October 2026,
explicitly says to build the F1TENTH slice first and add AutoDRIVE using the same
interchange contract afterward. It also describes AutoDRIVE's Unity client and
reply-driven bridge. That is evidence for reusing an existing second adapter;
it is not an evaluation proving Unity is the best current engine, nor a recovered
Robotech decision record. No new Unity-specific infrastructure was added here.

Before claiming a genuine run, select the simulator; retain its exact producer,
build and recording settings; obtain the original data and independent hash;
record actual time/units/coordinate semantics and capture conditions; validate a
source adapter; inspect the resulting file through this view. Wheelie validation
and any live or physical activity remain outside this offline implementation.
