# Offline demo

No keys, no signing, no auto-move. `sweep_policy.enabled` defaults **off**.

```bash
npm ci
npm test
npm run build
npm run demo:offline
```

`demo:offline` exits non-zero if stdout drifts from [`fixtures/offline.expected.txt`](./fixtures/offline.expected.txt).

What it shows (sealed allow **and** deny):

1. `sweep_policy.enabled` → `false`
2. Clear credit → `label=clear`
3. Unknown token → `label=quarantine`
4. Dust poison → `label=toxic`
5. Send non-clear → deny `sweep_braked`
6. Send clear → allow `ok_clear`
7. Balance view → spendable/quarantined/toxic counts; `degraded=false`
8. `enabled=true` still brakes quarantine → deny `sweep_braked`
9. `maySpend` toxic with `enabled=true` → deny `sweep_braked`
10. Empty allowlists under default require → `label=quarantine`
11. Reclassify toxic→clear → allow `ok_clear`
12. Store down → `balanceView.degraded=true` spend `classify_store_down`

Fixture SoT. Compose: recv classify → quarantine → sweep-brake → send; approval-watch upstream; send-rail peers mention only.
