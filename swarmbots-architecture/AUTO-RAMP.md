# Auto-ramp — the 5-gate capital scaling system

> The bot is its own auditor. Capital scales **only** when the data says it has earned the right.

This is one of the few mechanisms in SWARMBOTS that we believe is genuinely novel — most retail trading systems either trade the same size forever or scale capital based on operator vibes. We do neither.

## The stages

| Stage | Bankroll cap | Per-trade size | Daily PnL kill-switch |
|---|---|---|---|
| **Phase 0** | $30 | $10 | −$1.50 |
| **Phase 1** | $300 | $25 | −$15 |
| **Phase 2** | $750 | $50 | −$30 |
| **Phase 3** | $2,000 | $100 | −$80 |
| **Phase 4** | $5,000 | $250 | −$200 |
| **Phase 5+** | manual review only — operator decision |

Each stage is a discrete state. Promotion between stages is gated.

## The 5 gates

A stage promotion requires **all 5 gates to pass simultaneously** during a 96-hour evaluation window:

### Gate 1 · Trade volume
- ≥ 10 closed trades in the last 96h
- Why: small samples produce false-positive win rates. 10 is the floor where binomial variance starts being useful.

### Gate 2 · 7-day PnL positive
- `realized_pnl_7d > 0`
- Why: the system must demonstrate it can survive *its current capital tier* before scaling.

### Gate 3 · No kill-switch incidents
- Zero kill-switch triggers in the last 96h
- Why: if the system tripped its own circuit breaker, the conditions that caused it haven't been resolved yet.

### Gate 4 · Bucket-cap discipline
- ≤ 1 bucket-cap breach in the last 96h
- Why: bucket breaches happen — exchange API can lag, multiple Signals can fire in the same second. But more than 1 in 4 days means the correlation guard is leaking.

### Gate 5 · Cooldown
- ≥ 168 hours (7 days) since the last stage promotion
- Why: every stage change disrupts the system's operating envelope. We force a full week between scales to make sure each new tier is genuinely working before scaling further.

## Why this matters

Most retail traders have one of these failure modes:

1. **Scared scaling** — they trade $10 forever, never letting the system prove it can handle real capital.
2. **Reckless scaling** — first green week, they 10× the size. Then a regime shift wipes them out.
3. **Vibes scaling** — "I feel good about this one" → 5× size on a single trade → catastrophic single-trade loss.

The 5-gate system replaces all three with a deterministic state machine. Capital scales when the math says it's earned, not when the operator feels lucky.

## Demotion path

The state machine works in reverse too:

- **Hard demote:** kill-switch trigger at any stage → drop one stage immediately (e.g. Phase 3 → Phase 2)
- **Soft demote:** 5 consecutive days of negative PnL at current stage → drop one stage with operator notification
- **Manual pause:** operator can freeze the current stage indefinitely

There's no "stay-flat" tier. Either you're ramping up or you're stepping down. The system either has a profitable edge worth scaling, or it doesn't and capital should go elsewhere.

## What this *isn't*

- It's **not** a backtest-derived schedule. Every stage's gates are evaluated against live trades only. No simulation data counts.
- It's **not** a forecasting model. We're not predicting future performance — we're enforcing an empirical rule that the system has *demonstrated* it can handle each new tier.
- It's **not** a get-rich-quick mechanism. With strict gates, full ramp from Phase 0 → Phase 5 takes a minimum of 6 weeks, and that's only if every evaluation window passes cleanly. Most users will sit at Phase 1 or Phase 2 for months.

## Current state

At the time of writing, SWARMBOTS production is in **Phase 1**, validating the gates needed to promote to Phase 2. Live audit trail is in `/profit-command-center` for operators with admin access.

The whole point of the design is that **the auto-ramp doesn't care about the launch hype, the marketing copy, or the operator's mood.** It looks at trade volume, PnL, kill-switch incidents, bucket discipline, and cooldown. If all 5 pass, it promotes. If not, it doesn't.

→ Live system: [myswarmbots.com](https://myswarmbots.com)
