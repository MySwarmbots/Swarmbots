# MiroFish Mobile - Product Requirements Document

## Original Problem Statement
Build a mobile-responsive web app for MiroFish - a crypto trading swarm agent platform that deploys swarms of agents to perform crypto trading tasks and automatically compound profits.

## User Choices
- **Platform**: Web app with mobile-responsive design
- **Key Features**: View live agents and data
- **Integrations**: Stripe + Crypto payments, GPT AI trading insights, Telegram and in-app notifications

## Core Requirements (Static)
1. Mobile-responsive dashboard for trading swarm management
2. User authentication (JWT-based)
3. Live agents monitoring and control
4. Validation engine with shadow/live modes
5. AI-powered trading insights
6. Payment/subscription system
7. In-app notification system

## User Personas
1. **Crypto Trader**: Deploys and monitors trading agents
2. **Admin**: Manages system settings and validation gates
3. **Subscriber**: Pays for premium agent access

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI (Python) with MongoDB
- **Authentication**: JWT with httpOnly cookies
- **AI**: GPT-4o via Emergent LLM integration
- **Payments**: Stripe (card + crypto)

## What's Been Implemented (Jan 2026)

### Backend
- [x] JWT Authentication (register, login, logout, me, refresh)
- [x] User management with admin seeding
- [x] Trading agents CRUD operations
- [x] Validation engine (runs, gate control, summary)
- [x] AI insights endpoint with GPT-4o
- [x] Stripe payment integration (checkout, status, webhook)
- [x] In-app notifications system
- [x] Dashboard stats aggregation

### Frontend
- [x] Login/Register pages with Swiss-brutalist design
- [x] Dashboard "Control Room" with live stats
- [x] Agents page with create/toggle/delete
- [x] Validation page with runs table and gate control
- [x] AI Insights terminal interface
- [x] Billing page with subscription plans
- [x] Notifications page
- [x] Payment success/cancel pages
- [x] Mobile-responsive design (hamburger menu, responsive grid)
- [x] Dark theme throughout

## Prioritized Backlog

### P0 - Critical (Next Sprint)
- [ ] Telegram notification integration
- [ ] Real-time WebSocket updates for live data
- [ ] Agent performance charts

### P1 - High Priority
- [ ] Password reset flow
- [ ] Email notifications
- [ ] Trading history export
- [ ] Agent analytics dashboard

### P2 - Medium Priority
- [ ] Multi-exchange support
- [ ] Custom trading strategies builder
- [ ] Social sharing of performance
- [ ] Dark/light theme toggle

## Next Tasks
1. Implement Telegram bot integration for notifications
2. Add WebSocket for real-time agent status updates
3. Build performance charts using Recharts
4. Add email notification system

## Test Credentials
- See `/app/memory/test_credentials.md`
