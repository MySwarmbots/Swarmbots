# MiroFish Mobile - Product Requirements Document

## Original Problem Statement
Build a mobile-responsive web app for MiroFish - a crypto trading swarm agent platform that deploys swarms of agents to perform crypto trading tasks and automatically compound profits.

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn UI + Recharts
- **Backend**: FastAPI (Python) with MongoDB
- **Authentication**: JWT with httpOnly cookies + brute force protection
- **AI**: GPT-4o via Emergent LLM integration
- **Payments**: Stripe (card + crypto)
- **Notifications**: In-app + Telegram (@TraderGMONYbot) + Email (Resend)
- **Real-time**: WebSocket with JWT auth, auto-reconnect, exponential backoff

## What's Been Implemented

### Sprint 1 (MVP)
- [x] JWT Auth, Trading agents CRUD, Validation engine, AI insights, Stripe, In-app notifications, Dashboard, Mobile-responsive design

### Sprint 2 (P0+P1)
- [x] Telegram bot integration, WebSocket endpoint, Performance charts (Recharts), Password reset, Brute force protection, Settings page

### Sprint 3 (Real-time + Email)
- [x] **Client-side WebSocket**: WsProvider gets `/api/ws-token`, connects `wss://`, auto-reconnect with exponential backoff (max 30s), ping/pong keepalive every 30s
- [x] **Live push updates**: Dashboard stats, Agents list, Validation runs, Notifications all update in real-time via WS events (`agent_created`, `agent_status`, `agent_deleted`, `gate_update`, `validation_run`, `notification`)
- [x] **WS connection indicator**: Green/red dot in header showing live connection status
- [x] **Real-time toast notifications**: WS-pushed notifications show as sonner toasts
- [x] **Resend email integration**: Fully wired with styled HTML templates. Falls back to console logging when `RESEND_API_KEY` not set. Ready for production with one env var change.
- [x] **Email templates**: Branded MiroFish HTML emails for notifications and password reset
- [x] **Reduced polling**: Dashboard 15s, Validation 30s, Unread 30s (down from 5-10s) since WS handles real-time

## Prioritized Backlog

### P1 - Next Sprint
- [ ] Add RESEND_API_KEY to .env to enable real email delivery
- [ ] Trading history export (CSV/PDF)
- [ ] Multi-exchange API key management

### P2
- [ ] Custom trading strategies builder
- [ ] Social sharing of performance
- [ ] Mobile PWA install prompt

## Test Credentials
- See `/app/memory/test_credentials.md`
