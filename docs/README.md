# Dillweed Namespace — Documentation Index

This directory contains operational documentation, review reports, and design documents for the Dillweed Namespace Project. Formal specifications are in `specs/` and mirrored at [dillweed.com](https://dillweed.com).

## Operations

- **operations-runbook.md** — Deployment, recovery, upgrade, and troubleshooting procedures
- **release-notes/** — Per-release changelogs

## v2 Design

- **dillweed-v2-design-2026-06-10.md** — v2 architecture design: authenticated identity, scalable sync, OTel re-layering, rate limiting, key isolation, tamper-evident logging. Five-wave release plan.

## Strategic Evaluation

- **strategic-evaluation-2026-06-12.md** — Independent strategic evaluation (Fable 5): problem relevance, five-scenario future analysis, architectural fitness, existing-infrastructure comparison, Identity Digital institutional fit, hosting alternatives, evidence/traction assessment, strategic options, six-month plan. Verdict: technically credible but early; narrowing required.

## Documentation-Set Review

- **documentation-set-review-2026-06-11.md** — Independent review of this entire docs corpus (Fable 5): inventory, cross-document contradictions, post-W0 finding dispositions, v2 traceability matrix, institutional-readiness assessment, prioritized remediation. Note: identifies which findings in the reviews below were closed by W0 after their publication.

## Architecture Reviews

Production-readiness assessments for a 100-resolver, multi-organization deployment target.

- **architecture-review-registry-2026-06-10.md** — 9 structural findings
- **architecture-review-resolver-2026-06-10.md** — 8 structural findings
- **architecture-review-anthill-2026-06-10.md** — 9 structural findings

## Comparative Analyses

Where Dillweed's design is genuinely unique vs. where it should integrate with existing infrastructure.

- **architecture-review-registry-vs-existing-infrastructure-2026-06-10.md** — Registry vs DNS registries, PKI CAs, npm/crates.io, Consul/etcd, SPIFFE/SPIRE
- **anthill-vs-observability-stack-2026-06-10.md** — Anthill vs OpenTelemetry, Prometheus, Grafana

## Security

- **cross-service-trust-boundary-analysis-2026-06-10.md** — Cross-service attack chains: 1 CRITICAL, 4 HIGH, 4 MEDIUM, 2 LOW

## Implementer Experience

Gap reports for deploying or implementing from the specifications alone.

- **dillclaw-deployment-gap-report-2026-06-10.md** — Resolver first-deployment experience
- **anthill-signal-emitter-gap-report-2026-06-10.md** — Anthill signal emitter integration
- **registry-mirror-deployment-gap-report-2026-06-10.md** — Registry mirror deployment
- **spec-gap-report-2026-06-10.md** — Second-implementer analysis: 88 gaps, 9 blockers for cross-implementation compatibility

## Specification Consistency Reviews

Six-round automated review series (Fable 5) covering all 8 specs and 3 implementations. 4 HIGH and 19 MEDIUM findings raised; all resolved and verified.

- **spec-consistency-review-2026-06-09.md** — Round 1: 4 HIGH, 9 MEDIUM, 6 LOW
- **spec-consistency-review-2026-06-09-r2.md** — Round 2: 3 HIGH, 10 MEDIUM, 9 LOW
- **spec-consistency-review-2026-06-09-r3.md** — Round 3 (verification): 2 new findings from fix regressions
- **spec-consistency-review-2026-06-09-r4.md** — Round 4 (verification): 2 MEDIUM residuals
- **spec-consistency-review-2026-06-09-r5.md** — Round 5 (verification): 3 LOW residuals
- **spec-consistency-review-2026-06-10-r6.md** — Round 6 (closure): all HIGH/MEDIUM verified closed
