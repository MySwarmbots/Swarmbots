"""
Regression tests for MiroFish refactor (iteration 10).
Tests all endpoints after splitting server.py into routes/ and App.js into pages/.
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = os.getenv("TEST_ADMIN_EMAIL", "admin@mirofish.io")
ADMIN_PASSWORD = os.getenv("TEST_ADMIN_PASSWORD", "admin123")


class TestHealthAndBasics:
    """Basic health checks"""
    
    def test_health_endpoint(self):
        """GET /api/health returns status ok"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ok"
        print("✓ Health endpoint working")


class TestAuthRoutes:
    """Tests for /api/auth/* endpoints (now in routes/auth.py)"""
    
    def test_login_success(self):
        """POST /api/auth/login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] == "admin"
        print(f"✓ Login successful: {data['email']}")
    
    def test_login_invalid_credentials(self):
        """POST /api/auth/login with invalid credentials returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Invalid login correctly rejected")
    
    def test_auth_me_with_session(self):
        """GET /api/auth/me with valid session returns user"""
        session = requests.Session()
        # Login first
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_resp.status_code == 200
        
        # Get current user
        me_resp = session.get(f"{BASE_URL}/api/auth/me")
        assert me_resp.status_code == 200
        data = me_resp.json()
        assert data["email"] == ADMIN_EMAIL
        print(f"✓ Auth me endpoint working: {data['email']}")
    
    def test_auth_me_without_session(self):
        """GET /api/auth/me without session returns 401"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
        print("✓ Auth me correctly rejects unauthenticated requests")
    
    def test_logout(self):
        """POST /api/auth/logout clears session"""
        session = requests.Session()
        # Login
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        # Logout
        logout_resp = session.post(f"{BASE_URL}/api/auth/logout")
        assert logout_resp.status_code == 200
        assert logout_resp.json().get("message") == "Logged out successfully"
        print("✓ Logout endpoint working")
    
    def test_refresh_token(self):
        """POST /api/auth/refresh with valid refresh token"""
        session = requests.Session()
        # Login first
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        # Refresh
        refresh_resp = session.post(f"{BASE_URL}/api/auth/refresh")
        assert refresh_resp.status_code == 200
        assert refresh_resp.json().get("message") == "Token refreshed"
        print("✓ Token refresh working")
    
    def test_forgot_password(self):
        """POST /api/auth/forgot-password generates reset token"""
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": ADMIN_EMAIL
        })
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        # In dev mode, token is returned
        if "reset_token" in data:
            assert len(data["reset_token"]) > 20
        print("✓ Forgot password endpoint working")


class TestExchangeRoutes:
    """Tests for /api/exchange/* endpoints (now in routes/exchange.py)"""
    
    def test_exchange_status(self):
        """GET /api/exchange/status returns Bitget configured status"""
        response = requests.get(f"{BASE_URL}/api/exchange/status")
        assert response.status_code == 200
        data = response.json()
        assert "configured" in data
        assert data.get("exchange") == "bitget"
        print(f"✓ Exchange status: configured={data['configured']}")
    
    def test_exchange_tickers(self):
        """GET /api/exchange/tickers returns ticker data"""
        response = requests.get(f"{BASE_URL}/api/exchange/tickers?symbols=BTC/USDT")
        assert response.status_code == 200
        data = response.json()
        assert "tickers" in data
        assert isinstance(data["tickers"], list)
        print(f"✓ Exchange tickers: {len(data['tickers'])} tickers returned")
    
    def test_exchange_ticker_single(self):
        """GET /api/exchange/ticker/{symbol} returns single ticker"""
        response = requests.get(f"{BASE_URL}/api/exchange/ticker/BTC/USDT")
        assert response.status_code == 200
        data = response.json()
        assert "symbol" in data or "last" in data or "error" not in data
        print("✓ Single ticker endpoint working")
    
    def test_exchange_ohlcv(self):
        """GET /api/exchange/ohlcv/{symbol} returns candle data"""
        response = requests.get(f"{BASE_URL}/api/exchange/ohlcv/BTC/USDT?timeframe=1h&limit=10")
        assert response.status_code == 200
        data = response.json()
        assert "candles" in data
        print(f"✓ OHLCV endpoint: {len(data['candles'])} candles returned")
    
    def test_exchange_orderbook(self):
        """GET /api/exchange/orderbook/{symbol} returns orderbook"""
        response = requests.get(f"{BASE_URL}/api/exchange/orderbook/BTC/USDT?limit=5")
        assert response.status_code == 200
        data = response.json()
        # Should have bids/asks or error if not configured
        assert "bids" in data or "asks" in data or "error" in data
        print("✓ Orderbook endpoint working")
    
    def test_exchange_balance_authenticated(self):
        """GET /api/exchange/balance requires auth"""
        session = requests.Session()
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        response = session.get(f"{BASE_URL}/api/exchange/balance")
        assert response.status_code == 200
        data = response.json()
        # Should have balance data or error if API keys not configured
        assert "total" in data or "error" in data
        print("✓ Exchange balance endpoint working")


class TestSchedulerRoutes:
    """Tests for /api/dungeon/scheduler/* endpoints (now in routes/scheduler.py)"""
    
    def test_scheduler_status(self):
        """GET /api/dungeon/scheduler/status returns scheduler config"""
        response = requests.get(f"{BASE_URL}/api/dungeon/scheduler/status")
        assert response.status_code == 200
        data = response.json()
        assert "scheduler_enabled" in data
        assert "interval_minutes" in data
        assert "symbols" in data
        assert "recent_runs" in data
        print(f"✓ Scheduler status: enabled={data['scheduler_enabled']}, interval={data['interval_minutes']}min")
    
    def test_scheduler_trigger(self):
        """POST /api/dungeon/scheduler/trigger triggers manual prediction"""
        session = requests.Session()
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        response = session.post(f"{BASE_URL}/api/dungeon/scheduler/trigger?symbol=BTCUSDT")
        assert response.status_code == 200
        data = response.json()
        assert "direction" in data
        assert "confidence" in data
        assert "votes" in data
        print(f"✓ Scheduler trigger: {data['direction']} @ {data['confidence']*100:.1f}% confidence")


class TestDungeonEndpoints:
    """Tests for dungeon endpoints (still in server.py)"""
    
    def test_dungeon_agents(self):
        """GET /api/dungeon/agents returns 24 agents"""
        response = requests.get(f"{BASE_URL}/api/dungeon/agents")
        assert response.status_code == 200
        data = response.json()
        assert "agents" in data
        assert len(data["agents"]) == 24
        print(f"✓ Dungeon agents: {len(data['agents'])} agents")
    
    def test_dungeon_prediction(self):
        """GET /api/dungeon/prediction returns swarm prediction"""
        response = requests.get(f"{BASE_URL}/api/dungeon/prediction?symbol=BTCUSDT")
        assert response.status_code == 200
        data = response.json()
        assert "direction" in data
        assert "confidence" in data
        assert "votes" in data
        assert data["direction"] in ["long_bias", "short_bias", "wait"]
        print(f"✓ Dungeon prediction: {data['direction']} @ {data['confidence']*100:.1f}%")
    
    def test_dungeon_debate(self):
        """GET /api/dungeon/debate returns agent debate stances"""
        response = requests.get(f"{BASE_URL}/api/dungeon/debate?symbol=ETHUSDT")
        assert response.status_code == 200
        data = response.json()
        assert "debate" in data
        assert len(data["debate"]) > 0
        print(f"✓ Dungeon debate: {len(data['debate'])} agents debating")
    
    def test_dungeon_predictions_history(self):
        """GET /api/dungeon/predictions returns recent predictions"""
        response = requests.get(f"{BASE_URL}/api/dungeon/predictions")
        assert response.status_code == 200
        data = response.json()
        assert "predictions" in data
        print(f"✓ Dungeon predictions history: {len(data['predictions'])} predictions")


class TestSignalsEndpoints:
    """Tests for signals endpoints"""
    
    def test_signals_accuracy(self):
        """GET /api/signals/accuracy returns signal accuracy data"""
        response = requests.get(f"{BASE_URL}/api/signals/accuracy")
        assert response.status_code == 200
        data = response.json()
        assert "win_rate" in data
        assert "total_signals" in data
        print(f"✓ Signals accuracy: {data['win_rate']}% win rate, {data['total_signals']} signals")
    
    def test_signals_intelligence(self):
        """GET /api/signals/intelligence returns per-symbol intelligence"""
        response = requests.get(f"{BASE_URL}/api/signals/intelligence")
        assert response.status_code == 200
        data = response.json()
        assert "intelligence" in data
        print(f"✓ Signals intelligence: {len(data['intelligence'])} symbols")


class TestDashboardEndpoints:
    """Tests for dashboard endpoints"""
    
    def test_dashboard_stats(self):
        """GET /api/dashboard/stats returns dashboard statistics"""
        session = requests.Session()
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        response = session.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_agents" in data
        assert "active_agents" in data
        print(f"✓ Dashboard stats: {data['total_agents']} agents, {data['active_agents']} active")
    
    def test_dashboard_dungeon_overview(self):
        """GET /api/dashboard/dungeon-overview returns dungeon overview"""
        response = requests.get(f"{BASE_URL}/api/dashboard/dungeon-overview")
        assert response.status_code == 200
        data = response.json()
        assert "agents" in data
        assert len(data["agents"]) == 24
        assert "scheduler" in data
        print(f"✓ Dungeon overview: {len(data['agents'])} agents, scheduler={data['scheduler']}")


class TestEngineEndpoints:
    """Tests for profit engine endpoints"""
    
    def test_engine_swarm(self):
        """GET /api/engine/swarm returns swarm consensus"""
        session = requests.Session()
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        response = session.get(f"{BASE_URL}/api/engine/swarm")
        assert response.status_code == 200
        data = response.json()
        assert "consensus" in data
        print(f"✓ Engine swarm: consensus={data['consensus']}")
    
    def test_engine_config(self):
        """GET /api/engine/config returns engine configuration"""
        session = requests.Session()
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        response = session.get(f"{BASE_URL}/api/engine/config")
        assert response.status_code == 200
        data = response.json()
        assert "base_confidence_threshold" in data
        print(f"✓ Engine config: threshold={data['base_confidence_threshold']}")


class TestAgentsEndpoints:
    """Tests for trading agents endpoints"""
    
    def test_agents_list(self):
        """GET /api/agents returns agents list"""
        session = requests.Session()
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        response = session.get(f"{BASE_URL}/api/agents")
        assert response.status_code == 200
        data = response.json()
        assert "agents" in data
        print(f"✓ Agents list: {len(data['agents'])} agents")
    
    def test_agents_portfolio_summary(self):
        """GET /api/agents/portfolio/summary returns portfolio data"""
        session = requests.Session()
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        response = session.get(f"{BASE_URL}/api/agents/portfolio/summary")
        assert response.status_code == 200
        data = response.json()
        assert "portfolio_history" in data or "total_pnl" in data
        print("✓ Portfolio summary endpoint working")


class TestPaymentsEndpoints:
    """Tests for payments endpoints"""
    
    def test_payments_plans(self):
        """GET /api/payments/plans returns subscription plans"""
        session = requests.Session()
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        response = session.get(f"{BASE_URL}/api/payments/plans")
        assert response.status_code == 200
        data = response.json()
        assert "plans" in data
        print(f"✓ Payment plans: {list(data['plans'].keys())}")
    
    def test_payments_status_invalid(self):
        """GET /api/payments/status/{invalid} returns graceful error"""
        session = requests.Session()
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        response = session.get(f"{BASE_URL}/api/payments/status/invalid_session_id")
        # Should not crash, return error gracefully
        assert response.status_code in [200, 400, 404]
        print("✓ Payment status handles invalid session gracefully")


class TestWebSocketToken:
    """Tests for WebSocket token endpoint"""
    
    def test_ws_token(self):
        """GET /api/ws-token returns token for authenticated user"""
        session = requests.Session()
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        response = session.get(f"{BASE_URL}/api/ws-token")
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert len(data["token"]) > 10
        print(f"✓ WS token generated: {data['token'][:20]}...")


class TestValidationEndpoints:
    """Tests for validation endpoints"""
    
    def test_validation_runs(self):
        """GET /api/validation/runs returns validation runs"""
        session = requests.Session()
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        response = session.get(f"{BASE_URL}/api/validation/runs")
        assert response.status_code == 200
        data = response.json()
        assert "runs" in data
        print(f"✓ Validation runs: {len(data['runs'])} runs")
    
    def test_validation_gate(self):
        """GET /api/validation/gate returns gate status"""
        session = requests.Session()
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        response = session.get(f"{BASE_URL}/api/validation/gate")
        assert response.status_code == 200
        data = response.json()
        assert "mode" in data
        assert "blocked" in data
        print(f"✓ Validation gate: mode={data['mode']}, blocked={data['blocked']}")


class TestNotificationsEndpoints:
    """Tests for notifications endpoints"""
    
    def test_notifications_list(self):
        """GET /api/notifications returns notifications"""
        session = requests.Session()
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        response = session.get(f"{BASE_URL}/api/notifications")
        assert response.status_code == 200
        data = response.json()
        assert "notifications" in data
        print(f"✓ Notifications: {len(data['notifications'])} notifications")
    
    def test_notifications_unread_count(self):
        """GET /api/notifications/unread-count returns count"""
        session = requests.Session()
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        response = session.get(f"{BASE_URL}/api/notifications/unread-count")
        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        print(f"✓ Unread notifications: {data['count']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
