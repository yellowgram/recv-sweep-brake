export type QuarantineLabel = "clear" | "quarantine" | "toxic";

/** Closed code set. ok_brake_disabled_clear_only removed — never allow non-clear. */
export type SweepBrakeCode =
  | "sweep_braked"
  | "dust_poison"
  | "token_not_allowed"
  | "sender_not_allowed"
  | "classify_store_down"
  | "ok_clear";

export interface SweepPolicy {
  /**
   * When false (DEFAULT), brake is engaged for all non-clear assets.
   * No auto-sweep until explicitly enabled AND asset clear.
   * enabled=true alone does NOT make quarantine/toxic spendable.
   */
  enabled: boolean;
}

export interface FeedPolicy {
  /** Lowercased token contracts treated as assets. Unknown → quarantine. */
  tokenAllow: Set<string>;
  /** Lowercased expected senders. Unexpected → quarantine flag. */
  senderAllow: Set<string>;
  /** Native/ERC20 amount at or below this (raw) → dust_poison → toxic. */
  dustThreshold: bigint;
  /**
   * When true (DEFAULT) and tokenAllow empty/miss → quarantine unknowns.
   * Empty does not mean allow-all. Setting false is operator opt-in.
   */
  requireTokenAllow: boolean;
  /**
   * When true (DEFAULT) and senderAllow empty/miss → quarantine unknowns.
   * Empty does not mean allow-all. Setting false is operator opt-in.
   */
  requireSenderAllow: boolean;
}

export interface InboundCredit {
  token?: string | null; // null/undefined = native
  sender: string;
  amount: bigint;
  assetKey: string; // operator-chosen id for store (e.g. token+txid)
}

export interface AssetRecord {
  assetKey: string;
  label: QuarantineLabel;
  reasonCodes: SweepBrakeCode[];
  /**
   * Set only by explicit operator `reclassify`.
   * Never written by ingest/classify.
   */
  reclassifyReason?: string;
}

export interface ClassifyResult {
  label: QuarantineLabel;
  reasonCodes: SweepBrakeCode[];
}

export interface SweepCheckResult {
  allow: boolean;
  code?: SweepBrakeCode;
  label?: QuarantineLabel;
  reason?: string;
}

export interface BalanceView {
  spendable: string[];
  quarantined: string[];
  toxic: string[];
  /**
   * When true, store is down — empty lists are NOT a healthy all-clear.
   * Spend must still call checkSweepAllowed / maySpend.
   */
  degraded: boolean;
}

export function defaultSweepPolicy(): SweepPolicy {
  return { enabled: false };
}

export function defaultFeedPolicy(): FeedPolicy {
  return {
    tokenAllow: new Set(),
    senderAllow: new Set(),
    dustThreshold: 0n,
    requireTokenAllow: true,
    requireSenderAllow: true,
  };
}
