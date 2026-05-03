# Architecture deep-dive

This document captures the data-flow, timing, and storage layer of SWARMBOTS at a level of detail useful for systems engineers, *without* leaking the agent models themselves.

## Data-flow timing

```
t=0s     Market feed tick arrives (1m candle close on BTC/USDT)
         │
t=0.1s   ├─► Signal agent runs   (≤80ms)
         ├─► Trend agent runs    (≤120ms, may use cached 1h/4h state)
         ├─► Regime agent runs   (≤90ms)
         │
t=0.4s   └─► Policy governor receives all 3 votes
                │
t=0.5s          ├─► Resolve action + confidence
                ├─► Apply rule overrides:
                │     · trend veto on counter-trend signals
                │     · regime size modulation
                │     · cooldown / quiet-hour gating
                │
t=0.6s          └─► If decision != WAIT:
                       Send to Risk layer
                       │
t=0.7s                 ├─► Kelly sizer (against bankroll, floor at $10)
                       ├─► ATR stop calculator
                       ├─► Bucket-cap correlation guard
                       │
t=0.8s                 └─► Submit maker-post-only order to Bitget
                              │
t=1.5s+                       └─► Order fills (or expires)
                                    │
                                    └─► Trailing stop service takes over
```

Total decision-to-order latency: typically **~0.8s** from candle close. We're not chasing HFT timeframes — the edge is in the multi-agent logic, not in shaving milliseconds.

## Storage layer (MongoDB)

| Collection | Purpose | Retention |
|---|---|---|
| `auto_exec_trades` | Every order — fill, exit, fees, slippage, agent rationale | Forever |
| `auto_exec_decisions` | Every gate evaluation (executed + skipped) | 90d rolling |
| `auto_exec_config` | Live configuration — confidence bands, allowed symbols, manual pauses | Forever (versioned) |
| `rollout_persistent` | Auto-ramp state machine (current stage, validation passes) | Forever |
| `auto_deallow_runs` | Per-symbol deallow/reallow audit trail | Forever |

All ObjectIDs are stringified before serialization to API consumers. We never expose MongoDB internals to the client.

## Cross-cutting subsystems

### Auto-ramp
A 5-gate state machine that scales capital between predefined stages. See [`AUTO-RAMP.md`](./AUTO-RAMP.md).

### Auto-deallow
Once per hour, scans every symbol's last 30 trades. If `closed_trades >= 30 AND win_rate < 0.40`, the symbol is removed from `allowed_symbols`. Reallow path is the symmetric mirror: `WR >= 0.55 AND no manual pause AND cooldown_ok`.

### Manual symbol pauses
Operator can pause any symbol with a resume timestamp. The auto-deallow loop checks expired pauses at the top of every tick and re-allows them. **Manual pauses always win over auto-reallow** — we don't second-guess the human in the loop.

### Kill-switch
Two trigger conditions:
- 3 consecutive losses on the same symbol
- Daily realized PnL ≤ -2% of bankroll

When triggered, the system pauses for 6h and notifies the operator. Re-arm is automatic but logged.

## Frontend

- React + Tailwind, served from `/`
- Public landing page at `/` (this site's marketing page)
- Authenticated dashboard at `/dashboard` (Strategy Console / Risk Engine / Trade Ledger)
- Live cosmic Space Dungeon visualization at `/space-dungeon` (24 agent orbs, real-time positions, shooting-star animations on every win)

## What we won't document publicly

- The actual feature engineering inside Signal/Trend/Regime models
- Specific confidence-band tuning by symbol
- The order-book imbalance calculation
- Anything that, if copied, would let someone deploy a clone to compete with us

That's the line. Everything *above* that line is in this repo.
