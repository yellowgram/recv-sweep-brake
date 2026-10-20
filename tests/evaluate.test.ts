import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  defaultFeedPolicy,
  defaultSweepPolicy,
  ingestCredit,
  checkSweepAllowed,
  maySpend,
  balanceView,
  MemoryQuarantineStore,
  classifyInbound,
  reclassify,
  PACKAGE_VERSION,
} from "../src/api.js";
import * as api from "../src/api.js";

const TOKEN_OK = "0x1111111111111111111111111111111111111111";
const TOKEN_BAD = "0x2222222222222222222222222222222222222222";
const SENDER_OK = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SENDER_BAD = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function feeds() {
  const f = defaultFeedPolicy();
  f.tokenAllow = new Set([TOKEN_OK]);
  f.senderAllow = new Set([SENDER_OK]);
  f.dustThreshold = 10n;
  return f;
}

describe("classifyInbound + sweep brake", () => {
  it("clear credit when token+sender ok and above dust", () => {
    const c = classifyInbound(feeds(), {
      token: TOKEN_OK,
      sender: SENDER_OK,
      amount: 100n,
      assetKey: "a1",
    });
    expect(c.label).toBe("clear");
  });

  it("unknown token → quarantine", () => {
    const c = classifyInbound(feeds(), {
      token: TOKEN_BAD,
      sender: SENDER_OK,
      amount: 100n,
      assetKey: "a2",
    });
    expect(c.label).toBe("quarantine");
    expect(c.reasonCodes).toContain("token_not_allowed");
  });

  it("dust → toxic", () => {
    const c = classifyInbound(feeds(), {
      token: TOKEN_OK,
      sender: SENDER_OK,
      amount: 5n,
      assetKey: "a3",
    });
    expect(c.label).toBe("toxic");
    expect(c.reasonCodes).toContain("dust_poison");
  });

  it("default sweep_policy.enabled=false brakes non-clear", () => {
    const store = new MemoryQuarantineStore();
    const sweep = defaultSweepPolicy();
    expect(sweep.enabled).toBe(false);
    ingestCredit(feeds(), store, {
      token: TOKEN_BAD,
      sender: SENDER_BAD,
      amount: 100n,
      assetKey: "q1",
    });
    const r = checkSweepAllowed(sweep, store, "q1");
    expect(r.allow).toBe(false);
    expect(r.code).toBe("sweep_braked");
  });

  it("clear asset spendable even when sweep.enabled false", () => {
    const store = new MemoryQuarantineStore();
    const sweep = defaultSweepPolicy();
    ingestCredit(feeds(), store, {
      token: TOKEN_OK,
      sender: SENDER_OK,
      amount: 100n,
      assetKey: "c1",
    });
    const r = checkSweepAllowed(sweep, store, "c1");
    expect(r.allow).toBe(true);
    expect(r.code).toBe("ok_clear");
  });

  it("unknown asset key on send → sweep_braked (FC)", () => {
    const store = new MemoryQuarantineStore();
    const r = checkSweepAllowed(defaultSweepPolicy(), store, "missing");
    expect(r.allow).toBe(false);
    expect(r.code).toBe("sweep_braked");
    expect(r.label).toBe("quarantine");
  });

  it("store down → fail-closed", () => {
    const store = new MemoryQuarantineStore();
    store.setDown(true);
    const r = checkSweepAllowed(defaultSweepPolicy(), store, "x");
    expect(r.allow).toBe(false);
    expect(r.code).toBe("classify_store_down");
  });

  it("balance view splits labels", () => {
    const store = new MemoryQuarantineStore();
    ingestCredit(feeds(), store, {
      token: TOKEN_OK,
      sender: SENDER_OK,
      amount: 100n,
      assetKey: "clear1",
    });
    ingestCredit(feeds(), store, {
      token: TOKEN_BAD,
      sender: SENDER_OK,
      amount: 100n,
      assetKey: "q1",
    });
    ingestCredit(feeds(), store, {
      token: TOKEN_OK,
      sender: SENDER_OK,
      amount: 1n,
      assetKey: "t1",
    });
    const v = balanceView(store);
    expect(v.spendable).toContain("clear1");
    expect(v.quarantined).toContain("q1");
    expect(v.toxic).toContain("t1");
    expect(v.degraded).toBe(false);
  });

  it("never auto-moves — ingest only records", () => {
    const store = new MemoryQuarantineStore();
    const rec = ingestCredit(feeds(), store, {
      token: TOKEN_OK,
      sender: SENDER_OK,
      amount: 100n,
      assetKey: "stay",
    });
    expect(rec.assetKey).toBe("stay");
    expect(store.get("stay")?.label).toBe("clear");
    expect(rec.reclassifyReason).toBeUndefined();
  });
});

describe(" / design locks", () => {
  it("(1) defaultSweepPolicy().enabled === false", () => {
    expect(defaultSweepPolicy().enabled).toBe(false);
  });

  it("(2) store down → classify_store_down", () => {
    const store = new MemoryQuarantineStore();
    store.setDown(true);
    const r = maySpend(defaultSweepPolicy(), store, "any");
    expect(r.allow).toBe(false);
    expect(r.code).toBe("classify_store_down");
  });

  it("(3) quarantine asset → sweep_braked even when enabled: true", () => {
    const store = new MemoryQuarantineStore();
    ingestCredit(feeds(), store, {
      token: TOKEN_BAD,
      sender: SENDER_OK,
      amount: 100n,
      assetKey: "q-en",
    });
    expect(store.get("q-en")?.label).toBe("quarantine");
    const r = checkSweepAllowed({ enabled: true }, store, "q-en");
    expect(r.allow).toBe(false);
    expect(r.code).toBe("sweep_braked");
    expect(r.label).toBe("quarantine");
  });

  it("(4) toxic asset → sweep_braked when enabled: true", () => {
    const store = new MemoryQuarantineStore();
    ingestCredit(feeds(), store, {
      token: TOKEN_OK,
      sender: SENDER_OK,
      amount: 1n,
      assetKey: "t-en",
    });
    expect(store.get("t-en")?.label).toBe("toxic");
    const r = checkSweepAllowed({ enabled: true }, store, "t-en");
    expect(r.allow).toBe(false);
    expect(r.code).toBe("sweep_braked");
    expect(r.label).toBe("toxic");
  });

  it("(5) empty allowlists + default require true → quarantine on unknown token/sender", () => {
    const empty = defaultFeedPolicy();
    expect(empty.requireTokenAllow).toBe(true);
    expect(empty.requireSenderAllow).toBe(true);
    expect(empty.tokenAllow.size).toBe(0);
    expect(empty.senderAllow.size).toBe(0);
    const c = classifyInbound(empty, {
      token: TOKEN_BAD,
      sender: SENDER_BAD,
      amount: 100n,
      assetKey: "empty-q",
    });
    expect(c.label).toBe("quarantine");
    expect(c.reasonCodes).toContain("token_not_allowed");
    expect(c.reasonCodes).toContain("sender_not_allowed");
  });

  it("(6) dust → toxic and not in balanceView.spendable", () => {
    const store = new MemoryQuarantineStore();
    ingestCredit(feeds(), store, {
      token: TOKEN_OK,
      sender: SENDER_OK,
      amount: 1n,
      assetKey: "dust1",
    });
    expect(store.get("dust1")?.label).toBe("toxic");
    const v = balanceView(store);
    expect(v.toxic).toContain("dust1");
    expect(v.spendable).not.toContain("dust1");
    expect(v.quarantined).not.toContain("dust1");
  });

  it("(7) unknown assetKey → sweep_braked", () => {
    const store = new MemoryQuarantineStore();
    const r = maySpend(defaultSweepPolicy(), store, "no-such-key");
    expect(r.allow).toBe(false);
    expect(r.code).toBe("sweep_braked");
    expect(r.label).toBe("quarantine");
  });

  it("(8) no public sign/broadcast/auto-move API surface", () => {
    const banned = [
      "sign",
      "signTransaction",
      "signMessage",
      "sendTransaction",
      "eth_sendTransaction",
      "eth_sendRawTransaction",
      "broadcast",
      "autoMove",
      "autoSweep",
      "collectToTreasury",
      "privateKey",
      "wallet",
      "ok_brake_disabled_clear_only",
    ];
    const exported = Object.keys(api);
    for (const name of banned) {
      expect(exported).not.toContain(name);
    }
    // Surface is classify + brake + reclassify + store only
    expect(exported).toContain("checkSweepAllowed");
    expect(exported).toContain("maySpend");
    expect(exported).toContain("reclassify");
    expect(exported).toContain("ingestCredit");
    expect(exported).toContain("balanceView");
    expect(exported).not.toContain("BurnBrake");
  });

  it("maySpend alias === checkSweepAllowed semantics", () => {
    const store = new MemoryQuarantineStore();
    ingestCredit(feeds(), store, {
      token: TOKEN_BAD,
      sender: SENDER_OK,
      amount: 100n,
      assetKey: "alias-q",
    });
    const sweep = defaultSweepPolicy();
    expect(maySpend(sweep, store, "alias-q")).toEqual(
      checkSweepAllowed(sweep, store, "alias-q")
    );
    expect(maySpend(sweep, store, "missing")).toEqual(
      checkSweepAllowed(sweep, store, "missing")
    );
  });

  it("reclassify to clear records reason; ingest never auto-clears", () => {
    const store = new MemoryQuarantineStore();
    ingestCredit(feeds(), store, {
      token: TOKEN_OK,
      sender: SENDER_OK,
      amount: 1n,
      assetKey: "tox",
    });
    expect(store.get("tox")?.label).toBe("toxic");
    // re-ingest does not lift toxic via some auto path — still toxic after dust ingest
    ingestCredit(feeds(), store, {
      token: TOKEN_OK,
      sender: SENDER_OK,
      amount: 1n,
      assetKey: "tox",
    });
    expect(store.get("tox")?.label).toBe("toxic");
    expect(store.get("tox")?.reclassifyReason).toBeUndefined();

    const cleared = reclassify(store, "tox", "clear", "operator verified not poison");
    expect(cleared.label).toBe("clear");
    expect(cleared.reclassifyReason).toBe("operator verified not poison");
    expect(cleared.reasonCodes).toEqual([]);
    const r = checkSweepAllowed({ enabled: false }, store, "tox");
    expect(r.allow).toBe(true);
    expect(r.code).toBe("ok_clear");
  });

  it("reclassify rejects empty reason", () => {
    const store = new MemoryQuarantineStore();
    expect(() => reclassify(store, "x", "clear", "  ")).toThrow(/reason/);
  });

  it("balanceView store-down → degraded true, empty ≠ healthy", () => {
    const store = new MemoryQuarantineStore();
    ingestCredit(feeds(), store, {
      token: TOKEN_OK,
      sender: SENDER_OK,
      amount: 100n,
      assetKey: "c-down",
    });
    store.setDown(true);
    const v = balanceView(store);
    expect(v.degraded).toBe(true);
    expect(v.spendable).toEqual([]);
    expect(v.quarantined).toEqual([]);
    expect(v.toxic).toEqual([]);
    // spend path still FC
    const r = checkSweepAllowed(defaultSweepPolicy(), store, "c-down");
    expect(r.code).toBe("classify_store_down");
    expect(r.allow).toBe(false);
  });

  it("quarantine never in balanceView.spendable", () => {
    const store = new MemoryQuarantineStore();
    ingestCredit(feeds(), store, {
      token: TOKEN_BAD,
      sender: SENDER_OK,
      amount: 100n,
      assetKey: "q-spend",
    });
    const v = balanceView(store);
    expect(v.quarantined).toContain("q-spend");
    expect(v.spendable).not.toContain("q-spend");
  });

  it("native still subject to sender allow + dust", () => {
    const f = feeds();
    const badSender = classifyInbound(f, {
      token: null,
      sender: SENDER_BAD,
      amount: 100n,
      assetKey: "n1",
    });
    expect(badSender.label).toBe("quarantine");
    expect(badSender.reasonCodes).toContain("sender_not_allowed");
    expect(badSender.reasonCodes).not.toContain("token_not_allowed");

    const dustNative = classifyInbound(f, {
      token: null,
      sender: SENDER_OK,
      amount: 1n,
      assetKey: "n2",
    });
    expect(dustNative.label).toBe("toxic");
    expect(dustNative.reasonCodes).toContain("dust_poison");
  });

  it("default require flags true; require-false is opt-in not default", () => {
    const d = defaultFeedPolicy();
    expect(d.requireTokenAllow).toBe(true);
    expect(d.requireSenderAllow).toBe(true);
  });
});

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("deprecation", () => {
  it("README says the package is deprecated and points to l2-send-guard", () => {
    const text = readFileSync(join(root, "README.md"), "utf8");
    expect(text).toContain("(deprecated)");
    expect(text).toContain("l2-send-guard");
  });
  it("version is 0.2.0 in package.json and PACKAGE_VERSION", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(pkg.version).toBe("0.2.0");
    expect(PACKAGE_VERSION).toBe("0.2.0");
  });
});
describe("demo sealed fixture", () => {
  it("offline.expected.txt present and non-empty", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "..");
    const expected = readFileSync(
      join(root, "docs/fixtures/offline.expected.txt"),
      "utf8"
    );
    expect(expected).toContain("sweep_policy.enabled → false");
    expect(expected).toContain("code=sweep_braked");
    expect(expected).toContain("deprecated: use l2-send-guard");
  });
});
