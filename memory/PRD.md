# MiroFish Mobile - PRD

## Architecture
React 19 + Tailwind + FastAPI + MongoDB + Bitget (CCXT) + GPT-4o + Stripe + Telegram + WebSocket

## All Features
- [x] Auth, Dashboard, Agents, Validation, AI Insights, Stripe, Telegram, Charts, Settings, WebSocket
- [x] Bitget Exchange (LIVE), Profit Engine, Space Dungeon (24 agents, 6 rooms)
- [x] Auto-Execution (LONG-only), Scheduler (5m, 6 symbols), Signal Tracker
- [x] Cyberpunk Room Dashboard, Operations Guide
- [x] **Signal Intelligence Engine** — ML-style adaptive confidence adjustment based on historical accuracy
  - Boosts LONG confidence (80%+ WR → +15% boost)
  - Penalizes SHORT confidence (30%- WR → -20% penalty)
  - Scales position size by confidence
  - Per-symbol, per-direction historical tracking via MongoDB aggregation
  - Intelligence data shown on Signals page with BOOST/PENALIZE badges
  - Telegram alerts include intelligence adjustments

## CHANGELOG
### Feb 2026 — Code Review Round 3 Fixes (regression-tested)
- Frontend: WsContext and AuthContext values wrapped in `useMemo`
- Frontend: ChartsPage `fetchPortfolio`/`fetchAgents`/`fetchAgentPerf` converted to `useCallback` (declared before dependent `useEffect`s — hoisting safe)
- Frontend: `PaymentSuccessPage.poll` converted to `useCallback([sessionId])`
- Frontend: All `key={i}`/`key={index}` replaced with stable keys (`t.id`, `p.symbol`-`created_at`, `entry.date`, `e.name`, etc.)
- Backend: `swarm_dungeon._personality_bias` now uses cryptographically-secure `secrets.randbelow`-based weighted choice
- Backend: `swarm_dungeon.run_debate` uses `_sec_sample` (secrets-based sample without replacement), fully replaces `random` module
- Lint: 0 warnings on ruff (backend) and ESLint with `react-hooks/exhaustive-deps` + `react/jsx-key` (frontend)
- Testing agent iteration_9: 21/21 backend tests passed, all frontend pages verified, no React key warnings in console

## Roadmap (P1 — not started)
- Refactor monolithic `App.js` (~2530 lines) into `/components/pages/` structure
- Refactor monolithic `server.py` (~1800 lines) into FastAPI routers (`/routes/auth.py`, `/routes/scheduler.py`, etc.)
