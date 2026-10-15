# Saved provider reports

The UI accepts `blurr.saved-provider-report.v1` JSON files no larger than128KiB.
The bundled AutoDRIVE example contains the report JSON returned by the genuine
15 October2026 Nemotron Super request, with no reasoning text, credential,
account balance or personal data. Telemetry is a two-frame synthetic replay.

`sessionSha256` must equal the selected imported session's canonical digest.
`reportSha256` covers the exact UTF-8 bytes of `reportJson`. The importer rebuilds
the evidence store and passes the parsed report through the existing typed-claim
and reviewed-template validator. It renders only that validator's output.
Rehashing invented claims cannot bypass the evidence check.

The file carries a NVIDIA-namespaced model ID, response ID, completion time,
telemetry kind and input/output/reasoning/total token counts. Counts must be
bounded nonnegative integers, total=input+output, reasoning<=output. Extra
file metadata is discarded before browser-local persistence. Reports are keyed
by session digest and revalidated whenever history is reopened. Failed imports
preserve a previous valid report; corrupt stored reports are hidden with a
recovery message. The importer never sends a request or loads a model.

These digests detect mismatch and accidental changes; they are not signatures.
Provider metadata is supplied by the imported file. Browser claim validation
does not authenticate its provider provenance. The original sanitized native
HTTP receipt is retained independently in the task's evidence directory.

Current sponsor evidence: model nvidia/nemotron-3-super-120b-a12b,
response chatcmpl-a297366406b7f4bf, HTTP200, 1182input/655output tokens,
including518reasoning. Calculated cost USD0.0009441; invoice unobserved.
Preflight reservation16000input+1024totaloutput, n=1, maximumUSD0.0057216.
Exactly one request was authorized and made. Do not reset its durable guard
or rerun it. Future paid inference needs fresh owner approval.
