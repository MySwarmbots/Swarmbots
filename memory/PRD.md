# MiroFish Mobile - Product Requirements Document

## Original Problem Statement
Build a mobile-responsive web app for MiroFish - a crypto trading swarm agent platform that deploys swarms of agents to perform crypto trading tasks and automatically compound profits.

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn UI + Recharts
- **Backend**: FastAPI (Python) with MongoDB
- **Exchange**: Bitget via CCXT (spot + futures)
- **Swarm**: 24 autonomous agents with personalities, debate engine, prediction aggregation
- **Engine**: Profit-optimized with adaptive thresholds, regime filters, risk management
- **Auth**: JWT + brute force protection
- **AI**: GPT-4o via Emergent LLM
- **Payments**: Stripe (card + crypto)
- **Notifications**: In-app + Telegram + Email (Resend)
- **Real-time**: WebSocket

## Implemented Features (All Sprints)
- [x] JWT Auth, Dashboard, Agents CRUD, Validation Engine
- [x] AI Insights (GPT-4o), Stripe Payments, In-app Notifications
- [x] Telegram Bot (@TraderGMONYbot), Password Reset, Brute Force Protection
- [x] Performance Charts (Recharts), Settings Page
- [x] Client-side WebSocket with live push updates
- [x] Resend Email integration (fallback mode)
- [x] Bitget Exchange (live tickers, OHLCV, orders, positions)
- [x] Profit Engine (adaptive confidence, regime filter, position sizing, backtest)
- [x] Space Dungeon (24 agents, 6 sectors, debate engine, prediction aggregation, rollout pipeline)
