# Anthill Signal Emitter — Implementability Gap Report

> **Historical review — still current.** The Anthill spec is unchanged at v0.1.3; the entire report (including the three blockers GAP-01/02/03) was re-verified accurate on 2026-06-12. See [`finding-disposition-index-2026-06.md`](finding-disposition-index-2026-06.md) (FDI-ANT-010, FDI-ANT-001) for current status. Preserved unmodified as historical evidence.

**Date:** 2026-06-10
**Agent:** dillweed.protocol-steward
**Mode:** review-and-recommend (read-only)
**Exercise:** Engineer at a third-party company operating a DillClaw Resolver, asked to
implement conformant Anthill signal emission
**Permitted inputs (per exercise constraint):** `specs/anthill-spec.html` (v0.1.3) and
`anthill/README.md` (reference implementation v0.1.4) — no other stack documents, no
source code

---

## Verdict

**No — a conformant signal emitter cannot be implemented from these two documents.**

What *can* be built is a best-effort emitter that interoperates with the v0.1.4
reference implementation — but only because that implementation under-enforces the
spec (it does not verify signatures, accepts any non-empty nonce string, and accepts
any payload shape). Interoperating with a lenient server is not conformance. Strict
conformance to the §4 MUSTs is impossible today for three independent, blocking
reasons: the per-class payload schemas do not exist (GAP-01), the canonical
serialization under the mandatory `node_signature` is undefined (GAP-02), and the node
key registration procedure lives in a document section that the spec itself says has
not been drafted (GAP-03).

To the spec's credit, roughly half the gaps below are explicitly self-disclosed in
Appendix A (notably A.11, which the spec calls "the largest single deferred work item").
The report distinguishes acknowledged gaps from unacknowledged ones; both still block
or impair implementation.

---

## What the documents DO specify adequately

For fairness, an emitter engineer gets real value from these documents:

- **Envelope field list** (§4): nine metadata fields, named, with one-line semantics.
- **Timestamp format** (§4, README): RFC 3339 UTC, second precision, `Z` offset, no
  fractional seconds — precise and consistently stated in both documents.
- **Severity enum** (§4): INFORMATIONAL / ADVISORY / WARNING / CRITICAL.
- **Replay-protection semantics conceptually** (§4): globally unique nonce, strictly
  increasing per-node sequence, rejection behavior, and the rationale for global nonce
  scope.
- **Window assignment per class** (§5, README): 60s for ANT-DN/ANT-RA, 1h for ANT-RC,
  24h for ANT-TC/ANT-WF/ANT-EC — consistent across both documents.
- **Privacy MUSTs** (§8): no agent identity, no end-user data, no invocation content.
- **Reference-implementation HTTP surface** (README only): endpoint table, a concrete
  curl example, required-field list, and documented error codes
  (`409 NONCE_COLLISION`, `409 SEQUENCE_VIOLATION`, `500 STORAGE_FAULT`, `201`).
- **Honest limitation notes**: timestamp-integrity caveat (§8), local-trust-root
  advisory (README), unverified-signature disclosure (A.11).

Everything else an emitter needs is missing, ambiguous, or in another document.

---

## Blockers (conformant implementation impossible)

### GAP-01 — `signal_payload` schemas do not exist. *(Unacknowledged as a gap)*
§4 defines `signal_payload` as "class-specific structured data **as defined in the
per-class schema**." No per-class schema appears anywhere in the spec or README, for
any of the six classes. The README's single example (`{"detail": "...",
"drift_delta": 0.12}` for ANT-TC) is illustrative, not normative — `drift_delta` is
defined nowhere. For ANT-EC I cannot know whether to send raw invocation counts,
provider shares, or time-bucketed histograms; for ANT-RC I cannot know how to encode
propagation latency or completeness. Every payload I construct is a guess that a
future schema will invalidate. This also makes the §8 data-minimization MUST
unverifiable: "minimum identifying information necessary" cannot be assessed against
an undefined schema.
**Needed:** a normative JSON Schema (or equivalent) per signal class.

### GAP-02 — Canonical serialization and encoding of `node_signature` undefined. *(Partially acknowledged in A.11)*
§4 requires an Ed25519 signature "over the canonical serialization of all preceding
fields," and requires it to cover `signal_nonce` and `node_sequence`. But:
- **"Canonical serialization" is never defined.** Key order? Alphabetical or the §4
  list order? JSON with no whitespace? Is the serialization the same nested-JSON
  problem the stack has elsewhere — and if so, how are nested `signal_payload` objects
  ordered? Nothing is stated.
- **"All preceding fields"** presumably means the eight fields listed before
  `node_signature`, but `capability_ref` is "if applicable" — omitted or null when
  absent? Signature verification will diverge on exactly this kind of detail.
- **Signature wire encoding is unspecified** — base64? base64url? hex? A version
  prefix? (The signal example in the README omits `node_signature` entirely, so there
  is not even an example to imitate.)
A.11 discloses that the reference implementation stores but does not verify the field
— which means I also cannot discover the expected serialization empirically by testing
against the reference server.
**Needed:** a canonical-serialization rule (field set, ordering, whitespace,
absent-field handling, nested-object rule) and a signature encoding format.

### GAP-03 — Node key registration procedure does not exist. *(Acknowledged, A.11)*
§8 says key registration "follows the procedure defined in the DNSO Operations
Charter" — a document outside my permitted inputs, and A.11 concedes the dependent
section is "§-tbd … not yet drafted." Without a registration procedure there is no way
to make my node's signatures verifiable, no defined key rotation, and no registered-key
store. A.11 also concedes the consequence plainly: until this lands, **any party
knowing my node identifier and current sequence number can impersonate my node**, and
the aggregation layer cannot detect it. As an operator whose signals "may become
evidence in subsequent governance review" (A.7) — and where a CRITICAL ANT-RA can lead
to suspension or decertification (§7) — emitting into a system where I can be
impersonated without detection is a governance risk I must flag to my own management,
not just an implementation inconvenience.
**Needed:** the Operations Charter registration procedure, plus Anthill-side
verification semantics and error codes.

### GAP-04 — No production aggregation endpoint, and no credential issuance path. *(Partially acknowledged)*
The spec never states where a third-party resolver sends signals in the canonical
deployment, and the README's trust-root section makes clear a locally-installed
Anthill is a private namespace, not the canonical plane. The only authentication
mechanism documented anywhere is `ANTHILL_ADMIN_TOKEN` — a single shared **admin**
bearer token, explicitly scoped "for local reference use only." There is no described
way for an external node operator to obtain a submission credential for a DNSO-operated
aggregation endpoint. As of these documents, my emitter has nowhere to emit *to*.
**Needed:** canonical endpoint discovery and a per-node credential issuance model
(which presumably converges with GAP-03's key registration).

---

## Major gaps (implementable only by guessing; guesses carry governance risk)

### GAP-05 — Retry semantics can convert a network fault into an abuse accusation. *(Unacknowledged)*
§4: a reused nonce MUST be rejected **and MUST generate a CRITICAL-severity ANT-RA
signal naming the offending node**. Now consider the standard distributed-systems
case: I POST a signal, the server accepts it (201), but the response is lost to a
timeout. At-least-once delivery says retry. Retrying with the same nonce brands my
node with a CRITICAL ANT-RA — the severity tier that pages the DNSO steward within 4
hours (§6) and sits on the suspension/decertification path (§7). Retrying with a
*fresh* nonce double-counts the observation. There is no idempotent-acknowledgment
mechanism ("this exact signal was already accepted; 200 OK") that every comparable
ingestion API provides. Related sub-ambiguity: after `500 STORAGE_FAULT` (README:
logged to JSONL but not inserted to SQLite), is the nonce consumed? If uniqueness is
enforced against the accepted store, a same-nonce retry succeeds; if against the
ingestion log, it triggers the replay accusation. The two documents do not say.
**Needed:** idempotency semantics — at minimum, "byte-identical resubmission of an
accepted signal returns success without an ANT-RA."

### GAP-06 — `node_sequence` lifecycle undefined. *(Unacknowledged)*
Strictly increasing per node — but: starting value (0 or 1)? Must it persist across
emitter restarts (clearly yes in effect, since the server remembers the last accepted
value — but the spec never says so)? What is the recovery path after state loss on
*either* side? There is no endpoint to query "last accepted sequence for my node," so
an emitter that loses its counter is permanently locked out with `409
SEQUENCE_VIOLATION` until a human intervenes — by a procedure that doesn't exist. Also
unstated: whether a *rejected* signal consumes its sequence number (the §4 wording
"last **accepted** sequence number" implies no, but only by close reading).
**Needed:** sequence initialization, persistence requirement, gap tolerance, and a
recovery/reset procedure.

### GAP-07 — Severity assignment is the emitter's job, with no assignment criteria. *(Unacknowledged)*
§4 makes `severity` a field the node supplies; §5 says severity thresholds "are
operational parameters maintained by the DNSO" — and A.3 concedes those parameters
have no publication format and are not published. So I must stamp each signal
INFORMATIONAL/ADVISORY/WARNING/CRITICAL with no normative criteria for any class. The
stakes are asymmetric: a node-supplied CRITICAL obligates steward acknowledgment
within 4 hours (§6) — meaning, as written, any emitter can page the DNSO at will — and
under-rating severity invites exactly the suppression suspicion A.7 describes.
**Needed:** per-class severity assignment guidance, or a statement that nodes emit
observations at a fixed severity and escalation is computed at aggregation.

### GAP-08 — Emission triggers and division of responsibility per class are undefined. *(Partially acknowledged in A.5/A.10)*
What event, threshold, or pattern obligates my resolver to emit each class? ANT-DN's
"patterns consistent with circumventing attestation requirements" and ANT-WF's
"resolution volume patterns that suggest machine-driven discovery" are detection
*outcomes*, not detection *rules* — and A.5 concedes ANT-DN currently conflates
adversarial probing with LLM hallucination of paths, with the distinguishing field
(`lookup_failure_class`) deferred to a future revision. §8 says ANT-TC and ANT-EC are
"most accurately generated from Registry-side analysis" — so should my resolver emit
them at all, or never? Is an emitter that sends zero signals conformant? (Nothing says
otherwise; A.6 concedes silence is currently indistinguishable from health.) Also
unstated: whether one observation = one signal, or whether nodes batch/sample
(rate-limit guidance is absent; a busy resolver naively emitting per-event ANT-WF
observations would itself look like a fanout anomaly).
**Needed:** per-class emitter obligations: which origin emits, on what trigger, at
what granularity, with what batching/sampling rules.

### GAP-09 — Two contradictory authentication models. *(Unacknowledged as a contradiction)*
Spec §8: submissions "over HTTPS using Ed25519 signatures generated by the submitting
node's registered key." README: HTTP on 127.0.0.1 with an optional shared bearer
token, and `node_signature` not even in the required-fields list. These are different
authn architectures, and the documents never reconcile them. Worse, the shared token
model contradicts §5's isolation claim ("No resolver node has visibility into the
aggregate signal picture"): the same admin token that lets my node POST `/signal` also
grants GET `/signals` — full read access to every node's identified signals. In any
multi-operator deployment using the documented token model, every emitter can see the
whole picture.
**Needed:** a submission-scoped credential distinct from read/admin access, and an
explicit statement of which authn model is normative.

---

## Minor gaps and ambiguities

| # | Item | Detail |
|---|---|---|
| GAP-10 | `signal_nonce` encoding | Spec: "128-bit value," wire format unstated. README: accepts any non-empty string; future profile "may require UUID or **32-byte hex**" — 32 bytes is 256 bits, contradicting the spec's 128-bit definition (16 bytes / 32 hex chars). The README example placeholder says "128-bit random hex." Three signals, two sizes. |
| GAP-11 | `originating_node` format | No naming rules, length limits, uniqueness scope, or assignment authority. README example `dillclaw-node-001` is the only guidance. Identity is self-declared (ties to GAP-03). |
| GAP-12 | `capability_ref` applicability | "If applicable" per class is never enumerated; omit-vs-null unstated (matters for GAP-02 signing). |
| GAP-13 | HTTP contract is README-only | The spec defines **no API surface at all** — no paths, methods, status codes, content types, or size limits. The entire wire contract (`/signal`, `409` codes, `201`) exists only in the README of one implementation, which is not a normative document. The 256 KB-vs-unstated body limit, rate limits, and `400` validation behavior are all undocumented. |
| GAP-14 | No protocol/spec version field in the envelope | An emitter cannot declare which revision it implements; nothing supports negotiation when payload schemas (GAP-01) eventually land. |
| GAP-15 | ANT-RC requires external documents | Computing "beyond the revocation propagation bound" requires Registry Spec §10.1 and DillClaw Spec §7.5 — both outside the permitted inputs. The Anthill spec does not restate the bound. |
| GAP-16 | Operational parameters unpublished | §5/§8 defer windows-tuning, thresholds, and correlation rules to DNSO-maintained parameters; A.3 concedes there is no publication format or fetch mechanism. Emitters cannot read the parameters they are implicitly graded against. |
| GAP-17 | Version-reference looseness | README links "Specification v0.1," implements service v0.1.4, against spec document v0.1.3. Harmless but forces the integrator to guess which text governs. |
| GAP-18 | Heartbeats absent | A.6 (acknowledged): no liveness mechanism exists, so a conformant emitter cannot distinguish itself from a dead one. Informational for now. |

---

## Summary table

| Category | Count | IDs |
|---|---|---|
| Blockers — conformance impossible | 4 | GAP-01, 02, 03, 04 |
| Major — implementable only by guessing, with governance risk | 5 | GAP-05, 06, 07, 08, 09 |
| Minor / ambiguities | 9 | GAP-10 … GAP-18 |
| Of the above, self-acknowledged in spec (full or partial) | 7 | 02, 03, 04, 08, 16, 18 (+05's neighborhood via A.7) |

The single highest-leverage observation: **GAP-01, GAP-02, and GAP-13 together mean the
spec currently specifies *why* signals exist and *what metadata wraps them*, but neither
*what they contain* nor *how they travel*.** The conceptual architecture (taxonomy,
windows, governance cadences, response protocols) is the most complete part of the
document; the wire protocol an emitter actually codes against is the least.

## What I would ask the DNSO before writing any code

1. Publish per-class `signal_payload` JSON Schemas (GAP-01) — nothing else matters
   until this exists.
2. Define canonical serialization + signature encoding for `node_signature`, with test
   vectors (GAP-02).
3. Land the Operations Charter key-registration procedure, or publish an interim one
   (GAP-03/04/09/11).
4. Add idempotent resubmission semantics so retries are not abuse-flagged (GAP-05), and
   a sequence-recovery procedure (GAP-06).
5. State per-class emitter obligations and severity-assignment rules, or move severity
   to the aggregation layer (GAP-07/08).
6. Promote the HTTP contract from README to spec, with a version field in the envelope
   (GAP-13/14).
7. Resolve the 128-bit vs "32-byte hex" nonce inconsistency (GAP-10).

## Interim recommendation for my (hypothetical) employer

Defer production integration. If strategic interest justifies early work, build a
thin emitter behind a feature flag targeting the v0.1.4 reference implementation:
hex-encoded 128-bit nonces, persisted sequence counter starting at 1, severity fixed
at INFORMATIONAL, payloads kept to a minimal `{"detail": ...}` shape, and an
exactly-once outbox with manual reconciliation on timeout (because of GAP-05, never
auto-retry). Treat every payload as throwaway until schemas publish, and do not sign
(the field is unverified and the serialization undefined — a stored-but-wrong
signature today may read as a failed verification after A.11 lands). Track Appendix A:
the spec's own roadmap (A.2, A.3, A.5, A.11) covers most blockers, which suggests the
gaps are sequencing, not blindness.

---

*Produced under capabilities `review.spec.read`, `review.repo.read`, and
`review.report.write`, all boundary-allowed and DillClaw-verified this session.
Analysis used only the two permitted documents; references to other stack documents
appear only where the spec itself cites them, flagged as external dependencies.
No project artifacts were modified.*
