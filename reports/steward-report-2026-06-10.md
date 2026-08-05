# Dillweed Protocol Steward — Review Report

**Date:** 2026-06-10
**Agent:** dillweed.protocol-steward
**Mode:** review-and-recommend (read-only)

## Summary

All six capability boundary checks cleared (Exit 0 for allowed; Exit 2 for
approval-required). One finding: the local repository copy of
`namespace-standard.html` is at v0.4.4 while dillweed.com still publishes
v0.4.3 — the revision contains three substantive corrections (§3.3, §9,
footer) that are staged in the repo but not yet published. All other
surfaces are consistent: seven remaining specs match between repo and site,
all three component version references agree across README / release notes /
ops runbook, all tarball SHAs match the GitHub Release, the trust-root PEM
SHA matches the canonical value in every document, all three services are
healthy with expected configuration, and all nine steward capabilities
resolve with `sig_valid` and `sig_verified`.

---

## Step Results

### Step 1 — Spec drift detection
**Capability:** `review.spec.read` + `review.website.fetch` — **ALLOWED**
**Status:** FINDING

Compared eight spec documents between the local repo (`~/dillweed-namespace-repo/specs/`) and dillweed.com:

| Document | Local version | Published version | Match? |
|---|---|---|---|
| namespace-standard.html | v0.4.4 | v0.4.3 | **NO — local ahead** |
| registry-spec.html | v0.1.5 | v0.1.5 | yes |
| dillclaw-spec.html | v0.1.7 | v0.1.7 | yes |
| anthill-spec.html | v0.1.3 | v0.1.3 | yes |
| standards-overview.html | v1.0.10 | v1.0.10 | yes |
| governance.html | v1.1.3 | v1.1.3 | yes |
| continuity-protocol.html | GSP-01 v1.0.3 | GSP-01 v1.0.3 | yes |
| dnso-operations-charter.html | v1.0.3 | v1.0.3 | yes |

**Finding detail:** The local `namespace-standard.html` contains a Revision 0.4.4
note (June 2026) describing three changes:
- §3.3: version suffix example corrected from `:v2` to valid semver `:1.2.0`
- §9: stack diagram revised — Anthill and Registry are now unnumbered (orthogonal
  plane and authoritative substrate); only L1–L4 are numbered vertical layers
- Footer: reuse-rights grant expanded from "standards discussion and research
  purposes" to "standards discussion, research, and interoperable implementation,"
  aligning with the other seven spec documents

dillweed.com still serves the prior v0.4.3 revision. The local file is staged
ahead of the published site.

---

### Step 2 — Version consistency
**Capability:** `review.repo.read` — **ALLOWED**
**Status:** PASS

Checked version references in four documents:

| Document | Registry | Resolver | Anthill |
|---|---|---|---|
| README.md | v0.2.8 | v0.1.8 | v0.1.6 |
| docs/release-notes/v1.0.0-release-notes.md | v0.2.8 | v0.1.8 | v0.1.6 |
| docs/operations-runbook.md | v0.2.8 | v0.1.8 | v0.1.6 |
| PROJECT_LEDGER.md (header inventory) | v0.2.8 | v0.1.8 | v0.1.6 |

All version references agree. No mismatches found.

---

### Step 3 — SHA verification
**Capability:** `review.release.verify` — **ALLOWED**
**Status:** PASS

Expected SHAs per CLAUDE.md and repo documents:

| Component | Expected SHA256 |
|---|---|
| Registry v0.2.8 | `f0e329f51ab5eb1704d496084dd02525a02ef3d754618f26b08c3a9a69d2361a` |
| Resolver v0.1.8 | `2e3376a50c8485607c614fccbac44d3ffd9f222550ad1e5f97b6c7e45c814f0a` |
| Anthill v0.1.6 | `3bda022d2213240cfbc4355e6c07e85b8f8b997a7ae398ad626f5cb58f574f36` |

GitHub Release v1.0.0 asset digests (via GitHub API):
- Registry: `sha256:f0e329f51ab5eb1704d496084dd02525a02ef3d754618f26b08c3a9a69d2361a` — **match**
- Resolver: `sha256:2e3376a50c8485607c614fccbac44d3ffd9f222550ad1e5f97b6c7e45c814f0a` — **match**
- Anthill: `sha256:3bda022d2213240cfbc4355e6c07e85b8f8b997a7ae398ad626f5cb58f574f36` — **match**

GitHub Release body SHA table also matches. All three tarball SHAs are consistent
across README, release notes, and GitHub Release.

---

### Step 4 — Trust root verification
**Capability:** `review.website.fetch` — **ALLOWED**
**Status:** PASS

Fetched `https://dillweed.com/dnso_public.pem` and computed SHA256:

```
909891e92cfa7362ee88fd75e85f379a317680a2c987fc4d88ecae150deb6f33
```

Canonical value per CLAUDE.md, README.md, and v1.0.0 release notes:
```
909891e92cfa7362ee88fd75e85f379a317680a2c987fc4d88ecae150deb6f33
```

**Match confirmed.** Trust root is consistent across all authoritative references.

---

### Step 5 — Deployment health check
**Capability:** `review.repo.read` — **ALLOWED**
**Status:** PASS

Queried all three service health endpoints:

**Registry** — `http://localhost:9475/health`
```json
{
  "status": "ok",
  "registry_version": "dillweed-registry/0.2.8",
  "capabilities": 27,
  "signing": "Ed25519 (DNSO)",
  "timestamp": "2026-06-10T10:43:59Z"
}
```
Version matches expected v0.2.8. Status ok.

**Resolver (DillClaw)** — `http://localhost:9474/health`
```json
{
  "status": "ok",
  "registry": { "source": "remote", "mode": "ok", "records": 27 },
  "dnso_key": { "configured": true, "algorithm": "ed25519" },
  "resolver_version": "dillclaw/0.1.8",
  "timestamp": "2026-06-10T10:43:59Z"
}
```
Version matches expected v0.1.8. `registry.source: "remote"` confirmed.
`dnso_key.configured: true` confirmed. Status ok.

**Anthill** — `http://localhost:9476/health`
```json
{
  "status": "ok",
  "version": "dillweed-anthill/0.1.6",
  "signals_received": 117,
  "timestamp": "2026-06-10"
}
```
Version matches expected v0.1.6. Status ok.

All three services healthy with expected configuration.

---

### Step 6 — Capability resolution verification
**Capability:** `review.release.verify` — **ALLOWED**
**Status:** PASS

Resolved all nine steward capabilities through DillClaw (MCP interface,
port 9474). All nine returned `status: "resolved"` with `trust_tier: "verified"`:

| Capability | Trust Score | sig_valid | sig_verified | trust_tier |
|---|---|---|---|---|
| dillweed://review.spec.read | 0.59 | yes | yes | verified |
| dillweed://review.repo.read | 0.59 | yes | yes | verified |
| dillweed://review.website.fetch | 0.59 | yes | yes | verified |
| dillweed://review.release.verify | 0.59 | yes | yes | verified |
| dillweed://review.report.write | 0.59 | yes | yes | verified |
| dillweed://review.issue.suggest | 0.59 | yes | yes | verified |
| dillweed://review.issue.open | 0.59 | yes | yes | verified |
| dillweed://review.patch.propose | 0.59 | yes | yes | verified |
| dillweed://ledger.update.propose | 0.59 | yes | yes | verified |

All nine capabilities carry `dnso_verified`, `sig_valid`, `sig_verified` trust
signals. The `endpoint_unchecked` signal is present on all records — this is
expected for steward agent capabilities (endpoints are localhost-internal and
not reachable by the health-probe path).

---

### Step 7 — Write report
**Capability:** `review.report.write` — **ALLOWED**
**Status:** PASS

This file.

---

### Step 8 — Issue suggestions
**Capability:** `review.issue.suggest` — **ALLOWED** (presented below)
**Capability:** `review.issue.open` — **APPROVAL NEEDED** (awaiting steward)

One finding warrants a suggested issue. See **Suggested Issues** section.

---

### Step 9 — Ledger entry proposal
**Capability:** `ledger.update.propose` — **APPROVAL NEEDED** (awaiting steward)

See **Proposed Ledger Entry** section.

---

## Findings

### FINDING-1 — Namespace Standard spec version drift

**Severity:** LOW (informational — no runtime or trust-chain impact)

The local repository copy of `specs/namespace-standard.html` is at **v0.4.4**
(June 2026) while `https://dillweed.com/namespace-standard.html` still publishes
**v0.4.3**. The v0.4.4 revision contains three corrections:

1. **§3.3** — version suffix example corrected from `:v2` to valid semver `:1.2.0`
2. **§9** — stack diagram revised (Anthill and Registry unnumbered; L1–L4 numbered vertical layers only)
3. **Footer** — reuse-rights grant expanded to "standards discussion, research, and interoperable implementation" (aligns with the other seven spec documents)

These are substantive corrections (one is a spec example error; the others are
framing and consistency fixes). The local file is staged ahead of the site.
No other spec document has this discrepancy.

---

## Suggested Issues

### Issue 1 — Publish Namespace Standard v0.4.4 to dillweed.com

**Title:** `Publish namespace-standard.html v0.4.4 to dillweed.com`

**Body:**
```
The local repository contains `specs/namespace-standard.html` at v0.4.4
(June 2026), but dillweed.com still serves v0.4.3.

The v0.4.4 revision addresses three items:

- **§3.3 example fix:** version suffix example corrected from `:v2` to valid
  semver `:1.2.0`. The prior example was not valid semver and could mislead
  implementers.
- **§9 stack diagram:** Anthill and Registry are now unnumbered (orthogonal
  plane and authoritative substrate respectively); only L1–L4 are numbered
  vertical layers. The prior diagram overstated the layering relationship.
- **Footer reuse-rights:** grant expanded from "standards discussion and
  research purposes" to "standards discussion, research, and interoperable
  implementation," aligning with the other seven specification documents.

**Action required:** Publish `specs/namespace-standard.html` from the repository
to dillweed.com to bring the published spec into sync with the repository.

**Detected by:** Dillweed Protocol Steward Agent — steward-report-2026-06-10.md
```

**Labels:** `spec`, `documentation`, `low`

---

## Proposed Ledger Entry

*(Requires human approval before adding to PROJECT_LEDGER.md — `ledger.update.propose`, Exit 2)*

```markdown
### Steward review session — 2026-06-10

- **Agent:** dillweed.protocol-steward (review-and-recommend mode)
- **Scope:** Full consistency sweep — spec drift, version consistency, SHA
  verification, trust root, deployment health, capability resolution
- **Boundary enforcement:** All nine capabilities verified through enforce-boundary.sh
  and DillClaw before execution. All allowed capabilities: Exit 0. Approval-required
  capabilities (review.issue.open, review.patch.propose, ledger.update.propose):
  Exit 2, awaiting steward.
- **Outcome:** One finding (FINDING-1): `namespace-standard.html` is at v0.4.4
  in the repo but v0.4.3 on dillweed.com. Three corrections staged but not
  published (§3.3 example, §9 diagram, footer). All other checks passed.
- **Report:** `~/Dillweed-Agent/reports/steward-report-2026-06-10.md`
- **Suggested issue:** Publish namespace-standard.html v0.4.4 to dillweed.com
  (awaiting steward approval to open)
```
