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
