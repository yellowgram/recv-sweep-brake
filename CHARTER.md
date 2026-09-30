# recv-sweep-brake — charter fences

**Status:** LOCAL_SCAFFOLD · private · LaunchGate-before-expansion  
**As of:** 2026-09-30 (ET)

This package is the founder **no-auto-sweep** fence. Keep the surface honest. No public remote / npm until founder + LaunchGate.

## Job (P0)

- **No auto-sweep** until `sweep_policy.enabled` (default **off**)
- Quarantine states: `clear` \| `quarantine` \| `toxic`
- **Priced-with feeds (minimal):** token allow, sender allow, dust-poison
- When send tries to move **non-clear** inbound → deny `sweep_braked`
- **NO keys / signing / auto-move**

## Compose slot

```
recv classify feeds → recv-quarantine → recv-sweep-brake ──► send cluster (deny sweep_braked)
```

Bridge: send path consults quarantine / brake before broadcast on **any** outbound of inbound-labeled funds (`checkSweepAllowed` / `maySpend`).

Upstream: `recv-approval-watch` (emit/clearance peer — compose mention only).  
Send-rail: `send-approve-bound` / `send-permit2-bound` / `send-idempotency` (compose mention only — do not redesign).

## In scope (P0)

- `sweep_policy.enabled` default false → brake engaged for non-clear
- Quarantine label API + minimal feeds (token/sender allow, dust-poison thresholds)
- Send-path check: transfer/sweep/spend of non-clear → `sweep_braked`
- Explicit operator `reclassify(assetKey, "clear", reason)` — toxic/quarantine never auto-clear
- Minimal balance-view stub: `spendable` vs `quarantined` vs `toxic` + `degraded` when store down (no dashboard product)
- offline `demo:offline` + unit tests
- MIT, self-hosted, local-only until founder

## Out of scope / fences

| Fence | Meaning |
| --- | --- |
| **NO keys / signing / auto-move** | Classify + brake only. Never sweep into treasury as a service. |
| **No custody / Safe / SaaS / mainnet SLA** | Charter out. |
| **No Soft\*** | Forbidden. |
| **No Polar / checkout URLs** | None. |
| **No public/npm until founder** | Private local scaffold only. |
| **BurnBrake out** | HTTP spend governor is unrelated; do not meter inbound credits as BurnBrake. |
| **Lookalike** | Local pin core only if added; intel adapters optional with FC-on-spend-clearance — not oracle SaaS. |
| **LaunchGate-before-expansion** | Hosted ingest, treasury UX, pager SKUs need LaunchGate. |

## Fail modes (default)

| Case | Default | Notes |
| --- | --- | --- |
| `sweep_policy.enabled` false (default) | brake on for non-clear | founder fence |
| Unknown inbound | **quarantine** (FC) | not spendable |
| Dust / poison feed hit | toxic or quarantine | per policy |
| Send moves non-clear | **fail-closed** | `sweep_braked` |
| Store / classify unavailable on spend path | **fail-closed** | never silent clear |
| `enabled: true` alone | non-clear still braked | does not lift toxic/quarantine |

## Soft* ban

Forbidden: any Soft* monetization / conversion naming or copy in this package (including hyphenated or spaced Soft* WTP forms). Use Soft* only as the ban token.

## Acceptance sketch (tandem)

Unexpected/lookalike credit → quarantine; sweep attempt → send deny `sweep_braked`.
