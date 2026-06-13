# Dillweed Namespace Project — Independent Strategic Evaluation

> **Note** (added 2026-06-12, same day): this evaluation was conducted at HEAD `7f09e2e`. The README "No HIGH/MEDIUM open" claim cited in §4 was corrected hours later by commit `b7fab11`. Finding-level statuses are tracked in [`finding-disposition-index-2026-06.md`](finding-disposition-index-2026-06.md); the strategic analysis is unaffected.

**Date:** 2026-06-12
**Reviewer role:** Independent senior strategist / distributed-systems architect / AI infrastructure analyst / cybersecurity reviewer / standards expert / institutional deployment advisor
**Reviewed at:** repo HEAD `7f09e2e` (2026-06-11) · Specs: Namespace v0.4.4, Registry v0.1.6, DillClaw v0.1.8, Anthill v0.1.3, Governance v1.1.3, Charter v1.0.3, GSP-01 v1.0.3 · Implementations: Registry 0.2.8, Resolver 0.1.8, Anthill 0.1.6 (post-W0)
**Method:** Full read of README, all seven specification documents, PROJECT_LEDGER.md, v2-tracker.md, dillweed-v2-design-2026-06-10.md, all `/docs` architecture/comparative/gap reviews, documentation-set-review-2026-06-11.md, mcp-server, resolver trace corpus (1,373 files), and public GitHub repository state. Observed facts are cited; everything else is labeled inference.
**Mode:** review-and-recommend (no project artifacts modified other than this report and its index entry)
**Questions addressed:** (1) Is the project addressing the right problem for the current state of AI? (2) Is the architecture likely to remain relevant over 5–10 years? (3) Would an infrastructure provider such as Identity Digital be an appropriate host, operator, sponsor, or steward?

---

## 1. Executive Judgment

**Verdict: Technically credible but early** — with a mandatory narrowing requirement that, if ignored, degrades the verdict toward "useful research project without clear deployment path."

The project has correctly identified a real and currently unowned problem — what its own documents call capability standing: whether a named capability is what it claims, who vouches for it, whether that vouching is current or revoked, and whether the resolution decision can be reconstructed later. No existing system answers that compound question for agent-invocable capabilities. MCP and A2A deliberately punt on it; package registries answer it for artifacts, not running endpoints; PKI answers it for identities, not behavioral contracts.

But three facts dominate the strategic picture:

1. **There is zero external validation.** Public repo since 2026-05-18: 0 stars, 0 forks, no third-party implementation, no externally registered capability, no human specialist review. All 1,373 resolver traces are from a single day (2026-06-10) with `caller_id: null` — local test traffic, not usage.
2. **The architecture's centralization contradicts its own neutrality thesis.** A single DNSO Ed25519 key signs every record; a single steward attests every trust tier. The project's strongest internal review (`docs/architecture-review-registry-vs-existing-infrastructure-2026-06-10.md`) identifies this precisely: no delegation, no counter-signatures, registration-witnessing conflated with endorsement.
3. **The scope is roughly 3× wider than the defensible core.** Governance, continuity, and observability documents (four of seven specs) institutionalize a community that does not yet exist. The core — capability records, signatures, revocation, resolver semantics, traces — is the part worth defending.

Identity Digital is not an appropriate ask today for any operating role. It is a plausible *future* mirror/resolver operator under the "licensed neutral operator model" the Continuity Protocol §10 itself names — but only after independent validation exists that the project currently lacks.

---

## 2. Current-State Relevance

### The taxonomy, applied honestly

- **Agent identity** (who is acting): actively being addressed — SPIFFE/SPIRE for workloads, OAuth/OIDC extensions for agents, vendor agent-ID schemes. Crowded.
- **Service identity** (which endpoint am I talking to): solved — TLS/WebPKI, mTLS, SPIFFE.
- **Capability discovery** (what exists): being solved per-platform — the MCP server registry ecosystem, vendor tool catalogs, A2A agent cards. Crowded and platform-fragmented.
- **Authorization / policy enforcement** (may this call proceed): solved in-domain — OAuth scopes, IAM, OPA/Cedar policy engines.
- **Observability** (what happened): solved generically — OpenTelemetry.
- **Capability identity + capability standing** (is this *named thing* the thing it claims, who governs it, is its attestation current, has it been revoked, can the decision be verified independently and reconstructed later): **not solved by anything in the list above.** MCP registries are unsigned or platform-signed directories with no governed revocation semantics. Sigstore/transparency logs cover artifacts at publish time, not live endpoint standing. CRLs/OCSP cover certificates, not behavioral contracts.

So Dillweed identifies a **genuinely missing layer**, narrowly defined. The Registry comparative review states the niche correctly: "a governed, centrally-signed directory of agent-invocable capabilities, where the signature covers behavioral contracts... and the audit trail is a protocol obligation rather than an ops artifact. That combination is genuinely novel."

### But is the problem *live* today?

Mostly no, with one important exception. Today's enterprise agents overwhelmingly invoke tools inside one trust domain: the org's own MCP servers, vendor-curated catalogs, platform allowlists. Capability standing inside one trust domain is an IAM-plus-catalog problem that existing tooling handles tolerably. The compound question only becomes structural when invocation crosses organizational boundaries at scale — which is emerging (MCP server supply-chain incidents are already a documented attack class) but is not yet a procurement requirement anywhere identifiable.

The exception: **revocation of third-party tools.** The "we installed an MCP server that turned malicious" incident class exists *now*, and the current remediation is ad hoc. A signed, queryable, propagating revocation signal for capabilities is the single most presently-valuable piece of the stack.

**Classification: a genuinely missing layer at the spec level; a premature abstraction at the operate-production-infrastructure level.** Not a reinvention — though several of its *mechanisms* are reinventions (see §5).

### Where the current design undercuts its own answer

Two internal admissions matter here. Charter §4 ("Provisional Tier Behavior") concedes that a self-declared `verified` tier is signed at registration and "resolvers score the declared tier at face value" — meaning the trust tier, the system's headline trust signal, is currently unverified self-assertion wearing a DNSO signature. And the DNSO signature attests "the DNSO wrote the record," conflating *registration witness* with *endorsement* — the exact distinction Certificate Transparency was built to keep separate. These are fixable, but they mean the v1 system does not yet deliver the standing guarantees its framing implies.

---

## 3. Future-Scenario Analysis

**Scenario A — Vendor-controlled ecosystems.** Capability registration, signing, and revocation ship as platform features (they already are: vendor tool catalogs, marketplace review). A neutral layer gets no distribution; hyperscalers have *negative* incentive to adopt a namespace they don't control, and no incentive identified anywhere in the Dillweed corpus overcomes that. Relevance: near zero. **This is the scenario that most undermines the project**, and it is the most probable near-term (2–4 year) equilibrium.

**Scenario B — Multi-vendor enterprise agents.** The strongest supportive scenario. When an enterprise runs multiple frontier-model agents invoking tools from dozens of vendors, "is this capability still trustworthy, and can I prove what I checked?" becomes a compliance question no single vendor can answer for the others. Likely users: enterprise platform/security teams; likely competitors: cloud IAM extensions, API-gateway vendors, a future "Sigstore for tools" from the supply-chain-security community — the latter being the most dangerous, because that community has the credibility Dillweed lacks. Required changes: enterprise-deployable (private registry federations), OIDC-integrated registrant identity, delegation so orgs sign their own subtrees. Adoption likelihood: moderate, on a 3–7 year horizon.

**Scenario C — Open decentralized agent ecosystems.** DNS + PKI + transparency logs + MCP/A2A get you connection, identity, and artifact integrity — but not governed standing or revocation propagation for capabilities. Dillweed-the-architecture is relevant; Dillweed-the-single-steward-operation is exactly what a decentralized ecosystem would refuse. Would need: federation, multiple roots or a transparency-log model replacing the single root. The failure mode: the ecosystem standardizes a thinner thing (signed agent cards + a rekor-style log) and the namespace layer never forms.

**Scenario D — Heavy regulatory governance.** Strong conceptual fit: signed records, mandatory revocation reasons, append-only audit logs, resolver traces, evidence-retention windows (Charter §4.1) read like they were written for an AI-Act-style audit regime. But regulators will demand accredited operators and jurisdictional control — a Colorado single steward cannot be the trust root for EU compliance infrastructure. Dillweed's *shape* fits; its *institution* doesn't. In this scenario the architecture gets adopted (or reinvented) by accredited bodies, with or without the project.

**Scenario E — AI stays assistive.** Tools remain organization-local and supervised; the problem stays inside single trust domains; Dillweed is unnecessary complexity. Relevance: research archive.

**Net:** The project's thesis is a bet on B and D against A and E. That is a legitimate bet — B+D is plausibly 30–50% of probability mass over ten years — but the corpus nowhere acknowledges that A is the default path, and the Namespace Standard's L1–L4 stack diagram (§9), which positions Meta/Google/Microsoft as a "Human Gateway Layer" atop a Dillweed coordination root, reads as inevitability where contingency is warranted.

---

## 4. Architectural Fitness

### What's right

- **Separation of concerns is genuinely good.** Registry (truth) / Resolver (selection) / observability (orthogonal, explicitly non-gating — Namespace Standard §9) is the correct decomposition, and "the resolver does not sit in the invocation path" (§5.1, step 5) is the correct humility.
- **Verification-locality.** Any relying party verifies signatures against a published key without trusting the registry (README trust model). Right pattern.
- **Resolver traces as first-class objects** — `trace_id` persisted on every response path including early errors (ledger, RS-007) — is the most forward-looking feature in the stack; it is precisely what "can the resolution decision be independently verified later" requires, and nothing else in the ecosystem does it.
- **Revocation with mandatory reason, retained indefinitely** (Registry §8.1 per Charter §6.2) — the most presently-valuable semantics in the stack.
- **The engineering process is far above hobby grade.** Three review rounds per component with severity convergence curves, SHA-pinned baselines, cross-implementation byte-equivalence tests for canonicalization (ledger RS-003), 19/19 integration lifecycle tests, a W0 hardening wave (ETag, SQL pagination, rate limiting, SSRF deny-list with host pinning, jitter/backoff) executed and verified against isolated instances. The reference-implementation limitations are documented, not hidden.

### Classification of components

| Component | Assessment |
|---|---|
| Capability Record schema + Ed25519 signing | **Essential** — the product |
| Revocation semantics + audit log | **Essential** — the most valuable part today |
| Resolver trust-filtering, traces, failure semantics | **Essential** |
| Trust tiers | **Useful but currently underspecified** — provisional tiers scored at face value; "trust accumulation" (Namespace §7.2) has no defined mechanism |
| Mirrors/snapshots | Useful but **underspecified** — the mirror gap report's verdict is "no happy path at all"; mirror mode is an env-var echo (`registry/server.js:598–600`) |
| Anthill | **Premature and mis-shaped** — the project's own review says it: "a parallel observability stack... that is the wrong shape," should re-layer on OTel and keep only the adversarial-emitter trust model and Registry corroboration |
| Governance Framework, GSP-01, Charter | **Premature in volume, not in existence.** Documenting succession and key custody for a one-person trust root is genuinely responsible (GSP-01's candor about the unexecuted CDI, §11, is to its credit). But four governance documents with TSC tie-break rules and Participant Council review windows for bodies "not yet constituted" (Governance §04 status callout) is institutional architecture for a population of zero |
| Single DNSO root key, no delegation | **Overly centralized** — the central architectural defect. Every record in every future org's subtree signed by one key held by one person contradicts the neutrality thesis structurally, not just optically |
| Hand-rolled transparency, key-rotation metadata, registrant identity, change distribution | **Duplicative** — should adopt CT/Rekor, TUF, OIDC trusted publishing, and watch/feed patterns respectively (the project's own comparative review reaches exactly this conclusion) |
| Top-level-only canonicalization | **Likely to become obsolete** — ledger AI-007 already targets RFC 8785 JCS as a v2 breaking change |
| dllwd:// URI scheme, ~200 defensive domains, trademark framing | Marginal to the technical case; provenance is a governance argument, not an architecture one |

### Reference implementation vs. architecture — kept separate

Implementation gaps (macOS-only installers, SQLite, synchronous `writeFileSync` traces, 1,373 unrotated trace files, plaintext tokens in launchd plists, the unverified `node_signature` CRITICAL F-3) are v1-reference limitations, properly disclosed, and mostly tracked in the v2 design. They do not indict the architecture. The architectural defects are different and deeper: single-root signing without delegation, witness/endorsement conflation, underspecified trust-score semantics, and a mirror story that doesn't yet exist. The v2 design (Areas 1–6) addresses the operational list well but does **not** yet address delegation or counter-signing — the comparative review's three "make multi-org real" items (delegation, counter-signatures, record expiry) have no wave assignment.

Two credibility items at HEAD need fixing before any external evaluator looks (both verified): the repo README still claims "No HIGH-severity or MEDIUM-severity issues are open" while `docs/cross-service-trust-boundary-analysis` documents an open CRITICAL (F-3); and a working-tree Ed25519 private key sits at `registry/keys/dnso_private.pem` (it *is* covered by `.gitignore:35` and is a dev key, not the canonical root — but a security reviewer will find it in the first ten minutes and the optics cost exceeds the explanation).

---

## 5. Existing-Infrastructure Comparison

| System | Relationship | Notes |
|---|---|---|
| DNS | **Borrows the pattern; should also use the mechanism.** Authoritative store + caching resolvers + TTL propagation is DNS's architecture re-instantiated. DNS *delegation* (NS+DS) is the model the Registry lacks. Should integrate (TXT-based attestation is already in Charter §4.1), not duplicate |
| PKI / CAs / DNSSEC | **Composes the pattern** (single trust root, published key, signed records). Currently re-creates pre-CT PKI — a CA without transparency. Should adopt CT lessons, not relive them |
| Certificate Transparency / Sigstore / Rekor | **Should adopt rather than reinvent.** The append-only audit log re-implements transparency logging in weaker, unverifiable-by-third-parties form. A Dillweed registry that *published into* a transparency log would be dramatically more credible than one asking to be trusted |
| TUF | **Should adopt** for root-of-trust metadata, key rotation, and (critically) delegations |
| SPIFFE/SPIRE | **Complementary, no overlap.** SPIFFE answers "which workload is this"; Dillweed answers "what standing does this named capability have." A v2 with authenticated callers should accept SPIFFE identities rather than mint its own |
| OAuth/OIDC | **Complementary; should integrate** for registrant identity (trusted publishing) and caller identity. Authorization remains out of Dillweed's scope, correctly |
| Package registries (npm/crates/PyPI) | **Closest functional cousins.** Registration, versions, semver ranges, revocation/yank, signed records. Dillweed differs in covering *live endpoints* with *governed standing*, not static artifacts. Should copy their distribution patterns (index/changes feed) |
| API gateways / service discovery (Consul, etcd) | **Different layer.** Those are runtime, single-domain, availability-oriented. Dillweed is cross-domain and standing-oriented. No conflict |
| MCP | **Must integrate; partially does.** The `mcp-server/` adapter exposing `dillweed_resolve`/`verify` as MCP tools is exactly the right move. The deeper integration — Dillweed as the *standing layer for MCP server registries* — is the single most promising positioning available and is currently only a "PENDING" milestone (Namespace §11, milestone 03) |
| A2A | Same as MCP: complement. A2A agent cards are unsigned self-descriptions; standing for agent cards is an open problem |
| OpenTelemetry | **Defer to it.** Anthill's own comparative review says so |
| Policy engines (OPA/Cedar) | Complementary — they consume standing signals; Dillweed produces them |
| Cloud IAM / zero-trust | Complementary in-domain; Dillweed's claim is precisely the cross-domain gap zero-trust architectures leave between organizations |

**Direct answer:** Dillweed is best understood as **a capability registry plus a trust-resolution protocol — i.e., a capability-standing layer — that should be re-grounded as a profile composing existing mechanisms** (CT-style transparency, TUF-style root metadata, OIDC identity, DNS/SPIFFE integration) rather than as a freestanding namespace with bespoke plumbing. The namespace branding, governance corpus, and observability plane are secondary. Its genuinely distinct role is the compound standing question plus reconstructable resolution decisions; everything else it does, something older does better.

---

## 6. Identity Digital Fit

Facts first: Identity Digital operates ~300 TLD registries (Donuts/Afilias lineage), runs registry/DNS infrastructure at global scale with anycast, abuse mitigation, registrar channels, and deep ICANN governance experience. Inference from there:

**Technical suitability:** High for exactly two functions — operating high-availability read-mostly registry/resolver infrastructure, and namespace lifecycle/abuse operations. This is the same operational shape as a TLD registry: authoritative database, signed records, propagation to resolvers, revocation discipline. The Continuity Protocol §10 explicitly names the "licensed neutral operator model — analogous to the registry operator model in domain name infrastructure," which is Identity Digital's literal business.

**Role-by-role assessment:**

1. **Host a public read-only Resolver** — Technically trivial for them; low risk; plausible as a goodwill/optionality pilot. The best *first* ask, eventually. Safeguard needed: none significant (read-only, no key custody).
2. **Operate the authoritative Registry** — **Inappropriate now.** It transfers the trust root to a commercial operator while governance bodies don't exist, recreating the capture problem the Governance Framework §6 prohibits. Appropriate only later, under a governance license with the neutrality covenants GSP-01 describes, after a TSC exists to be the counterparty.
3. **Mirrors/regional resolvers** — Good future fit, *blocked today by the project itself*: the mirror gap report says a mirror operator has "no happy path at all." You cannot ask an operator to run a mirror protocol that isn't specified.
4. **DNS/domain infrastructure only** — Trivially available, strategically meaningless.
5. **Sponsor a foundation/consortium** — Plausible at the margin, but a single commercial sponsor for a neutrality-themed project is weak footing.
6. **One operator among several** — The *correct end-state role*. Neutrality through plurality, not through any single operator's character.
7. **Technical review without operating** — **The right first ask.** Their registry-operations people are among the few populations with operational experience in exactly this shape of system (signed namespace records, revocation propagation, registrar-mediated identity). A review costs them little and gives the project the operator-grade scrutiny it has never had.
8. **License/adopt internally** — Possible defensive interest ("agent-era naming services"), but this is absorption, not stewardship; it would fork the standard into a product.

**Incentive analysis (why they might care):** TLD revenue is mature; "what is the registry business in the agent era" is a live strategic question for every registry operator; capability registries are a recognizable adjacency that uses their core competencies; policy leadership in AI-infrastructure governance is cheap optionality; defensive positioning against hyperscaler agent control planes is real but weak (they have no agent-ecosystem distribution to defend).

**Why they would decline today (and they would):** no customer demand signal; no monetization path; project has zero adoption; the standing question isn't in any RFP; governance burden of touching a single-steward project with unexecuted continuity instruments (GSP-01 §11's open obligations: CDI not executed, sealed recovery materials not placed); legal exposure of operating a trust root that vouches for third-party AI capabilities (abuse/liability surface with no precedent); and — candidly — the name (see §9).

**The core tension, answered:** Would Identity Digital enhance credibility or undermine neutrality? *Both, sequentially.* As one mirror operator among several under a governance license: enhances credibility substantially — it is the institutional template (ICANN-contracted registry operations) the project's own documents reach for. As the sole operating host approached from the project's current position of zero leverage: it would become the de facto owner, and the neutrality thesis — the project's only differentiator — dies. **Do not approach for an operating role until at least one other independent operator exists.**

**What would change their answer:** a completed specialist cryptographic review (ledger AI-008 questions A–D, explicitly flagged in the ledger as a prerequisite "before partnership outreach begins" — the project already knows this); a specified, demonstrated mirror protocol; one non-affiliated organization running a resolver; evidence of enterprise or regulatory pull (a named design partner, a regulator citation); and a protocol-level brand that survives a board slide.

---

## 7. Alternative Hosting Models

| Model | Credibility | Neutrality | Tech ability | Funding | Capture risk | Fit |
|---|---|---|---|---|---|---|
| University research lab | High (eval) | High | Medium | Grant-bound | Low | **Best for formal evaluation + first mirror** |
| Standards body (IETF/IRTF) | High | High | N/A (no ops) | N/A | Low | **Best for the spec**, not the service |
| Nonprofit foundation (LF-style) | High | Medium-high | Via members | Member-funded | Medium (vendor boards) | Best long-term home; premature now — foundations host communities, and there is none yet |
| Public-interest tech org (ISC-like) | High | High | High (ops DNA) | Fragile | Low | Strong candidate for first *public resolver* |
| Cloud provider | Medium | **Low** | High | High | **High** | Contradicts thesis; use only as rented infrastructure |
| Cybersecurity company | Medium | Medium | High | High | High (productization) | Better as reviewer than host |
| Registry consortium (incl. Identity Digital) | High (ops) | Medium alone, high in plurality | **Highest for this workload** | High | Medium | Right end-state *operators*, wrong first movers |
| Government digital agency | High in-jurisdiction | Low globally | Medium | High | High (jurisdictional) | Scenario-D path only |
| Distributed operator federation | Grows with size | **Highest** | Variable | Weakest | Lowest | The architecture's natural shape; needs 2–3 anchor operators |
| Independent steward + contracted infra | Low-medium | Medium (single person) | Adequate | Self | Low external / high key-person | **Correct for the present phase** — it is what exists |

**Recommendations by phase:** Present reference phase — independent steward (status quo), with the GSP-01 open obligations actually executed. First public resolver — independent steward on contracted neutral infrastructure, *or* a public-interest infrastructure org if one will take it. First independent mirror — a university lab or public-interest org (this is the highest-value single act of external validation available; it forces the mirror spec to become real). Formal evaluation — commissioned specialist review (AI-008) + an academic security group. Standards development — an IETF Internet-Draft and dispatch-style conversation for the capability-record/standing semantics; ITU-T SG17 (the Standards Overview §03's preferred mapping) is a reasonable secondary venue but too slow and too far from the implementer community to be primary. Long-term production — foundation-held governance with a federation of contracted operators, of which Identity Digital is a natural one.

---

## 8. Evidence and Traction Assessment

**Technical progress (real and verifiable):** published spec stack with disciplined versioning; three working implementations with 79/65+29/58-test suites and a 19/19 lifecycle integration test; SHA-pinned release with verified asset digests (STEWARD-SWEEP-2026-06-11); a hardening wave shipped with isolated-instance verification; an MCP adapter; an audit ledger that is, as the documentation-set review puts it, "unusually honest, unusually rigorous for a one-steward project."

**What the review history is and isn't:** the "three rounds of external review per component" were generalist *AI* reviews — the ledger says so directly (AI-008: "the generalist AI review used during the v1 audit cycle," distinguishing it from the specialist human review it recommends commissioning). They were conducted with real discipline (severity convergence, reviewer-claim verification catching false positives), and they made the artifact much better. They are **not** independent external validation and must not be presented as such to institutional audiences.

**Discoverability vs. validation:** 1,373 traces, all dated 2026-06-10, all `caller_id: null` — internal test traffic. GitHub: public for under a month, 0 stars, 0 forks, 0 external issues. No inference of validation from crawl activity is warranted, and none exists to infer from anyway.

**Conceptual resonance:** none demonstrated externally. The strongest resonance evidence is *internal* — the comparative reviews finding a genuine niche — which is necessary but not external.

**Missing entirely:** third-party implementation; external capability registration (Namespace §11 milestones 03–05 all PENDING by the spec's own scorecard); human specialist security/crypto review; standards participation beyond aspiration; enterprise or academic engagement; any deployment not on the steward's own machine; executed continuity instruments (CDI, sealed materials — GSP-01 §11).

The project's milestone list (Namespace Standard §11) is honest about this. The risk is not self-deception in the documents — they are unusually candid — but the gap between the corpus's institutional *register* (charters, councils, succession protocols, trademark recitals) and its adoption *reality* (one person, one machine, zero users). Institutional evaluators notice register/reality gaps quickly and price them harshly.

---

## 9. Strategic Options Comparison

**Option 1 — Continue building independently (v2 hardening, docs, public resolver).** Moderate cost, low external-uptake probability *by itself* — building W1–W4 in a vacuum produces a better artifact nobody has asked for. Necessary elements (public read-only resolver; W1 identity) but insufficient as a strategy. Reversible.

**Option 2 — Freeze and seek evaluation.** Low cost, high information value. The ledger already prescribes it (AI-008: specialist review of canonicalization, key rotation, mirror freshness, revocation reuse "before partnership outreach begins"). Should be executed nearly verbatim.

**Option 3 — Approach Identity Digital (or similar) now.** **Negative expected value today.** One meeting with zero adoption evidence, an unexecuted CDI, a CRITICAL finding open, and a name that needs explaining converts a future maybe into a permanent no. Registry operators remember pitches.

**Option 4 — Small federation (2–3 independent resolver/mirror operators).** **Highest expected value per unit cost.** One university lab or public-interest org running a mirror would: force the mirror protocol from "no happy path" to specified; create the first non-self-referential validation; transform every subsequent conversation (including, eventually, Identity Digital). Cost: the mirror spec work plus relationship effort. Risk: rejection — which is itself cheap, early market information.

**Option 5 — Reframe as research contribution.** Low cost, real value, *not mutually exclusive* with anything above. A 12-page paper or Internet-Draft on capability standing — the problem taxonomy from §2, the trace/revocation semantics, the witness-vs-endorsement distinction — would do more for the ideas' survival than another spec revision. The ideas can win even if the operation doesn't.

**Option 6 — Narrow to capability standing + resolver semantics.** **Correct, and the project's own reviews have already voted for it**: re-layer Anthill on OTel (anthill-vs-observability review), delegate crypto plumbing to established patterns (registry comparative review), defer governance elaboration until there is someone to govern. Narrowing is cheap (stop work, mark documents "deferred") and reversible.

**Option 7 — Pause entirely.** Defensible but premature. The carrying cost is near zero, the option value on Scenarios B/D is real, and the next six months of signals (MCP registry trajectory, agent-identity standards activity, supply-chain incidents) will be far more informative than the last six. Pausing *before* running the cheap experiments (Options 2, 4, 5) discards information already mostly paid for. Set disconfirmation criteria instead (§10).

**Positioning:** Strongest: **"capability standing and verifiable resolution for agent tool ecosystems — a complement to MCP/A2A"**, leading with revocation and reconstructable resolution decisions. Weakest: "neutral coordination root for the agent economy" (the L1–L4 framing) — it asks the audience to grant the endgame before the first external user exists.

**The name.** Evaluated on consequences, not taste: "dillweed" is recognizable mild American slang. For a security-infrastructure pitch to a registry operator's executives or an ITU-T study group, that is a real, repeated tax — every introduction spends its first minute on the name instead of the problem. It is **not adoption-fatal** (etcd, Kafka, and GIMP survived odd names), and the 28-year provenance plus trademarks are genuine assets. The right resolution is the one already half-present in the corpus: the *protocol and standards artifacts* need a neutral sub-brand (the documents already use DNSO, DillClaw, `dllwd://`, "capability standing" as terms of art — an Internet-Draft titled e.g. "Capability Standing and Resolution (CSR)" with Dillweed as the founding implementation costs nothing and removes the tax exactly where it bites). Renaming the project wholesale is unnecessary; submitting the word "Dillweed" as the title of a standards proposal is unwise.

---

## 10. Recommended Six-Month Plan

**Month 1 — Close the credibility gaps (one week of work, highest ROI in the plan):**
- Fix the README "no HIGH/MEDIUM open" claim; it is contradicted two directories down and is the single worst thing an evaluator can find in a project whose brand is candor.
- Move the dev private key out of the working tree; document key hygiene.
- Ship the disposition index the documentation-set review calls "the most important gap" — every published finding marked open/closed/superseded.
- Execute the GSP-01 open obligations (CDI, sealed materials, attorney custody). A continuity protocol that is itself incomplete inverts its purpose.

**Months 1–2 — Narrow (Option 6):** Freeze Anthill development; publish a short "Anthill v2 direction: semantic/trust layer over OpenTelemetry" note adopting the internal review's conclusion. Mark governance/continuity documents stable-and-dormant. Declare the active surface: Namespace §3–§7, Registry, DillClaw, mirror protocol.

**Months 2–4 — Evaluate and harden the core (Options 2 + selective 1):** Commission the AI-008 specialist review (human cryptographer/protocol engineer; questions A–D; budget accordingly — this is the one place money should be spent). In parallel: specify the mirror protocol for real (the gap report is the requirements doc), implement W1 caller identity, and stand up the public read-only resolver on contracted infrastructure with the W0 hardening — it is the demo everything else points at.

**Months 3–6 — Manufacture the first external facts (Options 4 + 5):** Write the capability-standing paper/Internet-Draft under a neutral protocol name; submit to IETF dispatch or an agent-infrastructure workshop. Recruit *one* mirror operator (university systems-security lab or public-interest infra org — not a commercial registry yet). Register 2–3 genuinely external capabilities end-to-end through the MCP adapter against the public resolver, so milestones 03/04 of the Namespace Standard's own scorecard flip to ACHIEVED.

**Month 6 — Decision gate.** Continue toward partnership outreach (and only then consider an Identity Digital *technical review* conversation, role 7, with the specialist review and mirror operator in hand) if at least one of: an external mirror/implementation conversation is live; the draft/paper produced substantive engagement; or enterprise/regulatory pull appeared. If none: shift to Option 5 permanently — archive the operation, keep the publications, keep the domains, and let the timing thesis mature without further operational investment.

**Signals to watch (confirm/disconfirm, 12–24 months):** whether the official MCP registry ecosystem adds signing/revocation/standing semantics (if it does *well*, the platform-feature path is winning — disconfirming; if it does poorly or not at all while cross-vendor invocation grows — confirming); agent-identity standards activity (IETF/OpenID work on agent credentials — confirming for the layer, competitive for the implementation); publicized MCP/tool supply-chain incidents (each one is a demand signal for revocation infrastructure); enterprise RFP language asking for tool provenance/runtime verification; any hyperscaler launching a *cross-vendor* capability registry (strongly disconfirming for the neutral-operator thesis).

---

## 11. Final Verdict

Direct answers:

1. **Real problem?** Yes — capability standing is a genuine, identifiable gap; the project's definition of it is its most valuable intellectual contribution.
2. **Important now?** Only its revocation slice. The compound problem is 2–5 years from procurement reality, if it arrives.
3. **More important later?** Probably, under multi-vendor enterprise (B) and regulatory (D) futures; near-worthless under vendor consolidation (A), which is the default trajectory.
4. **Architecture proportionate?** The core is; the stack isn't. Single-root signing without delegation is the structural defect; Anthill and the governance corpus are disproportionate to a zero-adopter ecosystem.
5. **Too broad?** Yes — about three times broader than its defensible core.
6. **Too early?** Appropriately early as a specification and reference; too early as operated infrastructure and far too early for partnership asks.
7. **Credible adoption path?** Narrow but real: MCP/A2A complement → research/standards artifact → small federation → foundation-held federation with contracted operators. Every step requires external facts that don't yet exist.
8. **Identity Digital an appropriate host?** Not now, in any operating capacity. Appropriate later as *one* contracted operator among several under the licensed-neutral-operator model the project's own continuity protocol describes.
9. **What role to ask of them?** Eventually: technical review (role 7), then a read-only resolver or mirror pilot (roles 1/3). Never, from the current position: authoritative registry operation.
10. **Evidence needed first?** Human specialist crypto review completed; mirror protocol specified and demonstrated; one independent operator; one external registered capability; the credibility gaps of §10 closed; a protocol-level brand.
11. **Continue?** Yes — at narrowed scope, with capped investment and the month-6 disconfirmation gate.
12. **Next six months?** The plan in §10: close credibility gaps, narrow, commission real review, ship the public resolver, recruit one mirror, publish the idea under a neutral name.

**Strongest argument for continuing:** the problem definition is real and early, the marginal cost is low, MCP-era supply-chain incidents are already generating demand for exactly the revocation-and-standing semantics this stack has working today — and if the multi-vendor future arrives, a pre-existing, honestly-governed, externally-reviewed reference architecture is worth far more than it cost to maintain.

**Strongest argument for stopping:** after public release, zero external parties have engaged; the likeliest market path is platform-internal capability registries that make a neutral layer unnecessary; and the project's single-key, single-steward construction contradicts its own neutrality thesis in a way that can only be cured by the multi-party adoption it has not attracted — a circular dependency that may never break.

**Overall verdict: Technically credible but early.** The right response to that verdict is not more building and not a partnership pitch — it is narrowing to the capability-standing core, buying real external review, and manufacturing the first independent operator. Those three things convert "early" from a fatal condition into a position.
