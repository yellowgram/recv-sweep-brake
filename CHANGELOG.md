# Changelog

## 0.2.0

- Deprecated. Merged into `l2-send-guard` 1.x, which fixes nested-call decoding, EIP-7702 authorizations, cumulative limits, ungated submit methods and memory-only state. This version behaves like 0.1.0 and emits one `DeprecationWarning` on import.
- Removed internal planning files.

## 0.1.0

- No automatic sweeping: `sweep_policy.enabled` defaults off; quarantine clear | quarantine | toxic
- Priced-with minimal feeds (token allow, sender allow, dust-poison); deny sweep_braked on send of non-clear
- No keys / signing / auto-move; BurnBrake out of scope
- Offline `demo:offline` with fixed fixtures, and tests
- MIT licensed
