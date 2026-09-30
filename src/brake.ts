import type { QuarantineStore } from "./store.js";
import type {
  BalanceView,
  SweepCheckResult,
  SweepPolicy,
} from "./types.js";

/**
 * Send-path bridge: moving non-clear while brake engaged → sweep_braked.
 * sweep_policy.enabled default false → brake ON for non-clear.
 * P0 honesty: non-clear never spendable until reclassified clear (enabled alone does not lift toxic/quarantine).
 * Compose: consult on ANY outbound transfer/spend/swap/collect of inbound-labeled funds (DC12) — not method-name-only.
 */
export function checkSweepAllowed(
  sweep: SweepPolicy,
  store: QuarantineStore,
  assetKey: string
): SweepCheckResult {
  if (store.isDown()) {
    return {
      allow: false,
      code: "classify_store_down",
      reason: "quarantine store unavailable (fail-closed)",
    };
  }

  let rec;
  try {
    rec = store.get(assetKey);
  } catch {
    return {
      allow: false,
      code: "classify_store_down",
      reason: "quarantine store get failed (fail-closed)",
    };
  }

  // Unknown asset on spend path → treat as quarantine (FC) (DC13)
  const label = rec?.label ?? "quarantine";

  if (label === "clear") {
    return { allow: true, code: "ok_clear", label };
  }

  // Non-clear always braked at P0 (sweep.enabled only gates future auto-sweep runners; spend path stays FC).
  // DC5: enabled=true does NOT make quarantine/toxic spendable.
  return {
    allow: false,
    code: "sweep_braked",
    label,
    reason: `sweep braked for label=${label} (sweep_policy.enabled=${sweep.enabled})`,
  };
}

/**
 * Alias of checkSweepAllowed with identical semantics (DC12).
 * Compose must call this (or checkSweepAllowed) on every outbound of inbound-labeled funds.
 */
export function maySpend(
  sweep: SweepPolicy,
  store: QuarantineStore,
  assetKey: string
): SweepCheckResult {
  return checkSweepAllowed(sweep, store, assetKey);
}

/**
 * Minimal balance-view stub — not a dashboard (DC8).
 * When store is down, returns empty lists with degraded: true (DC18).
 * Empty under degraded ≠ healthy all-clear; spend must still call maySpend / checkSweepAllowed.
 */
export function balanceView(store: QuarantineStore): BalanceView {
  if (store.isDown()) {
    return {
      spendable: [],
      quarantined: [],
      toxic: [],
      degraded: true,
    };
  }
  return {
    spendable: store.listByLabel("clear").map((r) => r.assetKey),
    quarantined: store.listByLabel("quarantine").map((r) => r.assetKey),
    toxic: store.listByLabel("toxic").map((r) => r.assetKey),
    degraded: false,
  };
}
