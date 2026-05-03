# Risk model

> Risk doesn't depend on willpower. Six guardrails run before any order hits Bitget — and **two more run after the order is filled** to catch trades that go bad after entry.

## Pre-order guardrails

### 1 · ATR-based stops
- Stop distance = `1.5 × ATR(14, 1h)`
- Target distance = `2 × stop_distance` (so reward/risk = 2:1)
- Floor: `stop_distance >= 0.4% of entry price` (no stops tighter than typical exchange noise)
- Ceiling: `stop_distance <= 3% of entry price` (no insane risk per trade)

### 2 · Kelly sizing
- Position size = `bankroll × kelly_fraction × regime_modulator`
- `kelly_fraction = max(0, 2 × win_rate − 1) / avg_loss_R` — clamped to `[0.1, 0.6]`
- `regime_modulator`:
  - calm: 1.0
  - trending: 0.85
  - choppy: 0.4
- 7-day rolling win rate is the input — not lifetime, not 30-day. We weight recency.

### 3 · Bucket-cap correlation guard
Crypto pairs cluster: BTC + ETH move together, SOL + DOGE often move together. To avoid concentrated drawdowns:
- Bucket A: BTC, ETH (max 1 simultaneous position)
- Bucket B: SOL, DOGE, ADA (max 1)
- Bucket C: XRP (independent)

If a Signal fires on a pair whose bucket is already armed, the trade is skipped with reason `correlated_trade_within_cooldown`.

### 4 · Cooldown gates
- 30-minute cooldown after every closed trade on a symbol
- 6-hour kill-switch cooldown after consecutive losses
- 24-hour cooldown on the entire system after kill-switch trigger

### 5 · Quiet-hour scheduler
Specific UTC hours where pipeline output is muted (low-volume sessions, news windows). The system still scans and logs decisions — but doesn't execute. This produces clean training data without polluting the bankroll.

### 6 · Confidence band
Per-(symbol × direction) bot tuning, auto-recalibrated weekly:
- Reject Signal output if `confidence < band_low` (typical: 0.20)
- Reject if `confidence > band_high` (typical: 0.85 — counter-intuitive, but extreme confidence usually means the model has overfit a fluke pattern)

## Post-fill guardrails

### 7 · Two-stage trailing stop
- **Stage 1:** As soon as price reaches `entry + 1R` (one full stop distance), move stop to break-even. Risk → 0 from that point on.
- **Stage 2:** Once at `entry + 1.5R`, switch to a trailing stop at `0.5 × ATR` behind the current high (for longs).

This captures runners while never letting a winner turn into a loser past the 1R mark.

### 8 · Adverse-selection guard
A position that reaches `+0.7R` and then retraces below `+0.4R` is closed at market — even if its trailing stop hasn't triggered yet. Rationale: a trade that gets close to target and reverses is signal of a regime shift; better to take partial profit than wait for the stop.

## Kill-switch

Two trigger conditions:
1. **3 consecutive losses** on the same symbol → that symbol is paused for 6h
2. **Daily realized PnL ≤ −2%** of bankroll → entire system pauses for 24h

When triggered, the operator gets a Telegram notification with the trade history that led to it. Re-arming is automatic after the cooldown window, but logged in the audit trail.

## What this looks like in practice (last 7d)

- 17 closed trades
- 11 winners, 6 losers
- Largest single loss: $0.05 (DOGE) — caught at the trailing stop
- Largest single win: $0.04 (BTC) — held to 2R target
- 64.7% win rate
- Kill-switch: never triggered

The system is **deliberately undertrading** at this capital level. We'd rather miss 30 marginal trades than take 5 that breach risk policy. Once auto-ramp clears more capital, the absolute dollar magnitude rises but the *risk envelope* stays the same.

→ Capital scaling logic: [`AUTO-RAMP.md`](./AUTO-RAMP.md)
