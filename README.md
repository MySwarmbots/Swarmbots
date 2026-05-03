# swarm-policy-governor

> Multi-agent vote resolution + veto primitive in pure Python.
> Zero dependencies. Type-hinted. <300 lines of source.

[![PyPI](https://img.shields.io/pypi/v/swarm-policy-governor)](https://pypi.org/project/swarm-policy-governor/)
[![Python](https://img.shields.io/badge/python-3.10%2B-blue)](https://www.python.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

When you have **N specialist agents** that must reach a **single decision**, you have a coordination problem. This package solves it without you having to invent a voting scheme from scratch.

It's the conflict-resolution primitive extracted from [SWARMBOTS](https://myswarmbots.com) — a 24-agent autonomous trading swarm — generalized for any multi-agent system.

---

## Why this exists

Most multi-agent codebases reinvent voting/quorum logic from scratch. The result is usually:
- A `dict.most_common()` call dressed up as "consensus"
- Confidence scores ignored entirely
- No way for a single highly-confident agent to veto a low-confidence majority
- Zero auditability when the system makes a bad call

`swarm-policy-governor` gives you a small, **explicit** API for all of this. You define the actions, the quorum threshold, and the veto threshold. The governor returns a decision plus a full dissent log.

---

## Install

```bash
pip install swarm-policy-governor
```

Python 3.10+. No runtime dependencies.

---

## 60-second quickstart

```python
from swarm_policy_governor import PolicyGovernor, AgentVote

gov = PolicyGovernor(
    actions=["LONG", "SHORT", "WAIT"],
    quorum=0.55,            # 55% confidence-weighted agreement to pass
    veto_threshold=0.70,    # any single agent above 0.7 can override
    default_action="WAIT",  # what to return when no quorum is reached
)

votes = [
    AgentVote(agent="signal", action="LONG",  confidence=0.82),
    AgentVote(agent="trend",  action="WAIT",  confidence=0.55),
    AgentVote(agent="regime", action="LONG",  confidence=0.71),
]

decision = gov.resolve(votes)

print(decision.action)       # → "LONG"
print(decision.confidence)   # → 0.768
print(decision.passed_quorum)  # → True
print(decision.dissent)
# → [{'agent': 'trend', 'voted': 'WAIT', 'confidence': 0.55}]
```

That's the whole API. Three lines to get a decision + an audit trail.

---

## Example: a single agent veto

```python
votes = [
    AgentVote(agent="signal", action="LONG", confidence=0.82),
    AgentVote(agent="trend",  action="LONG", confidence=0.71),
    AgentVote(agent="risk",   action="WAIT", confidence=0.91),  # high-confidence veto
]

decision = gov.resolve(votes)
print(decision.action)        # → "WAIT" — risk agent vetoed
print(decision.veto_applied)  # → True
print(decision.veto_reason)
# → {'agent': 'risk', 'voted': 'WAIT', 'confidence': 0.91}
```

The risk agent's 0.91 confidence in `WAIT` exceeded `veto_threshold=0.70`, so its vote overrode the otherwise-strong LONG signal. **Veto is a feature, not a bug** — it's how you let domain specialists protect the system from groupthink.

---

## Example: configurable resolution strategy

```python
from swarm_policy_governor import PolicyGovernor, AgentVote
from swarm_policy_governor.strategies import ConfidenceWeighted, MajorityVote, Borda

# Confidence-weighted (default) — sum of confidences per action wins
gov = PolicyGovernor(
    actions=["LONG", "SHORT", "WAIT"],
    strategy=ConfidenceWeighted(),
)

# Pure majority vote — count of votes per action wins, confidence ignored
gov = PolicyGovernor(
    actions=["LONG", "SHORT", "WAIT"],
    strategy=MajorityVote(),
)

# Borda count — each agent ranks all actions; positions sum across agents
gov = PolicyGovernor(
    actions=["LONG", "SHORT", "WAIT"],
    strategy=Borda(),  # requires ranked votes via AgentVote.ranked
)
```

You can write your own by subclassing `ResolutionStrategy`. The default is confidence-weighted because in practice it's what most teams want — agents that are unsure should count less than agents that are sure.

---

## API reference

### `PolicyGovernor`

```python
PolicyGovernor(
    actions: list[str],
    quorum: float = 0.5,
    veto_threshold: float | None = 0.7,
    default_action: str | None = None,
    strategy: ResolutionStrategy | None = None,
)
```

| Argument | Default | Description |
|---|---|---|
| `actions` | required | The full set of legal actions. Anything else is rejected. |
| `quorum` | `0.5` | Minimum normalized score required for a decision to pass. Range `[0, 1]`. |
| `veto_threshold` | `0.7` | Single-agent confidence above which their vote overrides. Set `None` to disable. |
| `default_action` | `None` | What to return if quorum fails. `None` = first action in `actions`. |
| `strategy` | `ConfidenceWeighted()` | Resolution algorithm. See `strategies` module. |

### `AgentVote`

```python
AgentVote(
    agent: str,
    action: str,
    confidence: float,
    metadata: dict | None = None,
    ranked: list[str] | None = None,  # for Borda
)
```

### `Decision`

```python
@dataclass
class Decision:
    action: str
    confidence: float           # normalized [0, 1]
    passed_quorum: bool
    veto_applied: bool
    veto_reason: dict | None
    scores: dict[str, float]    # per-action total weight
    dissent: list[dict]         # agents who voted differently
```

The `Decision` object is fully serializable — drop it straight into a database for audit.

---

## Why we built it this way

Three design rules drove every choice:

1. **No magic.** The governor doesn't try to learn anything. It applies the rules you gave it. Reproducible, testable, debuggable.
2. **Explicit dissent log.** Every decision ships with the votes that *didn't* win. When the system is wrong, you have the evidence to figure out why.
3. **Veto is first-class.** The most common multi-agent pathology is groupthink — N agents drawing from correlated data sources all voting the same way and missing the one real risk. Veto gives a specialist the explicit power to say "no, I'm sure, override."

These rules came directly from running this exact pattern on real Bitget capital. Without them, the swarm produced too many false-positive entries during regime transitions.

---

## Tests

```bash
git clone https://github.com/MySwarmbots/swarm-policy-governor
cd swarm-policy-governor
pip install -e .[dev]
pytest
```

Coverage: 95%+ on the resolution and veto paths.

---

## Used in production by

- [SWARMBOTS](https://myswarmbots.com) — 24-agent autonomous crypto trading swarm

If you're using `swarm-policy-governor` in production, open a PR to add yourself.

---

## See also

- [SWARMBOTS architecture notes](https://github.com/MySwarmbots/swarmbots-architecture) — the broader system this package was extracted from
- [SWARMBOTS live system](https://myswarmbots.com) — $19/mo to use the full multi-agent trading swarm with auto-execution on your own Bitget funds

---

## Sponsor

Maintained by [@MySwarmbots](https://github.com/MySwarmbots). If this saved you a week of design debate:

→ **[github.com/sponsors/MySwarmbots](https://github.com/sponsors/MySwarmbots)**

## License

[MIT](./LICENSE) — use it, fork it, ship it.
