# MiroFish Mobile

A crypto swarm-trading dashboard. React (Tailwind + Shadcn UI) + FastAPI + MongoDB. Dark cyberpunk aesthetic, 24 AI robot agents, CCXT Bitget auto-execution, 5-minute swarm predictions with a Signal Intelligence Engine.

## Local Development

### Install
```bash
# Root — installs husky + lint-staged pre-commit hook
cd /app && yarn install

# Frontend
cd /app/frontend && yarn install

# Backend
cd /app/backend && pip install -r requirements.txt
```

### Lint (verify code quality)
```bash
# Frontend (ESLint with react-hooks/exhaustive-deps + jsx-key)
cd /app/frontend && yarn lint          # check only
cd /app/frontend && yarn lint:fix      # auto-fix safe issues

# Backend (ruff: pyflakes + bugbear + isort + pyupgrade)
cd /app/backend && ruff check .        # check only
cd /app/backend && ruff check . --fix  # auto-fix safe issues

# Run both in one go:
cd /app && yarn lint
```

### Pre-commit hook
The `.husky/pre-commit` hook runs `lint-staged` on staged files before every commit — **bad imports, missing React hook deps, and syntax errors block the commit**. Install it once with `yarn install` at the repo root.

## Architecture

### Backend
```
/app/backend/
├── server.py                        # App init, CORS, auth helpers, startup, health, dashboard
├── routes/                          # HTTP route handlers (9 routers)
│   ├── auth.py                      # login/register/logout/me/refresh/forgot/reset
│   ├── exchange.py                  # CCXT Bitget: tickers, balance, positions, orders
│   ├── scheduler.py                 # scheduler status + manual trigger
│   ├── profile.py                   # profile + telegram link
│   ├── notifications.py             # in-app notifications
│   ├── payments.py                  # Stripe subscription
│   ├── signals.py                   # signal accuracy + intelligence
│   ├── engine.py                    # profit engine endpoints
│   └── dungeon.py                   # space dungeon swarm agents
├── services/                        # Long-lived business logic
│   ├── auto_exec.py                 # Auto-execution pipeline, signal intelligence
│   ├── scheduler.py                 # Background scheduler loop (5-min interval)
│   └── signal_tracker.py            # Entry/exit price tracking for WR calc
├── swarm_dungeon.py                 # Agent personalities, debate, aggregate prediction
├── profit_engine.py                 # Core prediction algorithms
└── bitget_exchange.py               # CCXT Bitget client wrapper
```

### Frontend
```
/app/frontend/src/
├── App.js                           # Routing, lean main-page components
├── contexts/
│   ├── AuthContext.js               # user + login/logout + useMemo'd provider value
│   └── WsContext.jsx                # WebSocket connection + reactive lastMessage
├── components/
│   ├── DashboardLayout.jsx          # Top nav + mobile menu + unread badge polling
│   ├── ProtectedRoute.jsx           # Auth gate + WsProvider wrap
│   └── ui/                          # Shadcn primitives
├── pages/
│   ├── LoginPage.jsx / RegisterPage.jsx / ForgotPasswordPage.jsx / ResetPasswordPage.jsx
│   ├── DungeonPage.jsx              # 3D space dungeon, 24 robot agents
│   ├── SignalsPage.jsx              # Signal intelligence + history
│   ├── ExchangePage.jsx             # Live Bitget tickers + order form
│   ├── EnginePage.jsx               # Profit engine config + snapshots
│   └── ChartsPage.jsx               # Portfolio + agent PnL charts
└── lib/
    ├── chart.js                     # Shared CHART_COLORS + CustomTooltip
    └── utils.js                     # cn, formatCurrency, formatNumber, logError
```

## Test Credentials
See `/app/memory/test_credentials.md` for the live admin account.
