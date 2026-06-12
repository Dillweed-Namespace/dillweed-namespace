# Research Opportunities in the Dillweed Namespace Project — Summary

**Date:** 2026-06-12 · **Full document:** [potential-research-areas.md](potential-research-areas.md)

## Overview

The Dillweed Namespace Project is an open research artifact testing one hypothesis: that agentic AI systems invoking capabilities across organizational boundaries may need a neutral **capability-standing layer** — infrastructure answering what a named capability is, who governs it, whether its signed record is current or revoked, and whether the resolution decision can be reproduced and audited later. The project provides a specification stack, a working single-host reference implementation (Registry, DillClaw Resolver, Anthill) with passing conformance and integration suites, and a candid corpus of self-critical architecture reviews. It does not claim the problem is solved, or even that a new layer is the right answer; external adoption and independent validation are currently essentially zero. Researchers are invited to deploy, reproduce, attack, formally model, compare, and — where the evidence points that way — falsify the project's premise. Negative findings are explicitly valuable.

## Eight Highlighted Research Questions

1. Is **capability standing** a genuinely distinct systems concept, or a profile of existing standards (PKI, CT, TUF, OIDC, SPIFFE)? (Theme A/P)
2. Do the failures the project posits — tool substitution, revoked-tool invocation, silent provider change — **actually occur at material rates** in real agent/tool ecosystems? (Theme R)
3. What **revocation propagation guarantees** can a TTL + stale-while-revalidate cache design actually deliver, and can a maximum-staleness bound be formally proven? (Themes G, J)
4. Is a composite **scalar trust score** useful, gameable, reproducible — and does it cause more user overconfidence than structured evidence? (Themes E, O)
5. Can the proposed v2 identity model (delegation, dual signatures, enrolled node keys) be built from **existing identity standards** rather than new mechanisms? (Theme F)
6. Can a registry **mirror prove freshness and fidelity without being trusted**, via signed checkpoints and delta sync? (Theme C)
7. Is an adversarial observability plane viable — can governance signals be made **evidence-grade** against false reporting, collusion, and framing attacks? (Theme H)
8. Is the founding-steward → federation **governance transition** credible, and can a neutral trust root resist commercial or jurisdictional capture? (Themes M, N, Q)

## Ten Project Ideas

| Project | Level | Duration |
|---|---|---|
| Independent v1 deployment and reproducibility study | Undergraduate | 4–8 weeks |
| Continuity-protocol fire drill (execute key-transfer procedures as written) | UG/Master's | 8–12 weeks |
| Trust-score gaming study (adversarial score inflation) | UG/Master's | 1 semester |
| Formal verification of revocation propagation (TLA+/Alloy) | Master's/PhD | 6–12 months |
| Alternative trust-score design + user study of trust-signal interpretation | Master's/PhD | 1–2 semesters |
| Sigstore/Rekor or SPIFFE/SPIRE integration prototype | Master's | 1–2 semesters |
| Isolated-deployment red-team exercise against the published threat catalog | UG (supervised)/Master's | 1 semester |
| Verifiable mirror prototype + delta-sync protocol implementation | Master's/PhD/faculty | 6–12 months |
| Capability-standing incident taxonomy + MCP tool-churn longitudinal study | Master's/PhD/faculty | 6–12 months |
| "Minimal Dillweed" built solely from existing standards (CT+TUF+OIDC) | PhD/faculty | 1–3 years |

Full table of 26 projects with methods and expected outputs: [potential-research-areas.md §4](potential-research-areas.md#4-suggested-research-projects).

## Current Limitations

- v1 is a single-host reference implementation (SQLite, macOS installers), not production infrastructure; public deployment is gated on GitHub Issue #2.
- Mirror synchronization is unimplemented; multi-organization identity is a v2 design (Issue #4), not code; Anthill stores but never verifies node signatures (open CRITICAL finding F-3).
- Append-only logs are conventions, not cryptographic proofs; the resolver's determinism guarantee is not achievable as specified.
- External adoption and independent validation are essentially zero; the project's review corpus is self-authored and should be treated as hypotheses to re-derive, not settled findings.
- The project owner is not an independent evaluator, and studying the artifact implies no endorsement in either direction.

## Where to Start

Read [potential-research-areas.md](potential-research-areas.md) — especially "Suggested Starting Points," the researcher onboarding path (§10), and the 18 falsifiable hypotheses (§6). All adversarial work belongs on deployments you own; security findings go through responsible disclosure.
