# recv-sweep-brake

More from yellowgram: [OSS tools](https://www.yellowgram.dev/oss).

**Status:** public MIT · npm `recv-sweep-brake@0.1.0` · no Polar

Founder **no-auto-sweep** fence: `sweep_policy.enabled` defaults **off**. Quarantine `clear` \| `quarantine` \| `toxic`. Priced-with minimal feeds: token allow, sender allow, dust-poison. Send of non-clear → deny `sweep_braked`. **No keys / signing / auto-move.**

> **Charter:** [CHARTER.md](./CHARTER.md) — no Soft\* · no Polar/checkout · no custody · BurnBrake out

```bash
npm install && npm test && npm run demo:offline
```

Offline allow / deny story: [`docs/DEMO.md`](./docs/DEMO.md).

## Honesty (locked)

sweep_policy.enabled defaults to false. The brake stays engaged for non-clear inbound until an asset is explicitly clear.

When the quarantine store or classify path is unavailable, spend clearance is fail-closed. There is no silent clear.

toxic and quarantine never auto-clear. enabled alone does not lift them.

sweep_policy.enabled=true does not make quarantine or toxic spendable.

This package never holds keys, never signs, and never auto-moves funds.

BurnBrake is out of scope. Inbound credit labels are not HTTP spend metering.

P0 is offline classify + brake + fixtures. Live oracle / intel SaaS is not required; lookalike local pin only if added.

Empty token/sender allowlists under default require flags quarantine unknowns. Empty does not mean allow-all.

Any outbound transfer or spend of non-clear inbound funds must consult the brake. A sweep-named method check alone is not enough.

## Codes (P0)

Closed set:

| Code | Meaning |
| --- | --- |
| `sweep_braked` | send tried to move non-clear (or unknown assetKey) while brake engaged |
| `dust_poison` | dust-poison feed hit → toxic |
| `token_not_allowed` | token allow miss → quarantine path |
| `sender_not_allowed` | sender allow miss → quarantine path |
| `classify_store_down` | quarantine store / classify unavailable on spend path (fail-closed) |
| `ok_clear` | asset labeled clear — spend allowed |

Labels: `clear` \| `quarantine` \| `toxic`.

## API notes

- `defaultSweepPolicy().enabled === false`. Do not present `enabled: true` as the default safe path.
- `checkSweepAllowed(sweep, store, assetKey)` / `maySpend(...)` — identical semantics. Compose must call one of them on **every** outbound transfer/spend/swap/collect of inbound-labeled funds.
- `reclassify(store, assetKey, "clear", reason)` — explicit operator path to lift toxic/quarantine. Records `reclassifyReason`. Never run from ingest/classify.
- `balanceView(store)` — minimal spendable/quarantined/toxic lists. When store is down, returns empty lists with `degraded: true`. Empty under `degraded` is **not** a healthy all-clear; spend must still call `maySpend` / `checkSweepAllowed`.
- Default `requireTokenAllow` / `requireSenderAllow` are **true**. Setting either to `false` is an explicit opt-in that lowers the fence — not a happy-path demo. Native credits skip token-allow but remain subject to sender allow + dust.

## Compose

```
recv classify feeds → recv-quarantine → recv-sweep-brake ──► send cluster (deny sweep_braked)
```

Upstream emit/clearance peer: `recv-approval-watch` (compose mention only). Send-rail peers: `send-approve-bound`, `send-permit2-bound`, `send-idempotency` (compose mention only — not redesigned here).

### Send-rail wiring (before any outbound of inbound-labeled funds)

Call `maySpend` / `checkSweepAllowed` on **every** outbound transfer, spend, swap, or collect of inbound-labeled funds — not a sweep-named method check alone. This package does not redesign send peers.

```ts
import {
  defaultSweepPolicy,
  maySpend,
  // checkSweepAllowed — identical semantics
} from "recv-sweep-brake";

const sweep = defaultSweepPolicy(); // enabled === false
// store = shared quarantine store populated by ingest/classify

async function beforeOutbound(assetKey: string) {
  const gate = maySpend(sweep, store, assetKey);
  if (!gate.allow) {
    // sweep_braked | classify_store_down | …
    return gate;
  }
  // clear only — then hand off to send-rail peers (mention only):
  // send-approve-bound / send-permit2-bound / send-idempotency
  return gate;
}
```

## License

MIT — [LICENSE](./LICENSE).
