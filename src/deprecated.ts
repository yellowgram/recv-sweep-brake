let warned = false;

/** One warning per process, through Node's warning channel (silence with --no-deprecation). */
export function warnDeprecated(): void {
  if (warned) return;
  warned = true;
  process.emitWarning(
    "recv-sweep-brake is deprecated and gets no security fixes. It is merged into l2-send-guard 1.x: https://github.com/yellowgram/l2-safety-proxy#migrating",
    { type: "DeprecationWarning", code: "YELLOWGRAM_RECV_SWEEP_BRAKE_DEPRECATED" }
  );
}

warnDeprecated();
