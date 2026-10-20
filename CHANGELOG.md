# Changelog

## 0.2.0

- Deprecated. Merged into `l2-send-guard` 1.x, which fixes nested-call decoding, EIP-7702 authorizations, cumulative limits, ungated submit methods and memory-only state. This version behaves like 0.1.0 and emits one `DeprecationWarning` on import.
- Removed internal planning files (`CHARTER.md`, `IMPLEMENT_NOTES.md`).

## 0.1.0

- Founder no-auto-sweep fence: sweep_policy.enabled defaults off; quarantine clear | quarantine | toxic
- Priced-with minimal feeds (token allow, sender allow, dust-poison); deny sweep_braked on send of non-clear
- No keys / signing / auto-move; BurnBrake out of scope
- Offline `demo:offline` fixtures + vitest; sealed honesty lines
- Public MIT source on GitHub; **not published to npm**; no Polar
