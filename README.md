# recv-sweep-brake (deprecated)

**This package is merged into [`l2-send-guard`](https://github.com/yellowgram/l2-safety-proxy) 1.x and gets no more fixes.**
Version 0.2.0 behaves exactly like 0.1.0 and prints one deprecation warning when imported.

## Why

recv-sweep-brake did one slice of a bigger job (quarantine of suspicious inbound funds). On its own it had gaps that a single tool closes better:

- Findings stayed in this library: flagging a poisoner's address didn't stop the send side from paying it.
- State lived in memory only and was lost on restart.
- It needed its own log ingestion; there was no watcher with a saved cursor.

`l2-send-guard` 1.x checks every call inside a transaction against one policy file, gates EIP-7702
delegations, keeps rolling caps and idempotency keys in a persistent store, watches what arrives, and
ships a guarded signer that makes the policy binding for whoever holds the key.

## Migrating

```sh
npm uninstall recv-sweep-brake
npm install l2-send-guard
```

What you used here is now `L2SG_WATCH_AGENTS` on the proxy, or `watchInbound` / `scanOnce`, `maySpend` and `reclassify` imported from `l2-send-guard`. A flagged poisoner is refused as a destination with `-32083 POISONED_ADDRESS`.
The full guide is at https://github.com/yellowgram/l2-safety-proxy#migrating.

## License

MIT
