# Potential Research Areas for the Dillweed Namespace Project

**Status:** Living document — invitation to independent research
**Date:** 2026-06-12
**Applies to:** Repository state at v1.0.0 baseline (Registry 0.2.8, DillClaw Resolver 0.1.8, Anthill 0.1.6, post-W0 hardening) and specification stack Namespace Standard v0.4.4, Registry v0.1.6, DillClaw v0.1.8, Anthill v0.1.3, Governance Framework v1.1.3, Continuity Protocol v1.0.3, DNSO Operations Charter v1.0.3
**Repository:** https://github.com/Dillweed-Namespace/dillweed-namespace
**Public specifications:** https://www.dillweed.com/standards-overview.html

---

## Abstract

The Dillweed Namespace Project is an open research artifact exploring a single hypothesis: that agentic AI systems operating across organizational boundaries may need a neutral **capability-standing layer** — infrastructure that can answer, for any named, invocable capability: *What is being invoked? Who registered and governs it? Is its record cryptographically signed? Is it current? Has it been revoked? What constraints apply? Has its operational state changed? Can the resolution decision be reproduced and audited later? Can the trust chain survive organizational, model, or infrastructure change?*

The project does **not** claim these questions are solved, or even that they require a new layer to solve. It provides a specification stack, a working single-host reference implementation with passing conformance and integration test suites, an unusually candid corpus of self-critical architecture reviews and gap reports, and a v2 design that itself concedes major v1 mechanisms must be replaced. External adoption and independent validation are, at the time of writing, essentially zero — a fact the project's own strategic evaluation states plainly.

This document is written for university faculty, graduate students, undergraduate research groups, security laboratories, standards researchers, and interdisciplinary scholars. It identifies research questions that can be pursued *using* the project — including questions whose honest answer may be that the proposed layer is unnecessary, redundant with existing standards, institutionally illegitimate, or harmful. Critique, replication, comparison, extension, and falsification are all in scope. Negative findings are explicitly valuable and explicitly invited.

Intended audiences include researchers in distributed systems, cybersecurity, applied cryptography, AI agents and multi-agent systems, identity and access management, trustworthy AI, runtime governance, software supply-chain security, Internet architecture, service discovery, observability, formal methods, public-interest technology, digital sovereignty, technology policy, standards and protocol design, human-computer interaction, and science and technology studies.

---

## 1. Research Context

### 1.1 The problem the project attempts to address

When an AI agent invokes an external capability — a tool, an API, another agent — today's infrastructure answers some questions well and others not at all. Transport security (TLS), workload identity (SPIFFE/SPIRE), authorization (OAuth scopes, IAM, policy engines), artifact provenance (Sigstore, package registries), and generic observability (OpenTelemetry) are mature. What no existing system answers as a compound question is what the project's documents call **capability standing**: whether a *named, running* capability is what it claims to be, who vouches for it, whether that vouching is current or revoked, what governance applies, and whether the resolution decision can be independently verified and reconstructed after the fact.

Whether that compound question is (a) real, (b) presently live, and (c) best answered by a new namespace layer rather than a profile of existing standards is the project's central, unproven hypothesis. The project's own strategic evaluation (`docs/strategic-evaluation-2026-06-12.md`, §2–§3) classifies the problem as "a genuinely missing layer at the spec level; a premature abstraction at the operate-production-infrastructure level," and identifies vendor-consolidated platform registries as the most probable near-term path that would render a neutral layer unnecessary. Researchers should treat all three claims — the gap, its timing, and the architectural response — as open questions.

### 1.2 Conceptual distinctions the project asserts

The project's framing depends on distinctions that themselves merit scrutiny:

- **Capability discovery** — learning what capabilities exist (catalogs, MCP server registries, A2A agent cards).
- **Capability identity** — establishing that a named capability is a specific, versioned thing (the Capability Record schema, Registry Spec §3).
- **Capability standing** — the governed, current, revocable, attested status of that identity: trust tier, revocation state, signature validity, audit history.
- **Authorization** — whether a specific caller may invoke it (explicitly out of scope; Registry Spec §11.2 "What the Registry Does Not Secure").
- **Execution governance** — runtime policy over what an agent actually does (also out of scope; the Namespace Standard §9 positions the resolver outside the invocation path).

A core research question (Theme A) is whether "capability standing" survives as a distinct concept or collapses into combinations of the others.

### 1.3 The components and how they relate

- **Registry** (`registry/`) — the authoritative store of Capability Records. Signs every active record with a single DNSO Ed25519 key; exposes `/register`, `/revoke`, `/promote`, `/lookup`, `/verify`, `/list`, `/log`. Soft-delete revocation with mandatory reasons (Registry Spec §8); append-only registration log (§6.2); trust-tier governance (§9).
- **DillClaw Resolver** (`resolver/`) — fetches records from a Registry, caches with TTL and stale-while-revalidate (DillClaw Spec §7), verifies signatures locally against the published DNSO public key, applies a trust-evaluation pipeline producing a composite trust score (§6.2), and persists a `trace_id`-keyed resolution trace for every request (the `resolver/traces/` corpus).
- **Anthill** (`anthill/`) — a proposed observability plane for governance-relevant signals, defining a six-class signal taxonomy (ANT-TC trust-tier drift, ANT-RC revocation cascade, ANT-DN deceptive namespace paths, ANT-RA resolver abuse, ANT-WF wildcard fanout, ANT-EC ecosystem concentration), with nonce + node-sequence replay protection. The project's own comparative review (`docs/anthill-vs-observability-stack-2026-06-10.md`) concludes Anthill is "the wrong shape" and should re-layer on OpenTelemetry.
- **Continuity Protocol** (`specs/continuity-protocol.html`) — succession and key-custody procedures intended to let the trust chain survive the death, incapacity, or exit of the single founding steward, including a "licensed neutral operator" model (§10).
- **Governance framework** (`specs/governance.html`) and **DNSO Operations Charter** (`specs/dnso-operations-charter.html`) — a founding-steward governance phase with described (but not constituted) future bodies: a Technical Steering Committee and a Participant Council.
- **Trust root** — a single Ed25519 keypair. The public key is published at `https://dillweed.com/dnso_public.pem` (SHA256 pinned in `README.md`); the private key signs every record. There is no delegation, no intermediate, and no transparency log in v1 — limitations the project's own reviews identify as the central architectural defect (`docs/strategic-evaluation-2026-06-12.md` §4; `docs/architecture-review-registry-vs-existing-infrastructure-2026-06-10.md`).
- **MCP adapter** (`mcp-server/`) — exposes `dillweed_lookup`, `dillweed_resolve`, `dillweed_verify`, and `dillweed_health` as Model Context Protocol tools, the project's main integration with the existing agent-tool ecosystem.

### 1.4 What the v1 reference implementation demonstrates

Verifiable at the v1.0.0 release baseline (`README.md`, `PROJECT_LEDGER.md`):

- A full register → resolve → verify → revoke → propagation lifecycle passing a 19-test integration suite (`integration-test.sh`).
- Per-component conformance suites (Registry 79/79 at v1 baseline; Resolver 65 integration + 29 unit; Anthill 58/58).
- Local signature verification by relying parties against a published key, without trusting the Registry at resolution time.
- Persisted, reproducible resolution traces including on error paths.
- A W0 hardening wave shipped post-v1 (ETag/304 conditional reads, SQL-level pagination, per-IP rate limiting, SSRF deny-list with host pinning for liveness probes, refresh jitter/backoff, indexed tag filters — see `v2-tracker.md`).

### 1.5 What remains incomplete or intentionally deferred

Documented in the project's own corpus, not inferred:

- **Identity is a shared secret.** One bearer token gates all Registry writes; `caller` and `originating_node` are unauthenticated strings (v2 design Area 1; trust-boundary findings F-3, F-6).
- **Anthill never verifies `node_signature`** — the stack's one open CRITICAL finding (F-3, `docs/cross-service-trust-boundary-analysis-2026-06-10.md`).
- **Mirror mode is unimplemented.** `REGISTRY_MODE=mirror` rejects writes and echoes env vars; no sync protocol exists (`docs/registry-mirror-deployment-gap-report-2026-06-10.md`: "no happy path at all").
- **Self-declared trust tiers are scored at face value** (F-2; Charter §4 provisional-tier behavior) — the headline trust signal is currently unverified self-assertion carrying a DNSO signature.
- **Append-only logs are conventions, not proofs** — no hash chaining, Merkle structure, or signed checkpoints (v2 design Area 6).
- **Canonical serialization is JavaScript-specific**; RFC 8785 (JCS) migration is planned but not done (ledger AI-007; spec-gap REG-01/02).
- **Resolver score determinism is not achievable as specified** (resolver review S4; spec-gap RES-12/13).
- **88 specification gaps, 9 of them blockers for a second implementation** (`docs/spec-gap-report-2026-06-10.md`).
- Public production deployment is gated on Issue #2; the v2 roadmap (Issue #4, `docs/dillweed-v2-design-2026-06-10.md`) is design, not implementation, beyond W0.

---

## 2. How Researchers Can Use the Project

The project is usable today as a research artifact in at least the following ways:

1. **Deploy the reference stack** locally (single-host; macOS installers, Linux anticipated) and exercise the full lifecycle.
2. **Reproduce its tests** — component suites plus `integration-test.sh` — and report divergence from the published pass counts.
3. **Challenge its assumptions** — that capability standing is distinct, that a neutral root is needed, that resolution traces matter, that revocation propagation is a real operational problem.
4. **Compare it with existing systems** — DNS/DNSSEC, PKI/CT, TUF, Sigstore, SPIFFE, OAuth/OIDC, package registries, MCP/A2A registries, service discovery.
5. **Construct adversarial scenarios** against the documented threat surface (the F-1…F-11 findings are a ready-made starting catalog).
6. **Propose alternative architectures** — federated roots, transparency-log-only designs, profiles of existing standards with no new namespace at all.
7. **Measure performance and consistency** — revocation propagation latency, cache staleness windows, fleet sync cost, score reproducibility.
8. **Analyze the governance and institutional model** — a fully documented founding-steward arrangement with succession instruments is itself a study object.
9. **Create independent implementations** from the specifications alone, using `docs/spec-gap-report-2026-06-10.md` as a falsification log for spec completeness.
10. **Identify reasons the proposed layer may be unnecessary** — empirical, economic, or architectural.

A finding that the layer is redundant, that the trust model is unsound, or that a documented mechanism fails under test is a *useful result* and squarely within the intended use of the artifact. The project's milestone scorecard (Namespace Standard, "What Must Be Demonstrated") explicitly lists external validation milestones as PENDING; independent negative results are part of how those questions get answered honestly.

---

## 3. Research Themes

Each theme below lists: motivation, core questions, methods, relevant components/documents, example projects, expected contribution, difficulty, disciplines, prerequisites, and known project limitations affecting the work.

### Theme A — Capability standing as a distinct systems concept

**Motivation.** The project's entire justification rests on the claim that "capability standing" is not reducible to service discovery, identity, authorization, attestation, policy enforcement, execution governance, package provenance, or supply-chain trust. This claim has never been tested outside the project's own documents.

**Core questions.** Is the compound standing question (identity + governance + currency + revocability + auditability for *live endpoints*) genuinely unanswered by existing systems, or answerable by composing them? Is "standing" a coherent concept, or a bundle that decomposes under analysis? Could it be expressed as a profile of X.509 + CT + TUF + OIDC with no new namespace? Under what deployment topologies (single trust domain vs. cross-organization) does the distinction carry weight? Does the witness-vs-endorsement conflation in v1 (the DNSO signature attests acceptance, not vetting — Charter §4) show the concept is unstable even within the project?

**Methods.** Conceptual analysis; systematic mapping against existing standards (RFC-by-RFC); case-study decomposition of real incidents; construction of a minimal counter-architecture using only existing standards.

**Relevant materials.** Namespace Standard §1–§2 ("The Coordination Problem", "Registry vs. Namespace"); `docs/architecture-review-registry-vs-existing-infrastructure-2026-06-10.md`; `docs/strategic-evaluation-2026-06-12.md` §2, §5.

**Example projects.** A taxonomy paper mapping each standing sub-question to the existing standard(s) that answer it, with a gap matrix; a seminar exercise building "standing without Dillweed" from CT + TUF + OIDC and evaluating what is lost.

**Expected contribution.** Either a sharpened definition that survives challenge, or a demonstration that the concept is a profile of existing work — both publishable.

**Difficulty.** Moderate (conceptual; low infrastructure needs). **Disciplines.** Internet architecture, standards, security, STS. **Prerequisites.** Familiarity with PKI, CT, TUF, OIDC. **Limitations affecting the work.** The project's own definitions shifted across spec revisions; cite spec versions precisely.

### Theme B — Cross-vendor agent interoperability and trust

**Motivation.** The project's strongest supportive scenario (strategic evaluation, Scenario B) is multi-vendor enterprise agents invoking tools across trust domains. Whether agents from different providers can actually use a shared standing layer — and whether they need one — is untested.

**Core questions.** How do MCP clients, A2A agents, and vendor control planes currently establish (or fail to establish) trust in external capabilities? Can the `mcp-server/` adapter mediate standing checks for heterogeneous agent runtimes without modifying them? What happens at trust-domain boundaries: who picks the resolver, whose policy wins, how are conflicts surfaced? Do vendor-curated catalogs already provide adequate standing within their walls, making a neutral layer relevant only at the seams?

**Methods.** Multi-runtime testbed (two or more agent frameworks invoking the same capability set through and around the resolver); protocol analysis of MCP registry and A2A agent-card trust semantics; failure-injection experiments (revoke mid-workflow, rotate keys mid-workflow).

**Relevant materials.** `mcp-server/server.js` and `mcp-server/README.md`; DillClaw Spec §5 (API), §3.3 (resolution guarantees); Namespace Standard §5.2 (interoperability).

**Example projects.** A cross-vendor MCP resolution experiment: N agents, M tool providers, capabilities registered/revoked during workflows; measure whether standing checks change agent behavior. A comparative study of trust semantics in the official MCP registry ecosystem vs. Dillweed records.

**Expected contribution.** First empirical data on whether cross-vendor standing checks are usable and useful.

**Difficulty.** Moderate–high. **Disciplines.** AI agents/multi-agent systems, distributed systems, security. **Prerequisites.** Reference stack deployed; one or more MCP-capable agent runtimes. **Limitations.** The MCP adapter is the only protocol bridge; A2A integration does not exist and would need to be built; no second Registry implementation exists.

### Theme C — Registry and Resolver architecture

**Motivation.** v1 is a single-writer SQLite Registry with full-catalog polling resolvers; v2 proposes signed checkpoints, delta sync by cursor, and verifiable mirrors (v2 design Area 2). None of the v2 sync architecture is implemented or independently evaluated.

**Core questions.** What consistency model does the stack actually provide (and what should it)? How do signed snapshot checkpoints + delta feeds compare with full-poll, gossip, or watch-based designs for revocation propagation and bandwidth at fleet scale? What are the failure-recovery semantics of mirrors that can prove freshness only via re-presented checkpoints? Does stale-while-revalidate (DillClaw §7.3) admit exploitable windows (F-7)? How does the fleet behave on Registry restart (thundering herd) with and without W0 jitter? Can resolution be made deterministic across a distributed fleet at all?

**Methods.** Simulation (discrete-event models of N resolvers × change rates); emulated deployment (containerized fleet); implementation of the proposed v2 sync protocol as an independent artifact; chaos/partition testing.

**Relevant materials.** Registry Spec §2.2, §6, §10.3; DillClaw Spec §7; `docs/architecture-review-registry-2026-06-10.md` (S1–S3); `docs/registry-mirror-deployment-gap-report-2026-06-10.md` (G-1…G-18); v2 design Area 2.

**Example projects.** Implement and benchmark the v2 delta-feed/checkpoint protocol against the v1 full-poll baseline at 10/100/1,000 simulated resolvers; a consistency-model formalization of the Registry/mirror/resolver triangle.

**Expected contribution.** Empirical and formal grounding (or refutation) of the v2 sync design before it ships.

**Difficulty.** Moderate–high. **Disciplines.** Distributed systems. **Prerequisites.** Systems programming; the v2 design doc as protocol sketch. **Limitations.** Mirror mode has no implementation to test against — researchers building it are effectively co-designing it; document divergences as findings.

### Theme D — Cryptographic trust and key management

**Motivation.** v1 signs everything with one online root key loaded into the public HTTP process — a posture the project itself calls structurally unacceptable (v2 design Area 5). The proposed remedy (offline root, online intermediate, TUF-style rotation metadata, HSM custody) is a design, not an implementation.

**Core questions.** Is the signed-field selection sound (the unsigned `registration_date` forgery F-1 says no for v1)? Can the JavaScript-specific canonical serialization be replaced by RFC 8785 without breaking historical signatures, and what is the correct dual-signature transition? What key hierarchy and threshold scheme fits a namespace whose root must survive steward death (Continuity Protocol §3–§4)? How should catalog-wide re-signing under emergency rotation be scheduled (Charter §5.3)? Would a transparency log (RFC 6962/Rekor) remove the need to trust the Registry at all, and is the right design "publish into Rekor" rather than "build a log"?

**Methods.** Cryptographic protocol analysis; implementation of the JCS migration with cross-language byte-equivalence tests (the ledger's RS-003 methodology is reusable); key-ceremony design and rehearsal; integration prototype with an HSM/KMS and with Sigstore.

**Relevant materials.** Registry Spec §5 (signing model, §5.2 canonical JSON, §5.5–§5.6 custody/rotation); Charter §5; v2 design Areas 5–6; ledger items AI-007, AI-008; trust-boundary F-1.

**Example projects.** Independent cryptographic review answering the ledger's AI-008 questions A–D; a prototype that mirrors all Registry log entries into a public Rekor instance and measures what verification properties this adds.

**Expected contribution.** The specialist cryptographic scrutiny the project has never had (its three review rounds per component were generalist AI reviews, per ledger AI-008).

**Difficulty.** High. **Disciplines.** Applied cryptography, security. **Prerequisites.** Ed25519, canonicalization, PKI/CT/TUF literacy. **Limitations.** A development private key has existed in working trees (`registry/keys/`); treat all published keys as test material, never as a production root.

### Theme E — Trust-score semantics

**Motivation.** The Resolver computes a composite scalar trust score (DillClaw §6.2) used for selection and tie-breaking, with consumer guidance in §6.4. The project's own reviews show the score is currently neither reproducible (RES-12/13: wall-clock, liveness-state, and floating-point dependence) nor grounded (F-2: self-declared tiers scored at face value). Whether a scalar score should exist at all is open.

**Core questions.** Is a composite scalar useful, misleading, comparable across contexts, gameable, explainable, reproducible? What can an adversary do by optimizing inputs (tier self-declaration pre-W1, endpoint liveness, version recency)? Are structured alternatives better: evidence bundles without a scalar, confidence intervals, policy profiles, multidimensional trust vectors, context-specific rankings, formally defined risk measures? Should standing infrastructure *score* at all, or only *attest facts* and leave scoring to relying-party policy?

**Methods.** Sensitivity analysis of the documented score composition; adversarial optimization experiments; design and head-to-head evaluation of alternative representations; reproducibility measurement across resolver instances and time.

**Relevant materials.** DillClaw Spec §6.2–§6.4; `docs/architecture-review-resolver-2026-06-10.md` S4; spec-gap RES-12/13; trust-boundary F-2.

**Example projects.** An alternative trust-representation design (vector or evidence-bundle) implemented as a resolver fork and compared on decision quality and explainability; a gaming study quantifying score inflation achievable by a malicious registrant.

**Expected contribution.** Evidence for retaining, redesigning, or removing the scalar score — directly actionable for v2 and generalizable to other trust-scoring systems.

**Difficulty.** Low–moderate (analysis) to moderate (redesign). **Disciplines.** Security, ML/decision theory, HCI (pairs with Theme O). **Prerequisites.** Resolver deployed; spec §6 read closely. **Limitations.** Determinism is documented as unachievable as specified — baseline reproducibility measurements should expect and quantify this.

### Theme F — Identity, delegation, and authenticated operational actors

**Motivation.** v1 has no authenticated identity anywhere: one shared admin token for Registry writes, open resolver endpoints, unverified Anthill node signatures. The v2 Area 1 design proposes DNSO-rooted delegation records, dual signatures (registrant attestation + registry counter-signature), mTLS resolver certificates, and enrolled node keys — none implemented.

**Core questions.** What identity model fits registrants, resolver callers, resolver nodes, Anthill nodes, operators, delegated organizations, and automated agents respectively? Can SPIFFE/SPIRE identities, OIDC trusted publishing, and ACME-style name-control proofs be adopted directly rather than reinventing enrollment? How should credential rotation and revocation work for each actor class? Does delegation (orgs signing their own subtrees) cure the single-root centralization defect, and what does verification cost at depth? What is the correct migration sequencing from shared-token to fail-closed (the Area 1 Phase A–D plan)?

**Methods.** Protocol design and prototyping; integration prototypes (SPIRE agent issuing resolver identities; OIDC trusted publishing for registration); formal analysis of the delegation chain; migration-path simulation.

**Relevant materials.** v2 design Area 1; Registry Spec §7, §11.1, Appendix A.1–A.2; Anthill Spec §4 and A.11; Charter §4 (DNS-TXT identity verification); trust-boundary F-2/F-3/F-4/F-5/F-6.

**Example projects.** A SPIFFE-integration prototype where resolver↔registry sync authenticates via SPIRE-issued SVIDs; an implementation of delegation records with threshold keys and an evaluation of revocation blast radius at each hierarchy level.

**Expected contribution.** Working evidence on whether the v2 identity keystone is buildable from existing standards — the single highest-leverage technical question in the project per its own design doc.

**Difficulty.** High. **Disciplines.** IAM, security, distributed systems. **Prerequisites.** SPIFFE/OIDC/mTLS experience. **Limitations.** Everything in this theme is proposal, not implementation; prototypes will diverge from whatever v2 eventually ships.

### Theme G — Revocation and freshness

**Motivation.** The project's own strategic evaluation identifies revocation of third-party tools as "the single most presently-valuable piece of the stack." The tension between cache efficiency and revocation speed is documented (DillClaw §7.5) but its parameter space is unexplored.

**Core questions.** What revocation propagation latency do realistic deployments achieve under TTL + stale-while-revalidate, and how does it degrade under Registry unavailability or an on-path adversary (F-7)? What are the right semantics for force-refresh, maximum stale windows, and offline operation? Can freshness *proofs* (signed checkpoints with bounded age) give high-assurance callers a verifiable staleness bound rather than a configuration promise? Where on the performance/availability/consistency frontier should defaults sit for different risk tiers, and should the record itself carry its required freshness class?

**Methods.** Measurement on the reference stack (the 19-test lifecycle in `integration-test.sh` includes revocation propagation and is a reusable harness); parameter sweeps over TTL/stale-window settings; adversarial delay injection; comparative analysis with CRL/OCSP/OCSP-stapling history.

**Relevant materials.** DillClaw Spec §7.2–§7.3, §7.5; Registry Spec §8; Charter §6; trust-boundary F-7; v2 design Areas 2 and 6 (checkpoints as freshness proofs).

**Example projects.** An empirical map of revocation-propagation latency vs. cache-hit ratio across the configuration space, at 10–1,000 simulated resolvers; a design and prototype of checkpoint-based freshness proofs with measured overhead.

**Expected contribution.** Quantified tradeoff curves that either validate the documented defaults or show they cannot meet high-assurance requirements (a result the hypothesis list below treats as live).

**Difficulty.** Low (measurement) to moderate (proof design). **Disciplines.** Distributed systems, security. **Prerequisites.** Reference stack; scripting. **Limitations.** Single-host v1 means multi-node results require simulation or independent fleet tooling.

### Theme H — Anthill observability and adversarial signal analysis

**Motivation.** Anthill is the stack's most contested component: spec'd as a governance-signal plane, reviewed internally as a misshapen parallel observability stack, and carrying the project's only open CRITICAL finding (F-3: node signatures stored, never verified). Its v2 direction — a semantic/trust layer over OpenTelemetry retaining only signature verification, Registry corroboration, and completeness attestation — is unbuilt.

**Core questions.** What should Anthill *be*: signal store, aggregation service, observability plane, anomaly detector, response system, or evidence infrastructure? How is authenticated attribution achieved, and what do reporter incentives look like — why would a resolver operator report honestly, and what do false reporting, collusion, and framing attacks (F-5: nonce-replay reflection auto-generating a CRITICAL ANT-RA against a victim) cost the system? How should thresholds and cross-signal correlation be designed against adversarial reporters? What does *signal absence* mean evidentially (the spec's heartbeat/ANT-HB material), and can per-window completeness attestations make suppression detectable? Can privacy-preserving telemetry coexist with evidentiary weight? How should the taxonomy map onto OpenTelemetry semantic conventions, Prometheus, and SIEM pipelines?

**Methods.** Adversarial simulation (honest/dishonest reporter populations, collusion fractions, threshold sweeps); mechanism-design analysis; prototype of the OTel re-layering; red-team exercises against the live ingestion endpoint.

**Relevant materials.** `specs/anthill-spec.html` (signal taxonomy, replay handling, aggregation, response protocols, Appendix items A.6/A.7/A.10/A.11); `docs/architecture-review-anthill-2026-06-10.md`; `docs/anthill-vs-observability-stack-2026-06-10.md`; `docs/anthill-signal-emitter-gap-report-2026-06-10.md`; trust-boundary F-3/F-4/F-5; v2 design Area 3.

**Example projects.** An adversarial Anthill simulation quantifying how many colluding reporters are needed to trigger each response class falsely; an OTel semantic-convention draft for the ANT-* taxonomy with test vectors.

**Expected contribution.** Either a viable adversarial-telemetry design — a genuinely under-researched area — or a demonstration that governance signals cannot be made evidence-grade at acceptable cost.

**Difficulty.** Moderate–high. **Disciplines.** Security, observability, mechanism design/game theory, distributed systems. **Prerequisites.** Anthill spec read; simulation skills. **Limitations.** The threshold/escalation engine specified in the Anthill spec does not exist in code; F-3 means the current implementation provides *no* authentication to study — adversarial work is necessarily against the spec'd design plus your own prototype.

### Theme I — Continuity and long-running agent workflows

**Motivation.** The Continuity Protocol addresses institutional continuity (steward succession, key custody transfer, standards-body migration). A broader research question sits behind it: how should capability state, authority, context, and evidence persist across model replacement, agent handoffs, organizational change, software upgrades, key rotation, infrastructure migration, and workflows that outlive all of these?

**Core questions.** Is continuity a protocol concern (signed state that survives operators), a governance concern (succession instruments), a state-management concern (durable workflow context), or necessarily all three? What happens to in-flight agent workflows during a trust-root rotation or registry migration — can resolution traces plus signed records actually reconstruct "what was true when the decision was made"? How should historical signatures be treated after key transfer (Continuity Protocol "Historical Signature Treatment")? Can the protocol's paper procedures be executed under realistic conditions — and what does a rehearsal reveal?

**Methods.** Tabletop and live rehearsal of the continuity procedures on a disposable deployment; longitudinal workflow experiments spanning forced key rotations and component upgrades; archival/records-management analysis of the trace and ledger corpus as evidence.

**Relevant materials.** `specs/continuity-protocol.html` (trigger conditions, key custody transfer, §10 licensed-neutral-operator model); Charter §5.2–§5.3; `PROJECT_LEDGER.md` (the strategic evaluation §8 notes continuity instruments documented but not fully executed); `resolver/traces/`.

**Example projects.** A continuity fire-drill study: execute the planned and emergency key-transfer procedures end-to-end on a test deployment, timing each step and logging every ambiguity in the protocol text; a study of trace-based decision reconstruction six months after the fact.

**Expected contribution.** The first execution evidence for a class of succession protocol that AI-infrastructure projects increasingly write but never test.

**Difficulty.** Low–moderate. **Disciplines.** Distributed systems, governance/STS, archival science, trustworthy AI. **Prerequisites.** Reference stack; careful reading of the continuity and charter documents. **Limitations.** The project's own continuity instruments are not fully executed; the protocol has never been exercised even by its author.

### Theme J — Formal methods and protocol verification

**Motivation.** The stack makes verifiable-sounding claims — append-only logs, replay resistance, deterministic resolution, revocation propagation bounds, key-rotation overlap safety — that are currently established by tests and prose, not models or proofs. Several are already known to be false as stated (determinism: RES-12/13).

**Core questions.** What are the actual invariants of the Registry state machine (register/revoke/promote with soft-delete and immutable re-registration)? Can revocation propagation under TTL + stale-while-revalidate be model-checked for a maximum-staleness bound? Is the nonce + node-sequence replay scheme sound, including the documented sequence-poisoning attack (F-4)? Does the proposed checkpoint/delta mirror-sync protocol preserve consistency under partitions and crash-recovery? Is the key-rotation overlap window (Charter §5.2) safe against split-trust states? Does the v2 delegation chain verify correctly under all expiry/revocation interleavings?

**Methods.** TLA+ or Alloy for state machines (registry lifecycle, cache states, mirror sync); ProVerif/Tamarin for the signing, replay, and rotation protocols; property-based testing (the conformance suites in `registry/test.sh`, `resolver/test.sh`, `anthill/test.sh` provide oracles); symbolic execution of the reference implementations against their specs.

**Relevant materials.** Registry Spec §6, §8, §5.6; DillClaw Spec §7; Anthill Spec replay-handling section; v2 design Areas 2, 5, 6; `docs/spec-gap-report-2026-06-10.md` (ambiguities are exactly where models will be underdetermined).

**Example projects.** A TLA+ model of revocation propagation proving (or refuting) a staleness bound under the spec'd cache rules — a self-contained master's thesis; a ProVerif model of the v2 dual-signature and delegation design before it is implemented.

**Expected contribution.** Machine-checked clarity on which guarantees the specs can actually make — and a list of spec ambiguities discovered as modeling blockers, each of which is a reportable finding.

**Difficulty.** Moderate–very high by target. **Disciplines.** Formal methods, security. **Prerequisites.** Tool experience; specs as the source of truth. **Limitations.** Specs have known gaps (88 catalogued); modelers must make and document interpretation choices, which is itself useful spec feedback.

### Theme K — Performance and scalability

**Motivation.** All published numbers come from one host. The architecture reviews identify specific cliffs (full-catalog polling, single SQLite writer, synchronous trace writes); W0 fixed some (pagination, ETag, jitter), but no independent benchmark exists at any scale.

**Core questions.** What are Registry throughput and Resolver latency under realistic mixes, and where are the cliffs as catalog size grows (10³–10⁶ records)? What is fleet sync load at 10/100/1,000/10,000 resolvers under full-poll vs. ETag/304 vs. (prototype) delta sync? How do batch and wildcard queries scale (wildcard expansion is cost-weighted in the v2 rate-limit design for a reason)? What are trace-storage growth rates (the repo's own 1,373-file corpus from one day of testing is a data point) and Anthill ingestion limits? What do multi-region deployments and failure-under-load look like, and what does the whole thing cost to run?

**Methods.** Load generation against isolated deployments (the project's own pattern: isolated ports, never production); containerized fleet emulation; storage-growth modeling; cost modeling on commodity cloud.

**Relevant materials.** Registry/Resolver/Anthill `server.js`; DillClaw Spec §7.4 (performance targets — testable claims); `docs/architecture-review-*.md` S-findings; `v2-tracker.md` (W0 measurements methodology).

**Example projects.** A reproducible benchmark suite published as an artifact: catalog-size × fleet-size × change-rate matrix for 10/100/1,000/10,000 resolvers (the largest tiers via emulation), reporting propagation latency, bandwidth, and Registry CPU; an undergraduate project measuring the §7.4 targets and reporting pass/fail.

**Expected contribution.** The project's first independent performance numbers; a benchmark others can rerun.

**Difficulty.** Low (single-node) to high (10k emulation). **Disciplines.** Distributed systems, performance engineering. **Prerequisites.** Load-testing tooling. **Limitations.** v1 is explicitly not production-hardened; results characterize a reference implementation, not a product — frame them that way.

### Theme L — Security and threat modeling

**Motivation.** The project ships a cross-service trust-boundary analysis with eleven findings (1 CRITICAL, 4 HIGH) and per-component reviews — produced by the project itself. No independent security assessment exists, and the project's README points evaluators to Issue #2 precisely because public deployment is gated on hardening.

**Core questions.** Registry compromise (the process held the root key in v1 — what is the full blast radius?); resolver compromise and cache poisoning; key theft and forged records; replay at each boundary; SSRF residual risk after the W0 deny-list (is the host-pinning DNS-rebinding defense complete?); namespace enumeration via wildcards and `/capability`; denial of service against each service post-W0 rate limiting; malicious registrants (typosquatting in the namespace — ANT-DN exists because the project expects it); compromised mirrors once mirrors exist; split-brain between authoritative and mirror state; insider threat in a single-steward operation; supply-chain attacks on the components themselves (Node dependency tree, installer pipeline); trace disclosure and privacy leakage from `/trace` and the trace corpus.

**Methods.** Independent threat modeling (STRIDE/attack trees) against the deployed stack; penetration testing of isolated instances; verification or refutation of each F-finding and each W0 fix; dependency and installer supply-chain audit; fuzzing the record-validation and canonicalization paths.

**Relevant materials.** `docs/cross-service-trust-boundary-analysis-2026-06-10.md` (F-1…F-11); Registry Spec §11; DillClaw Spec §11 (threat model); Issue #2; `v2-tracker.md` W0 entries (each fix documents its own verification method — re-verify independently).

**Example projects.** A student red-team exercise scoped to an isolated deployment, reporting against the F-catalog plus novel findings; a typosquatting study registering deceptive namespace paths in a test registry and measuring resolver/score behavior.

**Expected contribution.** The independent security review the project lists as a prerequisite for any partnership or production step (ledger AI-008).

**Difficulty.** Moderate–high. **Disciplines.** Cybersecurity. **Prerequisites.** Isolated deployment (never the project's production host); standard offensive tooling. **Limitations and ethics.** Test only your own deployments; the public dillweed.com endpoints and the steward's reference host are out of scope absent explicit written authorization; use responsible disclosure (see §12 below) for anything affecting the published artifacts.

### Theme M — Governance and institutional design

**Motivation.** The project documents a complete institutional architecture — founding steward (DNSO), Technical Steering Committee, Participant Council, foundation transition, succession instruments — for a community that does not yet exist. This register/reality gap is acknowledged internally (strategic evaluation §8) and is itself a research object: a fully specified micro-institution observable from inception.

**Core questions.** Is the founding-steward → multi-stakeholder transition path credible, or does it have the circular dependency the strategic evaluation identifies (neutrality requires plurality; plurality requires the credibility that only neutrality confers)? What do appeal and dispute processes need to look like for revocation and tier decisions, and are the Charter's procedures adequate? How is operator accountability enforced under the licensed-neutral-operator model? What capture risks exist for each transition path, and how do commercial vs. public-interest operation models compare? How does this governance corpus compare with ICANN's formation, CA/Browser Forum, Let's Encrypt/ISRG, the npm/PyPI governance history, and IETF process? Is writing governance *before* community formation prudent pre-commitment or premature institutionalization?

**Methods.** Comparative institutional analysis; document analysis of the governance corpus and its revision history; structured interviews with registry/PKI governance practitioners; scenario-based stress tests of the dispute and succession procedures.

**Relevant materials.** `specs/governance.html` (§4 founding phase, §5 evolution, §6 asset protection); `specs/dnso-operations-charter.html`; `specs/continuity-protocol.html` §10; Namespace Standard §8; `PROJECT_LEDGER.md` (decision rationale archive).

**Example projects.** An institutional-governance comparison paper: Dillweed's founding-phase instruments vs. three historical trust-infrastructure formations, scored on capture resistance, legitimacy, and transition credibility; a moot-court exercise running a contested revocation through the documented dispute process.

**Expected contribution.** Independent assessment of whether the institutional model could ever be legitimate — a question the project explicitly cannot answer about itself.

**Difficulty.** Moderate. **Disciplines.** STS, policy, law, public-interest technology, political economy. **Prerequisites.** None technical. **Limitations.** All governance bodies beyond the founding steward are unconstituted; analysis is necessarily of documents and analogies, not behavior.

### Theme N — Digital sovereignty and jurisdiction

**Motivation.** Capability records describe live services operated by real organizations under real legal regimes. The current schema (Registry Spec §3) does not express jurisdiction, and the project — a US single-steward operation — would face exactly the accreditation and jurisdictional-control demands the strategic evaluation's regulatory scenario (Scenario D) describes.

**Core questions.** How might capability records express governing jurisdiction, operator location, delegated providers, data-residency constraints, applicable legal authority, foreign-control risk, and continuity requirements — and which of these are attestable facts vs. legal conclusions a registry must not pretend to make? Would jurisdiction-aware resolution (a resolver policy that filters by residency constraints) be useful or compliance theater? Can a single global trust root ever be acceptable to sovereignty-conscious deployments, or is federation with jurisdictional roots structurally required? It must be stated clearly: **machine-readable standing metadata does not itself resolve political or legal sovereignty questions** — at most it makes claims legible and auditable.

**Methods.** Legal/policy analysis (EU AI Act, data-residency regimes, NIS2, procurement rules); schema-extension design with attestability analysis; comparative study of jurisdiction handling in DNS (ccTLDs), eIDAS trust lists, and cloud sovereignty programs.

**Relevant materials.** Registry Spec §3; Namespace Standard §8.3 (governance constraints); Governance Framework §6; strategic evaluation §3 Scenario D.

**Example projects.** A proposed jurisdiction/residency record-extension profile with an analysis of which fields a registry can honestly attest; a policy paper on whether neutral capability infrastructure is compatible with EU digital-sovereignty doctrine.

**Expected contribution.** A grounded treatment of sovereignty for capability infrastructure, useful well beyond this project.

**Difficulty.** Moderate. **Disciplines.** Law, policy, digital sovereignty, Internet governance. **Prerequisites.** None technical. **Limitations.** Nothing in the current stack implements any of this; the work is design and analysis, and should resist implying the project has sovereignty answers.

### Theme O — Human factors and usability

**Motivation.** The stack's outputs — trust tiers, scalar scores, staleness flags, revocation states, provenance chains, audit traces — are ultimately consumed by people: operators configuring policy, security teams triaging, developers choosing tools, auditors reconstructing decisions. No usability work of any kind exists.

**Core questions.** How do practitioners actually interpret a trust score of, say, 0.82 vs. a `verified` tier vs. a structured evidence bundle? Do scalar scores induce overconfidence relative to structured evidence (a head-to-head experiment the hypothesis list below makes precise)? How do users respond to stale-record and revocation warnings — and at what frequency does alert fatigue set in? Can a resolution trace be read by a human auditor without tooling, and what does trace-reading tooling need? What automation-bias risks arise when agents (not humans) consume standing signals and humans only see the agent's summary?

**Methods.** Controlled interpretation studies (between-subjects: score vs. tier vs. evidence-bundle presentations, measuring calibration); think-aloud studies with security practitioners on real traces from a test deployment; warning-design iteration; survey work across operator populations.

**Relevant materials.** DillClaw Spec §6.4 (the consumer guidance whose adequacy is the question); §3.2 response structure; `resolver/traces/` (format examples); Theme E outputs as stimuli.

**Example projects.** A user study of trust-score interpretation (n≈40 practitioners) testing the overconfidence hypothesis; a trace-comprehension study measuring time-to-correct-reconstruction of a resolution decision.

**Expected contribution.** Human-subjects evidence on trust-signal presentation — scarce in security UX generally and absent here.

**Difficulty.** Moderate (IRB process included). **Disciplines.** HCI, security usability, psychology. **Prerequisites.** IRB approval; recruited practitioner participants. **Limitations.** No real user population exists; studies use recruited proxies, which should be stated as a validity limit.

### Theme P — Standards alignment and protocol reuse

**Motivation.** The project's own comparative reviews conclude that several v1 mechanisms reinvent existing standards in weaker form and should be replaced by them (transparency: CT/Rekor; root metadata and delegation: TUF; registrant identity: OIDC trusted publishing; change distribution: index/feed patterns). The open question is the full retain/replace/profile/integrate matrix.

**Core questions.** For each mechanism — naming and the `dillweed://`/`dllwd://` URI scheme, record schema, signing, tiers, revocation, sync, traces, signals — should Dillweed retain its mechanism, replace it with an existing standard, publish a profile of an existing standard, or integrate as a consumer? Specifically: DNS/DNSSEC (delegation pattern, TXT attestation already in Charter §4), PKI/X.509, SPIFFE/SPIRE (workload identity — complementary per the project's analysis), OAuth/OIDC, SCIM (actor lifecycle), MCP and A2A (the adjacent agent protocols), Consul/etcd-style discovery, npm/crates/PyPI distribution patterns, Sigstore, RFC 6962 transparency logs, in-toto, TUF, OpenTelemetry, OPA/Cedar policy engines, and zero-trust architectures. Is the residue after maximal reuse large enough to justify a namespace — or does the exercise dissolve the project into a profile document (a legitimate outcome the strategic evaluation §5 anticipates)?

**Methods.** Standards mapping with conformance-level rigor; prototype "profile implementations" (e.g., capability standing expressed as a Sigstore + TUF profile) compared against the reference stack feature-for-feature; Internet-Draft authorship.

**Relevant materials.** `docs/architecture-review-registry-vs-existing-infrastructure-2026-06-10.md`; `docs/anthill-vs-observability-stack-2026-06-10.md`; strategic evaluation §5 (the relationship table); `specs/standards-overview.html`.

**Example projects.** A "minimal Dillweed" prototype built from Rekor + TUF + OIDC and a gap report on what could not be expressed; an Internet-Draft for capability-record semantics under a neutral protocol name, suitable for IETF dispatch discussion.

**Expected contribution.** The retain/replace matrix the v2 effort needs, produced independently rather than by the project about itself.

**Difficulty.** Moderate–high. **Disciplines.** Standards/protocol design, Internet architecture, security. **Prerequisites.** Working literacy in the comparison set. **Limitations.** The project's comparative reviews are thorough but self-authored; treat their conclusions as hypotheses to re-derive, not facts.

### Theme Q — Economic incentives and adoption

**Motivation.** The strategic evaluation's most damaging observation is economic, not technical: hyperscalers have negative incentive to adopt a namespace they don't control, and no incentive identified in the corpus overcomes that. Adoption economics are the project's least-developed dimension.

**Core questions.** Why would a capability provider register (what does standing buy them — distribution, liability cover, procurement compliance)? Why would resolver operators verify rather than trust their platform? What makes honest Anthill reporting incentive-compatible (ties to Theme H)? Where are the free-rider problems (everyone wants revocation data, nobody wants to fund the registry)? What funding models keep a neutral root neutral — fees, membership, philanthropy, government — and what does each do to capture risk (Theme M)? Does a neutral layer reduce or entrench market concentration and vendor lock-in? Under what conditions does platform resistance flip to platform adoption (regulatory mandate, insurance, a major incident)? Could certification/assurance markets form around standing tiers?

**Methods.** Game-theoretic modeling (registration and verification as coordination games; platform-vs-neutral-layer as entry deterrence); comparative adoption history (DNSSEC's slow path, CT's browser-forced path, Sigstore's ecosystem path, EV certificates' failure); willingness-to-pay/adopt surveys of enterprise platform teams; mechanism design for reporter incentives.

**Relevant materials.** Strategic evaluation §3 (scenarios), §9 (options); Governance Framework §5.5 (funding-relevant structure); Namespace Standard §9 (stack positioning).

**Example projects.** A game-theoretic model of neutral-namespace adoption identifying the minimal coalition and forcing functions, calibrated against the CT and DNSSEC histories; a study of what enterprise RFPs currently demand regarding tool provenance.

**Expected contribution.** An adoption-economics analysis the project cannot credibly produce about itself, and which generalizes to all neutral-infrastructure proposals in the agent ecosystem.

**Difficulty.** Moderate. **Disciplines.** Economics, game theory, technology policy, business strategy. **Prerequisites.** None technical. **Limitations.** Zero adoption data exists; empirical calibration must come from analog systems, and that analogical step should be explicit.

### Theme R — Empirical necessity of the proposed layer

**Motivation.** The deepest open question: do the failures attributed to missing capability standing actually occur, at what rate, and with what cost? The project asserts an incident class; independent measurement of that class has never been done. **This theme explicitly allows — and is designed to permit — the conclusion that a separate namespace layer is not justified.**

**Core questions.** How often do real systems experience: tool substitution (a name resolving to different behavior over time), stale endpoint invocation, invocation of revoked or deprecated integrations, cross-organization agent workflow failures traceable to unknown capability state, misconfigured API targets, silent provider changes, compromised plugins/MCP servers, model-routing opacity (not knowing which capability actually served a request)? When these occur, would signed records, governed revocation, or resolution traces have prevented or shortened them — or would ordinary platform controls have sufficed? What fraction of the incident class is cross-domain (where Dillweed's claim lives) vs. intra-domain (where existing IAM suffices)?

**Methods.** Incident-corpus construction from public sources (CVEs, vendor postmortems, documented MCP-server supply-chain incidents, GitHub advisory data); enterprise incident-report analysis under NDA where obtainable; longitudinal measurement studies (e.g., crawl public MCP server listings over months, measuring churn, disappearance, ownership change, and behavioral drift of named tools); counterfactual analysis applying the standing model to each incident.

**Relevant materials.** Namespace Standard §1 (the problem statement under test); strategic evaluation §2 ("is the problem live today?" — the project's own partial answer: "mostly no, with one important exception: revocation of third-party tools"); the MCP adapter as measurement instrumentation.

**Example projects.** A capability-standing incident taxonomy and annotated public corpus — the single most valuable artifact an outside group could produce, whatever it shows; a six-month longitudinal study of MCP-ecosystem tool churn quantifying how often a stable name stops meaning a stable thing.

**Expected contribution.** The evidence base that either justifies, narrows, or removes the project's premise.

**Difficulty.** Moderate (corpus work) to high (enterprise data access). **Disciplines.** Security, empirical software engineering, measurement. **Prerequisites.** Data-collection ethics review for crawling/telemetry. **Limitations.** The project supplies no incident data of its own — its 1,373 resolver traces are single-day local test traffic and must not be used as usage evidence.

---

## 4. Suggested Research Projects

| # | Title | Core question | Scope | Method | Expected output | Difficulty | Duration | Level | Component |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Independent v1 deployment and reproducibility study | Do the published test results reproduce from the repo alone? | Full stack, single host | Clean-room install; run all suites + `integration-test.sh`; diff against README claims | Reproducibility report + issues filed | Low | 4–8 weeks | Undergraduate | All; `README.md` |
| 2 | Linux port and portability report | Is the stack genuinely portable beyond the macOS reference? | Installers, launchd→systemd | Port, test, document divergences | Port + portability findings | Low–Mod | 1 semester | Undergraduate | `*/install.sh` |
| 3 | Revocation propagation measurement | What staleness bounds does the cache design actually deliver? | Registry + N resolvers (emulated) | Parameter sweeps, latency measurement | Tradeoff curves; config guidance | Moderate | 1 semester | UG/Master's | DillClaw §7; Theme G |
| 4 | Formal verification of revocation propagation | Can a max-staleness bound be proven from the spec'd cache rules? | Cache + refresh state machines | TLA+/Alloy model checking | Model + proof or counterexample; spec-ambiguity list | High | 6–12 months | Master's/PhD | DillClaw §7; Theme J |
| 5 | ProVerif/Tamarin analysis of signing, replay, and rotation | Are the cryptographic protocols sound, including key-rotation overlap? | Registry §5, Anthill replay, Charter §5 | Symbolic protocol verification | Formal analysis paper | High | 6–12 months | PhD | Theme D/J |
| 6 | Alternative trust-score design | Does a vector/evidence representation beat the scalar on decision quality and calibration? | Resolver §6 fork | Design + implementation + comparative evaluation | Fork + evaluation paper | Moderate | 1–2 semesters | Master's | DillClaw §6; Theme E |
| 7 | Trust-score gaming study | How much score inflation can a malicious registrant achieve? | Registrant inputs vs. §6.2 composition | Adversarial optimization on test registry | Attack catalog + mitigations | Low–Mod | 1 semester | UG/Master's | Theme E/L |
| 8 | Signed snapshot / delta-sync protocol implementation | Does the v2 Area 2 sync design work, and at what cost vs. full-poll? | Registry + resolver sync path | Implement checkpoints + cursor feed; benchmark | Independent protocol implementation + benchmarks | High | 6–12 months | Master's/PhD | v2 design Area 2; Theme C |
| 9 | Verifiable mirror prototype | Can a mirror prove freshness and fidelity without being trusted? | Mirror mode (currently a shell) | Build from `registry-mirror-deployment-gap-report` as requirements | First real mirror + spec feedback | High | 6–12 months | Master's/PhD/faculty | Theme C |
| 10 | SPIFFE/SPIRE integration prototype | Can workload identity replace the shared-token model for resolver↔registry auth? | v2 Area 1 slice | SPIRE deployment + mTLS integration | Prototype + integration report | Moderate–High | 1–2 semesters | Master's | Theme F |
| 11 | Sigstore/Rekor transparency-log integration | Does publishing registry log entries into Rekor supersede the bespoke audit log? | Registry `/log` → Rekor | Integration prototype; verification-property analysis | Prototype + retain/replace recommendation | Moderate | 1 semester | Master's | Themes D/P |
| 12 | RFC 8785 canonicalization migration study | Can JCS replace the JS-specific signing base without breaking history? | Registry §5.2 | Cross-language byte-equivalence harness; dual-signature transition design | Migration design + test vectors | Moderate–High | 1–2 semesters | Master's/PhD | Theme D; ledger AI-007 |
| 13 | Adversarial Anthill simulation | How many colluding/false reporters defeat the threshold design? | Signal taxonomy + aggregation | Agent-based simulation; mechanism analysis | Simulation + threshold-design paper | Moderate–High | 1–2 semesters | Master's/PhD | Theme H |
| 14 | Isolated-deployment red-team exercise | What does an independent offensive review find beyond F-1…F-11? | Full stack (isolated) | Structured penetration test against the F-catalog + novel work | Security assessment (responsibly disclosed) | Moderate | 1 semester | UG (supervised)/Master's | Theme L |
| 15 | Public Resolver abuse study | What abuse arrives at an internet-exposed read-only resolver, and do the W0 controls hold? | Hardened resolver honeypot (own deployment) | Deploy, instrument, observe; ethics-reviewed | Abuse taxonomy + hardening feedback for Issue #2 | Moderate–High | 6–12 months | Master's/faculty | Themes K/L |
| 16 | Capability-standing incident taxonomy | Do the failures the project posits actually occur in the wild? | Public incident corpora | Corpus construction + counterfactual analysis | Annotated public dataset + taxonomy paper | Moderate | 6–12 months | Master's/PhD/faculty | Theme R |
| 17 | MCP-ecosystem tool-churn longitudinal study | How often does a stable tool name stop meaning a stable thing? | Public MCP listings over ≥6 months | Periodic crawling + drift measurement | Churn dataset + measurement paper | Moderate | 6–12 months | Master's/PhD | Theme R/B |
| 18 | Cross-vendor MCP capability-resolution experiment | Do standing checks change multi-vendor agent behavior under revocation/rotation? | `mcp-server/` + ≥2 agent runtimes | Testbed + failure injection | Interop findings | Moderate–High | 1–2 semesters | Master's | Theme B |
| 19 | User study of trust-signal interpretation | Do scalar scores cause more overconfidence than structured evidence? | Score/tier/evidence presentations | Controlled human-subjects experiment (IRB) | Calibration data + design guidance | Moderate | 1–2 semesters | Master's/PhD | Theme O |
| 20 | Institutional governance comparison | Is the founding-steward → federation path credible vs. historical analogs? | Governance corpus vs. ICANN/ISRG/CT/npm histories | Comparative institutional analysis | Governance paper | Moderate | 1–2 semesters | Master's/PhD | Theme M |
| 21 | Continuity-protocol fire drill | Can the key-transfer and succession procedures be executed as written? | `continuity-protocol.html` on a disposable stack | Live rehearsal, timed, with ambiguity log | Execution report + protocol errata | Low–Mod | 8–12 weeks | UG/Master's | Theme I |
| 22 | Neutral-namespace adoption game-theory model | What minimal coalition and forcing functions make adoption rational? | Adoption economics | Game-theoretic modeling calibrated on CT/DNSSEC history | Economics paper | Moderate–High | 6–18 months | PhD/faculty | Theme Q |
| 23 | Second-implementer study | Can a compatible Registry or Resolver be built from the specs alone? | One component, clean room | Independent implementation; gap logging against `spec-gap-report` | Independent implementation + updated gap count | High | 1–2 semesters | Master's/PhD | All specs; Theme P |
| 24 | Jurisdiction-aware record extension design | Which sovereignty attributes can a registry honestly attest? | Record schema extension | Legal/policy analysis + schema profile | Extension proposal + attestability analysis | Moderate | 1 semester | Master's (law/policy) | Theme N |
| 25 | "Minimal Dillweed" from existing standards | How much of the stack dissolves into a CT+TUF+OIDC profile? | Full conceptual stack | Profile prototype + feature-gap report | Profile artifact; possibly a narrowing argument | High | 1–3 years | PhD/faculty | Themes A/P |
| 26 | Reproducible fleet benchmark suite | What are the scaling cliffs at 10/100/1k/10k resolvers? | Full stack, emulated fleet | Containerized benchmark matrix, published as artifact | Rerunnable benchmark + numbers | High | 6–12 months | Master's/PhD/faculty | Theme K |

---

## 5. Evaluation Datasets and Testbeds

Researchers will need to create most evaluation assets themselves; the project ships seeds (a 7-record dev catalog, per the v2 tracker) but no research datasets. Useful artifacts to build — each publishable in its own right:

- **Synthetic capability catalogs** at 10³–10⁶ records with realistic name distributions, version histories, tag vocabularies, and tier mixes; include adversarial slices (typosquats of high-tier names, deep wildcard-fanout subtrees) for Themes C, K, L.
- **Revocation workloads** — timed register/revoke/promote schedules replayable against `registry/` via its API, from steady-state trickle to mass-revocation incidents, for Themes G, K.
- **Multi-resolver simulations** — containerized fleets with configurable TTL, jitter, and partition injection; publish the orchestration so consistency results are rerunnable (Themes C, G, K).
- **Malicious-registrant scenarios** — scripted actors performing tier self-inflation (F-2), unsigned-field forgery (F-1), namespace squatting, and filler mass-registration (pre-W0 F-10), against isolated registries (Themes E, L).
- **Compromised-mirror scenarios** — once a mirror prototype exists (Project 9): record withholding, stale serving, and history rewriting, testing whether checkpoint verification detects each (Themes C, D).
- **Key-rotation event traces** — planned (Charter §5.2 overlap) and emergency (§5.3) rotations executed on test stacks, with fleet-side observation data (Themes D, I, J).
- **Trust-tier manipulation datasets** — labeled honest/adversarial registration histories for evaluating scoring designs (Theme E).
- **Telemetry and signal-injection datasets** — synthetic ANT-* streams with planted attacks (replay, sequence poisoning, collusive false reporting, framing via nonce reflection) and ground-truth labels (Theme H).
- **Cross-vendor agent/tool environments** — reproducible multi-runtime MCP testbeds with capability churn (Theme B).
- **Latency/consistency benchmarks** — the Project 26 matrix, with pinned commit hashes and hardware specs.

**Ethics and safe experimentation.** All adversarial work belongs on deployments you own. The project's own practice — isolated instances on separate ports, never production — is the right model. Do not test against `dillweed.com`, the canonical trust-root endpoint, or the steward's reference deployment without explicit written authorization. Human-subjects work (Theme O) requires IRB review. Crawling studies (Project 17) should respect robots.txt and rate limits. Synthetic datasets avoid most privacy concerns; any enterprise incident data used for Theme R requires appropriate agreements and anonymization. Treat all keys in the repository as compromised test material.

---

## 6. Falsifiable Hypotheses

Each is stated so that evidence could refute it; the suggested measurement follows. Hypotheses unfavorable to the project are included deliberately.

1. **A neutral resolver materially reduces stale or revoked capability invocation.** *Test:* agent workflows with/without standing checks under injected revocation churn (Project 18); measure revoked-invocation rate. Refuted if reduction is negligible or achievable with a plain TTL cache.
2. **Scalar trust scores cause greater user overconfidence than structured trust evidence.** *Test:* Project 19 calibration experiment; compare confidence–accuracy gaps across presentation conditions.
3. **Existing SPIFFE and service-discovery infrastructure can provide most Dillweed functions without a new namespace.** *Test:* Project 25 profile prototype; count standing sub-questions (per §1.2) satisfiable without new mechanisms. Favorable to the project only if the residue is large.
4. **Signed capability records improve post-incident reconstruction.** *Test:* staged incidents on a testbed; measure auditor time-to-correct-reconstruction with traces+signatures vs. ordinary logs.
5. **Cross-vendor organizations will reject a single central trust root.** *Test:* structured interviews/surveys with enterprise platform and security leads; complementary evidence from the adoption histories of single-root systems.
6. **Resolver caching prevents revocation guarantees from meeting high-assurance requirements.** *Test:* Projects 3/4 — measured and model-checked worst-case staleness vs. published high-assurance revocation requirements (e.g., payment or healthcare integration policies).
7. **Independent verification reduces reliance on compromised vendor control planes.** *Test:* tabletop + emulated compromise of a vendor catalog; measure whether locally-verified records detect the substitution.
8. **The v1 specifications are insufficient for a compatible second implementation.** *Test:* Project 23 clean-room build; hypothesis stands if blockers beyond the 9 already catalogued in `docs/spec-gap-report-2026-06-10.md` prevent byte-compatible interop.
9. **The published v1 test results reproduce on independent hardware.** *Test:* Project 1. Refuted by non-reproducible suites or undocumented environmental dependencies beyond those noted (e.g., the rate-limit window interaction recorded in `v2-tracker.md`).
10. **The Anthill threshold design is robust to <20% colluding reporters.** *Test:* Project 13 simulation; find the minimal collusion fraction triggering each false response class. (Note: requires implementing the spec'd thresholds, which v1 omits.)
11. **Per-window completeness attestation makes signal suppression detectable at acceptable overhead.** *Test:* prototype the Merkle-per-window design (v2 Area 3/A.7); measure detection rate and overhead vs. suppression scenarios.
12. **The trust-score composition is gameable: a malicious registrant can reach the score of an honest verified-tier capability without attestation.** *Test:* Project 7 adversarial optimization against DillClaw §6.2 as specified.
13. **Capability-standing failures (tool substitution, revoked-tool invocation, silent provider change) occur at material rates in the public MCP ecosystem.** *Test:* Projects 16/17. Refutation — low churn, rare incidents — directly undermines the project's premise and should be published.
14. **The continuity procedures can be executed by a third party from the documents alone within the protocol's own timelines.** *Test:* Project 21 fire drill with an executor who has never spoken to the steward.
15. **The v2 delta-sync design reduces fleet sync bandwidth by ≥10× over full-poll at 100+ resolvers with equal or better staleness.** *Test:* Project 8 benchmark, both protocols, same workload.
16. **Key rotation under the Charter §5.2 overlap procedure produces a fleet trust-disagreement window exceeding the documented bound.** *Test:* instrumented rotation on an emulated fleet (Themes D, J).
17. **A transparency-log-backed registry (publish-into-Rekor) provides strictly stronger third-party verifiability than the v1 append-only log at lower implementation cost.** *Test:* Project 11; compare verifiable properties and code size/effort.
18. **Enterprise demand exists for governed tool revocation but not for the broader standing stack.** *Test:* RFP/procurement-language analysis plus practitioner surveys; supports the narrowing thesis in `docs/strategic-evaluation-2026-06-12.md` §11 if confirmed.

---

## 7. Questions the Project Should Not Answer Alone

Some questions are structurally unanswerable by a project about itself, and this corpus — however candid — is largely self-authored (its review rounds were generalist AI reviews commissioned by the steward; ledger AI-008 says so explicitly). Independent scholarship is the only credible source for:

- **Whether the architecture is necessary at all** (Themes A, R).
- **Whether the trust model is socially legitimate** — a single founding steward signing the world's capability records is a legitimacy question, not an engineering one (Theme M).
- **Whether the governance body (DNSO) should exist**, and in what institutional form.
- **Whether a central public trust root is desirable**, versus federation, jurisdictional roots, or no root.
- **Whether capability scoring should be standardized** — or whether standardizing a score does harm (Themes E, O).
- **Whether neutral infrastructure can resist commercial capture** over decades (Themes M, Q).
- **Whether the project creates new risks** — a global registry of invocable capabilities is also a reconnaissance asset; resolution traces are also surveillance records; concentration of standing decisions is also a single point of political pressure. These deserve dedicated adversarial scholarship, not a paragraph in the project's own threat model.

---

## 8. Current Limitations and Research Caveats

Stated plainly so that no research plan is built on an inflated premise:

- **v1 is a reference implementation**, not production infrastructure: single host, SQLite, macOS installers, Node services. Performance and security results characterize the reference, not a product.
- **Public production deployment remains gated** on the open hardening issue (GitHub Issue #2). There is no public resolver to study; internet-exposed experiments require your own deployment.
- **Mirror synchronization is incomplete**: mirror mode rejects writes and echoes configuration; no sync protocol is implemented (`docs/registry-mirror-deployment-gap-report-2026-06-10.md`).
- **Multi-organization identity is unresolved**: one shared admin token; delegation, registrant attestation, and node-key verification are v2 designs (Issue #4), not code.
- **Anthill does not implement its detection-and-response vision**: the threshold/escalation engine is unbuilt and node signatures are stored unverified (CRITICAL F-3, open at the time of the trust-boundary analysis).
- **Several production-hardening designs remain proposals**: offline root/intermediate hierarchy, tamper-evident logging, delta sync, per-identity quotas — all v2 design (`docs/dillweed-v2-design-2026-06-10.md`), with only the W0 wave shipped.
- **External adoption and independent validation are essentially zero** at the time of writing: no third-party implementation, no externally registered capability, no independent specialist review (the project's own strategic evaluation, §8, documents this candidly).
- **Crawler or trace traffic is not evidence of research endorsement.** The repository's 1,373 resolver traces are single-day local test traffic with null caller IDs; web-crawl activity against the specs implies nothing about validation.
- **The project owner should not be treated as an independent evaluator.** The architecture reviews, gap reports, and strategic evaluation in `/docs` were commissioned and curated by the steward. They are unusually self-critical and are excellent *starting points* — but every conclusion in them is a candidate for independent re-derivation, not a settled fact.
- **Spec and implementation versions diverge** (e.g., Registry spec v0.1.6 implements as Registry 0.2.8) with no published mapping rule — pin both when citing.

---

## 9. Collaboration Models

Practical ways a university group can engage, none of which constitutes or implies endorsement of the project:

- **Independent deployment** — install, test, and report (Project 1); the lowest-cost engagement.
- **Seminar review** — a graduate seminar takes the spec stack and review corpus as a case study; the spec-consistency review series (`docs/spec-consistency-review-2026-06-09*.md`) models the format.
- **Capstone project** — any single-semester row from the table in §4.
- **Security audit** — an independent assessment of an isolated deployment (Project 14), responsibly disclosed.
- **Replication study** — re-run and verify the W0 fix verifications recorded in `v2-tracker.md`.
- **Standards comparison** — Theme P mapping work; suitable for networking/security course modules.
- **Student red-team exercise** — supervised, against lab-owned instances only.
- **Formal-methods project** — Projects 4/5; self-contained from the specs.
- **Joint workshop** — a capability-standing or agent-infrastructure workshop where this project is one artifact among several under review.
- **Independent implementation** — Project 23; the strongest possible test of the specifications.
- **Hosted read-only resolver** — a lab-operated resolver instance against its own registry; note that pointing one at the project's production registry should wait for the Issue #2 hardening to close.
- **Hosted mirror — only after the mirror protocol exists.** The project's own gap report says a mirror operator currently has no happy path; do not commit to mirror operation against v1.
- **Interdisciplinary governance study** — Themes M/N/Q work needing no code at all.

---

## 10. Researcher Onboarding

A bounded path from zero to a defensible research question:

1. **Read the project overview** — `README.md` (root), then `specs/standards-overview.html` for the stack map.
2. **Review the trust model** — `README.md` §"Trust model", then `specs/registry-spec.html` §5 (signing) and §11 (security model).
3. **Read the specifications relevant to your theme** — `specs/namespace-standard.html`, `specs/registry-spec.html`, `specs/dillclaw-spec.html`, `specs/anthill-spec.html`, `specs/governance.html`, `specs/continuity-protocol.html`, `specs/dnso-operations-charter.html`.
4. **Inspect the known findings before forming hypotheses** — `docs/cross-service-trust-boundary-analysis-2026-06-10.md` (F-1…F-11), the three `docs/architecture-review-*-2026-06-10.md` reviews, the four gap reports, `docs/dillweed-v2-design-2026-06-10.md`, and `docs/strategic-evaluation-2026-06-12.md`. Much of the easy critique is already written down; your contribution starts where the corpus stops — or where independent testing contradicts it.
5. **Deploy the local reference stack** — release tarballs per `README.md` §"Installing v1 components" (Registry → Resolver → Anthill); verify the trust chain per §"Verification".
6. **Run the tests** — per-component `test.sh` suites, `resolver/unit-tests.js`, and `integration-test.sh` at the repo root. Note the documented rate-limit interaction between consecutive suites (`v2-tracker.md`, 2026-06-10 entries).
7. **Select a bounded research question** — one theme, one hypothesis from §6, or one row of §4. Record the commit hash and component versions you are studying.
8. **Publish methods and negative findings** — a hypothesis from §6 refuted is a result.
9. **Submit issues or independent reports** — GitHub issues for defects and spec gaps; independent publication for findings (see §11). Security-sensitive findings go through responsible disclosure first.

---

## 11. Publication and Attribution Principles

Research using this artifact should:

- **Disclose project-owner involvement** — if the steward assisted with deployment, data, or review, say so; the project's value to the literature depends on a clean independence boundary.
- **Distinguish independent results from project claims** — "the project documents X" vs. "we measured X" must never blur; the self-authored review corpus makes this distinction unusually important here.
- **Cite repository commit hashes** and component/spec versions (both — they diverge).
- **Document test environments** fully (hardware, OS, isolation setup, configuration overrides).
- **Preserve reproducibility artifacts** — datasets, orchestration, analysis code — in archival venues.
- **Report negative results** — this document exists in part to make them citable contributions rather than abandoned drafts.
- **Avoid implying institutional endorsement** in either direction: studying the artifact endorses nothing; the project citing your study confers nothing.
- **Use responsible disclosure** for security vulnerabilities: report privately to the steward (repository contact channels; see `specs/dnso-operations-charter.html` §"Communication Channels"), allow a reasonable remediation window consistent with the Charter's disclosure obligations (§7), then publish.

---

## 12. Closing Invitation

The Dillweed Namespace Project is one proposed answer to a question — whether agentic systems need a neutral capability-standing layer — that has not yet been settled by evidence. The artifact is small enough to deploy in an afternoon, documented enough to critique without private guidance, and honest enough about its own gaps that the interesting work starts immediately.

Independent critique, replication studies, comparative analyses against existing standards, alternative designs, student projects at every level, formal review of its protocols and its institutions, and responsible reporting of vulnerabilities are all welcome. So are findings that the layer is unnecessary, the trust model unsound, or the institution illegitimate — the project's premise deserves to be tested, not assumed, and the fastest way to find out is for people with no stake in the answer to start measuring.

---

## 13. References to Repository Documents

**Root:** `README.md` · `PROJECT_LEDGER.md` · `v2-tracker.md` · `integration-test.sh` · `LICENSE` (Apache-2.0)

**Specifications (`specs/`, mirrored at dillweed.com):** `namespace-standard.html` (v0.4.4) · `registry-spec.html` (v0.1.6) · `dillclaw-spec.html` (v0.1.8) · `anthill-spec.html` (v0.1.3) · `governance.html` (v1.1.3) · `continuity-protocol.html` (v1.0.3) · `dnso-operations-charter.html` (v1.0.3) · `standards-overview.html` (v1.0.10)

**Design and strategy (`docs/`):** `dillweed-v2-design-2026-06-10.md` · `strategic-evaluation-2026-06-12.md` · `documentation-set-review-2026-06-11.md`

**Architecture and security reviews (`docs/`):** `architecture-review-registry-2026-06-10.md` · `architecture-review-resolver-2026-06-10.md` · `architecture-review-anthill-2026-06-10.md` · `architecture-review-registry-vs-existing-infrastructure-2026-06-10.md` · `anthill-vs-observability-stack-2026-06-10.md` · `cross-service-trust-boundary-analysis-2026-06-10.md`

**Implementer-experience gap reports (`docs/`):** `spec-gap-report-2026-06-10.md` · `dillclaw-deployment-gap-report-2026-06-10.md` · `anthill-signal-emitter-gap-report-2026-06-10.md` · `registry-mirror-deployment-gap-report-2026-06-10.md`

**Spec-consistency review series (`docs/`):** `spec-consistency-review-2026-06-09.md` through `-r5.md` and `spec-consistency-review-2026-06-10-r6.md`

**Operations:** `docs/operations-runbook.md` · `docs/release-notes/`

**Implementations:** `registry/` · `resolver/` · `anthill/` · `mcp-server/`

**GitHub issues:** #2 (pre-public-resolver hardening, open) · #4 (v2 architecture scope, open)
