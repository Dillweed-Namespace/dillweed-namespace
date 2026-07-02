# ANS v2 and Dillweed Capability Standing: Comparative Architecture and Boundary Analysis

## 1. Status, Date, and Repository Baselines

**Status:** Independent comparative review. Review-and-recommend mode; no specification, implementation, or governance artifact in either project was modified. This document is analysis, not specification.

**Report date:** 2026-07-01

**Reviewer role:** Independent internet-architecture reviewer / distributed-systems architect / security engineer / identity specialist / standards analyst / open-source governance evaluator.

### 1.1 Dillweed baseline

| Item | Value |
|---|---|
| Repository | https://github.com/Dillweed-Namespace/dillweed-namespace |
| Commit reviewed | `310d503` ("index: reconcile §6/§7 severity mismatches on DOC-003 and DOC-009", 2026-06-13) |
| Implementations | Registry 0.2.8, DillClaw Resolver 0.1.8, Anthill 0.1.6 — all post-W0 hardening wave; note the implementation `VERSION` strings were not bumped for W0 behavioral changes (FDI version-drift findings, `docs/finding-disposition-index-2026-06.md` §12) |
| Specifications | Namespace Standard v0.4.4, Registry Spec v0.1.6, DillClaw Resolver Spec v0.1.8, Anthill Spec v0.1.3, Governance Framework v1.1.3, DNSO Operations Charter v1.0.3, Continuity Protocol (GSP-01) v1.0.3, Standards Overview v1.0.10 |
| Open GitHub issues consulted | #2 (pre-public-resolver hardening, OPEN), #4 (v2 architecture, OPEN) |

### 1.2 ANS baseline

| Item | Value |
|---|---|
| Internet-Draft | `draft-narajala-courtney-ansv2-01`, uploaded 2026-04-13 (last updated 2026-04-15). **Individual submission**; replaces `draft-narajala-ans`. Authors: Courtney (GoDaddy), Narajala (OWASP), Huang (DistributedApps.ai), Habler (OWASP), Sheriff (Cisco). Not adopted by any IETF working group; no formal IETF standing. |
| Linux Foundation announcement | 2026-06-23 — an announcement of **intent to launch**, not a launched project or completed governance structure. Quoted supporters: GoDaddy, Cloudflare, DistributedApps.ai, Hashgraph Online, Infoblox, Salesforce, Cisco, OWASP. |
| GitHub organization | https://github.com/agentnameservice — `ans` (Go reference implementation: RA, transparency log, offline verifier, dev DNS; releases through v0.1.6), `ans-registry` (specification corpus ANS-0–ANS-5 and threat model; ~20 commits, no releases; lineage from `godaddy/ans-registry`), `ans-sdk-java`, `ans-sdk-go`, `ans-sdk-rust`, packaging taps. |
| Research lineage | "Agent Name Service (ANS): A Universal Directory for Secure AI Agent Discovery and Interoperability" (arXiv:2505.10609, May 2025); OWASP GenAI Security Project publication "ANS for Secure AI Agent Discovery v1.0"; `draft-narajala-ans-00` (May 2025). |

### 1.3 Source materials not inspected, and reliance on inference

The following could not be inspected directly and any dependent conclusions are labeled where they occur:

- **The ANS Trust Index companion specification.** Draft §4.7 references "a companion Trust Index specification"; it was not located and its content is known only through the draft's description. All Trust Index conclusions rely on the draft text.
- **ANS repository commit hashes.** Repository contents were reviewed through rendered pages (README, release tags), not a cloned tree; findings are pinned to release tags (`ans` v0.1.6) rather than commits. Statements about test coverage ("≥90% enforced") repeat the repository's own claims and were not independently executed.
- **The Internet-Draft full text** was analyzed through structured extraction of the published HTML rather than a line-by-line read; section citations follow the draft's numbering as extracted. Where a specific normative nuance matters (e.g., whether ANS revocation events carry a mandatory reason field), uncertainty is stated inline.
- **Live deployments.** Neither project's public endpoints (dillweed.com services; any hosted ANS RA/TL) were probed. Deployment-maturity conclusions rest on repository and document evidence only.
- **Dillweed release tarballs** and the `patches/` directory were not re-verified; the PROJECT_LEDGER's SHA-pinned audit trail is taken as documentary evidence.
- **GitHub issue bodies** for Dillweed #2/#4 were not read in full (titles and labels only); their content is characterized from the in-repo documents that summarize them.

No conclusion below rests *solely* on inference; where inference is load-bearing (Trust Index maturity, ANS production status, ANS revocation-reason semantics), it is flagged.

### 1.4 Version labeling rule

All Dillweed statements refer to the current repository state at `310d503` unless explicitly marked as v2-design content (design, not code). All ANS statements refer to draft `-01` and the `ans` v0.1.6 reference implementation unless explicitly marked as future work (draft §11). Future-work sections of either project are never treated as implemented functionality.

---

## 2. Executive Summary

ANS v2 and the Dillweed Namespace Project attack adjacent problems with different primary objects. **ANS v2 governs versioned agent identity anchored to DNS domains**: who this agent is, which domain vouches for it, which sealed metadata described it at registration, and what its lifecycle state is — with genuinely strong cryptographic machinery (ACME domain validation, dual certificates, a SCITT-aligned Merkle transparency log with offline-verifiable receipts). **Dillweed governs capability records**: named, versioned, signed descriptions of individually invocable functions, with capability-level revocation, trust-filtered resolution, and per-decision audit traces — implemented as a single-steward reference deployment whose own review corpus documents an open CRITICAL finding, an unimplemented mirror protocol, and zero external adoption.

The boundary, examined concretely:

1. **ANS subsumes most of Dillweed's identity, trust-root, transparency, and mirror ambitions — and does so with stronger cryptography than Dillweed has built or specified.** Dillweed's own v2 design (2026-06-10) independently converged on the same patterns ANS already implements: transparency logs, signed checkpoints, offline roots, domain-proof registration. Where Dillweed planned, ANS shipped a reference implementation.
2. **ANS does not govern capabilities.** In draft §1.5 and §5.3, capabilities are metadata (`functions` arrays inside `endpoints` in the Trust Card); they have no independent identity, no independent version, no independent lifecycle, and no independent revocation. "Every change to an agent's software or capabilities requires a new version number and a new registration." The unit of standing in ANS is the agent version; the unit of invocation in agent systems is the capability. That gap is real and demonstrable in concrete scenarios (§9, §10 below).
3. **Capability standing is a defensible concept but not a defensible parallel namespace.** The compound question — *is this named capability what it claims, who governs it, is that governance current or revoked, and can the resolution decision be reconstructed later* — is answered by neither ANS alone nor anything else surveyed. But nothing in that question requires a `dllwd://` root, a bespoke trust root, a bespoke transparency mechanism, or a competing registry. It can be expressed as a capability-standing evidence layer that consumes ANS identity upstream and emits evidence to execution-policy engines downstream.
4. **Several Dillweed components duplicate what ANS (or older infrastructure) does better and should be retired or replaced**: the bespoke trust-root distribution (PEM over one HTTPS URL), the unimplemented mirror snapshot-hash protocol, the hand-rolled append-only logs, and — in its current unverified-self-declaration form — the trust-tier mechanism. The scalar trust score should be abandoned in favor of the structured signal vector Dillweed already returns alongside it.
5. **Dillweed retains three genuinely distinct assets**: capability-granular lifecycle semantics (revocation with mandatory logged reasons, per-capability versioning), resolution traces (a reconstructable record of *why this candidate was selected under this policy*, which no ANS component produces), and an unusually rigorous self-critical research corpus (falsifiable hypotheses, gap reports, disposition index, continuity-exercise designs) that is directly useful to ANS's own deferred work items.
6. **Interoperability is more credible than competition, by a wide margin.** ANS has institutional momentum (a Linux Foundation intent announcement, multi-vendor authorship, three SDKs) that Dillweed cannot match and should not try to; Dillweed has capability-layer analysis ANS has not yet needed to do. The realistic relationship is: ANS identity as upstream evidence into a Dillweed-derived capability-standing profile, with selected Dillweed artifacts contributed upstream.

**Overall verdict: Complementary profile is the strongest path** (of the five permitted verdicts). Dillweed should stop building parallel infrastructure (mirrors, trust-root distribution, transparency mechanics, most of Anthill's plumbing), re-ground its capability-record and resolution semantics as a profile that consumes ANS identity, and concentrate its remaining effort on the two things it demonstrably has that ANS demonstrably lacks: capability-granular standing and reconstructable resolution evidence. §23 and §24 give the wording changes and 90-day sequence; §25 gives the fifteen direct answers.

---

## 3. Method and Evidence Limitations

**Method.** The Dillweed repository was read at `310d503`: README, all eight specifications, the v2 design, the trust-boundary analysis, all architecture and comparative reviews, all four deployment/implementation gap reports, the documentation-set review, the finding-disposition index, the strategic evaluation, both research documents, the project ledger and v2 tracker, the MCP adapter, and GitHub issue metadata. ANS materials were reviewed through the datatracker record, the published `-01` draft HTML, the Linux Foundation announcement, the `agentnameservice` organization repositories, and the research lineage (arXiv paper, OWASP publication, original `draft-narajala-ans`).

**Standing distinctions maintained throughout** (per the review brief): an individual Internet-Draft is not a working-group document, an adopted standard, or an endorsement; a Linux Foundation *intent* announcement is not completed governance or a deployed system; a reference implementation is not production infrastructure; a design document is not a feature; a research proposal is not a capability. Both projects are early. Both projects' future-work sections are treated as absent functionality.

**Known limitations.** (a) The Dillweed review corpus is largely self-authored (AI-assisted reviews commissioned by the steward — the ledger's own AI-008 entry draws this distinction); it is used here as *evidence of what the project knows about itself*, with claims spot-verified against spec and code text where the documentation-set review had already done the verification. (b) ANS conclusions rest on the draft and public repositories, not on operating the software. (c) The comparison is asymmetric in access: full file-level access to Dillweed, page-level access to ANS. Where the asymmetry could bias a judgment (e.g., test-suite quality), the judgment is hedged. (d) This report was prepared for placement in the Dillweed repository; the analytical posture is nonetheless neutral, and negative findings against Dillweed are preserved throughout — several classifications below recommend retiring Dillweed components.

---

## 4. Terminology

These distinctions are load-bearing; the two projects use overlapping words for different things.

| Term | Meaning as used here |
|---|---|
| **Identity** | A stable, verifiable binding between an actor (agent, service, organization) and a cryptographic credential. ANS's primary business. |
| **Naming** | A syntax and allocation policy for stable identifiers. ANS: `ans://v{version}.{fqdn}` (draft §5.1). Dillweed: `dllwd://<domain>.<category>.<function>` paths (Namespace Standard §3.3). |
| **Discovery** | Finding candidates that might satisfy a need. ANS: Discovery Services indexing TL events (§4.1); `_ans` DNS TXT records (§7.4.1). Dillweed: resolver wildcard/constraint queries. |
| **Registration** | The governed act of entering a name/identity/record into an authoritative system, with whatever validation that system performs. |
| **Authentication** | Proving, at interaction time, that a party is the holder of an identity (mTLS with Identity Certificates in ANS §6.4; largely absent in Dillweed v1 — shared bearer tokens only). |
| **Attestation** | A signed third-party statement that some property was checked (DNSO tier attestation; ANS `verifiableClaims`; SCITT receipts). |
| **Capability declaration** | A description of what an actor can do (ANS Trust Card `endpoints[].functions`; Dillweed Capability Record schema fields). Declarative unless separately verified. |
| **Capability standing** | Dillweed's term of art (defined precisely in §9): the current, evidence-backed status of a *named capability* — signature validity, governance state, revocation state, freshness — evaluated at resolution time. Distinct from both identity and authorization. |
| **Authorization** | Whether a specific caller may use a specific capability. Out of scope for both projects, by both projects' own statements (DillClaw spec §6.4; ANS leaves it to Layer 2/3 consumers and local policy). |
| **Admissibility / execution governance** | Whether a specific *action* may proceed now, under policy, with these data flows. The layer above authorization; neither project's business (§20 of this report). |
| **Monitoring** | Continuous comparison of live state against expected state (ANS AIM; Anthill's aspiration). |
| **Audit evidence** | Records sufficient to reconstruct a past decision under challenge. Cryptographic (TL receipts) vs operational (logs) vs application-level (resolver traces) — kept separate in §11. |
| **Behavioral reputation** | Accumulated third-party experience signals (ANS Trust Index Layer 3). Neither project verifies behavior cryptographically. |

---

## 5. Primary Object Comparison

### 5.1 What each architecture actually governs

**ANS v2's primary object is a versioned, domain-bound agent identity, evidenced by a sealed lifecycle event chain.** The candidates in the brief resolve as follows: the *identifier* is the ANSName (`ans://v1.0.0.agent.example.com`, §5.1) — a (version, FQDN) pair; the *authority* is domain control demonstrated via ACME (§7.1.2); the *credential* is the dual certificate pair (public-CA Server Certificate on the stable FQDN; private-CA Identity Certificate with the ANSName in a URI SAN, §5.4); the *record of record* is the transparency-log event (§4.3), whose sealing is the declared "point of no return" (§7.1.2); the *metadata artifact* is the Trust Card (§5.3), bound to the sealed record by hash. So the primary object is a **composite**: the versioned identity is primary; certificates, Trust Card, and TL events are its evidence. The FQDN, not the ANSName, is the durable anchor — "the version number changes, the domain does not" (§1.5), with `supersedes` chaining versions and reputation accruing to the FQDN (§5.2.3).

**Dillweed's primary object is the signed Capability Record**: a named (`research.market.intel.vendors`), versioned (semver), behaviorally described (input/output schemas, permissions, protocol, endpoint) unit, signed over ten fields by the DNSO key (Registry Spec §5.2; Namespace Standard §4.1). The namespace entry is the record's address; the resolution result is a *derived* object (record + trust signals + score + trace ID); the endpoint is a field, not the identity — Namespace Standard §7.3 is explicit that identity anchors to the path and survives endpoint changes. The governed endpoint and the resolution result are secondary; the record is primary.

The essential asymmetry: **ANS binds identity to infrastructure an agent operator already controls (a DNS domain) and treats functions as description. Dillweed mints identities for functions themselves and treats the operator as (currently) almost nothing — v1 has no registrant identity at all** (trust-boundary analysis F-6; v2 design Area 1).

### 5.2 Does the agent-vs-capability distinction produce architectural consequences?

Yes — testable ones. Scenario walk-through, using each system's documented mechanics:

| # | Scenario | ANS v2 behavior | Dillweed behavior | Consequence |
|---|---|---|---|---|
| 1 | One agent exposes many capabilities | One registration; capabilities are `functions` entries in Trust Card endpoints (App. A.2). One lifecycle state covers all. | One Capability Record per capability; independent tiers, versions, revocation per record. | The distinction is real: ANS's unit of state is coarser than the unit of invocation. |
| 2 | Different capabilities governed by different organizations | Not representable: registration is bound to one domain/ProviderID; a second org's capability needs its own agent registration under its own domain. | Not implemented either: v1 has a single DNSO signer and shared token; delegation is v2 design (Area 1.2.1) only. | **Both leave this unresolved** in running code. ANS's model (per-domain authority) handles the *common* case naturally; neither handles delegated authority over a sub-capability. |
| 3 | One capability implemented by many agents | No cross-agent capability equivalence; Discovery can filter by protocol/tags, but "these five agents implement the same function" has no first-class object. | Partially natural: multiple records can populate a category path; the resolver ranks candidates under one query (`research.market.*.vendors`). Name+version uniqueness means true substitutes register as sibling paths. | Dillweed's category-path query + ranked selection is a real mechanism ANS lacks; it is also where Dillweed's weakest machinery (scoring, self-declared tiers) sits. |
| 4 | Independent revocation of one capability | Impossible below agent-version granularity (§5.5, §7.2). Workaround: deprecate v1.0.0, register v1.1.0 without the function — a *replacement*, not a revocation, and it conflates "one function withdrawn" with "software changed." | First-class: `POST /revoke` per record, mandatory reason, soft-delete retained in log (Registry Spec §8.1). | **The single clearest architectural consequence.** See §10 scenarios 1 and 10. |
| 5 | Independent versioning of one capability | Capability versions do not exist; only the agent version exists. A capability's contract change forces a whole-agent version bump. | First-class: per-record semver; resolver supports ranges/pinning (DillClaw §4.3). | Real difference; matters to consumers pinning a *function* contract, not a codebase. |
| 6 | Delegated capability ownership | Out of scope; §11 defers even DID-style persistent identifiers. | v2 design only (delegation records, Area 1.2.1); v1 has none. | Unresolved by both. Dillweed has the more developed *design*; ANS has none and doesn't claim to. |
| 7 | Capability migration between agents | No mechanism: the name embeds the FQDN, so a capability moving to another operator gets a new identity and loses history (RDAP/provider-mismatch logic in §5.2.3 actively *revokes* on operator change). | Structurally supported: identity anchors to the path; the endpoint field changes under the same name (Namespace Standard §7.3). But v1 cannot verify the *new* operator is legitimate (no registrant identity), so the property is currently a liability as much as a feature. | Genuine conceptual difference; neither implementation makes it safe today. |
| 8 | Capability policies differing from agent-level policies | Not representable: one Trust Card, one lifecycle state, one identity per version. | Representable: per-record `permissions`, `trust_tier`, and caller-side per-query constraints (`trust_minimum`, required permissions). | Real difference in expressiveness. |
| 9 | Shared capabilities composed from several agents | Neither system represents composition. | Neither. | **Both leave unresolved.** |
| 10 | Ephemeral / task-bound agents | Poor fit: registration requires domain control, certificate issuance, TL sealing — heavyweight for minutes-lived workers. §11 defers TEE/ZKP runtime identity. Workload-identity systems (SPIFFE) fit better. | Also poor fit, differently: Dillweed doesn't identify agents at all; an ephemeral agent could *consume* resolution but not be represented. | Both defer to workload identity; correctly so. |

**Judgment:** the agent-vs-capability distinction is not merely semantic. It produces at least four concrete representational differences (rows 1, 4, 5, 8) and one propagating operational difference (capability-granular revocation). It does **not** by itself justify a parallel global namespace: rows 2, 6, 9, 10 show both systems unresolved on the hard multi-authority cases, and every Dillweed advantage in this table is a *schema and lifecycle-semantics* advantage, not a trust-root or transparency advantage — i.e., expressible as a layer over ANS identity rather than beside it.

---

## 6. Responsibility Matrix

Maturity vocabulary: **spec** (normative text exists), **design** (non-normative design doc), **impl** (running reference code), **tested** (impl + passing suite), **deployed-1** (one operator's deployment), **absent**. "ANS" = draft-01 + `ans` v0.1.6 unless noted. Equivalence is not forced: "—" marks concerns a system simply does not have.

| Concern | ANS v2 | Dillweed | Overlap | Important difference | Current maturity |
|---|---|---|---|---|---|
| Global naming | `ans://v{ver}.{fqdn}` (§5.1); rides DNS allocation | `dllwd://` dot-paths under one governed root (NS §3.3) | Both name globally | ANS inherits DNS's existing allocation/dispute machinery; Dillweed invents allocation under one steward | ANS: spec+impl · DW: spec+impl |
| Namespace ownership | Domain owner owns subtree by construction | DNSO governs entire root; no delegation in v1 | Low | Structural: distributed-by-DNS vs single-steward | ANS: impl · DW: impl (centralized) |
| Domain validation | ACME DNS-01/HTTP-01 at registration and renewal (§7.1.2, §5.2.3) | None at registration; DNS-TXT proof only in Charter §4.1 *attestation* flow; v2 design plans ACME-style proof | Partial | ANS validates control before issuing identity; Dillweed signs first, attests later (maybe) | ANS: spec+impl (real DNS-01 listed as partly planned in repo) · DW: spec (attestation only) |
| Principal/organizational identity | ProviderID + optional LEI (§5.2.1); org data in registration | None in v1 (shared token); OIDC/delegation in v2 design | Low | ANS has a real answer; Dillweed's is unbuilt | ANS: spec+impl · DW: design |
| Agent identity | Core object (certs, ANSName) | Absent by design | None | Complementary, not competing | ANS: impl · DW: — |
| Capability identity | Metadata only (`functions` in Trust Card, App. A.2); no lifecycle | Core object (Capability Record) | Low | The pivotal gap in each direction | ANS: — · DW: impl+tested |
| Versioning | Agent-version; new registration per change (§1.5, §7.2); `supersedes` chain | Per-capability semver; ranges/pinning in resolver (DillClaw §4.3) | Both version | Granularity: agent vs capability | Both: impl |
| Registration | RA flow with validation gates (§7.1) | `POST /register` behind shared bearer token | Both register | ANS validates domain control; Dillweed validates schema only (F-6) | ANS: impl · DW: impl+tested |
| Signed metadata | Trust Card COSE_Sign1 + sealed agentCardHash (§5.3) | Ed25519 over 10 of ~13 record fields (Registry §5.2); `registration_date`/`tags` unsigned (F-1) | High | ANS seals the *hash* in an append-only log; Dillweed signature has no log anchoring; Dillweed signs behavioral schemas, ANS card includes function/schema hashes | ANS: spec+impl · DW: impl+tested (known unsigned-field defect) |
| X.509 certificates | Dual-cert model; private CA for URI-SAN identity certs (§5.4) | None | None | ANS interoperates with TLS ecosystems; Dillweed relies on raw Ed25519 | ANS: impl · DW: — |
| Non-X.509 signatures | COSE (receipts, Trust Card); ES256 | Ed25519 `dnso_v1_` bespoke format | Some | ANS uses standard envelopes; Dillweed hand-rolled (verifiers must implement §5.4 procedure) | ANS: impl · DW: impl |
| Canonicalization | COSE/CBOR-governed byte discipline | Top-level-only JSON key sort, "bytes-as-stored" nested; JCS migration planned (ledger AI-007) | Low | Dillweed's scheme blocks second implementations (spec-gap REG-01/02); its cross-impl byte-equivalence *test method* (ledger RS-003) is genuinely good | ANS: impl · DW: impl (defective for interop, planned fix) |
| Discovery | Decoupled Discovery Services over TL event stream (§4.4); `_ans` TXT | Resolver wildcard/constraint queries over registry snapshot | Moderate | ANS: open indexers, no ranking semantics. DW: policy-filtered ranked selection — richer, centralized | ANS: spec (service impl not in `ans` repo) · DW: impl+tested |
| Resolution (name→invocable) | DNS + metadata URL + Trust Card fetch | DillClaw pipeline: parse→lookup→tier gate→permission→signature→rank (DillClaw §6.1) | Moderate | Dillweed resolution embeds policy evaluation; ANS resolution is retrieval + client-side verification | ANS: impl (verify) · DW: impl+tested |
| Offline verification | Stapled SCITT receipts; `ans-verify` CLI; PKI+DANE fallback (§6.4) | None (verification requires fetching PEM from one URL; no receipts) | Low | ANS materially stronger; this was a Dillweed v2 aspiration (Area 6) | ANS: impl · DW: absent |
| Freshness | Certificate validity + TL checkpoint recency + DNS TTLs; AIM drift checks | TTL'd snapshot (60s refresh, jitter/backoff), stale-while-revalidate window ≤30min, documented bounds (DillClaw §7.5) | Moderate | Dillweed's freshness semantics are more explicitly *specified per consumer*; ANS's are distributed across mechanisms | Both: impl |
| Revocation | Agent-version REVOKED event sealed in TL; DNS record removal; suppression-before-revocation quorum (§5.5, §12.9) | Per-capability soft-delete with mandatory reason, retained forever; propagation ≤1 refresh interval (Registry §8.1; DillClaw §7.5) | Moderate | Granularity (capability vs agent-version) and evidence (TL receipt vs unlogged-DB-row + convention log) | ANS: spec+impl · DW: impl+tested |
| Deprecation | First-class lifecycle state (§5.5) | None (revoke or leave; tiers can be demoted) | Low | ANS cleaner | ANS: impl · DW: absent |
| Key rotation | KMS keys with `/root-keys` history (§4.3); cert renewal cadence | §5.6 overlap-window design; `rotate-key.js`; TUF-style metadata is v2 design | Moderate | ANS delegates to KMS/PKI practice; Dillweed hand-rolled a subset (its own comparative review says adopt TUF) | ANS: impl · DW: impl (manual) |
| Trust-root distribution | CA roots + DNSSEC/DANE + published KMS keys — multiple channels (§6.1) | One PEM at one HTTPS URL + README SHA | Low | Dillweed's root reduces to one WebPKI cert (its own review, registry-vs-infra §1.1); ANS layered | ANS: impl · DW: impl (weak) |
| Delegation | Deferred (§11) | v2 design (Area 1) | None running | Both unresolved; Dillweed's design is further developed | Both: design/absent |
| Authorization | Out of scope (Layer 2/3 + local policy) | Out of scope (DillClaw §6.4 boundary) | Full agreement | Both correctly refuse this | — |
| Execution admissibility | Out of scope | Out of scope; explicitly named as the consumer's layer (§6.4 "Resolution vs. Authorization") | Agreement | Dillweed articulates the boundary more precisely | — |
| Trust scoring | Trust Index: multi-dimensional signed VCs by competing providers (§4.7); companion spec unseen | Scalar 0–1 weighted formula + tiers (DillClaw §6.2) | Moderate | Structure vs scalar; market-of-evaluators vs resolver-computed | ANS: spec-referenced (**inference: no public impl found**) · DW: impl+tested (gameable — F-1/F-2) |
| Structured evidence | Receipts, proofs, Trust Card, VC credentials | `trust_signals` array + score breakdown + trace | Moderate | Different strata: ANS evidence is registration-time cryptographic; Dillweed evidence is resolution-time evaluative | ANS: impl · DW: impl |
| Transparency logging | RFC 6962-style Merkle log, COSE receipts, consistency proofs, checkpoint anchoring (HCS-27) (§4.3, §9.1, §12.5) | Append-only-by-convention SQLite/JSONL (arch-reg S9); Merkle log is v2 W3 design | Low | **Largest one-sided gap in ANS's favor** | ANS: impl · DW: absent (design) |
| Audit logging | TL audit endpoint per agent (§4.3) | Public `/log` as conformance MUST; mandatory revocation reasons | Moderate | Dillweed's *protocol obligation* framing + reasons is distinctive; its integrity is weaker | ANS: impl · DW: impl+tested |
| Runtime integrity | Deferred (§11: ZKP/TEE) | Out of scope (Registry §11.2) | None | **Both leave unresolved**; honest in both | Both: absent |
| Behavioral monitoring | AIM: live-vs-sealed drift (§7.6); Layer 3 reputation via Trust Index | Anthill signal classes (ANT-TC/RC/DN/RA/WF/EC); mostly store-and-count today | Low | See §12 | ANS: spec (AIM not in `ans` repo — **inference**) · DW: impl (ingestion only; F-3 open) |
| Infrastructure monitoring | AIM DNS/cert checks; ops out of scope | Health endpoints; ops runbook | Low | Neither is an ops stack; both defer (Dillweed explicitly to OTel in v2) | — |
| Anomaly detection | AIM mismatch findings; quorum before action (§12.9) | Anthill escalation model — **specified, not implemented** (anthill-vs-OTel R3) | Low | ANS has running check logic in design; Dillweed has taxonomy without engine | ANS: spec · DW: spec only |
| Privacy | Minimal: query privacy out of RA scope; ECH pointer (§6.7) | Essentially unaddressed; traces record caller IDs; wildcard enumeration open (arch-res S2) | Both weak | **Both leave unresolved**; §16 details | Both: weak |
| Query confidentiality | Delegated to Discovery Services ("SHOULD" PIR/relays) | None | None | Neither delivers | Both: absent |
| Mirrors / replication | Not needed as bespoke concept: TL event stream + checkpoints + independent Discovery = verifiable replication | Mirror mode is an env-var echo; no sync protocol (mirror gap G-1..G-24: "no happy path at all") | Concept-level | ANS's architecture dissolves the problem Dillweed failed to specify | ANS: spec+impl (log side) · DW: absent |
| Federation | Topologies sketched (§8.4); multi-RA marketplace deferred (§11) | None; SPIFFE-federation noted as model in comparative review | None | Both future; ANS has a sketch | Both: design |
| Governance | LF **intent**; governance white paper explicitly deferred (§11); RA/CA/TL operator roles defined technically, not institutionally | Seven documents: framework, charter, continuity protocol, defined succession — for a participant population of zero; CDI listed as open obligation (GSP-01 §11) | Low | Opposite failure modes: ANS has institutions without instruments; Dillweed has instruments without institutions | ANS: intent · DW: spec (unexercised) |
| Continuity | Not addressed | GSP-01: trustee designation, key-custody transfer, sealed materials, disclosure timelines | None | Uniquely Dillweed; genuinely contributable | DW: spec (obligations open) |
| Dispute handling | Deferred to governance white paper (§11) | Governance Framework names mechanisms; Participant Council "not yet constituted" | None real | **Both unresolved** | Both: absent |
| Conformance testing | ≥90% coverage claim; OpenAPI; no third-party conformance suite | Per-component suites (98/77+29/62 at HEAD), 19/19 integration lifecycle; no test↔spec mapping (G-28) | Moderate | Dillweed's suites are conformance-flavored and disciplined; neither has an independent conformance program | Both: partial |
| MCP integration | Protocol Adapter translates MCP manifests into registration (§4.8); `p=mcp` DNS hint | `mcp-server/` adapter exposing resolve/lookup/verify/health as MCP tools | Moderate | Different directions: ANS registers *from* MCP metadata; Dillweed serves resolution *to* MCP clients | ANS: spec · DW: impl |
| A2A integration | First-class (Agent Cards as Protocol Cards; `p=a2a`) | Named as protocol enum + integration guide §9.2; no artifact | ANS stronger | — | ANS: spec+impl · DW: spec |
| OpenAPI integration | Protocol Card source (§5.3); OpenAPI-documented services | None (bespoke JSON API, undocumented `/health` schema — REG-26/RES-23) | ANS stronger | — | ANS: impl · DW: absent |
| Policy-engine integration | None specified (VCs "used for authorization decisions" — format only) | None specified; boundary articulated (DillClaw §6.4) but no OPA/Cedar binding | None | **Both leave the execution-policy hand-off unresolved** — the space §20 analyzes | Both: absent |
| Multi-org deployment | Designed-for (federation topologies); not demonstrated | Explicitly not yet possible (v2 design premise; FDI Profile D gates) | — | ANS closer by design; neither demonstrated | Both: undeployed |
| Public deployment maturity | No public production RA/TL identified (**inference from repo evidence**); docker/quickstart mature | Single-host macOS reference on steward's machine; public resolver gated on Issue #2 | — | See §15 | Both: pre-production |

---

## 7. ANS Architecture Analysis

### 7.1 The identity chain, end to end

Per draft-01, a registration proceeds: **AHP** (Agent Hosting Provider) submits identity, endpoints, certificates, metadata, organization data, and privacy settings (§7.1.1) → **RA** validates domain control via ACME DNS-01/HTTP-01 (RFC 8555) with all validations gating activation (§7.1.2, Table 13) → dual certificates issue: a **public-CA Server Certificate** on the stable FQDN and a **private-CA Identity Certificate** carrying the ANSName in a URI SAN — necessarily private-CA because CA/Browser Forum baseline requirements prohibit URI SANs in publicly trusted server certs (§5.4) → the RA assembles the event (hashing submitted Registration Metadata) and **seals it into the Transparency Log — "point of no return"** (§7.1.2) → DNS records (`_ans`, `_ans-badge`, TLSA) are generated by the RA and provisioned by the AHP (§7.4.1, §6.2).

The **Trust Card** (§5.3) is an optional COSE_Sign1 document at `/.well-known/ans/trust-card.json`: protocol-native metadata (A2A card / MCP manifest / OpenAPI-derived) plus ANS trust fields and a **stapled SCITT receipt**; the AIM later verifies the live card's hash against the sealed `agentCardHash` (§7.6). The **TL** (§4.3) is an append-only Merkle structure issuing COSE inclusion receipts, KMS-signed checkpoints, and consistency proofs, with read-side verification requiring no producer keys or authentication; §9.1 formalizes proof composition; §12.5 adds external checkpoint anchoring (HCS-27). The **offline verifier** consumes stapled receipts or the `_ans-badge` pointer, falling back to PKI+DANE with a recorded downgrade (§6.4). **Verification tiers are client-side descriptions of what was checked** — Bronze (PKI), Silver (+DANE), Gold (+TL proofs); "a tier describes what the client verified, not a property the RA assigned" (§6.1). The **AIM** compares live DNS/Trust Card/schema hashes against sealed state, publishes signed findings, and "cannot revoke certificates or command state changes"; the RA must not act on a single monitor's report (quorum, §12.9). The **Trust Index** (§4.7) is a three-layer framework — foundational identity (this protocol), operational maturity (verifiableClaims references: SOC 2, SBOM, HIPAA), behavioral reputation — consumed by competing providers who emit signed Verifiable Credentials; the mechanics live in an unseen companion spec.

### 7.2 What ANS proves — and does not prove

| Claim | Proven? | Mechanism / gap |
|---|---|---|
| Domain control at registration (and renewal/version-bump) | **Yes** | ACME validation (§7.1.2, §5.2.3) |
| Registration occurred, at a position in an append-only history | **Yes** | TL inclusion + consistency proofs, KMS-signed checkpoints (§4.3, §9.1) |
| Declared agent version existed with sealed metadata | **Yes** (as *declaration*) | Event + agentCardHash sealing. The metadata's *truth* is not proven — only its immutability since sealing |
| Certificate possession at interaction time | **Yes** | mTLS with Identity Certificate (§6.4) |
| Current lifecycle state | **Yes, to TL freshness** | Latest sealed event; badge/status tokens |
| Live endpoint consistency with sealed state | **Monitored, not proven** | AIM detects drift after the fact (§7.6); between sweeps, drift is invisible |
| Runtime code identity | **No** | §11 defers TEE/ZKP; version numbers are operator declarations |
| Model identity / prompt identity / tool configuration | **No** | Nothing in the chain observes them; a "version" MAY change without any of these being disclosed, and any of these can change without a version bump if the operator misbehaves |
| Behavioral integrity | **No** | Layer 3 reputation is unverified third-party signal |
| Organizational authorization of the service | **Partial** | Domain control + optional LEI correlate to an org; whether the org's *authority structure* approves the deployment is invisible (see §10 scenario 9) |

**Declarative vs cryptographically enforced:** enforced — domain control, log inclusion/consistency, certificate chains, Trust Card hash binding, DANE binding. Declarative — everything inside the metadata: display name, endpoints' semantics, `functions` arrays, verifiableClaims (references to attestations whose issuer accreditation §11 explicitly defers), release channel, and the honesty of version-bump discipline itself. ANS's cryptography guarantees *what was said and when*, not *that it is true* — the same witness-vs-endorsement boundary Dillweed's reviews criticize in the DNSO signature (strategic evaluation §2), handled by ANS with more machinery but the same epistemic limit.

---

## 8. Dillweed Architecture Analysis

### 8.1 The stack as built

Three services implement the v1 specs (repo README): the **Registry** (authoritative store; Ed25519-signs each record over ten fields via `canonicalJSON` — `registry/server.js:161–166`; public `/log` with mandatory revocation reasons; trust-tier promote/demote; mirror "mode" that only rejects writes and echoes env vars, `registry/server.js:598–614`); the **DillClaw Resolver** (60s-jittered snapshot refresh with pagination-to-completion and backoff; pipeline of tier gate → permission check → signature eligibility → per-name version preference → deterministic scoring with banker's rounding — DillClaw §6.1–6.3; persisted trace per response including early errors, `/trace/{id}`, RS-007); **Anthill** (signal ingestion with nonce/sequence replay protection; six governance signal classes; **stores but never verifies `node_signature`** — the open CRITICAL F-3, `anthill/server.js:386–399`). A thin **MCP adapter** exposes `dillweed_resolve/lookup/verify/health` as MCP tools. Test discipline is real: per-component suites, a 19/19 register→resolve→verify→revoke→propagation integration test, SHA-pinned releases, and a three-round-per-component AI-assisted review history with severity-convergence records (PROJECT_LEDGER).

### 8.2 What Dillweed proves — and does not

Proven, today: record integrity over ten fields against a published key; capability-level revocation propagating within one refresh interval (integration-tested); reconstructability of a resolution decision from its trace. Not proven, by its own corpus: **who registered anything** (shared token, spoofable `caller` — F-6); **that a `verified`/`canonical` tier means anything** (self-declared, scored at face value — F-2; Charter §4 concedes it); **that history is authentic** (`registration_date` unsigned yet worth 30% of the score — F-1); **that logs are tamper-evident** (convention only — S9); **that a mirror can exist** (G-1: no sync protocol); **that signals are attributable** (F-3). The strategic evaluation's summary stands: the v1 system does not yet deliver the standing guarantees its framing implies, and the single-key/single-steward construction structurally contradicts the neutrality thesis. The project's candor about all of this — disposition index, gap reports, falsifiable hypotheses — is its most institutionally unusual asset.

### 8.3 The convergence fact

The Dillweed v2 design (2026-06-10) proposes, area by area: domain-proof and OIDC registrant identity (Area 1), signed checkpoints and delta feeds replacing the mirror hash (Area 2), OTel re-layering for Anthill (Area 3), offline root + intermediate + KMS custody (Area 5), and an RFC 6962/Rekor transparency log with inclusion/consistency proofs and monitors (Area 6). **Every one of these is a pattern ANS v2 had already specified — and, for the RA/TL/verifier core, implemented — in the April 2026 draft and the `ans` repository.** This is independent convergence on the same prior art (CT, ACME, SCITT, TUF), not derivation; but its strategic consequence is blunt: Dillweed's v2 infrastructure roadmap now largely describes work whose ANS equivalent exists in runnable, multi-SDK, institutionally sponsored form. Building it again would be duplication in the precise sense Dillweed's own comparative reviews warn against.

---

## 9. Capability-Standing Boundary Analysis

### 9.1 Definition

From the Dillweed corpus (research summary; DillClaw §6.4; strategic evaluation §1): **capability standing** is the current, evidence-backed status of a named capability at the moment of intended use — comprising at least: (a) the capability is what its signed record claims (integrity), (b) an identifiable authority governs the record (governance), (c) that governance is current — not revoked, not stale (currency), and (d) the evaluation that concluded (a)–(c) can be reconstructed later (auditability).

### 9.2 What kind of thing is it?

Testing the brief's candidates against the evidence: it is **not** inherently a new protocol object (nothing in (a)–(d) requires a new wire format or namespace); it is **not** a trust score (the score is one lossy projection of it — Dillweed's own §6.4 keeps them apart); it **is** best characterized as **a resolution-time evaluation over an evidence bundle**, where the bundle's elements come from identity infrastructure, registration infrastructure, and lifecycle state. "Capability standing" is a useful *term* because no surveyed system evaluates that bundle at capability granularity; it becomes an *unnecessary term* the moment it is used to imply that a new root of trust is required. The concept survives; the packaging does not.

### 9.3 Element-by-element: does ANS already supply it?

| Standing element | ANS supplies? | Detail |
|---|---|---|
| Capability identifier | **Indirectly/weakly** | `functions[].id` inside Trust Card endpoints (App. A.1/A.2) — a label, not an identity: no uniqueness regime, no lifecycle, not independently addressable |
| Provider identity | **Fully** (agent/domain level) | ANSName + certificates + ProviderID + optional LEI |
| Governing authority | **Partially** | Domain owner is the authority for everything under the registration; per-capability or delegated authority absent |
| Signature validity | **Fully** (card level) | COSE_Sign1 Trust Card + sealed hash — covers the whole card, not per-capability |
| Registration state | **Fully** | TL events, badge, status tokens |
| Current version | **Partially** | Agent version yes; capability version does not exist |
| Revocation state | **Partially** | Agent-version REVOKED/DEPRECATED yes; per-capability no (§5.5) |
| Freshness | **Partially** | Receipt/checkpoint recency + cert validity; no per-record resolution-time freshness contract like DillClaw §7.5's bounded TTL semantics |
| Constraints (permissions etc.) | **Not really** | `securitySchemes` and endpoint metadata exist; caller-facing permission vocabulary with resolver-side filtering does not |
| Endpoint binding | **Fully** (agent level) | Endpoints array sealed via card hash; DANE binds the TLS cert |
| Policy profile | **No** | No notion of caller trust policy in resolution |
| Delegation | **No** | Deferred (§11) |
| Provenance | **Partially** | `supersedes` chain, TL history; software/artifact provenance (SBOM) only as declarative verifiableClaims |
| Runtime evidence | **No** | Deferred (both projects) |
| Resolver evidence (why *this* candidate) | **No** | Discovery Services are indexes; no selection semantics, no trace |
| Monitoring evidence | **Partially** | AIM findings exist as signed public reports; consumption at resolution time unspecified |
| Audit trace of the standing decision | **No** | Nothing in ANS records what a relying party checked (the Bronze/Silver/Gold tier is the *client's* self-knowledge, unrecorded) |

### 9.4 The decisive question: what decision does Dillweed standing enable that ANS evidence does not?

Stated directly, per the brief's demand. After complete, honest ANS Gold-tier verification of an agent, a relying party still cannot decide:

1. **"May I still use function X of this agent?"** when X (one of many) has been withdrawn, compromised, or contract-changed without the operator cutting a new agent version — or when the operator *has* cut a new version but the relying party's question is about the function contract, not the codebase. ANS state is version-scoped; the invocation is function-scoped.
2. **"Which of several candidate implementations of the function I need should I select under my policy (minimum assurance tier, required permissions, version range), and how do I prove later why I selected it?"** ANS discovery returns candidates; it performs no policy-filtered ranking and records no decision. Dillweed's resolver pipeline + trace is precisely this, and it is the *only* piece of Dillweed for which no ANS analog exists even in design.
3. **"Was this specific capability's standing current at invocation time?"** at capability granularity with a documented propagation bound (DillClaw §7.5's ≤1-refresh-interval revocation guarantee). ANS gives agent-version state with freshness distributed across cert validity, TL recency, and AIM sweep cadence — real, but not a per-invocation contract.

These are genuine decisions, so the concept is **not** merely semantic. But note what they have in common: all three are *evaluation and lifecycle-granularity* functions. None requires Dillweed's registry to be a root of trust, its trust root to exist, its mirror protocol to exist, or its namespace to be global. Every input either already exists in ANS (identity, sealed metadata, lifecycle events, receipts) or is a schema/lifecycle extension (capability-level records and revocation) plus a consumer-side evaluator (the resolver). That is the architecture of a **profile + evidence layer**, and it is the honest resolution of the boundary question.

---

## 10. Lifecycle and Revocation Comparison

Mechanism inventory: ANS — six lifecycle states (§5.5), version-bump-as-new-registration (§7.2), `supersedes` chaining and FQDN-anchored reputation (§5.2.3), ACME re-validation + RDAP monitoring + provider-mismatch forced revocation (§5.2.3), suppression-before-revocation with monitor quorum (§12.9), certificate expiry as a hard backstop, TL as permanent history. Dillweed — per-record soft-delete revocation with mandatory reason retained indefinitely (Registry §8.1), tier promote/demote as a lifecycle-adjacent governance channel, no expiry (`not_after` is v2 design — its own comparative review calls the revocation-only lifecycle a repeat of pre-Let's-Encrypt PKI failure), TTL-bounded propagation with stale-while-revalidate and a documented adversarial freeze window up to 30 minutes (F-7), key-rotation overlap design (§5.6) unexercised.

The brief's ten scenarios:

| # | Scenario | ANS v2 | Dillweed | More natural fit |
|---|---|---|---|---|
| 1 | One of ten capabilities compromised | Revoke the whole agent version (over-broad, disables nine good functions) or bump to a version without the function (a replacement masquerading as remediation; old version lingers until DEPRECATED/REVOKED). Either way the TL never records *which capability* was the problem. | `POST /revoke` on that record with a logged reason; propagation bounded; other records untouched. | **Dillweed**, decisively — this is its core scenario |
| 2 | Agent valid, one endpoint withdrawn | Same coarseness: endpoints live inside the sealed card; changing the set = new version. AIM will flag live-vs-sealed drift if the operator edits the card without re-registering — treating remediation as a violation. | Endpoint is per-record; withdraw/re-register that record. | **Dillweed** |
| 3 | Capability delegated to another operator | No mechanism; worse, §5.2.3's provider-mismatch logic actively revokes when a different ProviderID registers on an FQDN. | No mechanism in v1; delegation is v2 design (Area 1.2.1). | **Neither** (Dillweed by design intent only) |
| 4 | Software changes, advertised capability stable | Forced new registration ("every change… requires a new version," §1.5): correct for identity, noisy for consumers who pinned the *function* contract; `supersedes` preserves continuity. | Capability version can stay if the behavioral contract is unchanged; the software is invisible to Dillweed (endpoint-level opacity). | **Split**: ANS truer to code identity; Dillweed truer to contract identity. Both are partial |
| 5 | Model changes without declared version change | Undetected. Version discipline is operator honesty; AIM checks DNS/card hashes, not runtime. | Undetected. Nothing observes the endpoint's internals. | **Both leave unresolved** — a shared, honest gap (both defer runtime attestation) |
| 6 | Capability revoked while resolver/discovery offline | ANS: stapled receipts keep *positive* verification working offline, but a stale stapled receipt also keeps a revoked agent looking valid — staleness is bounded by receipt/checkpoint freshness policy, which the draft leaves to the verifier. | Documented failure mode: stale-while-revalidate serves pre-revocation data up to the stale window (≤30 min), disclosed via `stale: true`; adversarially inducible (F-7). | **Split**: Dillweed specifies and bounds the window explicitly; ANS's offline-verification strength is also its revocation-blindness. Neither solves offline revocation (nobody has; cf. OCSP stapling history) |
| 7 | Registered domain changes ownership | **ANS's best scenario**: ACME re-validation at renewal, RDAP registrant monitoring, forced revocation on provider mismatch (§5.2.3). | No concept of domains; registrant identity absent in v1, so a hostile "transfer" is just… someone with the token. | **ANS**, decisively |
| 8 | Trust Card current, runtime changed | Undetected by design; AIM validates card-vs-sealed, not card-vs-runtime. | Same gap (record-vs-endpoint). | **Both unresolved** |
| 9 | Certificate valid, organization no longer authorizes the service | Invisible: domain control ≠ org authorization; a rogue team with DNS control passes every check. LEI helps correlation, not authorization. | Equally invisible, one layer down (no org identity at all). | **Both unresolved**; ANS at least names the org |
| 10 | Disable one capability without revoking the agent | Not representable (see 1). Suppression (§12.9) is agent-scoped too. | The system's native operation. | **Dillweed** |

**Reading:** ANS wins where identity meets internet infrastructure (7), and its lifecycle evidence (TL receipts for every transition) is categorically stronger than Dillweed's convention-only log. Dillweed wins wherever the *unit* of lifecycle action is the capability (1, 2, 10) — which is exactly the granularity at which execution decisions are made. Scenarios 5, 8, 9 fail identically in both systems and define the shared boundary with runtime attestation and organizational IAM.

---

## 11. Transparency and Audit Comparison

Separating the strata, as required:

- **Cryptographic transparency.** ANS: implemented — Merkle log, COSE inclusion receipts, consistency proofs, KMS-signed checkpoints, external anchoring, offline verifier, explicit "verification MUST NOT require producer keys or authentication" (§4.3, §9.1, §12.5). Dillweed: **none at HEAD**. Registry `/log`, Anthill JSONL/SQLite, and traces are append-only by convention (arch-reg S9; anth S6); the Merkle/Rekor log is v2 W3 design. The mirror snapshot-hash mechanism claims a transparency-like property ("without trusting the mirror") that its own gap report demonstrates false (G-11) — the claim persists in published Registry Spec §2.2 (doc-set review C3).
- **Operational logs.** Both have them; neither's are evidence-grade. Dillweed's are at least public-by-conformance-requirement.
- **Application traces.** Dillweed only: per-resolution persisted traces reconstructing the decision (RS-007 covers even early-error paths). ANS has no analog anywhere in the draft. This is Dillweed's strongest transparency asset and it is *orthogonal* to log transparency — it witnesses the relying party's evaluation, not the registry's history.
- **Monitoring telemetry.** ANS AIM findings are "public and signed" feeds (§12.9) — evidence-shaped. Anthill signals are currently unauthenticated (F-3) and therefore evidentially worthless until node-key verification lands; the project knows this.
- **Governance records.** Dillweed: mandatory revocation reasons, promotion audit entries, attestation-evidence retention rules (Charter §4.1) — a genuinely distinctive *accountability vocabulary*. Whether ANS revocation events carry structured reasons is **not established from the reviewed material** (uncertainty flagged); nothing in the draft summary indicates a mandatory-reason rule.
- **Behavioral evidence.** Neither produces any, cryptographically.

**Claims Dillweed should narrow because ANS's evidence is stronger:** "append-only audit log" → "public audit log, append-only by convention; tamper-evidence planned" (the disposition index already imposes this discipline — FDI-XST-002); the §2.2 mirror tamper-evidence claim → withdraw or caveat now, not at W3; "publicly verifiable trust root" → "published trust root" (strategic evaluation §10 already directed this). **Evidence types Dillweed has that ANS does not:** resolution traces; mandatory revocation reasons; the (designed) Registry-corroboration verdicts and completeness attestation (Anthill A.10/A.7) — noting the latter two are unbuilt and must not be claimed.

---

## 12. AIM versus Anthill

**What AIM detects** (draft §7.6, §2.2, §12.9): DNS pointer presence/validity under DNSSEC (`_ans`, `_ans-badge`), Trust Card hash vs sealed `agentCardHash`, schema-URL content hashes vs card, distinguishing Unreachable from Mismatch; plus (via §5.2.3) RDAP registrant-entity drift. In the brief's vocabulary: DNS drift ✔, certificate drift ✔ (TLSA/DANE), Trust Card drift ✔, principal-binding changes ✔ (RDAP), endpoint inconsistency ✔ (as published-metadata drift, not liveness), lifecycle mismatch ✔ (live-vs-registered). Its governance posture is exemplary: monitors report, RA acts, quorum required, evidence re-verified (§12.9). Caveat: AIM is **specified in the draft; no AIM implementation appears in the `agentnameservice/ans` repository** (inference from repository contents) — so today it is a design with strong bones, not a running service.

**Anthill's six signal classes, individually judged:**

| Signal | Concern | Already in AIM? | Verdict |
|---|---|---|---|
| ANT-TC (trust-tier drift) | Governance-tier changes over time | No — ANS has no governed tiers; nearest analog is TL lifecycle events, which Trust Index providers would watch | **Outside AIM's scope but tied to Dillweed's weakest mechanism** (unverified tiers). Retain only if tiers survive redesign as verifiable attestations; otherwise retire with them |
| ANT-RC (revocation cascade) | Propagation of a revocation across resolver fleet | No — ANS has no resolver fleet concept | **Genuinely outside AIM**, and the project's own review (anthill-vs-OTel R6) shows it is a *distributed-tracing* problem: implement as W3C trace context on OTel, not a bespoke class |
| ANT-DN (deceptive namespace paths) | Look-alike path registration | Not in AIM; ANS inherits DNS's mature homograph/squatting machinery for the domain part, nothing for function labels | **Real concern in any namespace**; for a capability layer riding ANS, the residual surface is capability labels — small but nonzero. Keep as a *policy check at registration*, not a telemetry class |
| ANT-RA (resolver abuse) | Misbehaving resolver nodes | No — no ANS analog | Outside AIM. But currently *self-defeating*: unauthenticated signals mean ANT-RA can be used to frame victims (F-5). Worthless until node identity lands; then legitimate |
| ANT-WF (wildcard fanout anomalies) | Enumeration/abuse via wildcard queries | No — ANS discovery has no wildcard semantics | An ordinary rate/shape anomaly: **better implemented as OTel metrics + alerting**, per the project's own R2/R3 analysis |
| ANT-EC (ecosystem concentration) | Provider concentration as neutrality risk | No; ANS Trust Index *could* compute it from TL data | **Genuinely novel as a governance metric**; also the most speculative. A research artifact, not a service |

**Account of Anthill's current limitations, as required:** `node_signature` is stored, never verified (CRITICAL F-3, open at HEAD); sequence counters key on the unauthenticated node string (F-4); replay reflection can frame victims (F-5); the escalation/threshold engine "does not exist in code" (anthill-vs-OTel R3); the wire protocol is under-specified for any second emitter (emitter gap GAP-01/02). Anthill today is, in its own reviewers' words, a signal store.

**Judgment:** AIM and Anthill overlap far less than their "integrity monitoring" labels suggest — AIM watches *registered agents' public surface vs sealed state*; Anthill watches *the coordination layer's own operators*. AIM's design should be adopted as the model for governance posture (report-don't-act, quorum, signed public findings — Anthill's spec has no equivalent restraint written down). Anthill's distinct ideas reduce to: the adversarial-reporter evidence model (keep, as the OTel-carried signed-envelope design in v2 Area 3), Registry corroboration (keep — no generic tool can do it), ANT-EC as a research metric (keep on paper), and everything else delegated to OTel/Prometheus/Alertmanager exactly as the project's own comparative review concluded. Anthill as a deployed parallel service should not survive.

---

## 13. Trust-Evaluation Comparison

**ANS Trust Index** (§4.7): three data layers; evaluation performed by *any number of competing providers* crawling TL events plus external claims and reputation; output is a signed Verifiable Credential consumed by the client's authorization layer. "No single source controls the evaluation." The client-side Bronze/Silver/Gold tiers are a separate axis: descriptions of verification depth performed, not assigned trust. **Dillweed**: four governed tiers assigned/attested by the steward (currently accepted at self-declaration and scored at face value — F-2, Charter §4), plus a pinned scalar formula (0.40·tier + 0.30·history + 0.20·sig + 0.10·liveness, banker's-rounded; DillClaw §6.2) computed *by the resolver*, with an honest §6.4 disclaimer that the score is not probability, guarantee, or authorization.

The brief's questions, answered directly:

- **Can scores from different ANS Trust Index providers be compared?** No — nothing in the reviewed material defines inter-provider comparability, calibration, or a common scale; the market-of-evaluators model makes comparability a consumer problem. (Dillweed answers the analogous question honestly: scores are profile-relative and incomparable across profiles, §6.4.)
- **Who accredits claims and attestors?** ANS: explicitly deferred ("verifiable claim type standards and issuer accreditation," §11). Dillweed: the DNSO accredits itself. Neither has a real answer.
- **How are inputs authenticated?** ANS Layer 1 inputs: cryptographically (sealed events). Layer 2/3: references and reputation with no authentication regime specified. Dillweed: signature and tier inputs authenticated to the (single) key; history input **unauthenticated** (F-1); liveness input resolver-observed.
- **How are behavioral signals weighted?** Neither system specifies; ANS delegates to providers, Dillweed has no behavioral signals at all.
- **Can trust evaluation be reproduced?** Dillweed: yes within a profile — genuinely, this is its best property (pinned formula, pinned rounding, trace) — though its own reviews show the determinism MUST is over-broad (wall-clock history, liveness cache; RES-12, C10). ANS: unknowable per provider.
- **Should trust decisions be made by the identity layer?** No — and both projects agree in principle: ANS pushes evaluation out to providers and clients; DillClaw §6.4 pushes authorization out to the consumer. ANS's separation is architecturally cleaner (the RA neither computes nor blesses any score); Dillweed's resolver both evaluates and ranks, which concentrates gameable judgment in infrastructure.
- **Should Dillweed abandon scalar scores?** **Yes.** The evidence is cumulative: 30% of the score rests on an unsigned field (F-1); 40% on a self-declared tier (F-2); the ranges table (§6.4) invites threshold-policy misuse the same section disclaims; the project's own research agenda (H-question 4) asks whether the scalar causes overconfidence versus structured evidence. The `trust_signals` vector plus the score *breakdown* already carries all the information; the scalar adds only false comparability.
- **Would a structured capability-standing evidence vector be more defensible?** Yes — and it aligns with both systems: it is the Trust Card/receipt/VC shape on the ANS side and the `trust_signals`+trace shape on the Dillweed side. §19 sketches it.

**Recommended division of labor:** *evidence generation* — identity layer (ANS RA/TL) and capability layer (records, lifecycle events, resolver observations); *evidence verification* — relying-party libraries (offline verifiers) and resolvers, never trusting the generator; *scoring* — optional, competitive, outside infrastructure (Trust Index model), always signed and profile-labeled; *local policy* — the consumer's, expressed over the evidence vector, not over anyone's scalar; *authorization* — the consumer's policy engine, full stop.

---

## 14. Governance and Neutrality

**ANS.** What exists: an individual Internet-Draft; a Linux Foundation **intent** announcement (2026-06-23) naming vendor-neutral stewardship as a goal; multi-vendor authorship (GoDaddy, OWASP, Cisco, DistributedApps.ai) and quoted supporters; an open-license reference implementation. What does not yet exist, by the draft's own §11: the governance white paper (name allocation, fee model, dispute arbitration, root-CA stewardship), the federated multi-RA "CA/Browser-Forum-analog" body, issuer accreditation, and any operational answer to who runs the Private CA whose root every Identity Certificate chains to. Institutional sponsorship is not completed governance: today, concretely, ANS governance is a stated intention plus technically well-separated *roles* (RA/TL/KMS/Discovery/Trust Index/AIM, §4.1) whose institutional occupants are undefined. The role separation itself is genuine neutrality engineering — RA cannot act on one monitor's word; TL verification needs no one's permission; discovery is competitive; checkpoint anchoring removes even the TL operator from sole custody of history (§12.5, §12.8). Commercial incentives are visible and undisguised (registrars and DNS operators are natural RA/AHP businesses); the open-protocol posture (§1.7 "any organization can operate…") is the counterweight on paper.

**Dillweed.** The inverse profile: elaborate written instruments (Governance Framework with TSC/Participant Council evolution; Operations Charter with attestation procedures and evidence-retention rules; GSP-01 continuity protocol with trustee designation, sealed recovery materials, key-custody transfer, disclosure timelines, and four named transition paths including the "licensed neutral operator model") — for an ecosystem of one steward, zero participants, with GSP-01 §11 listing its own core instruments (CDI execution, sealed materials, attorney custody) as open obligations at publication, and the strategic evaluation finding governance volume ~3× the defensible scope. Single-key, single-steward signing contradicts the neutrality thesis structurally (strategic evaluation §1); the continuity protocol's §10 candor ("single-steward concentration… accepted during the founding phase only") is to its credit.

**Determinations required by the brief:**

- **Governance issues ANS has already solved:** none institutionally; several *architecturally* (role separation, monitor quorum, log verifiability without operator trust, anchored history). Nothing else should be credited yet.
- **Which remain future work:** everything institutional — for both projects. ANS's dispute handling, accreditation, root stewardship: deferred. Dillweed's councils: unconstituted.
- **Redundant Dillweed governance concepts:** the DNSO as sole global signer and tier-endorser (superseded architecturally by ANS's distributed roles); the mirror-governance surface (moot without a mirror protocol, dissolved by transparency-log architecture); the L1–L4 "coordination root" framing (Namespace Standard §9 — the strategic evaluation already recommends retiring it).
- **Could Dillweed continuity research contribute to ANS?** Yes, concretely: ANS's deferred governance white paper needs exactly what GSP-01 has drafted and nobody else has — operator-death/incapacity procedures, key-custody transfer with sealed materials, disclosure timelines, neutrality covenants running with assets. A generalized "registry-operator continuity protocol" (steward-neutral, ANS-role-aware: what happens when an RA, TL, or private-CA operator fails) is the single most contribution-ready Dillweed governance artifact. The continuity-fire-drill research design (research doc, project #2) applies verbatim to ANS operators.
- **Does a capability profile need independent governance?** Minimal, not zero: capability-label allocation/dispute rules within a provider's own scope, and the evidence-schema change process. It does **not** need an independent root of trust, and should be subordinate to (i.e., consume, not compete with) ANS agent/domain governance for identity questions. Capability-level policy authority belongs to the domain owner and the relying party, with any cross-provider curation living where Trust Index providers live — outside the identity layer.

---

## 15. Deployment Maturity

Evidence only; sponsor names and repo stars are excluded from the maturity judgment.

| Deployment property | ANS evidence | Dillweed evidence | Stronger current position | Remaining uncertainty |
|---|---|---|---|---|
| Local reference deployment | `ans` repo: 60-second quickstart, Docker Compose with healthchecks, Make targets; RA+TL+verifier+dev-DNS run locally | Installer-based macOS deployment, launchd services, Keychain tokens; verified single-host stack (`dill-p-001`) with steward sweep records | Roughly even; different shapes (containers vs installers) | Neither independently reproduced by a third party on record |
| Public endpoint deployment | None identified in reviewed material (inference) | None; explicitly gated on Issue #2 | Even (neither) | ANS side unverified — a hosted RA/TL could exist unadvertised |
| Independent third-party operation | None evidenced | None; "no externally registered capability" (strategic eval §8) | Even (neither) | — |
| Federation | Topology sketch only (§8.4); multi-RA deferred | None; mirror protocol nonexistent (G-1) | ANS (has a coherent sketch and log architecture that supports it) | Unimplemented both sides |
| High availability | SQLite default, "Postgres noted as production alternative"; no HA demonstrated | Single SQLite writer; v2 states single-hardened-instance posture explicitly | Even (neither); Dillweed's posture is at least documented | — |
| Key rotation | KMS key history endpoint (`/root-keys`); cloud-KMS adapters *planned* | §5.6 overlap design + `rotate-key.js`; never exercised under load; resolver-side reload requires restart (S8) | ANS (design integrates KMS practice) | Neither has performed a real rotation on record |
| Recovery | Not evidenced | Operations runbook with recovery procedures; continuity protocol; **instruments unexecuted** | Dillweed (documented procedures exist) | Unexercised |
| Conformance | OpenAPI specs; ≥90% coverage claim (self-reported) | Component suites 98+77/29+62 + 19/19 lifecycle integration + spec-gap report proving *second* implementations blocked (9 blockers) | Dillweed for test discipline; Dillweed *against* itself for cross-impl conformance | ANS suites not independently run |
| Operational monitoring | Healthchecks; AIM unimplemented in repo | `/health` on all services (schema undocumented — REG-26); Anthill ingestion only | Even/weak | — |
| SDK availability | Java, Go, Rust SDKs + Homebrew/Scoop | None (bespoke HTTP + one MCP adapter) | **ANS, clearly** | SDK depth/quality not audited |
| Language support | Go core; three SDK languages | Node.js only | ANS | — |
| Reproducibility | Docker + pinned releases (v0.1.6) | SHA-pinned tarballs with verified asset digests; macOS-only; no CI | Split: ANS for environment portability, Dillweed for artifact pinning rigor | — |
| Production claims | None found (to its credit) | None ("production-grade largely not claimed" — doc-set review §8) | Even; both honest | — |
| Institutional adoption | Multi-org authorship and LF intent are *interest* evidence, not deployment evidence | Zero external engagement on record (0 forks, single-day trace corpus, `caller_id: null`) | ANS on interest; even (nil) on adoption | LF launch outcome unknown |

**Summary:** both are pre-production reference systems. ANS's maturity edge is breadth (SDKs, containers, standard envelopes, institutional runway); Dillweed's is depth-of-audit on a narrow deployment (pinned releases, lifecycle integration test, disposition-tracked findings). Neither has a public deployment, an independent operator, a demonstrated rotation, or a production claim. Any Dillweed positioning that implies ANS is "just a draft" would be false (there is a tested Go implementation); any ANS-side assumption that LF sponsorship equals operational maturity would be equally false.

---

## 16. Security and Privacy Comparison

### 16.1 Threat-by-threat

Severity of residual risk is judged against each system's *stated* deployment target (ANS: internet-scale federation; Dillweed: currently single-operator reference).

| Threat | ANS mitigation | Dillweed mitigation | Residual risk | Stronger design | Cross-project learning |
|---|---|---|---|---|---|
| Registration impersonation | ACME domain validation before activation (§7.1.2); provider-mismatch revocation (§5.2.3) | None in v1 — shared token; open-write default binds 0.0.0.0 (F-6) | ANS: subdomain-takeover-grade attacks. DW: total (token compromise = arbitrary signed records) | **ANS** | DW v2 Area 1 should adopt ACME-style proof outright (it already plans to) |
| Domain takeover | RDAP monitoring + re-validation + forced revocation (§5.2.3) | N/A (no domains) — but the trust root itself hangs off `dillweed.com`'s WebPKI cert | ANS: window between takeover and detection. DW: root-level single point | ANS | DW's root distribution needs DNSSEC/DANE or TUF metadata (its own review, integration point 5) |
| Certificate/key compromise | Dual certs limit blast radius; KMS custody; TL makes post-compromise history rewriting evident | Root Ed25519 key `readFileSync` into the public HTTP process (S5); rotation designed, unexercised | ANS: private-CA root compromise remains catastrophic (accreditation deferred). DW: catastrophic and *undetectable* (no log proofs) | **ANS** | DW v2 Area 5 = ANS/PKI practice; adopt rather than rebuild |
| Stale lifecycle state | Stapled receipts age; verifier freshness policy unspecified in draft | Bounded stale window with disclosure (`stale: true`), documented adversarial freeze ≤30 min (F-7) | Both real | **Dillweed for explicitness** — the bound is specified and tested | ANS verifiers should specify maximum receipt age the way DillClaw §7.5 specifies TTL semantics |
| Malicious discovery service | Structural: discovery is untrusted by design — clients verify signatures/receipts independently of the index (§4.4) | N/A (resolver is trusted infrastructure) | ANS: low (integrity), though *ranking/omission* bias by an index is unaddressed | ANS | Omission bias is exactly what DW's completeness-attestation idea (Anthill A.7) targets — a genuine contribution candidate |
| Malicious resolver | Out of ANS's model | DillClaw is a trusted component; a hostile resolver can filter, re-rank, forge scores. Signature pass-through (§3.3) lets clients re-verify records, but not the *selection* | DW: high in multi-party deployment; traces help only if the resolver is honest enough to keep them | ANS (by having less trusted middle) | Signed resolution traces (resolver-signed, optionally logged) would make DW selection auditable — profile field in §19 |
| Transparency-log equivocation | Consistency proofs + checkpoint gossip + external anchoring (HCS-27, §12.5) | No transparency log to equivocate; the registry can rewrite history undetectably (S9) | ANS: split-view attacks bounded by monitor/gossip deployment. DW: total | **ANS** | — |
| Trust Card substitution | Card hash sealed in TL; AIM drift detection (§7.6) | Record signature over 10 fields; **unsigned `registration_date`/`tags` alterable in transit/at mirrors** (F-1, G-13) | ANS: low. DW: score-manipulation channel open | **ANS** | DW W2 signed-field fix is mandatory regardless of any ANS decision |
| Capability substitution (swap function behind a name) | Not modeled — functions are card metadata; substitution within an unchanged card is invisible; card change = drift detection | The core protected object: name+version+schemas signed; revocation per capability | DW's one clear security win, *contingent on* fixing registrant identity (else F-6 defeats it) | **Dillweed (architecturally)** | The capability-record signing discipline is the thing to carry into an ANS profile |
| Endpoint redirection | Endpoint in sealed card; DANE pins TLS cert; mTLS binds identity | Endpoint signed in record; no TLS/identity binding at invocation (invocation is out of scope) | DW: post-resolution redirection unmitigated (client's problem) | ANS | Profile should bind capability endpoints to ANS Identity-Certificate verification at invocation |
| Replay | Nonces in ACME; receipts are position-bound; mTLS freshness | Anthill nonce+sequence (unauthenticated → F-4/F-5 abuse); resolver layer: none needed (read-only) | DW: replay protection itself is an attack surface until keys verify | ANS | — |
| Downgrade | Verification-tier model makes downgrade *visible* (client knows which tier it achieved; §6.4 records PKI fallback) | `allow_unsigned` caller flag is explicit opt-in (RS-001/002); diagnostic mode explicit | Both handle adequately | Even | ANS's "record the downgrade" idiom is worth copying into resolver traces |
| Metadata tampering | Sealed hashes | Signed subset; gaps as above | — | ANS | — |
| Forged telemetry | AIM: signed public findings, quorum before action (§12.9) | Anthill: **F-3 open — signals unauthenticated, sequence poisoning (F-4), framing via replay (F-5)** | DW: an adversary can currently manufacture governance evidence against a victim | **ANS** | Adopt AIM's report-don't-act + quorum posture verbatim in any Anthill successor |
| Trust-score manipulation | Displaced to Trust Index providers (unassessable; companion spec unseen) | Demonstrated composite: backdate `registration_date` (F-1) + self-declared tier (F-2) → top trust band | DW: concrete and open. ANS: unknown | Neither proven; DW's is at least documented | Abandoning the scalar (§13) removes the target |
| Organizational correlation | LEI is *deliberate* correlation; public TL exposes org registration patterns | Registrant identity absent (nothing to correlate — a privacy property by accident) | ANS: real for orgs wanting unlinkability | DW (accidentally) | Profile design must decide what is *not* published globally (§19.3) |
| Query surveillance | Out of RA scope; discovery "SHOULD" use PIR/relays (§6.7) — unenforced | None: resolver logs every query with optional caller/session headers into traces; 72h+ retention | Both weak; DW's audit strength is precisely a surveillance surface | Even (opposite trade-offs) | Trace retention policy + caller-ID minimization needed if a public resolver ever ships (Issue #2) |
| Ecosystem concentration | Federation is the answer on paper; single-operator risk named (§12.8) with anchoring as mitigation | ANT-EC names the risk; single-steward reality *is* the risk | Both aspirational | ANS (mechanism sketched) | ANT-EC as a metric could run over ANS TL data — contribution candidate |
| Compromised RA | Per-event `raId` isolates fraudulent events (§12.6); TL immutability limits cover-up | N/A (registry *is* the RA-analog and sole signer) — compromise is total | — | **ANS** | — |
| Compromised root (CA/DNSO) | Catastrophic both; ANS at least detects *what was issued* via TL | Catastrophic and silent | — | ANS | — |
| Partial mirror views | Consistency proofs make a lying mirror/log detectable | G-11: freshness fields self-reported; "without trusting the mirror" claim false as specified | DW: unmitigated (and unimplemented anyway) | **ANS** | Retire the snapshot-hash design; this is settled |
| Malicious/negligent operator | Role separation + monitors + anchoring constrain each operator | Governance documents constrain the steward *procedurally*; nothing constrains technically | — | ANS | The honest DW statement is: v1 requires trusting the steward; ANS requires trusting less |

### 16.2 Privacy analysis

Both projects publish names and metadata globally by default, and neither has a real query-confidentiality story. Specifics: **public names** — ANS names embed organizational FQDNs (endpoint enumeration of an org's agent estate via TL/discovery is trivial and permanent; the TL's immutability makes *deregistration* impossible as a privacy remedy); Dillweed paths reveal business function taxonomy but not (in v1) the registrant. **Capability enumeration** — Dillweed's wildcard queries make enumeration a first-class feature (`≤200` matches per query; arch-res S2 flags unbounded namespace enumeration); ANS discovery indexes are equally enumerable by design. **Behavioral tracking** — Dillweed traces + `X-DillClaw-Caller`/`X-DillClaw-Session` headers create a caller-behavior corpus at the resolver (1,373 trace files at review time demonstrate the accumulation pattern); ANS's Layer 3 reputation *institutionalizes* behavioral tracking at Trust Index providers with no specified consent or minimization regime. **Cross-service correlation** — ANS's optional LEI is explicit; combined with DNS records, TLS handshakes, and TL history it gives observers a rich correlation graph. **Operator visibility** — every ANS RA/TL/Discovery/Trust Index operator sees registration and query flows in their segment; every Dillweed resolver operator sees callers' capability needs in full. **Minimum necessary disclosure** exists as a principle in neither document set (ANS registration accepts "privacy settings" (§7.1.1) whose semantics were not visible in the reviewed material — flagged as uncertainty). A capability-standing profile has one genuine privacy opportunity: keeping capability-level policy and standing evaluation *local* to the relying party, publishing globally only what identity requires (§19.3).

---

## 17. Standards and Protocol Reuse

| Standard | ANS v2 | Dillweed v1 (+v2 design) | Assessment |
|---|---|---|---|
| DNS | Foundation: names, `_ans`/`_ans-badge` TXT, TLSA | Analogy only (DillClaw spec §13 maps where it holds/breaks); no mechanism reuse | ANS reuses; DW re-instantiates the pattern without the infrastructure |
| DNSSEC | Required for Gold-tier record verification (§6.3) | Absent; recommended by own review for root anchoring | ANS reuses |
| ACME (RFC 8555) | Registration-time domain validation | Absent; v2 design adopts the DNS-01 idea | ANS reuses; DW plans to |
| X.509 / PKI | Dual-cert model, private CA, OCSP/CRL for server certs | None; raw Ed25519 with bespoke format | ANS reuses; DW's avoidance is *defensible* for record signing (simpler) but couples to a bespoke verification procedure |
| OAuth 2.0 / OIDC | OIDC on RA admin surface (repo); not part of the protocol trust model | Absent; v2 design adopts OIDC trusted publishing for registrants | Both partial; DW's planned use (registrant identity) is the right pattern (PyPI/npm precedent) |
| SPIFFE/SPIRE | Not referenced; §11's TEE/runtime deferral is adjacent | Not used; comparative review correctly maps it as complementary (workload identity ≠ capability standing) | Neither reuses; both defer runtime/workload identity — correctly |
| DIDs / VCs | DIDs deferred (§11); Trust Index outputs are signed VCs; LF announcement names DIDs | Absent | ANS partial |
| Sigstore | Not used (own KMS/CA stack) | Absent; v2 design and comparative review recommend Rekor/keyless patterns | Open question *for ANS* whether its private-CA + KMS stack duplicates what Sigstore infrastructure offers; for DW the answer is already written in its own docs: adopt, don't rebuild |
| SCITT | TL "MUST operate as a SCITT Transparency Service," COSE receipts (§4.3); formal compliance listed as remaining work (§11) | Absent | ANS aligned-with (not yet compliant — the distinction matters and the draft admits it) |
| Certificate Transparency (RFC 6962) | Leaf hashing per RFC 6962 (repo); Merkle proofs | Absent; v2 W3 plans it | ANS reuses |
| OpenTelemetry | Not addressed (monitoring is AIM-specific) | v1 rebuilt the stack bespoke; v2 Area 3 re-layers onto OTel | DW's own verdict stands: delegate. An ANT-\*-style *semantic convention* is the reusable part |
| MCP | Protocol Card ingestion; `p=mcp` discovery hint | `protocol: "mcp"` enum + working MCP adapter | Complementary directions; both legitimate |
| A2A | First-class card ingestion | Enum + guide only | ANS stronger |
| OpenAPI | Protocol Card source; self-documented APIs | Absent | ANS stronger |
| RFC 8785 (JCS) | N/A (CBOR/COSE side-steps JSON canonicalization) | Known blocker; migration planned since ledger AI-007 | DW must complete this regardless of any ANS decision |
| TUF | Not used (KMS key history instead) | v2 design: "TUF-style" metadata — its own doc-set review (D3) says pick real TUF or justify | — |

**Unnecessary duplication, judged:** Dillweed v1 duplicates — in weaker form — transparency logging (vs CT/Rekor), trust-root distribution (vs TUF/DNSSEC), registrant identity (vs OIDC), change distribution (vs standard feed patterns), and observability plumbing (vs OTel); this is not this report's discovery — it is the verbatim conclusion of Dillweed's own comparative reviews, which makes continuing the duplication indefensible. ANS duplicates less: its one arguable reinvention is operating a bespoke private-CA + KMS + log stack where Sigstore-family infrastructure exists (defensible given the URI-SAN requirement and SCITT alignment, but worth an explicit rationale it currently lacks); its `ans://` scheme and underscore labels follow the IANA path (§13) rather than squatting. **Reuse directives:** any Dillweed successor work should reuse ANS's registration/validation/transparency machinery itself as the identity substrate, JCS for any JSON signing it retains, OTel for telemetry, and OPA/Cedar-class engines as the policy consumer — reserving invention for capability-record schema, capability lifecycle semantics, and resolution evidence, where no standard exists.

---

## 18. Integration Options

### Option A — Dillweed remains an independent parallel architecture

Continue the namespace, root key, registry, resolver, Anthill, and governance stack as a freestanding alternative. **Technical viability:** possible; nothing prevents the code running. **Duplication:** maximal — identity, transparency, trust-root, mirrors, monitoring all now have stronger ANS counterparts, and Dillweed's v2 roadmap would re-implement them with one steward against ANS's multi-vendor effort. **Governance burden:** the entire seven-document corpus stays load-bearing, with the single-steward contradiction unresolved. **Adoption probability:** the strategic evaluation put external validation at zero *before* ANS's LF announcement; competing head-on with an LF-hosted, registrar-backed identity effort for overlapping mindshare lowers it further. **Interoperability risk:** high — two incompatible naming/trust roots for agent-era infrastructure invites the fragmentation both projects claim to prevent. **Standards fit / institutional credibility:** poor / very low. **Research value:** as a control artifact only. **Assessment: not recommended.** The only argument for A is preserving optionality while B/C/D are tested — which is Option C's job, not a strategy.

### Option B — Dillweed becomes an ANS capability-standing profile

Define (non-normatively at first) an extension where capabilities exposed by ANS-registered agents get standing semantics: capability records bound to an ANSName, capability-level lifecycle events, and a standing-evaluation contract. Content sketch in §19. **Technical viability:** high — nothing in the draft precludes richer per-function structures in Trust Cards or auxiliary sealed statements; SCITT's arbitrary-statement model fits capability-lifecycle events naturally. **Standards fit:** strong (rides the draft's own extension surfaces). **Institutional credibility:** depends entirely on whether ANS contributors engage; an unsolicited profile from a zero-adoption project has no standing until it is demonstrated (§25's gates). **Effort:** moderate — schema + lifecycle mapping + a prototype evaluator; no infrastructure to operate. **Duplication risk:** low. **Adoption path:** through ANS's community rather than around it. **Distinctiveness/research value:** high — it isolates exactly the capability-granularity contribution. **Assessment: the strongest destination**, contingent on Option C proving the mechanics first.

### Option C — ANS identity becomes upstream evidence for Dillweed

Concretely: a Dillweed capability record gains fields for the provider's ANSName and Identity-Certificate binding; the Registry validates the ANS registration (Gold-tier walk: DNSSEC badge record → JWS badge → inclusion proof → checkpoint → current-state check, §6.3) before accepting records for that provider's capabilities; the Resolver's signature-verification step extends to verifying the provider's ANS lifecycle state (ACTIVE, not REVOKED/EXPIRED) at resolution time, recording the receipt in the trace; Trust Card `verifiableClaims` and Trust Index VCs enter the evidence bundle as attested inputs. This *replaces* Dillweed's registrant-identity gap (F-6's root cause) with ANS's strongest machinery and gives the trust-tier redesign an anchor (tiers become claims about *verified* providers). **Viability:** high; implementable now against the `ans` reference stack on a dev deployment. **Effort:** small-moderate (one integration, no new infrastructure). **Duplication:** negative — it deletes planned work (most of v2 Areas 1/5/6 identity-and-transparency scope). **Credibility:** builds the first concrete interop artifact either community would have. **Assessment: do this first.** It is the prototype that makes B proposable and D credible.

### Option D — Dillweed contributes selected artifacts upstream

Candidates, in descending contribution-readiness: (1) **capability-level lifecycle/revocation analysis** — §10's scenario matrix is a gap analysis ANS's own §11 does not yet contain; (2) **resolver-evidence schema** — trace structure, trust-signal vocabulary, and the §6.4 resolution-vs-authorization boundary text; (3) **conformance/gap-report methodology** — the clean-room second-implementer exercise (88 gaps, 9 blockers) and the finding-disposition-index format, both directly applicable to an early multi-SDK project; (4) **adversarial telemetry taxonomy** — ANT-EC and the adversarial-reporter trust model as input to AIM/Trust Index thinking; (5) **continuity exercises** — GSP-01-derived operator-continuity protocol for RA/TL/CA operators (§14); (6) **canonicalization byte-equivalence test discipline** (ledger RS-003) for cross-SDK signing surfaces; (7) **deployment-gap reporting** as a practice. **Viability/effort:** low effort, immediate. **Risk:** contributions may be ignored; that outcome is itself cheap market information (the strategic evaluation's Option-4 logic). **Assessment: run in parallel with C.**

### Option E — Dillweed narrows to execution-evidence integration

Reposition entirely as the evidence layer feeding execution governance: OPA/Cedar bundles, Microsoft-IFC-style information-flow labels, MCP-gateway policy engines, enterprise authorization systems, agent runtimes — consuming ANS identity and emitting standing verdicts + traces, with no public namespace, no registry-of-record ambition. **Viability:** high; it is Option B minus the ANS-community dependency. **Distinctiveness:** high (nobody owns the resolution-evidence→policy-engine hand-off — §6's matrix shows both projects absent there). **Risk:** without the profile work it decays into a niche middleware with no standard behind it; and the demand evidence (which policy engine wants this input, in what format?) does not yet exist — §21 RQ-3/RQ-10 are the tests. **Assessment: the correct *fallback* and the correct *framing* for B** — B's profile should be designed from day one as what an execution-policy engine consumes.

**Recommended composite:** C now (prototype), D in parallel (contributions), B as the destination (profile), E as B's design frame and the fallback if ANS engagement fails, A rejected. This is the §25 plan's skeleton.

---

## 19. A Possible ANS Capability-Standing Profile (Non-Normative Sketch)

The evidence supports proposing this (per §9.4's three demonstrated decisions); it is sketched under the brief's constraint — no field invented merely to preserve a Dillweed mechanism. Dillweed constructs that did *not* survive into the profile: the `dllwd://` root and scheme, the DNSO signature, trust tiers as global governed labels, the scalar trust score, mirror freshness fields.

### 19.1 The two objects

**Capability Standing Record (CSR)** — published by the provider, sealed like other ANS artifacts:

| Field | Source | Status |
|---|---|---|
| `agent` (ANSName + ProviderID) | **ANS provides** (§5.1, §5.2.1) | reuse |
| `capabilityId` (label unique within the agent's FQDN scope) | extends Trust Card `functions[].id` (App. A.1) | **new (small)** — uniqueness + stability rule |
| `capabilityVersion` (semver, independent of agent version) | Dillweed record semantics | **new** |
| `governingPrincipal` / `delegatedAuthority` | ANS domain owner by default; delegation deferred exactly as ANS defers it | reuse / explicitly deferred |
| `endpointBinding` (endpoint ref + protocol binding: MCP/A2A/REST) | ANS endpoints array | reuse, at capability granularity |
| `contract` (input/output schema hashes, permissions vocabulary) | Dillweed's signed behavioral contract — the schema-hash idiom already exists in Trust Cards (§7.6) | **new (moderate)** |
| `signature` | provider's ANS Identity Certificate key, COSE_Sign1 | reuse (replaces DNSO signing entirely) |
| `revocationState` + capability lifecycle events (`CAP_REGISTERED/ DEPRECATED/ REVOKED(reason)`) | sealed as SCITT statements in a TL | **new (the core of the profile)** — mandatory reason imported from Registry Spec §8.1 |
| `freshnessLimit` (max evaluation age the provider commits to) | DillClaw §7.5 semantics | **new (small)** |
| `transparencyReceipt` | ANS TL mechanics (§4.3) | reuse |
| `operationalConstraints` / `policyReferences` / `evidenceReferences` (SBOM, claims) | Trust Card `verifiableClaims` | reuse |

**Standing Evaluation (SE)** — produced by whatever evaluates (a resolver library, a policy-engine plugin), *never* stored in a global registry:

resolver timestamp; per-check verdicts (identity chain, card/CSR integrity, lifecycle state incl. capability revocation, freshness vs `freshnessLimit`, receipt verification tier achieved — reusing ANS's Bronze/Silver/Gold vocabulary for "what was verified"); monitoring state consulted (AIM findings, if any); policy profile applied; selected-candidate rationale; evaluator signature. This is the DillClaw trace, re-based on ANS evidence and stripped of the scalar score.

### 19.2 Explicit placements

**ANS already provides:** identity, domain validation, certificates, agent lifecycle, sealing, receipts, offline verification, monitoring, claim references. **New:** capability identity/version/lifecycle (sealed statements), contract binding, freshness commitment, the SE format. **Remains local policy, never global:** trust thresholds, tier-like classifications, scores of any kind, caller authorization, admissibility. **Must not enter a global registry:** SEs and traces (they reveal caller intent — privacy), caller identities, per-caller policy, behavioral telemetry. **Privacy consequences:** the profile adds provider-side disclosure (a public capability inventory — already implied by Trust Cards) but keeps the new *evaluative* data local; net privacy posture improves on both current systems' defaults. **Canonicalization:** inherit COSE/CBOR from ANS; no JSON canonicalization surface should exist in the profile (this retires Dillweed's hardest interop problem rather than solving it). **Lifecycle implications:** capability events chain under the agent's TL history; agent-version REVOKED implies all capabilities revoked (dominance rule); capability REVOKED does not touch agent state — resolving §10 scenarios 1, 2, 10 cleanly.

### 19.3 What would falsify the profile's premise

If ANS Trust Cards plus agent-version discipline turn out to satisfy real consumers' revocation and selection needs (i.e., §21 RQ-1/RQ-2 return negative), the profile reduces to a schema convention for `functions[]` and should be abandoned as a separate object. That test is designed in §21 and gated in §25.

---

## 20. Execution-Policy Boundary

What an execution-governance system needs *at the moment before a tool/agent action*, and who can supply it:

| Evidence needed at action time | ANS supplies | Dillweed supplies | Neither |
|---|---|---|---|
| Actor identity (who is calling) | Caller-side ANS identity via mTLS (§6.4) — for *agents*; human/workload callers belong to OIDC/SPIFFE | Nothing (v1 caller identity is a spoofable header) | — |
| Capability identity being invoked | Function label only | Named, versioned, signed capability | — |
| Authority over the capability | Domain-scoped | Record-scoped (steward-signed; registrant unproven) | Delegated authority: neither |
| Current status | Agent-version lifecycle + receipts | Capability revocation state, bounded freshness | Combined view: the §19 profile |
| Policy version / constraints | — | `permissions`, caller constraints | Policy-engine's own |
| Endpoint + protocol binding | Sealed endpoints, DANE | Signed endpoint field | — |
| Provenance | `supersedes` chain, TL history, SBOM refs (declarative) | Registration log, revocation history w/ reasons | Runtime/code provenance: neither |
| Revocation at capability granularity | **No** | **Yes** | — |
| Freshness contract | Implicit | Explicit (§7.5) | — |
| Runtime state / attestation | No (§11 deferred) | No (§11.2 out of scope) | **Both** |
| Monitoring state | AIM findings (signed, public) | Anthill (unauthenticated today) | — |
| Delegation chain | No | Design only | **Both** |

The seven questions, assigned to layers:

1. **Who or what is making the request?** → Workload identity (SPIFFE) / OAuth-OIDC for humans and services; **ANS** for cross-org agent callers. Not Dillweed's question; not the policy engine's to *establish*, only to consume.
2. **Which capability is being invoked?** → MCP/A2A supply the invocation frame; the **capability-standing layer** (Dillweed-derived profile) supplies the stable identity behind the frame.
3. **Does that capability currently have valid standing?** → The **capability-standing layer**, consuming ANS identity/lifecycle evidence. This is the layer's entire reason to exist; after full ANS verification, this question is answerable only at agent granularity — the residue §9.4 demonstrated.
4. **Is this actor authorized to use it?** → **Execution-policy engine** (OPA/Cedar/IAM), over evidence from 1–3. Both projects correctly refuse this.
5. **Is this particular action admissible now?** → **Execution-policy engine + runtime** (arguments, context, rate, budget). No registry-shaped system can answer it.
6. **May data flow in/out of the action?** → **IFC and runtime** labeling; application-level. Entirely outside both projects.
7. **What evidence must be preserved?** → Split: the standing layer preserves the *standing decision* (SE/trace); the **runtime/application** preserves the action record; **human governance** sets retention. Dillweed's trace discipline is the only existing artifact aimed at this layer's slice of the answer.

**The boundary finding, stated once:** after complete ANS verification an execution-policy engine still lacks — capability-granular current status (3), a machine-consumable standing verdict rather than raw receipts, a freshness contract, a selection rationale when alternatives existed, and preservable decision evidence. That list is exactly the §19 profile's payload — and nothing on it requires a second namespace, which is the whole boundary in one sentence.

---

## 21. Research Questions

Falsifiable questions arising from this comparison, in the format the brief requires. Several extend Dillweed's existing research corpus (`docs/potential-research-areas.md` themes A, E, G, H, R) with an ANS arm.

**RQ-1. Does capability-level revocation materially improve safety over agent-version revocation?**
*Hypothesis:* in realistic multi-function agent deployments, capability-level revocation reduces unnecessary loss of healthy functionality (over-revocation) and reduces exposure window for the compromised function (under-revocation) versus version-bump remediation. *Method:* incident-replay simulation over a corpus of real MCP-server/tool compromise incidents; implement both remediation models against the same fleet (ANS reference stack vs profile prototype); measure availability loss × exposure window. *Artifact:* incident corpus + dual-stack testbed. *Negative result:* version-granular remediation proves operationally sufficient (operators just cut versions fast) — the profile's core justification collapses; adopt plain ANS. *Consequence:* this is the profile's go/no-go experiment (§25 gate 1).

**RQ-2. Can ANS Trust Cards adequately represent independently governed capabilities?**
*Hypothesis:* they cannot without lifecycle extension: `functions[]` labels lack uniqueness, versioning, and state. *Method:* attempt to encode ten real capability-lifecycle histories (from npm-yank/MCP-registry churn data) purely in Trust Card + version-bump mechanics; count representational failures. *Artifact:* encoding study. *Negative result:* everything encodes acceptably — profile unnecessary. *Consequence:* determines whether §19 is an extension or a convention.

**RQ-3. What execution decisions remain impossible after complete ANS Gold-tier verification?**
*Hypothesis:* the §20 residue list (capability status, standing verdict, freshness contract, selection rationale, decision evidence). *Method:* build an OPA policy for a concrete agent-tool authorization scenario using only ANS evidence; document every policy predicate that cannot bind to available evidence. *Artifact:* policy + gap log. *Negative result:* OPA policies bind everything they need from ANS receipts + local config — Option E has no demand. *Consequence:* validates or kills the execution-evidence positioning.

**RQ-4. Can capability standing be represented as a structured evidence vector without a new global namespace?**
*Hypothesis:* yes (§19's CSR/SE split). *Method:* implement the profile against the `ans` reference stack; run Dillweed's 19-step lifecycle integration scenario re-based on ANS identity; verify every step has an evidence artifact. *Artifact:* the Option-C prototype. *Negative result:* some standing element proves to *require* namespace-level allocation (e.g., cross-provider capability equivalence) — would justify more Dillweed than this report recommends retaining. *Consequence:* §25 gate 2.

**RQ-5. Can ANS identity plus local policy fully replace Dillweed?**
*Hypothesis:* no — resolution-time selection with reconstructable rationale is not derivable from identity + policy alone. *Method:* ablation: implement the procurement-agent scenario (Namespace Standard §6) three ways — ANS-only, ANS+local policy, ANS+profile — and compare decision quality and post-hoc reconstructability under audit challenge. *Negative result:* ANS+local policy suffices — retire everything but the contributions (Option D only). *Consequence:* the honest kill-switch for the whole capability-standing program.

**RQ-6. Does an independent resolver add value beyond ANS discovery + offline verification?**
*Hypothesis:* policy-filtered ranked selection is a distinct function; but it belongs in a *library/sidecar*, not a trusted network service (removing the malicious-resolver surface §16 flags). *Method:* implement the DillClaw pipeline as an embedded library over ANS discovery output; compare trust/threat model vs the service deployment. *Negative result (partial):* the service form survives only where fleets need shared caches. *Consequence:* determines the resolver's redesign shape (§22 table).

**RQ-7. Are Anthill's signal classes useful beyond AIM and standard observability?**
*Hypothesis:* only ANT-EC and Registry-corroboration are; the rest map to AIM checks or OTel primitives (§12's table). *Method:* implement all six classes as OTel semantic conventions over an ANS+profile testbed; for each, attempt an equivalent with stock AIM/Prometheus; measure the delta. *Negative result:* zero delta — retire the taxonomy entirely. *Consequence:* settles Anthill's residual scope.

**RQ-8. Does domain-bound identity adequately represent delegated enterprise authority?**
*Hypothesis:* no — §10 scenario 9 (valid cert, org no longer authorizes) recurs in practice. *Method:* case-study analysis of enterprise agent deployments (who controls DNS vs who authorizes services); attempt to express three real org-authority structures in ANS registrations. *Negative result:* DNS control tracks authority well enough in practice. *Consequence:* informs both ANS's deferred delegation work and the profile's `delegatedAuthority` deferral.

**RQ-9. How should long-running agents revalidate standing at execution time?**
*Hypothesis:* per-action revalidation against a freshness contract (profile `freshnessLimit`) is affordable at realistic action rates using cached receipts + capability-status tokens. *Method:* latency/throughput study on the prototype: revalidation cost per action vs staleness-window risk, across TTL settings (DillClaw §7.5's table as the design space). *Negative result:* revalidation cost forces windows so wide that "standing at the moment of use" is untenable — a finding against both projects' freshness rhetoric. *Consequence:* produces the operator guidance the profile ships with.

**RQ-10. Do the failure modes justifying any of this occur at material rates?** *(Carries over Dillweed's Theme R, unchanged — it is the master question.)*
*Hypothesis:* tool substitution, revoked-tool invocation, and silent provider change occur at measurable rates in public MCP/A2A ecosystems. *Method:* longitudinal crawl of public MCP registries and A2A cards; classify churn events against the §10 scenario taxonomy. *Negative result:* the rates are negligible — both ANS's monitoring ambitions and Dillweed's standing thesis lose their demand premise. *Consequence:* §25 gate 4's evidence base.

---

## 22. Dillweed Component Disposition

Each substantial function receives exactly one boundary classification (the seven-category vocabulary from the review brief), then the action table. Evidence and reasoning for each classification appear throughout §§5–20; the pointer column cites the primary section.

### 22.1 Classification of every major Dillweed function

| Function | Classification | Basis (§) | Practical consequence |
|---|---|---|---|
| Registry (registration, storage, serving) | **PARTIALLY SUBSUMED BY ANS** | §6, §8, §18-C | Registration/validation/sealing better done by ANS RA+TL; the capability-record *object* is not — keep the object, retire the authority |
| Signed capability records (behavioral contract signing) | **PARTIALLY SUBSUMED BY ANS** | §5, §9.3, §19 | Trust Card seals function/schema metadata at card level; capability-granular signed contracts remain distinct — becomes the CSR |
| DillClaw Resolver (policy-filtered ranked resolution) | **COMPLEMENTARY TO ANS** | §9.4, §20, RQ-6 | No ANS analog; re-base on ANS evidence; consider library form |
| Resolver traces (reconstructable decisions) | **DISTINCT FROM ANS** | §11, §20 Q7 | The strongest single artifact; becomes the SE format |
| Trust tiers (as currently built: self-declared, face-value-scored) | **DUPLICATIVE AND SHOULD BE RETIRED** | §13, F-2, Charter §4 | Current mechanism is unverified self-assertion; the *governed-curation idea* survives only if rebuilt as verifiable attestations (Trust Index Layer-2 shape) |
| Scalar trust scoring | **DUPLICATIVE AND SHOULD BE RETIRED** | §13 | Abandon the scalar; keep the signal vector + breakdown |
| Structured standing evidence (`trust_signals`, breakdown) | **COMPLEMENTARY TO ANS** | §13, §19 | Direct input to the SE format |
| Revocation model (capability-granular, mandatory reasons) | **DISTINCT FROM ANS** | §10 scenarios 1/2/10 | The core of the profile; evidence strength must come from ANS-style sealing |
| Mirror design (snapshot-hash, freshness fields) | **FULLY SUBSUMED BY ANS** | §6, §16, G-11 | TL event stream + checkpoints + consistency proofs solve what the mirror protocol failed to specify; retire |
| Anthill (as a parallel observability service) | **PARTIALLY SUBSUMED BY ANS** (AIM) + OTel | §12 | Retire the service; keep taxonomy-as-convention, corroboration idea, ANT-EC research |
| Governance framework (TSC/Council structures) | **BOTH SYSTEMS LEAVE UNRESOLVED** | §14 | Mark dormant; neither project has real governance — don't pretend otherwise in either direction |
| Continuity protocol (GSP-01) | **DISTINCT FROM ANS** | §14 | Genuinely novel; generalize and contribute |
| DNSO concept (single root signer/endorser) | **DUPLICATIVE AND SHOULD BE RETIRED** | §8.2, §14, §16 | ANS role separation supersedes it architecturally; retiring it also resolves the neutrality contradiction |
| MCP adapter | **COMPLEMENTARY TO ANS** | §6, §17 | Keep; point it at the profile prototype |
| Trust-root handling (PEM-over-HTTPS + README SHA) | **FULLY SUBSUMED BY ANS** | §6, §16 | Retire with the DNSO signing role |
| Canonicalization work (top-level-only JSON; JCS plan; byte-equivalence tests) | **PARTIALLY SUBSUMED** | §17, §19.2 | COSE adoption retires the problem; the *test discipline* is contributable |
| Conformance tests + gap-report method | **DISTINCT FROM ANS** | §15, §18-D | Contribute the methodology |
| Research & evaluation artifacts (hypotheses, disposition index, reviews) | **DISTINCT FROM ANS** | §3, §21 | Highest-value retained asset; extend with ANS arms |
| Namespace Standard (`dllwd://` root, L1–L4 stack, provenance framing) | **INSUFFICIENT EVIDENCE** for the namespace-as-infrastructure claim; the *conceptual sections* (§2 registry-vs-namespace, §7.3 path-anchored identity) are research contributions | §5, §14, RQ-4 | Preserve as a dated research document; stop presenting as a live standards track |

### 22.2 Action table

| Dillweed component | Retain | Narrow | Redesign | Integrate with ANS | Contribute upstream | Deprecate | Reason |
|---|---:|---:|---:|---:|---:|---:|---|
| Namespace Standard | ✔ (as research doc) | ✔ | | | ✔ (concepts) | ✔ (as competing root) | Concept survives; parallel global root does not (§5, §18-A) |
| Registry | | ✔ | ✔ | ✔ | | ✔ (authority role) | Becomes a capability-record store keyed to ANS identity; RA/TL functions retired to ANS (§18-C) |
| Resolver | ✔ | | ✔ (library-first, ANS-evidence-based) | ✔ | ✔ (evidence schema) | | Only component with no ANS analog (§9.4; RQ-6) |
| Anthill | | ✔ (taxonomy + corroboration only) | ✔ (OTel convention) | ✔ (AIM posture) | ✔ (ANT-EC, adversarial-reporter model) | ✔ (service) | §12; own review's verdict, now with an ANS counterpart |
| DNSO governance | | ✔ | | | | ✔ (root-signer role) | §14; single-signer contradicts own thesis; superseded architecturally |
| Continuity Protocol | ✔ | | ✔ (generalize: operator-neutral) | | ✔ (to ANS governance WG-to-be) | | Unique artifact; ANS's governance white paper needs it (§14) |
| Trust scoring | | | ✔ (evidence vector) | | | ✔ (scalar + face-value tiers) | §13; F-1/F-2 |
| Mirrors | | | | ✔ (TL/checkpoint model) | | ✔ | G-1..G-24 + ANS solves it (§16) |
| MCP adapter | ✔ | | | ✔ | | | Working artifact; low cost (§6) |
| Signed capability records | ✔ | | ✔ (COSE, ANS-key-signed CSR) | ✔ | | | The product, re-based (§19) |
| Audit & trace formats | ✔ | | ✔ (SE format; signed traces) | ✔ (receipts into traces) | ✔ | | §11, §20 |
| Research & conformance material | ✔ | | | | ✔ | | §21; the project's durable value |

---

## 23. Claims and Positioning

Review of existing Dillweed claims in light of ANS, with replacement wording. The project's documented independent history (domain provenance since 1997; specs and running stack predating the LF announcement; ANS/AgentDNS already cited as related work in Namespace Standard §1) is real and should be kept in the record — as history, not as an argument. Temporal priority is not architectural value, and nothing here suggests derivation in either direction: both projects visibly converged on CT/ACME/SCITT-era prior art.

| Claim (current wording) | Status vs ANS | Recommended action |
|---|---|---|
| "Neutral global namespace" / "neutral coordination root" (NS §9) | **No longer credible** as stated: single-steward, single-key, zero adopters, and now adjacent to a multi-vendor LF-hosted effort claiming the neutral-infrastructure ground with more structural neutrality (§14) | Retire. Replace: "a research architecture for capability-level coordination, proposed as a profile over emerging agent-identity infrastructure" |
| "Capability standing" | **Still defensible — the project's best claim** (§9), *if* narrowed to the evaluation-layer meaning | Keep; define it against ANS explicitly: "the capability-granular standing evidence that agent-identity verification (e.g., ANS) does not produce" |
| "Verifiable resolution" | Needs qualification: traces make resolution *reconstructable*; "verifiable" overreaches while the resolver is a trusted service and determinism is over-claimed (C10) | "Reconstructable, evidence-backed resolution decisions"; fix the §3.3 determinism scope per the doc-set review (B3) |
| "First-of-kind" (any variant) | **No longer credible** without qualification: ANS lineage (May 2025 paper) predates Dillweed's publication; both have precursors | Drop entirely; cite ANS and AgentDNS as the NS §1 table already does, and characterize the *capability-granularity* difference instead |
| "Coordination above MCP and A2A" | Duplicative of ANS's positioning and unsupported by artifacts (A2A integration is a guide section) | Narrow to the demonstrated artifact: "MCP-integrated capability resolution" |
| "Independent trust infrastructure" | Duplicative of ANS at the infrastructure layer; contradicted by single-key reality | Retire; replace with "capability-standing evidence layer consuming existing identity infrastructure" |
| "Cross-vendor interoperability" | **Not credible yet from either project** (zero cross-vendor deployments both sides) — but Dillweed specifically has a spec-gap report proving second implementations are blocked | "Designed for cross-implementation conformance; currently blocked by documented gaps (spec-gap report)" — the candor *is* the differentiator |
| "Anthill observability" | Overstated (own review: "signal store"); partially duplicative of AIM going forward | Adopt the review's label until/unless the OTel re-layer ships; frame signal classes as a proposed semantic convention |
| "DNSO governance" | The instruments are real; the institution is one person; ANS comparison makes the single-root shape a liability, not an asset | Reframe: "documented stewardship and continuity instruments for the founding phase," and stop implying an operating governance body |
| "Public Resolver" (planned) | Still meaningful *only if* re-scoped: a public resolver over Dillweed's own registry has no demand evidence; a public standing-evaluator over ANS identity is a demonstrable first | Re-scope to the Option-C prototype before any Issue-#2 deployment work |
| "Trust tiers" | Not credible as trust signals today (F-2, Charter §4's own concession) | Suspend the tier vocabulary in outward-facing text until redesigned as verifiable attestations |
| "Publicly verifiable trust root" (README) | Overstated (root = one HTTPS PEM; strategic eval already directed the fix) | "Published trust root; record signatures independently verifiable" — and this retires anyway under §22's disposition |

**Potentially distinctive claims worth *adding*** (all currently under-claimed): capability-granular revocation with mandatory logged reasons; per-decision resolution traces; the finding-disposition/candor methodology; the falsifiable-hypothesis research corpus.

---

## 24. Recommended 90-Day Plan

Premise: Option C → D → B (per §18), with E as frame and fallback. All infrastructure build-out on the v2 roadmap that duplicates ANS (Areas 1, 5, 6 identity/transparency scope; Area 2 mirror protocol; Area 3 beyond the semantic convention) **pauses immediately** — not because the designs are wrong, but because their strongest possible outcome is a weaker second implementation of what ANS already runs.

**Days 1–15 — Preserve and correct.**
- Repository preservation: tag the current state (`v1-archive` or similar); the v1 stack, ledger, and review corpus are the project's evidence base and must stay reproducible.
- Claims pass per §23 (README, Namespace Standard framing, docs index) — small edits, large credibility effect; the disposition-index discipline already models how.
- Publish this comparison (or a corrected successor) in `docs/`; both audiences should be able to read the same boundary analysis.
- Do **no** outreach yet (comparison-before-outreach, per the brief and the ledger's own AI-008 sequencing).

**Days 15–45 — Prototype (Option C).**
- Stand up the `ans` reference stack (RA+TL+verifier) locally; register a test agent for a Dillweed-controlled domain.
- Bind capability records to that ANS identity: provider ANSName in the record; Registry-side Gold-tier validation at registration; Resolver-side lifecycle check + receipt in the trace. Sign records with the ANS Identity-Certificate key on a branch (retiring the DNSO signature in the prototype).
- Re-run the 19-step lifecycle integration test on the composite stack (RQ-4's artifact). Publish results — including failures — as a gap report in the house style.

**Days 45–75 — Draft the profile (Option B) and the contributions (Option D).**
- Write the non-normative capability-standing profile (§19) as a standalone document, with the RQ-1/RQ-2 encoding studies as its evidence appendix.
- Prepare the two most contribution-ready artifacts: the capability-lifecycle gap analysis (§10's matrix, generalized) and the operator-continuity protocol (GSP-01 generalized to RA/TL/CA operators).
- Build the RQ-3 demonstration: an OPA policy consuming the prototype's SE output — the execution-evidence proof point (Option E's demand test).

**Days 75–90 — Engage, with evidence in hand.**
- Open a discussion issue on the `agentnameservice` repos (or the LF project's channel once it exists) presenting: the prototype, the profile draft, the gap analysis, the continuity contribution. Frame as contribution, not competition; no naming/branding asks.
- In parallel, one research-community submission (workshop paper or updated `potential-research-areas.md` ANS-arm) so the ideas survive regardless of reception.
- **Which component gets focus throughout:** the resolver-as-evaluator + trace/SE format. **What stays paused:** mirrors, Anthill service, key-hierarchy build-out, public-resolver deployment (Issue #2 re-scopes to the prototype), tier mechanism.

**Decision gates (day ~90):**
1. **Is capability-level standing demonstrably absent from ANS?** (RQ-1/RQ-2 evidence — expected yes per §9, but the encoding study must confirm against real Trust Cards.) *No → Option D only; archive the rest.*
2. **Can it be expressed as an ANS extension?** (RQ-4: the prototype works without forking ANS semantics.) *No → reassess whether the blocking element justifies independent architecture — the one path back toward Option A, requiring evidence this report did not find.*
3. **Does a policy engine consume the evidence?** (RQ-3 demo binds real predicates.) *No → the execution-evidence framing fails; profile becomes documentation only.*
4. **Is there interest from an external researcher or ANS contributor?** (Any substantive engagement with the issue/paper.) *No → shift to research-archive mode: publications stand, operations stop — the strategic evaluation's Option-5 terminus.*
5. **Can one independent implementation reproduce the profile?** (Someone other than the steward runs the prototype from the docs.) *Deferred beyond 90 days, but instrumented now: the prototype's install path must be Linux/container-first, breaking the macOS-only pattern the gap reports flag.*

**What would justify continuing an independent architecture** (explicit, per the brief): gates 1 *and* 2 failing in the specific direction where ANS cannot host capability lifecycle even as an extension *and* the capability-granularity need is confirmed — a conjunction this review judges unlikely (§9.4, §19.3) but constructs the experiments to detect honestly.

---

## 25. Final Judgments

1. **How much of Dillweed's original architecture is now covered by ANS v2?** By §6's matrix: most of the infrastructure layer — registration authority, domain-anchored identity, signed metadata sealing, transparency/audit cryptography, offline verification, trust-root distribution, mirror/replication (dissolved by the log architecture), drift monitoring design, and the multi-provider trust-evaluation frame. Roughly: the *identity and evidence plumbing* is covered, mostly with stronger mechanisms; the *capability-granular semantics and resolution-evaluation layer* is not. In terms of Dillweed's v2 roadmap, ANS covers the majority of Areas 1, 2, 5, 6 and the monitoring posture of Area 3.
2. **Which component has the strongest remaining independent value?** The DillClaw evaluation layer taken as a whole: capability-granular lifecycle semantics + policy-filtered resolution + persisted traces (§9.4, §20). Second: the research/candor corpus. Third: the continuity protocol.
3. **Is capability standing materially distinct from ANS agent identity and Trust Cards?** Yes as a *function* (three demonstrated decisions, §9.4); no as a *justification for parallel infrastructure* (every input is ANS evidence or a schema extension).
4. **Can that distinction be demonstrated through concrete use cases?** Yes — §10 scenarios 1, 2, 10 (revoke/withdraw/disable one capability) and §9.4's selection-with-rationale case; RQ-1/RQ-2 are the controlled versions.
5. **Should Dillweed continue as an independent global namespace?** **No.** §18-A: maximal duplication, no adoption path, fragmentation risk against the project's own stated values.
6. **Should Dillweed become an ANS-compatible profile or extension?** **Yes** — the §19 profile, gated by §24's experiments.
7. **Should selected artifacts be contributed upstream?** **Yes**: capability-lifecycle gap analysis, resolver-evidence schema, continuity protocol (generalized), conformance/gap-report and disposition methodology, canonicalization test discipline, ANT-EC concept (§18-D).
8. **Which components should be paused or retired?** Retired: DNSO root-signing role, bespoke trust-root distribution, mirror protocol, scalar scoring, face-value tiers, Anthill-as-service. Paused: public-resolver deployment as scoped in Issue #2, v2 Areas 1/5/6 identity-transparency build-out, governance elaboration (§22.2, §24).
9. **Does ANS eliminate the need for Dillweed's Resolver?** No — discovery and offline verification are not policy-filtered selection with reconstructable rationale (§9.4, RQ-6). It does eliminate the resolver's current *evidence base* (DNSO signatures, self-declared tiers), which should be replaced with ANS evidence.
10. **Does ANS eliminate the need for Anthill?** Largely, in combination with OTel: AIM covers registered-surface drift; OTel covers operational telemetry (Anthill's own comparative review). Residue: Registry/registry-corroboration verification, the adversarial-reporter evidence model, ANT-EC — none of which requires Anthill as a deployed parallel service (§12).
11. **What does an execution-policy engine still need after full ANS verification?** Capability-granular current status, a consumable standing verdict, a freshness contract, selection rationale, and preservable decision evidence (§20) — the profile's payload.
12. **Is collaboration with ANS technically credible?** Yes: the prototype path (§18-C) uses only public ANS interfaces and the reference stack; no ANS changes are required to *demonstrate* the profile, only to standardize it.
13. **Is collaboration institutionally credible?** Conditionally. Sober reading: Dillweed brings zero adoption, one steward, a name that taxes first impressions (strategic evaluation §9), and — offsetting — runnable prototypes, unusually rigorous artifacts, and analysis ANS's own future-work list needs. Credibility must be manufactured by the §24 sequence (evidence first, outreach second); it cannot be asserted. The LF project's actual openness to external contribution is untested (uncertainty, flagged).
14. **What would make Dillweed's continued development worthwhile?** Passing gates 1–3: confirmed capability-granularity need, a working ANS-hosted expression of it, and at least one policy-engine consumer — i.e., demonstrated demand for exactly the layer this report says is distinct.
15. **What would falsify Dillweed's remaining value proposition?** RQ-2 negative (Trust Cards suffice), RQ-5 negative (ANS + local policy suffices), or RQ-10 negative (the failure modes don't materially occur). Any one of these ends the implementation program honestly; the research corpus still stands.

**Overall verdict: Complementary profile is the strongest path.** Secondary finding: even if the profile is never adopted upstream, *research contribution remains useful, but implementation should narrow* describes the floor — and *independent architecture remains justified* is not supported by any evidence reviewed here.

---

## 26. Appendix: Source Inventory and Evidence Map

### 26.1 Dillweed sources (repo `Dillweed-Namespace/dillweed-namespace` @ `310d503`)

| Source | Used for (report §§) |
|---|---|
| `README.md` (trust model, v1 baseline, evaluation readiness) | 1, 8, 16, 23 |
| `specs/namespace-standard.html` v0.4.4 (§§3–4 naming/records; §7 trust; §8 governance; §9 L1–L4; §11 milestones; §12 provenance) | 4, 5, 8, 14, 23 |
| `specs/dillclaw-spec.html` v0.1.8 (§3.3 guarantees; §5.1 endpoints/trace; §6.1–6.4 evaluation/score semantics; §7 caching/revocation) | 5, 8, 9, 10, 13, 19, 20 |
| `specs/registry-spec.html` v0.1.6 (via reviews; §5.2 signed set; §8 revocation; §2.2/§10.3 mirror) | 6, 10, 11, 16 |
| `specs/anthill-spec.html` v0.1.3 (via reviews; §4 signals; A.7/A.10/A.11) | 12 |
| `specs/governance.html` v1.1.3, `specs/dnso-operations-charter.html` v1.0.3 (§4 attestation/provisional tiers), `specs/continuity-protocol.html` GSP-01 v1.0.3 (§10 transition paths, §11 open obligations) | 13, 14, 22 |
| `docs/dillweed-v2-design-2026-06-10.md` (Areas 1–6, waves) | 8.3, 17, 18, 24 |
| `docs/cross-service-trust-boundary-analysis-2026-06-10.md` (F-1…F-11) | 8, 9, 13, 16 |
| `docs/registry-mirror-deployment-gap-report-2026-06-10.md` (G-1…G-24) | 6, 11, 16, 22 |
| `docs/architecture-review-registry-vs-existing-infrastructure-2026-06-10.md`; `docs/anthill-vs-observability-stack-2026-06-10.md` | 12, 17, 22 |
| `docs/documentation-set-review-2026-06-11.md` (verification table; contradictions C1–C12) | 3, 8, 11, 23 |
| `docs/finding-disposition-index-2026-06.md` (69 findings; deployment-profile gates; claim-safety) | 1, 8, 11, 22 |
| `docs/strategic-evaluation-2026-06-12.md` | 2, 8, 14, 15, 18, 23 |
| `docs/potential-research-areas.md`; `docs/research-opportunities-summary.md` | 9, 21 |
| `PROJECT_LEDGER.md` (AI-005/007/008; RS-003 byte-equivalence; release SHAs); `v2-tracker.md` (W0 record) | 1, 3, 15, 17 |
| `mcp-server/README.md` + `server.js` | 6, 17, 22 |
| `registry/server.js`, `resolver/server.js`, `anthill/server.js` (line-level citations as verified by the documentation-set review and disposition index) | 8, 12, 16 |
| GitHub issues #2, #4 (titles/labels) | 1, 15, 24 |

### 26.2 ANS sources

| Source | Used for |
|---|---|
| `draft-narajala-courtney-ansv2-01` (datatracker + published HTML; §§1.5, 1.7, 2.2, 4.1–4.8, 5.1–5.5, 6.1–6.7, 7.1–7.6, 8.4, 9.1, 11, 12.1–12.9, 13, App. A) — accessed 2026-07-01 via structured extraction | 1, 5–12, 14, 16, 17, 19, 20 |
| Linux Foundation press release, 2026-06-23 (intent to launch; participants; DNS/DID/LEI framing) | 1, 14, 15 |
| `github.com/agentnameservice/ans` (Go RA/TL/verifier/dev-DNS; v0.1.6; coverage and CI claims self-reported) | 1, 15, 18, 24 |
| `github.com/agentnameservice/ans-registry` (ANS-0–ANS-5 spec corpus; MAESTRO threat model; no releases; `godaddy/ans-registry` lineage) | 1, 15 |
| `ans-sdk-java` / `ans-sdk-go` / `ans-sdk-rust` (existence/languages only; not audited) | 15 |
| Research lineage: arXiv:2505.10609 (May 2025); OWASP GenAI Security Project "ANS v1.0"; `draft-narajala-ans-00` | 1, 23 |

### 26.3 Evidence-strength legend applied in this report

Direct file/section citation → treated as fact at the stated version. Repository self-description (coverage %, "production alternative") → reported as claim. Absence from reviewed material (public ANS deployments, Trust Index implementations, ANS revocation-reason semantics, Trust Card "privacy settings" semantics, LF project openness) → flagged inline as inference/uncertainty at each use. Future-work text (ANS §11; Dillweed v2 design; Anthill appendices) → never treated as functionality.

---

*Prepared as an independent comparative review for placement in `docs/`. Corrections — especially from ANS contributors on any mischaracterization of draft-01 or the reference implementation, and from the Dillweed steward on repository state — are invited through the repository issue tracker; the §26.3 uncertainty flags mark where corrections are most likely to be needed.*
