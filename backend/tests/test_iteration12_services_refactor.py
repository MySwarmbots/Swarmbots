"""
Iteration 12 Services Refactor Tests - Scheduler/Auto-Exec chain split from server.py
Tests the new services module: signal_tracker.py, auto_exec.py, scheduler.py
CRITICAL: Verifies 100% parity with iteration_11 after refactor
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@mirofish.io"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def auth_session():
    """Create authenticated session for tests"""
    session = requests.Session()
    resp = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return session


# ============== HEALTH CHECK ==============

class TestHealthCheck:
    """Basic health check to verify backend is running"""
    
    def test_health_endpoint(self):
        """GET /api/health must work"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ok"
        print("✓ Health check passed")


# ============== AUTH ENDPOINTS ==============

class TestAuthEndpoints:
    """Test all auth endpoints (login/logout/me/refresh)"""
    
    def test_login_success(self):
        """POST /api/auth/login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        # Response contains user info (cookies set for auth)
        assert "email" in data or "user" in data
        print("✓ Login success")
    
    def test_login_invalid_credentials(self):
        """POST /api/auth/login with invalid credentials returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Login rejects invalid credentials")
    
    def test_auth_me(self, auth_session):
        """GET /api/auth/me returns current user"""
        response = auth_session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        data = response.json()
        assert data.get("email") == ADMIN_EMAIL
        print("✓ Auth me endpoint working")
    
    def test_auth_refresh(self, auth_session):
        """POST /api/auth/refresh works"""
        response = auth_session.post(f"{BASE_URL}/api/auth/refresh")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data or "access_token" in data
        print("✓ Auth refresh working")


# ============== SCHEDULER STATUS (services/scheduler.py) ==============

class TestSchedulerStatus:
    """Test /api/dungeon/scheduler/status - uses services.auto_exec + services.scheduler"""
    
    def test_scheduler_status_structure(self):
        """GET /api/dungeon/scheduler/status must show scheduler_enabled, interval_minutes, symbols, recent_runs"""
        response = requests.get(f"{BASE_URL}/api/dungeon/scheduler/status")
        assert response.status_code == 200
        data = response.json()
        
        # Verify required fields
        assert "scheduler_enabled" in data, "Missing scheduler_enabled"
        assert "interval_minutes" in data, "Missing interval_minutes"
        assert "symbols" in data, "Missing symbols"
        assert "recent_runs" in data, "Missing recent_runs"
        
        # Verify types
        assert isinstance(data["scheduler_enabled"], bool)
        assert isinstance(data["interval_minutes"], int)
        assert isinstance(data["symbols"], list)
        assert isinstance(data["recent_runs"], list)
        
        print(f"✓ Scheduler status: enabled={data['scheduler_enabled']}, interval={data['interval_minutes']}min, symbols={data['symbols']}")


# ============== SCHEDULER TRIGGER (services/scheduler.py) ==============

class TestSchedulerTrigger:
    """Test /api/dungeon/scheduler/trigger - must return a live prediction with votes"""
    
    def test_scheduler_trigger_btcusdt(self, auth_session):
        """POST /api/dungeon/scheduler/trigger?symbol=BTCUSDT returns prediction with votes"""
        response = auth_session.post(f"{BASE_URL}/api/dungeon/scheduler/trigger?symbol=BTCUSDT")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify prediction structure
        assert "direction" in data, "Missing direction"
        assert "confidence" in data, "Missing confidence"
        assert "votes" in data, "Missing votes"
        
        # Verify direction is valid
        assert data["direction"] in ["long_bias", "short_bias", "wait"], f"Invalid direction: {data['direction']}"
        
        # Verify confidence is a float between 0 and 1
        assert 0 <= data["confidence"] <= 1, f"Invalid confidence: {data['confidence']}"
        
        # Verify votes structure
        votes = data["votes"]
        assert "bullish_count" in votes
        assert "bearish_count" in votes
        assert "neutral_count" in votes
        
        print(f"✓ Scheduler trigger: {data['direction']} @ {data['confidence']*100:.1f}% (B:{votes['bullish_count']} S:{votes['bearish_count']} N:{votes['neutral_count']})")


# ============== AUTO-EXEC CONFIG (services/auto_exec.py) ==============

class TestAutoExecConfig:
    """Test /api/dungeon/auto-exec/config - uses services.auto_exec"""
    
    def test_get_auto_exec_config(self, auth_session):
        """GET /api/dungeon/auto-exec/config returns persisted AutoExecConfig"""
        response = auth_session.get(f"{BASE_URL}/api/dungeon/auto-exec/config")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify required fields from AutoExecConfig
        assert "enabled" in data, "Missing enabled"
        assert "max_trade_usd" in data, "Missing max_trade_usd"
        assert "min_confidence" in data, "Missing min_confidence"
        assert "allowed_symbols" in data, "Missing allowed_symbols"
        assert "allowed_directions" in data, "Missing allowed_directions"
        assert "market_type" in data, "Missing market_type"
        assert "cooldown_seconds" in data, "Missing cooldown_seconds"
        assert "scheduler_enabled" in data, "Missing scheduler_enabled"
        assert "scheduler_interval_minutes" in data, "Missing scheduler_interval_minutes"
        assert "scheduler_symbols" in data, "Missing scheduler_symbols"
        
        print(f"✓ Auto-exec config: enabled={data['enabled']}, scheduler_enabled={data['scheduler_enabled']}")
    
    def test_patch_auto_exec_config_disable(self, auth_session):
        """PATCH /api/dungeon/auto-exec/config with {enabled: false} persists"""
        # Patch to disable
        response = auth_session.patch(f"{BASE_URL}/api/dungeon/auto-exec/config", json={
            "enabled": False
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("enabled") == False, "enabled should be False after patch"
        
        # Verify persistence by re-fetching
        verify_resp = auth_session.get(f"{BASE_URL}/api/dungeon/auto-exec/config")
        assert verify_resp.json().get("enabled") == False, "enabled should persist as False"
        
        print("✓ Auto-exec config PATCH persists enabled=false")


# ============== AUTO-EXEC TRADES (services/auto_exec.py) ==============

class TestAutoExecTrades:
    """Test /api/dungeon/auto-exec/trades - returns array"""
    
    def test_get_auto_exec_trades(self, auth_session):
        """GET /api/dungeon/auto-exec/trades returns array"""
        response = auth_session.get(f"{BASE_URL}/api/dungeon/auto-exec/trades")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "trades" in data, "Missing trades field"
        assert isinstance(data["trades"], list), "trades should be a list"
        
        print(f"✓ Auto-exec trades: {len(data['trades'])} trades")


# ============== SIGNALS ENDPOINTS (services/signal_tracker.py) ==============

class TestSignalsEndpoints:
    """Test /api/signals/* - uses services.signal_tracker"""
    
    def test_signals_accuracy(self):
        """GET /api/signals/accuracy returns accuracy data"""
        response = requests.get(f"{BASE_URL}/api/signals/accuracy")
        assert response.status_code == 200
        data = response.json()
        
        assert "win_rate" in data
        assert "total_signals" in data
        assert "by_symbol" in data
        assert "by_direction" in data
        assert "pending" in data
        
        print(f"✓ Signals accuracy: {data['win_rate']}% win rate, {data['total_signals']} total")
    
    def test_signals_pending(self):
        """GET /api/signals/pending returns pending signals"""
        response = requests.get(f"{BASE_URL}/api/signals/pending")
        assert response.status_code == 200
        data = response.json()
        
        assert "pending" in data
        assert isinstance(data["pending"], list)
        
        print(f"✓ Signals pending: {len(data['pending'])} pending")
    
    def test_signals_intelligence(self):
        """GET /api/signals/intelligence returns per-symbol intelligence"""
        response = requests.get(f"{BASE_URL}/api/signals/intelligence")
        assert response.status_code == 200
        data = response.json()
        
        assert "intelligence" in data
        assert isinstance(data["intelligence"], list)
        
        print(f"✓ Signals intelligence: {len(data['intelligence'])} entries")


# ============== DASHBOARD DUNGEON OVERVIEW (lazy import fix) ==============

class TestDashboardDungeonOverview:
    """Test /api/dashboard/dungeon-overview - uses lazy import of get_auto_exec_config"""
    
    def test_dungeon_overview_structure(self):
        """GET /api/dashboard/dungeon-overview must show 24 agents + recent scheduler info"""
        response = requests.get(f"{BASE_URL}/api/dashboard/dungeon-overview")
        assert response.status_code == 200
        data = response.json()
        
        # Verify required fields
        assert "agents" in data, "Missing agents"
        assert "latest_predictions" in data, "Missing latest_predictions"
        assert "scheduler" in data, "Missing scheduler"
        assert "recent_scheduler_runs" in data, "Missing recent_scheduler_runs"
        
        # Verify 24 agents
        assert len(data["agents"]) == 24, f"Expected 24 agents, got {len(data['agents'])}"
        
        # Verify scheduler info structure
        scheduler = data["scheduler"]
        assert "enabled" in scheduler
        assert "auto_exec_enabled" in scheduler
        assert "interval_minutes" in scheduler
        assert "total_auto_trades" in scheduler
        
        print(f"✓ Dungeon overview: {len(data['agents'])} agents, scheduler_enabled={scheduler['enabled']}")


# ============== PAYMENTS 404 FIX VERIFICATION ==============

class TestPayments404Fix:
    """CRITICAL: Verify 500→404 fix for invalid Stripe session_id"""
    
    def test_invalid_session_returns_404(self, auth_session):
        """GET /api/payments/status/invalid_xyz → HTTP 404"""
        response = auth_session.get(f"{BASE_URL}/api/payments/status/invalid_xyz")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data
        assert "not found" in data["detail"].lower()
        print("✓ CRITICAL FIX VERIFIED: Invalid session returns 404")


# ============== EXCHANGE ENDPOINTS ==============

class TestExchangeEndpoints:
    """Test exchange endpoints (balance, tickers, positions)"""
    
    def test_exchange_status(self, auth_session):
        """GET /api/exchange/status returns Bitget configured"""
        response = auth_session.get(f"{BASE_URL}/api/exchange/status")
        assert response.status_code == 200
        data = response.json()
        assert "configured" in data
        print(f"✓ Exchange status: configured={data['configured']}")
    
    def test_exchange_tickers(self, auth_session):
        """GET /api/exchange/tickers returns ticker data"""
        response = auth_session.get(f"{BASE_URL}/api/exchange/tickers?symbols=BTC/USDT,ETH/USDT&market_type=spot")
        assert response.status_code == 200
        data = response.json()
        assert "tickers" in data
        print(f"✓ Exchange tickers: {len(data['tickers'])} tickers")
    
    def test_exchange_balance(self, auth_session):
        """GET /api/exchange/balance returns balance"""
        response = auth_session.get(f"{BASE_URL}/api/exchange/balance?market_type=spot")
        assert response.status_code == 200
        data = response.json()
        # Balance can be empty dict or have balances
        assert isinstance(data, dict)
        print("✓ Exchange balance endpoint working")
    
    def test_exchange_positions(self, auth_session):
        """GET /api/exchange/positions returns positions"""
        response = auth_session.get(f"{BASE_URL}/api/exchange/positions")
        assert response.status_code == 200
        data = response.json()
        assert "positions" in data
        print(f"✓ Exchange positions: {len(data['positions'])} positions")


# ============== DUNGEON AGENTS ==============

class TestDungeonAgents:
    """Test dungeon agent endpoints"""
    
    def test_dungeon_agents_count(self):
        """GET /api/dungeon/agents returns 24 agents"""
        response = requests.get(f"{BASE_URL}/api/dungeon/agents")
        assert response.status_code == 200
        data = response.json()
        assert "agents" in data
        assert len(data["agents"]) == 24
        print(f"✓ Dungeon agents: {len(data['agents'])} agents")
    
    def test_dungeon_prediction(self):
        """GET /api/dungeon/prediction returns swarm prediction"""
        response = requests.get(f"{BASE_URL}/api/dungeon/prediction?symbol=BTCUSDT&auto_exec=false")
        assert response.status_code == 200
        data = response.json()
        assert "direction" in data
        assert "confidence" in data
        assert "votes" in data
        print(f"✓ Dungeon prediction: {data['direction']} @ {data['confidence']*100:.1f}%")


# ============== WEBSOCKET TOKEN ==============

class TestWebSocketToken:
    """Test WebSocket token generation"""
    
    def test_ws_token(self, auth_session):
        """GET /api/ws-token returns token"""
        response = auth_session.get(f"{BASE_URL}/api/ws-token")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "token" in data
        assert len(data["token"]) > 0
        print("✓ WebSocket token generated")


# ============== AUTH LOGOUT (run last to not invalidate session) ==============

class TestZAuthLogout:
    """Test auth logout - run last to not invalidate session for other tests"""
    
    def test_auth_logout(self, auth_session):
        """POST /api/auth/logout clears session"""
        response = auth_session.post(f"{BASE_URL}/api/auth/logout")
        assert response.status_code == 200
        print("✓ Auth logout working")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
