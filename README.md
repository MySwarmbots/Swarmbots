# SWARMBOTS — architecture notes

> **A 24-agent autonomous trading swarm that gates its own capital scaling.**
> Live on Bitget · 6 markets · 24/7 · custody stays with the operator.

🌐 **Live system:** [myswarmbots.com](https://myswarmbots.com)
🐦 **Updates:** [@swarmbots_io](https://twitter.com/swarmbots_io)

---

This repo is the **public architecture log** for SWARMBOTS. The trading code itself isn't open-source — that's how the team eats — but every system-level idea that makes the swarm work is documented here, with diagrams and the rationale behind each design choice.

If you've ever wondered *"how do you actually run a multi-agent trading system without it blowing up the first time the market regime shifts?"* — this is your read.

---

## Table of contents

- [Why a swarm and not a model?](#why-a-swarm-and-not-a-model)
- [System overview](#system-overview)
- [The 4 agent roles](#the-4-agent-roles)
- [Policy governor (open-source primitive →)](#policy-governor)
- [Risk model — ATR stops, Kelly sizing, kill-switch](./RISK-MODEL.md)
- [Auto-ramp — the 5-gate capital scaling system](./AUTO-RAMP.md)
- [Full system diagram](./ARCHITECTURE.md)
- [Live performance (last 7d)](#live-performance-last-7d)
- [Open-source primitives we ship](#open-source-primitives-we-ship)

---

## Why a swarm and not a model?

Most retail "trading bots" are a single signal generator wrapped in a Telegram alert: one model, one input view, one decision boundary. They blow up the first time the market regime moves outside the model's training distribution.

SWARMBOTS takes the opposite approach. **Per crypto pair we trade, four specialist agents run in parallel, each with a narrow scope and an explicit confidence score:**

| Agent | What it does | Outputs |
|---|---|---|
| **Signal** | Short-window pattern detection (momentum, breakouts, mean-reversion) | `{action, conf, target}` |
| **Trend** | Macro filter — 1h/4h structure, EMA stack, regime label | `{label, strength}` |
| **Regime** | Volatility/volume regime detection (calm / trending / choppy) | `{regime, atr_pct}` |
| **Policy** | Position-sizing + conflict-resolution governor | `{decision, dissent}` |

The output of all 4 agents lands at the **Policy Governor** — the only thing allowed to authorize an order. Any one agent can veto. Conflicts are resolved by a transparent rule set, not majority vote.

This shape gives us three properties that single-model bots can't have:

1. **Localized failure** — when one agent's model decays, the others outvote it. No catastrophic strategy collapse.
2. **Auditable decisions** — every order ships with the agent debate that produced it. No "the model decided" black box.
3. **Independent capacity** — adding a new market means deploying 4 fresh agents, not retraining a monolithic model.

---

## System overview

```
                   ┌──────────────────────────────────────────┐
                   │         BITGET (live exchange)            │
                   └──────────────────┬───────────────────────┘
                                      │ ccxt async (maker-post-only)
                   ┌──────────────────┴───────────────────────┐
                   │         EXECUTION LAYER                   │
                   │   · Kelly position sizer                  │
                   │   · ATR stop + 2:1 target                 │
                   │   · Two-stage trailing (1R → 0.5×ATR)     │
                   │   · Adverse-selection guard               │
                   └──────────────────┬───────────────────────┘
                                      │
                   ┌──────────────────┴───────────────────────┐
                   │         POLICY GOVERNOR                   │
                   │  resolves agent conflicts → 1 decision    │
                   │   ↑                                      │
                   │   open-sourced as `swarm-policy-governor` │
                   └─────┬──────────┬──────────┬──────────────┘
                         │          │          │
                ┌────────┴───┐ ┌────┴────┐ ┌───┴────────┐
                │  SIGNAL    │ │  TREND  │ │  REGIME    │
                │  agent     │ │  agent  │ │  agent     │
                └────────┬───┘ └────┬────┘ └────┬───────┘
                         │          │          │
                ┌────────┴──────────┴──────────┴───────┐
                │      MARKET FEED (1m → 4h candles)     │
                │  BTC · ETH · SOL · XRP · DOGE · ADA    │
                └────────────────────────────────────────┘

           ╔══════════════════ CROSS-CUTTING ══════════════════╗
           ║  • Auto-ramp (5-gate capital scaler)              ║
           ║  • Auto-deallow (per-symbol underperformance)     ║
           ║  • Kill-switch (consecutive-loss + daily PnL)     ║
           ║  • Per-symbol manual pause + auto-resume          ║
           ╚════════════════════════════════════════════════════╝
```

Full ASCII diagram with data-flow timing in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## The 4 agent roles

### Signal agent
- **Scope:** 5-minute candles + order-book imbalance
- **Models:** ensemble of momentum, breakout, mean-reversion
- **Output:** `(action ∈ {LONG, SHORT, WAIT}, confidence ∈ [0, 1], target_price)`
- **Why this scope?** Short windows miss macro shifts but catch the entry timing. The trend agent provides the macro filter.

### Trend agent
- **Scope:** 1h + 4h candles
- **Models:** EMA stack + structure detection (HH/LH for downtrends, etc.)
- **Output:** `(label ∈ {bull, bear, range}, strength ∈ [0, 1])`
- **Veto power:** can downgrade a Signal LONG to WAIT if `label == bear AND strength > 0.7`.

### Regime agent
- **Scope:** rolling 24h volatility + volume
- **Output:** `(regime ∈ {calm, trending, choppy}, atr_pct)`
- **Effect:** modulates position size — choppy regime caps Kelly fraction at 0.25, trending allows up to 0.6.

### Policy governor
- **Scope:** receives all 3 votes + a rule set
- **Output:** `(decision, confidence, dissent_log)`
- **Open-source:** the conflict-resolution primitive lives at `github.com/MySwarmbots/swarm-policy-governor` — see below.

---

## Policy governor

This is the one piece of SWARMBOTS infrastructure that's actually **open-source**:

```bash
pip install swarm-policy-governor
```

```python
from swarm_policy_governor import PolicyGovernor, AgentVote

gov = PolicyGovernor(
    actions=["LONG", "SHORT", "WAIT"],
    quorum=0.55,            # require 55% confidence-weighted agreement
    veto_threshold=0.70,    # any agent above 0.7 confidence can veto
)

votes = [
    AgentVote(agent="signal", action="LONG",  confidence=0.82),
    AgentVote(agent="trend",  action="WAIT",  confidence=0.55),
    AgentVote(agent="regime", action="LONG",  confidence=0.71),
]

decision = gov.resolve(votes)
print(decision.action, decision.confidence, decision.dissent)
# → LONG  0.768  [{'agent': 'trend', 'voted': 'WAIT', 'confidence': 0.55}]
```

→ Repo: [MySwarmbots/swarm-policy-governor](https://github.com/MySwarmbots/swarm-policy-governor)

Why is this the one thing we open-sourced? Because the *governor* is structural — it doesn't encode our edge. The edge is in the agent models themselves (which stay closed). The conflict-resolution primitive is generic and useful to any team building multi-agent systems.

---

## Live performance (last 7d)

> **Phase 1 capital deployment: $30 USDT.** Per-trade size capped at $10. These numbers reflect a deliberately conservative, audit-the-system phase — not "what's possible at scale."

| Metric | Value |
|---|---|
| Closed trades | **17** |
| Win rate | **64.7%** |
| BTC win rate | 5/5 = 100% |
| XRP win rate | 3/4 = 75% |
| Net realized PnL | ~flat (well within ATR slippage band at this size) |
| Order type | Maker-post-only (fee minimization) |
| SOL/DOGE | Auto-paused — 0/3 combined, system flagged its own underperformers |

**The bot is its own auditor.** Capital ramps from $10 → $25 → $50 → $100 only after 5 quantitative gates pass. We don't manually scale.

Full breakdown of the gate logic: [`AUTO-RAMP.md`](./AUTO-RAMP.md).

---

## Open-source primitives we ship

| Repo | What it is | Use case |
|---|---|---|
| **[swarm-policy-governor](https://github.com/MySwarmbots/swarm-policy-governor)** | Multi-agent vote-resolution + veto primitive | Any system where multiple specialists must reach a single decision |

More may follow as we extract reusable, edge-neutral components. Star the org to follow.

---

## Try the live system

If reading the design notes makes you want to actually *use* this — instead of building your own from scratch — the production deployment is at:

→ **[myswarmbots.com](https://myswarmbots.com)** — $19/mo Pro · $99/mo Alpha (auto-execution) · $499/mo Enterprise · 7-day refund

Custody stays in your own Bitget account. We never hold your funds. Read/trade-only API keys, encrypted at rest, auto-rotated every 30 days.

---

## Contributing & feedback

This repo is documentation, not a runnable codebase. But:

- **Found a flaw in the architecture?** Open an issue. Genuine architectural critique is the most valuable feedback we can get.
- **Want to discuss multi-agent design?** [@swarmbots_io](https://twitter.com/swarmbots_io) DMs are open.
- **Building something similar?** The `swarm-policy-governor` package is yours — fork, extend, send PRs.

## Sponsor

If these notes saved you a week of design debate, consider [sponsoring](./SPONSORS.md) — it directly funds more public write-ups and additional open-source primitives.

## License

The documentation in this repository is licensed under [MIT](./LICENSE). The trading code referenced in these docs is proprietary and not included.
