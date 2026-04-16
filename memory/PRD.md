# MiroFish Mobile - Product Requirements Document

## Original Problem Statement
Build a mobile-responsive web app for MiroFish - a crypto trading swarm agent platform that deploys swarms of agents to perform crypto trading tasks and automatically compound profits.

## User Choices
- **Platform**: Web app with mobile-responsive design
- **Key Features**: View live agents and data
- **Integrations**: Stripe + Crypto payments, GPT AI trading insights, Telegram and in-app notifications

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn UI + Recharts
- **Backend**: FastAPI (Python) with MongoDB
- **Authentication**: JWT with httpOnly cookies + brute force protection
- **AI**: GPT-4o via Emergent LLM integration
- **Payments**: Stripe (card + crypto)
- **Notifications**: In-app + Telegram bot (@TraderGMONYbot)
- **Email**: MOCKED (logged to console) - ready for SendGrid/Resend integration

## What's Been Implemented

### Sprint 1 (MVP - Jan 2026)
- [x] JWT Authentication (register, login, logout, me, refresh)
- [x] Trading agents CRUD operations
- [x] Validation engine (runs, gate control, summary)
- [x] AI insights endpoint with GPT-4o
- [x] Stripe payment integration (checkout, status, webhook)
- [x] In-app notifications system
- [x] Dashboard "Control Room" with live stats
- [x] Mobile-responsive design

### Sprint 2 (P0+P1 Features - Jan 2026)
- [x] **Telegram Notifications**: Bot @TraderGMONYbot integrated, link/unlink/test via Settings
- [x] **WebSocket**: Real-time endpoint /ws/{token} + ConnectionManager for live updates
- [x] **Agent Performance Charts**: Recharts - Cumulative PnL, Daily PnL, Win Rate, Volume, Strategy/Exchange breakdown, Pie charts
- [x] **Password Reset Flow**: Forgot password + reset with token (token also sent via Telegram if linked)
- [x] **Brute Force Protection**: 5 attempts = 15min lockout
- [x] **Settings Page**: Profile, Telegram link, Notification preferences (email/telegram toggles), Security
- [x] **Mark All Read**: Bulk notification management
- [x] **Unread Badge**: Real-time notification count in nav

## Prioritized Backlog

### P0 - Next Sprint
- [ ] Real email provider integration (SendGrid/Resend)
- [ ] WebSocket client-side connection for live data push (currently polling)

### P1
- [ ] Trading history export (CSV/PDF)
- [ ] Multi-exchange API key management
- [ ] Custom trading strategies builder

### P2
- [ ] Social sharing of performance
- [ ] Dark/light theme toggle
- [ ] Mobile PWA install prompt

## Test Credentials
- See `/app/memory/test_credentials.md`
