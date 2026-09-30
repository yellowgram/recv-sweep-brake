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

describe("DC15 / design locks", () => {
  it("(1) defaultSweepPolicy().enabled === false (DC1)", () => {
    expect(defaultSweepPolicy().enabled).toBe(false);
  });

  it("(2) store down → classify_store_down (DC2)", () => {
    const store = new MemoryQuarantineStore();
    store.setDown(true);
    const r = maySpend(defaultSweepPolicy(), store, "any");
    expect(r.allow).toBe(false);
    expect(r.code).toBe("classify_store_down");
  });

  it("(3) quarantine asset → sweep_braked even when enabled: true (DC5)", () => {
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

  it("(4) toxic asset → sweep_braked when enabled: true (DC5)", () => {
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

  it("(5) empty allowlists + default require true → quarantine on unknown token/sender (DC10)", () => {
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

  it("(6) dust → toxic and not in balanceView.spendable (DC3/DC4)", () => {
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

  it("(7) unknown assetKey → sweep_braked (DC13)", () => {
    const store = new MemoryQuarantineStore();
    const r = maySpend(defaultSweepPolicy(), store, "no-such-key");
    expect(r.allow).toBe(false);
    expect(r.code).toBe("sweep_braked");
    expect(r.label).toBe("quarantine");
  });

  it("(8) no public sign/broadcast/auto-move API surface (DC6)", () => {
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

  it("maySpend alias === checkSweepAllowed semantics (DC12)", () => {
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

  it("reclassify to clear records reason; ingest never auto-clears (DC4)", () => {
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

  it("balanceView store-down → degraded true, empty ≠ healthy (DC18)", () => {
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

  it("quarantine never in balanceView.spendable (DC3)", () => {
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

  it("native still subject to sender allow + dust (DC11/F8)", () => {
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

  it("default require flags true; require-false is opt-in not default (DC11)", () => {
    const d = defaultFeedPolicy();
    expect(d.requireTokenAllow).toBe(true);
    expect(d.requireSenderAllow).toBe(true);
  });
});

describe("docs honesty lines (DC1/DC2/DC4/DC5/DC6/DC7/DC9/DC10/DC12)", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const readme = readFileSync(join(root, "README.md"), "utf8");
  const security = readFileSync(join(root, "SECURITY.md"), "utf8");

  it("(9) README contains verbatim honesty lines", () => {
    expect(readme).toContain(
      "sweep_policy.enabled defaults to false. The brake stays engaged for non-clear inbound until an asset is explicitly clear."
    );
    expect(readme).toContain(
      "When the quarantine store or classify path is unavailable, spend clearance is fail-closed. There is no silent clear."
    );
    expect(readme).toContain(
      "toxic and quarantine never auto-clear. enabled alone does not lift them."
    );
    expect(readme).toContain(
      "sweep_policy.enabled=true does not make quarantine or toxic spendable."
    );
    expect(readme).toContain(
      "This package never holds keys, never signs, and never auto-moves funds."
    );
    expect(readme).toContain(
      "BurnBrake is out of scope. Inbound credit labels are not HTTP spend metering."
    );
    expect(readme).toContain(
      "P0 is offline classify + brake + fixtures. Live oracle / intel SaaS is not required; lookalike local pin only if added."
    );
    expect(readme).toContain(
      "Empty token/sender allowlists under default require flags quarantine unknowns. Empty does not mean allow-all."
    );
    expect(readme).toContain(
      "Any outbound transfer or spend of non-clear inbound funds must consult the brake. A sweep-named method check alone is not enough."
    );
  });

  it("SECURITY verbatim DC2 and DC6 lines", () => {
    expect(security).toContain(
      "When the quarantine store or classify path is unavailable, spend clearance is fail-closed. There is no silent clear."
    );
    expect(security).toContain(
      "This package never holds keys, never signs, and never auto-moves funds."
    );
  });

  it("package private fences (DC16)", () => {
    const pkg = JSON.parse(
      readFileSync(join(root, "package.json"), "utf8")
    ) as Record<string, unknown>;
    expect(pkg.private).toBe(true);
    expect(pkg.repository).toEqual({
      type: "git",
      url: "git+https://github.com/yellowgram/recv-sweep-brake.git",
    });
    expect(pkg.homepage).toBe("https://www.yellowgram.dev/oss");
    expect(pkg.bugs).toEqual({
      url: "https://github.com/yellowgram/recv-sweep-brake/issues",
    });
    expect(pkg.prepublishOnly).toBeUndefined();
    expect(
      (pkg.scripts as Record<string, unknown> | undefined)?.prepublishOnly
    ).toBeUndefined();
    expect(PACKAGE_VERSION).toBe("0.1.0");
  });

  it("Soft* conversion phrases absent; ban token only OK (DC16)", () => {
    // Product/docs/source only (exclude this test file — banned needles live here as data).
    const scanRoots = [
      "README.md",
      "SECURITY.md",
      "CHARTER.md",
      "package.json",
      "scripts/demo-offline.mjs",
      "docs/fixtures/offline.expected.txt",
      "src/api.ts",
      "src/brake.ts",
      "src/classify.ts",
      "src/ingest.ts",
      "src/reclassify.ts",
      "src/store.ts",
      "src/types.ts",
      "IMPLEMENT_NOTES.md",
    ];
    // Build needles without embedding banned Soft* conversion forms as contiguous literals.
    const bannedNeedles = [
      "Soft" + "Pay",
      "Soft" + " Checkout",
      "Soft" + "WTP",
      "soft" + "-pay",
      "conversion" + "-pressure",
      "willingness" + "-to-pay",
      "willingness" + " to pay",
    ];
    for (const rel of scanRoots) {
      const text = readFileSync(join(root, rel), "utf8");
      for (const needle of bannedNeedles) {
        expect(text.toLowerCase().includes(needle.toLowerCase()), `${rel} contains ${needle}`).toBe(false);
      }
    }
  });

  it("README compose peers mention only (DC17)", () => {
    expect(readme).toContain("recv-approval-watch");
    expect(readme).toContain("send-approve-bound");
    expect(readme).toContain("send-permit2-bound");
    expect(readme).toContain("send-idempotency");
    expect(readme).toContain("recv-sweep-brake");
    expect(readme).toMatch(/recv classify feeds → recv-quarantine → recv-sweep-brake/);
  });
});

describe("demo sealed fixture (DC15-10)", () => {
  it("offline.expected.txt present and non-empty", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "..");
    const expected = readFileSync(
      join(root, "docs/fixtures/offline.expected.txt"),
      "utf8"
    );
    expect(expected).toContain("sweep_policy.enabled → false");
    expect(expected).toContain("code=sweep_braked");
    expect(expected).toContain("no Soft*");
  });
});
