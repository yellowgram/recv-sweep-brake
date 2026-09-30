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
} from "../dist/api.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const EXPECTED = join(root, "docs/fixtures/offline.expected.txt");
const TOKEN_OK = "0x1111111111111111111111111111111111111111";
const TOKEN_BAD = "0x2222222222222222222222222222222222222222";
const SENDER_OK = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const lines = [];
const out = (s) => {
  lines.push(s);
  process.stdout.write(s + "\n");
};

out("recv-sweep-brake offline demo");
out("no keys · no signing · no auto-move · sweep_policy.enabled default off");
out("");

const sweep = defaultSweepPolicy();
out(`1 sweep_policy.enabled → ${sweep.enabled}`);

const feeds = defaultFeedPolicy();
feeds.tokenAllow = new Set([TOKEN_OK]);
feeds.senderAllow = new Set([SENDER_OK]);
feeds.dustThreshold = 10n;

const c2 = classifyInbound(feeds, {
  token: TOKEN_OK,
  sender: SENDER_OK,
  amount: 100n,
  assetKey: "c1",
});
out(`2 clear credit → label=${c2.label}`);

const c3 = classifyInbound(feeds, {
  token: TOKEN_BAD,
  sender: SENDER_OK,
  amount: 100n,
  assetKey: "q1",
});
out(`3 unknown token → label=${c3.label}`);

const c4 = classifyInbound(feeds, {
  token: TOKEN_OK,
  sender: SENDER_OK,
  amount: 1n,
  assetKey: "t1",
});
out(`4 dust poison → label=${c4.label}`);

const store = new MemoryQuarantineStore();
ingestCredit(feeds, store, {
  token: TOKEN_OK,
  sender: SENDER_OK,
  amount: 100n,
  assetKey: "c1",
});
ingestCredit(feeds, store, {
  token: TOKEN_BAD,
  sender: SENDER_OK,
  amount: 100n,
  assetKey: "q1",
});
ingestCredit(feeds, store, {
  token: TOKEN_OK,
  sender: SENDER_OK,
  amount: 1n,
  assetKey: "t1",
});

const r5 = checkSweepAllowed(sweep, store, "q1");
out(`5 send non-clear → allow=${r5.allow} code=${r5.code}`);

const r6 = checkSweepAllowed(sweep, store, "c1");
out(`6 send clear → allow=${r6.allow} code=${r6.code}`);

const v = balanceView(store);
out(
  `7 balance view → spendable=${v.spendable.length} quarantined=${v.quarantined.length} toxic=${v.toxic.length} degraded=${v.degraded}`
);

const r8 = checkSweepAllowed({ enabled: true }, store, "q1");
out(`8 enabled=true still brakes quarantine → allow=${r8.allow} code=${r8.code}`);

const r9 = maySpend({ enabled: true }, store, "t1");
out(`9 maySpend toxic enabled=true → allow=${r9.allow} code=${r9.code}`);

const empty = defaultFeedPolicy();
const c10 = classifyInbound(empty, {
  token: TOKEN_BAD,
  sender: "0xcccccccccccccccccccccccccccccccccccccccc",
  amount: 100n,
  assetKey: "empty1",
});
out(`10 empty allowlists default require → label=${c10.label}`);

reclassify(store, "t1", "clear", "operator verified");
const r11 = checkSweepAllowed(sweep, store, "t1");
out(`11 reclassify toxic→clear → allow=${r11.allow} code=${r11.code}`);

store.setDown(true);
const v12 = balanceView(store);
const r12 = checkSweepAllowed(sweep, store, "c1");
out(
  `12 store down → balanceView.degraded=${v12.degraded} spend.code=${r12.code}`
);
store.setDown(false);

out("");
out(
  "charter: no Soft* · no Polar · no custody · BurnBrake out · LaunchGate-before-expansion"
);
out(
  "compose: recv classify → quarantine → sweep-brake → send; approval-watch upstream; send-rail peers"
);

const expected = readFileSync(EXPECTED, "utf8").replace(/\r\n/g, "\n").trimEnd();
const actual = lines.join("\n").trimEnd();
if (actual !== expected) {
  console.error("[demo-offline] DRIFT");
  console.error("--- expected ---\n" + expected);
  console.error("--- actual ---\n" + actual);
  process.exit(1);
}
console.error("[demo-offline] OK — matches offline.expected.txt");
