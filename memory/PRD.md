# MiroFish Mobile - Product Requirements Document

## Original Problem Statement
Build a mobile-responsive web app for MiroFish - a crypto trading swarm agent platform that deploys swarms of agents to perform crypto trading tasks and automatically compound profits.

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn UI + Recharts
- **Backend**: FastAPI (Python) with MongoDB
- **Exchange**: Bitget via CCXT (spot + futures)
- **Authentication**: JWT with httpOnly cookies + brute force protection
- **AI**: GPT-4o via Emergent LLM integration
- **Payments**: Stripe (card + crypto)
- **Notifications**: In-app + Telegram (@TraderGMONYbot) + Email (Resend)
- **Real-time**: WebSocket with JWT auth, auto-reconnect

## What's Been Implemented

### Sprint 1 (MVP)
- [x] JWT Auth, Agents CRUD, Validation engine, AI insights, Stripe, Notifications, Dashboard

### Sprint 2 (P0+P1)
- [x] Telegram bot, WebSocket endpoint, Performance charts, Password reset, Brute force, Settings

### Sprint 3 (Real-time + Email)
- [x] Client-side WebSocket with live push, Resend email integration, HTML templates

### Sprint 4 (Bitget Exchange)
- [x] **CCXT Bitget integration**: Spot + Futures (swap) market support
- [x] **Live market data**: Tickers (BTC, ETH, SOL, XRP, DOGE, ADA), OHLCV candles, orderbook
- [x] **Trading**: Market/Limit orders, cancel orders, open orders, order history
- [x] **Account**: Balance viewer, futures positions, trade logging
- [x] **Exchange page**: Live ticker strip, price chart, BUY/SELL order panel, Balance/Positions/Orders/History tabs
- [x] **Spot/Futures toggle**: Switch between market types
- [x] **API key management**: Graceful "not configured" state with setup instructions
- [x] **WS integration**: Order fills broadcast via WebSocket for real-time updates

## Prioritized Backlog
- [ ] Add BITGET_API_KEY/SECRET/PASSPHRASE to .env for live trading
- [ ] Add RESEND_API_KEY for real email delivery
- [ ] Trading history export (CSV/PDF)
- [ ] Custom trading strategies builder
- [ ] Mobile PWA install prompt
