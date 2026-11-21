# Grounded post-session coaching contract

This slice validates and renders model-selected coaching after a simulator session is sealed. It does not make a provider call by itself and cannot participate in a live driving/control loop.

## Trust boundary

- Model output is untrusted data.
- Factual output consists only of typed claims validated against the deterministic evidence store.
- Interpretations consist only of reviewed catalogue template IDs plus typed slot bindings.
- Both channels are rendered by local code. No model-authored prose or numeric value is displayed.
- Any failed claim, unresolved slot, unknown template, unavailable channel, unit mismatch, or unsupported direction invalidates the whole report. Deterministic metrics remain available.

Supported factual claim types are `metric_value`, `comparison`, `trend`, `event_occurrence`, `occurrence`, and `absence`. Causal claims are not factual claim types. A causal relationship may appear only in a reviewed template marked `Hypothesis (unverified)` and all of its factual premises must be validated claim references.

Occurrence and absence claims require a measured owning channel. A collision claim therefore fails when the collision channel records absence or is unavailable.

## Catalogue review

Every template declares explicit fixed-text and enum-rendering review. Automated lexical lint rejects known comparative, occurrence, state, and behavior premises in fixed text or enum labels. This lint supplements explicit catalogue review; it is not treated as a complete semantic proof. Catalogue changes require both review and tests.

The current F1TENTH evidence contract has no measured braking channel. No braking-behavior template is present. Deceleration must not be relabeled as measured brake application.

## Provider boundary

`requestPostSessionCoaching` requires a sealed session identifier, SHA-256 digest, UTC seal time, bounded evidence, and an injected transport. This contract module has no transport or credential handling of its own, and its tests use an in-memory fake transport. The separate server-only runner `server/runApprovedVerification.ts` (added later) supplies a bounded Nebius Token Factory transport for one-shot, approved calls; see "How Nemotron and Token Factory are used" in the README. The browser never calls a provider.

Nebius account, model, endpoint, credentials, spending, outbound data, judge access, hosting, deployment, and publication remain explicit owner decisions.
