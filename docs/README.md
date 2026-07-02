# Dillweed Namespace — Documentation Index

This directory contains operational documentation, review reports, and design documents for the Dillweed Namespace Project. Formal specifications are in `specs/` and mirrored at [dillweed.com](https://dillweed.com).

## Finding Disposition (start here)

- **finding-disposition-index-2026-06.md** — Authoritative index of all 69 canonical findings across the review corpus, independently verified against repo HEAD `c999fdd` (2026-06-12): current disposition (open / partially closed / closed / accepted for v1 / deferred to v2), evidence, deployment gates, contradiction table, hardening-wave assessment, and claim-safety review. **The review documents below are historical snapshots; consult the index for current finding status.**

## Operations

- **operations-runbook.md** — Deployment, recovery, upgrade, and troubleshooting procedures
- **release-notes/** — Per-release changelogs

## v2 Design

- **dillweed-v2-design-2026-06-10.md** — v2 architecture design: authenticated identity, scalable sync, OTel re-layering, rate limiting, key isolation, tamper-evident logging. Five-wave release plan. *Partially outdated: the W0 row no longer matches what shipped (fail-closed/CORS and async trace sinks dropped) — see index FDI-XST-004/006.*

## Research

- **potential-research-areas.md** — Invitation to independent research: 18 research themes (capability standing as a concept, registry/resolver architecture, cryptographic trust, trust-score semantics, adversarial observability, formal methods, governance, adoption economics, empirical necessity), 26 concrete project ideas, 18 falsifiable hypotheses, testbed designs, onboarding path, and publication principles. Written for university faculty, students, and security labs; negative findings explicitly invited.
- **research-opportunities-summary.md** — One-page companion to the above: overview, 8 highlighted research questions, 10 project ideas by level and duration, current limitations.
- **independent-review-methodology-for-agentic-trust-infrastructure.md** — *An Evidence-Layered, Temporally Maintained Review Method for Agentic Trust Infrastructure.* Methodology paper (working draft) that uses the Dillweed review corpus at commit `110c4c1` as a worked case study to derive a reusable, 14-stage review method for early agentic trust infrastructure: baseline pinning, claim decomposition, cross-service trust-boundary analysis, adversarial second-implementer review, iterative closure verification, controlled finding disposition, deployment-profile gating, and an AI-assisted-review provenance protocol. Includes evidence taxonomy, severity/confidence/completeness separation, threats-to-validity, a validation agenda, and reusable instrument templates (Appendices A–J). Explicitly not peer-reviewed, not independently validated, and derived from a single case; treats the case corpus as AI-assisted, steward-commissioned review — not third-party assessment.

## Strategic Evaluation

- **strategic-evaluation-2026-06-12.md** — Independent strategic evaluation (Fable 5): problem relevance, five-scenario future analysis, architectural fitness, existing-infrastructure comparison, Identity Digital institutional fit, hosting alternatives, evidence/traction assessment, strategic options, six-month plan. Verdict: technically credible but early; narrowing required.

## Documentation-Set Review

- **documentation-set-review-2026-06-11.md** — Independent review of this entire docs corpus (Fable 5): inventory, cross-document contradictions, post-W0 finding dispositions, v2 traceability matrix, institutional-readiness assessment, prioritized remediation. Note: identifies which findings in the reviews below were closed by W0 after their publication.

## Architecture Reviews

Production-readiness assessments for a 100-resolver, multi-organization deployment target. Each carries a historical-review banner; current finding status is in the disposition index.

- **architecture-review-registry-2026-06-10.md** — 9 structural findings (S1–S9). *S3 (pagination/ETag) and S4 (rate limiting) partially closed by W0; S1/S2/S5–S9 open or deferred to v2.*
- **architecture-review-resolver-2026-06-10.md** — 8 structural findings (S1–S8). *S3 (SSRF) closed by W0; S1/S2 partially closed; S4–S8 open or deferred.*
- **architecture-review-anthill-2026-06-10.md** — 9 structural findings (S1–S9). *S8 (rate limiting) closed in code; S1 (unauthenticated `node_signature`) and the rest open or deferred to v2.*

## Comparative Analyses

Where Dillweed's design is genuinely unique vs. where it should integrate with existing infrastructure.

- **ans-v2-and-capability-standing-boundary-analysis-2026-06.md** — Independent comparative review of ANS v2 (draft-narajala-courtney-ansv2-01, Linux Foundation intent, agentnameservice repos) vs the Dillweed stack at `310d503`: primary-object comparison, responsibility matrix, lifecycle/revocation scenarios, AIM vs Anthill, component disposition, non-normative capability-standing profile sketch, 90-day plan. Verdict: complementary profile over ANS identity is the strongest path; capability-granular standing and resolution traces are the retained assets.
- **architecture-review-registry-vs-existing-infrastructure-2026-06-10.md** — Registry vs DNS registries, PKI CAs, npm/crates.io, Consul/etcd, SPIFFE/SPIRE
- **anthill-vs-observability-stack-2026-06-10.md** — Anthill vs OpenTelemetry, Prometheus, Grafana

## Security

- **cross-service-trust-boundary-analysis-2026-06-10.md** — Cross-service attack chains: 1 CRITICAL, 4 HIGH, 4 MEDIUM, 2 LOW. *F-8 (SSRF) and F-10 (truncation) closed by W0; F-9 partially narrowed; **F-3 (CRITICAL, unverified `node_signature`)** and the HIGH cluster (F-1/F-2/F-4/F-6) remain open — see index.*

## Implementer Experience

Gap reports for deploying or implementing from the specifications alone. The mirror and emitter reports were re-verified fully current; the others are partially stale (see per-document banners and the index).

- **dillclaw-deployment-gap-report-2026-06-10.md** — Resolver first-deployment experience. *G-1/G-2/G-3 (config reference, TTL knobs, non-enforcing SHA check) still open.*
- **anthill-signal-emitter-gap-report-2026-06-10.md** — Anthill signal emitter integration. *Still current (Anthill spec unchanged at v0.1.3).*
- **registry-mirror-deployment-gap-report-2026-06-10.md** — Registry mirror deployment. *Still current — W0 touched no mirror surface; no sync protocol exists.*
- **spec-gap-report-2026-06-10.md** — Second-implementer analysis: 88 gaps, 9 blockers for cross-implementation compatibility. *REG-22 partially closed by spec v0.1.6; the other 87 gaps and all 9 blockers remain open.*

## Specification Consistency Reviews

Six-round automated review series (Fable 5) covering all 8 specs and 3 implementations. 8 HIGH and 21 MEDIUM findings raised across the rounds (r1: 4H/9M, r2: 3H/10M, r3: 1H/2M new — earlier summaries understated this as "4 HIGH and 19 MEDIUM"); all resolved and verified.

- **spec-consistency-review-2026-06-09.md** — Round 1: 4 HIGH, 9 MEDIUM, 6 LOW
- **spec-consistency-review-2026-06-09-r2.md** — Round 2: 3 HIGH, 10 MEDIUM, 9 LOW
- **spec-consistency-review-2026-06-09-r3.md** — Round 3 (verification): 2 new findings from fix regressions
- **spec-consistency-review-2026-06-09-r4.md** — Round 4 (verification): 2 MEDIUM residuals
- **spec-consistency-review-2026-06-09-r5.md** — Round 5 (verification): 3 LOW residuals
- **spec-consistency-review-2026-06-10-r6.md** — Round 6 (closure): all HIGH/MEDIUM verified closed
