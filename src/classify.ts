import type {
  ClassifyResult,
  FeedPolicy,
  InboundCredit,
  SweepBrakeCode,
} from "./types.js";

/**
 * Minimal priced-with feeds: token allow, sender allow, dust-poison.
 * Unknown → quarantine (fail-closed on spend clearance).
 * Empty allowlists under default require*=true quarantine unknowns (DC10).
 * Native skips token-allow but remains subject to sender allow + dust (DC11/F8).
 * NO keys / signing / auto-move. Does not call reclassify (DC4).
 */
export function classifyInbound(
  feeds: FeedPolicy,
  credit: InboundCredit
): ClassifyResult {
  const reasons: SweepBrakeCode[] = [];
  let label: ClassifyResult["label"] = "clear";

  const sender = credit.sender.toLowerCase();
  if (feeds.requireSenderAllow) {
    if (feeds.senderAllow.size === 0 || !feeds.senderAllow.has(sender)) {
      reasons.push("sender_not_allowed");
      label = "quarantine";
    }
  }

  const token = credit.token ? credit.token.toLowerCase() : "native";
  // Native credits skip requireTokenAllow (not an ERC-20). Still subject to sender allow + dust.
  if (feeds.requireTokenAllow && token !== "native") {
    if (feeds.tokenAllow.size === 0 || !feeds.tokenAllow.has(token)) {
      reasons.push("token_not_allowed");
      label = "quarantine";
    }
  }

  if (credit.amount <= feeds.dustThreshold) {
    reasons.push("dust_poison");
    label = "toxic";
  }

  if (reasons.length === 0) {
    return { label: "clear", reasonCodes: [] };
  }
  return { label, reasonCodes: reasons };
}
