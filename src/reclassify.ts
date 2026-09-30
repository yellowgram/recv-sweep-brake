import type { QuarantineStore } from "./store.js";
import type { AssetRecord, QuarantineLabel } from "./types.js";

/**
 * Explicit operator reclassify (DC4). Name locked.
 * Reaching `clear` requires this path (or documented compose equivalent).
 * Never called from ingest/classify. No timer / enabled=true auto-clear.
 * Records `reclassifyReason` and clears reasonCodes when label becomes clear.
 */
export function reclassify(
  store: QuarantineStore,
  assetKey: string,
  label: QuarantineLabel,
  reason: string
): AssetRecord {
  const trimmed = reason?.trim() ?? "";
  if (!trimmed) {
    throw new Error("reclassify requires a non-empty reason");
  }
  if (store.isDown()) {
    throw new Error("store_down");
  }
  const existing = store.get(assetKey);
  const record: AssetRecord = {
    assetKey,
    label,
    reasonCodes: label === "clear" ? [] : (existing?.reasonCodes ?? []),
    reclassifyReason: trimmed,
  };
  store.set(record);
  return record;
}
