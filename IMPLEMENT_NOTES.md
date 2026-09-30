# IMPLEMENT_NOTES — recv-sweep-brake P0

**As of:** 2026-09-30 (ET)  
**Against:** `/workspace/recv-sweep-brake-lg/DESIGN-GATE.md` PASS-with-conditions (DC1–DC18)  
**Artifact:** `/workspace/recv-sweep-brake` (still `"private": true`, no remote, no npm publish)

## What changed vs scaffold

| Area | Scaffold | P0 implement |
| --- | --- | --- |
| Sweep codes | included unused `ok_brake_disabled_clear_only` | Removed from closed union (DC5/DC14) — never allow non-clear |
| Reclassify | store.set overwrite only | Explicit `reclassify(store, assetKey, label, reason)` records `reclassifyReason`; never from ingest/classify (DC4) |
| maySpend | absent | Alias of `checkSweepAllowed` (DC12) |
| balanceView | empty lists on store-down, no signal | `degraded: true` when store down; empty ≠ healthy all-clear (DC18) |
| Docs | scaffold codes table | Verbatim honesty lines DC1/DC2/DC4/DC5/DC6/DC7/DC9/DC10/DC12 in README (+ DC2/DC6 in SECURITY) |
| Compose | charter compose line | README compose: approval-watch upstream; send-rail peers mention only (DC17) |
| package.json | private, no public URLs | Still private; **no** `repository` / `homepage` / `prepublishOnly` |
| Demo | 7 fixture steps | + enabled=true still brakes, maySpend toxic, empty allowlists, reclassify, store-down degraded |

## DC checklist

| ID | Status | Notes |
| --- | --- | --- |
| DC1 | satisfied | `defaultSweepPolicy().enabled === false` (`src/types.ts`); verbatim README honesty line; demo step 1 |
| DC2 | satisfied | `checkSweepAllowed` / `maySpend` → `classify_store_down` when store down (`src/brake.ts`); verbatim README + SECURITY |
| DC3 | satisfied | quarantine → `sweep_braked`; `balanceView.spendable` excludes quarantine (`src/brake.ts` + tests) |
| DC4 | satisfied | `reclassify` in `src/reclassify.ts`; ingest never calls it; verbatim README; toxic stays until operator reclassify |
| DC5 | satisfied | enabled=true still brakes quarantine/toxic (`src/brake.ts`); `ok_brake_disabled_clear_only` removed from union; verbatim README |
| DC6 | satisfied | no sign/broadcast/auto-move exports; ingest classifies+stores only; verbatim README + SECURITY |
| DC7 | satisfied | no BurnBrake metering; verbatim README BurnBrake-out line |
| DC8 | satisfied | minimal `balanceView` only — no dashboard/SKU |
| DC9 | satisfied | offline classify + brake + fixtures; no oracle dep; verbatim README |
| DC10 | satisfied | default `require*=true` + empty allow → quarantine (`src/classify.ts`); verbatim README |
| DC11 | satisfied | require-false documented as opt-in; demo uses default require-true; native still sender+dust (tests + README) |
| DC12 | satisfied | `maySpend` exported; README any-outbound verbatim; compose docs require consult on every outbound |
| DC13 | satisfied | unknown assetKey → label quarantine → `sweep_braked` (`src/brake.ts`) |
| DC14 | satisfied | closed codes: sweep_braked, dust_poison, token_not_allowed, sender_not_allowed, classify_store_down, ok_clear; labels clear\|quarantine\|toxic |
| DC15 | satisfied | tests cover (1)–(10): default enabled false, store-down, quarantine+enabled, toxic+enabled, empty allowlists, dust not spendable, unknown key, no sign API, README verbatim, demo sealed |
| DC16 | satisfied | private:true; no repository/homepage/prepublishOnly; Soft\* ban token only; no Polar; BurnBrake out; no sibling redesign; Soft\* conversion scan clean |
| DC17 | satisfied | README compose: recv classify → quarantine → sweep-brake → send; approval-watch upstream; send-approve-bound / send-permit2-bound / send-idempotency mention only |
| DC18 | satisfied | `balanceView` returns `degraded: true` when store down; documented in README; tested |

## Rejected (not shipped)

R1–R17 from DESIGN-GATE remain rejected: no default enabled true, no silent clear, no quarantine/toxic spendable without reclassify, no auto-move/treasury, no keys/signing, no BurnBrake inbound, no dashboard, no oracle SaaS, no empty-allow=allow-all under defaults, no method-name-only brake, no public remote/npm/Polar, no sibling redesign, no Credit Ledger, no Soft\* conversion naming, no ship-holes-for-CR4, no hosted ingest/pager/treasury UX in P0.

## Soft* scan

Ban-token-only Soft\* mentions in CHARTER / README / demo / fixture / IMPLEMENT_NOTES (fence language). Banned Soft* conversion / monetization naming forms are absent from the tree (excluding node_modules/dist). LICENSE “Software” is unrelated MIT wording.

## Verification (this implement)

- `npm test` — **30 passed** (1 file: evaluate.test.ts — classify/brake scaffold, DC15 locks, reclassify, maySpend, balanceView degraded, docs honesty, Soft* scan, package fences)
- `npm run demo:offline` — OK, matches `docs/fixtures/offline.expected.txt` (12 fixture steps + charter/compose lines)

## DC still open

None of DC1–DC18 are left intentionally open for this P0. Expansion (hosted ingest, treasury UX, pager SKUs, lookalike intel adapters) remains LaunchGate-gated; auto-move/signing stay culled.
