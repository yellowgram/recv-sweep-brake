import { classifyInbound } from "./classify.js";
import type { QuarantineStore } from "./store.js";
import type { FeedPolicy, InboundCredit, AssetRecord } from "./types.js";

/**
 * Classify + store. No auto-move. No keys/signing.
 * Never calls reclassify — toxic/quarantine never auto-clear (DC4).
 */
export function ingestCredit(
  feeds: FeedPolicy,
  store: QuarantineStore,
  credit: InboundCredit
): AssetRecord {
  const c = classifyInbound(feeds, credit);
  const record: AssetRecord = {
    assetKey: credit.assetKey,
    label: c.label,
    reasonCodes: c.reasonCodes,
  };
  store.set(record);
  return record;
}
