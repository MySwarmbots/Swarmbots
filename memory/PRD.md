# MiroFish Mobile - PRD

## Architecture
React 19 + Tailwind + FastAPI + MongoDB + Bitget (CCXT) + GPT-4o + Stripe + Telegram + WebSocket

## Implemented (All Sprints 1-7)
- [x] Auth, Dashboard, Agents CRUD, Validation Engine, AI Insights, Stripe Payments
- [x] Telegram Bot, Password Reset, Brute Force, Performance Charts, Settings
- [x] WebSocket (live push), Resend Email (fallback mode)
- [x] Bitget Exchange (LIVE - spot+futures, tickers, OHLCV, orders, positions, balance)
- [x] Profit Engine (adaptive thresholds, regime filter, position sizing, backtest, TradingView webhook)
- [x] Space Dungeon (24 agents, 6 sectors, debate engine, prediction aggregation, rollout pipeline)
- [x] **Auto-Execution Bridge** (Dungeon predictions → Bitget live trades with safety controls)

## Auto-Execution Details
- Toggle ON/OFF (default OFF), max trade USD, min confidence threshold, cooldown timer
- Symbol whitelist, trade logging to MongoDB, WebSocket broadcast, Telegram/in-app notifications
- Full pipeline tested end-to-end against live Bitget (blocked only by insufficient balance)

## Next
- [ ] Deposit USDT to Bitget for live auto-trading
- [ ] Add Resend API key for email notifications
- [ ] Scheduled prediction runs (cron-style auto-predict every N minutes)
