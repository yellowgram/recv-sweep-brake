# Security

recv-sweep-brake classifies inbound credits and brakes auto-sweep / spend-of-inbound until clear. It does not custody keys, does not sign, and does not auto-move funds. Not a hosted service or mainnet SLA.

This package never holds keys, never signs, and never auto-moves funds.

When the quarantine store or classify path is unavailable, spend clearance is fail-closed. There is no silent clear.

Classify + brake + minimal balance-view only. No treasury collect runner, no portfolio dashboard, no BurnBrake inbound metering, no live oracle hard dependency.

Do not file public issues with private keys or funded transactions.
