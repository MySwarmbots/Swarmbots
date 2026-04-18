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
### Feb 2026 — P2 Refactor Wave 2 (iteration_11)
**Backend: `server.py` 1614 → 1167 lines (total -38% from original 1880)**
- `/backend/routes/profile.py` (profile GET/PATCH, telegram link/unlink/test)
- `/backend/routes/notifications.py` (list, unread-count, create, mark read, mark-all-read)
- `/backend/routes/payments.py` (plans, checkout, status, webhook) — SUBSCRIPTION_PLANS moved here
- `/backend/routes/signals.py` (accuracy, pending, intelligence)
- `/backend/routes/engine.py` (all /engine/* + EngineConfigUpdate model)
- `/backend/routes/dungeon.py` (agents, debate, prediction, auto-exec, rollout)

**Frontend: `App.js` 921 → 718 lines (total -72% from original 2534)**
- `/src/pages/LoginPage.jsx` (68), `RegisterPage.jsx` (54), `ForgotPasswordPage.jsx` (70), `ResetPasswordPage.jsx` (63)

**Bug fix**: `GET /api/payments/status/{invalid_session_id}` now returns HTTP 404 with `"Checkout session not found"` (was 500). Other Stripe errors return 400 with descriptive detail.

**Testing**: iteration_11 passed 36/36 backend + all frontend pages. Scheduler verified running every 5 min across 6 symbols.

### Feb 2026 — P1 Refactor Wave 1 (iteration_10)
**Frontend: `App.js` split from 2534 → 921 lines**
- `/src/pages/ChartsPage.jsx` (219 lines)
- `/src/pages/SignalsPage.jsx` (254 lines)
- `/src/pages/DungeonPage.jsx` (429 lines)
- `/src/pages/EnginePage.jsx` (242 lines)
- `/src/pages/ExchangePage.jsx` (366 lines)
- `/src/components/DashboardLayout.jsx` (shared chrome nav + unread polling)
- `/src/components/ProtectedRoute.jsx` (auth gate + WsProvider wrap)
- `/src/contexts/WsContext.jsx` (WsProvider, useWs — useMemo-wrapped value)
- `/src/lib/chart.js` (shared CHART_COLORS + CustomTooltip)

**Backend: `server.py` split from 1880 → 1613 lines**
- `/backend/routes/auth.py` (register, login, logout, me, refresh, forgot-password, reset-password)
- `/backend/routes/exchange.py` (status, tickers, ohlcv, orderbook, balance, positions, orders, history)
- `/backend/routes/scheduler.py` (scheduler/status, scheduler/trigger)
- Pattern: router modules use late `from server import ...` — works because server.py imports routers at the end after all shared state/helpers are defined
- Scheduler background loop + deep helpers (_process_scheduled_symbol, _apply_signal_intelligence, etc.) stay in server.py

### Feb 2026 — Code Review Round 3 Fixes (iteration_9)
- Frontend: WsContext and AuthContext values wrapped in `useMemo`
- Frontend: ChartsPage `fetchPortfolio`/`fetchAgents`/`fetchAgentPerf` converted to `useCallback` (declared before dependent `useEffect`s — hoisting safe)
- Frontend: `PaymentSuccessPage.poll` converted to `useCallback([sessionId])`
- Frontend: All `key={i}`/`key={index}` replaced with stable keys (`t.id`, `p.symbol`-`created_at`, `entry.date`, `e.name`, etc.)
- Backend: `swarm_dungeon._personality_bias` now uses cryptographically-secure `secrets.randbelow`-based weighted choice
- Backend: `swarm_dungeon.run_debate` uses `_sec_sample` (secrets-based sample without replacement), fully replaces `random` module
- Lint: 0 warnings on ruff (backend) and ESLint with `react-hooks/exhaustive-deps` + `react/jsx-key` (frontend)

## Roadmap (P3)
- Add public leaderboard / shareable agent card for virality
- Consider splitting remaining server.py helpers (scheduler_loop + auto-exec chain) into `/backend/services/` if they grow further
