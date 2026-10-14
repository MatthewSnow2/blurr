# Morning decision — one bounded package, not executed

Matthew reports the Nebius account is now set up. Credits, usable key access and
specific spend/data authorization remain unknown; no connected read-only account
tool was available and no secret values were read. The earlier paid-call and
simulator-trial proposal was not approved. Account setup alone is not approval.

Proposed decision: approve **one synthetic-only Nemotron 3 Super smoke call** to
`https://api.tokenfactory.us-central1.nebius.com/v1/chat/completions`, model
`nvidia/nemotron-3-super-120b-a12b`, at most 1,024 output tokens, one attempt/no
retry, **$0.01 aggregate ceiling from existing credits only**, paired with the
prepared minimized synthetic request and a retained redacted receipt. Verify
current rate/credit/key usability before any send; otherwise stop. Do not create
keys, top up, accept account terms or silently substitute models. Public model
availability/pricing is not account-specific availability.

Also approve **one gated AlienPC simulator-only trial**, 45 seconds total, pinned
installed executable and scene. Scene decoding found one manual-mode vehicle,
zero traffic controllers and zero lighting controllers; Start initializes Manual,
but live state is unverified. Connection objects start disabled, so one specific
Connection toggle through existing access is required. After live mode, Unity
peer PID/SID, loopback route and physical-output exclusion are verified, allow
only `{}` Bridge polls to that one SID at <=5 Hz for <=10 seconds/50 polls. Keep
control tools disabled. Record simulation_poll_only provenance, not no-reply
capture. Stop if any precondition is unavailable or changes. The conditional poll
mode/import envelope is not yet implemented; prepare/test it in isolation first.

This decision does not approve physical outputs, new security/access rules,
installs, cloud provisioning, publication, pushing or entry/terms acceptance.
Actual network/device isolation is still missing. Loopback alone cannot exclude
a local hardware proxy; a hard unreachability guarantee requires an already
supported confinement mechanism or a separately authorized access change.
Relevant source reads and offline tests remain authorized without this decision.

Detailed prior proposal: task evidence/final-decision-handoff.md and
simulator-handshake-proposal.md. Prepared HTTP module has no native client or
credential source bound. Its durable journal prevents duplicate bytes from being
resent, but is not an account-wide spending lock or authorization for new payloads.
