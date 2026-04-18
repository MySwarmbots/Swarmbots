"""
Iteration 11 Refactor Tests - Extended router extraction + 500→404 fix
Tests the 6 new routers: profile, notifications, payments, signals, engine, dungeon
CRITICAL: Verifies /api/payments/status/{invalid} returns 404 (not 500)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = os.getenv("TEST_ADMIN_EMAIL", "admin@mirofish.io")
ADMIN_PASSWORD = os.getenv("TEST_ADMIN_PASSWORD", "admin123")


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


# ============== CRITICAL FIX VERIFICATION ==============

class TestPaymentStatus404Fix:
    """CRITICAL: Verify 500→404 fix for invalid Stripe session_id"""
    
    def test_invalid_session_returns_404(self, auth_session):
        """GET /api/payments/status/cs_invalid_xxx MUST return 404 (not 500)"""
        response = auth_session.get(f"{BASE_URL}/api/payments/status/cs_invalid_xxx")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data
        assert "not found" in data["detail"].lower()
        print("✓ CRITICAL FIX VERIFIED: Invalid session returns 404 with 'not found' message")
    
    def test_random_invalid_session_returns_404(self, auth_session):
        """GET /api/payments/status/random_garbage_id returns 404"""
        response = auth_session.get(f"{BASE_URL}/api/payments/status/random_garbage_id_12345")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Random invalid session ID returns 404")
    
    def test_empty_session_id_returns_404(self, auth_session):
        """GET /api/payments/status/empty returns 404"""
        response = auth_session.get(f"{BASE_URL}/api/payments/status/empty")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Empty-like session ID returns 404")


# ============== PROFILE ROUTES (routes/profile.py) ==============

class TestProfileRoutes:
    """Tests for /api/profile and /api/telegram/* endpoints"""
    
    def test_get_profile(self, auth_session):
        """GET /api/profile returns user profile"""
        response = auth_session.get(f"{BASE_URL}/api/profile")
        assert response.status_code == 200
        data = response.json()
        assert "email" in data
        assert data["email"] == ADMIN_EMAIL
        assert "telegram_chat_id" in data
        assert "email_notifications" in data
        assert "telegram_notifications" in data
        print(f"✓ Profile GET: {data['email']}, telegram_chat_id={data.get('telegram_chat_id')}")
    
    def test_patch_profile(self, auth_session):
        """PATCH /api/profile updates profile settings"""
        response = auth_session.patch(f"{BASE_URL}/api/profile", json={
            "email_notifications": True,
            "telegram_notifications": True
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("message") == "Profile updated"
        print("✓ Profile PATCH working")
    
    def test_telegram_unlink(self, auth_session):
        """POST /api/telegram/unlink removes telegram link"""
        response = auth_session.post(f"{BASE_URL}/api/telegram/unlink")
        assert response.status_code == 200
        data = response.json()
        assert data.get("message") == "Telegram unlinked"
        print("✓ Telegram unlink working")
    
    def test_telegram_test_without_link(self, auth_session):
        """POST /api/telegram/test without linked telegram returns 400"""
        # First unlink to ensure no telegram
        auth_session.post(f"{BASE_URL}/api/telegram/unlink")
        response = auth_session.post(f"{BASE_URL}/api/telegram/test")
        assert response.status_code == 400
        data = response.json()
        assert "not linked" in data.get("detail", "").lower()
        print("✓ Telegram test correctly rejects when not linked")


# ============== NOTIFICATIONS ROUTES (routes/notifications.py) ==============

class TestNotificationsRoutes:
    """Tests for /api/notifications/* endpoints"""
    
    def test_get_notifications(self, auth_session):
        """GET /api/notifications returns notifications list"""
        response = auth_session.get(f"{BASE_URL}/api/notifications")
        assert response.status_code == 200
        data = response.json()
        assert "notifications" in data
        assert isinstance(data["notifications"], list)
        print(f"✓ Notifications GET: {len(data['notifications'])} notifications")
    
    def test_get_unread_count(self, auth_session):
        """GET /api/notifications/unread-count returns count"""
        response = auth_session.get(f"{BASE_URL}/api/notifications/unread-count")
        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        assert isinstance(data["count"], int)
        print(f"✓ Unread count: {data['count']}")
    
    def test_create_notification(self, auth_session):
        """POST /api/notifications creates a notification"""
        response = auth_session.post(f"{BASE_URL}/api/notifications", json={
            "title": "Test Notification",
            "message": "This is a test from iteration 11",
            "type": "info"
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("message") == "Notification created"
        print("✓ Notification created successfully")
    
    def test_mark_all_read(self, auth_session):
        """POST /api/notifications/mark-all-read marks all as read"""
        response = auth_session.post(f"{BASE_URL}/api/notifications/mark-all-read")
        assert response.status_code == 200
        data = response.json()
        assert data.get("message") == "All marked as read"
        print("✓ Mark all read working")


# ============== PAYMENTS ROUTES (routes/payments.py) ==============

class TestPaymentsRoutes:
    """Tests for /api/payments/* endpoints"""
    
    def test_get_plans(self, auth_session):
        """GET /api/payments/plans returns subscription plans"""
        response = auth_session.get(f"{BASE_URL}/api/payments/plans")
        assert response.status_code == 200
        data = response.json()
        assert "plans" in data
        assert "starter" in data["plans"]
        assert "pro" in data["plans"]
        assert "enterprise" in data["plans"]
        # Verify plan structure
        starter = data["plans"]["starter"]
        assert starter["amount"] == 29.00
        assert starter["agents"] == 3
        print(f"✓ Payment plans: {list(data['plans'].keys())}")
    
    def test_checkout_invalid_plan(self, auth_session):
        """POST /api/payments/checkout with invalid plan returns 400"""
        response = auth_session.post(f"{BASE_URL}/api/payments/checkout", json={
            "plan": "invalid_plan",
            "origin_url": "https://example.com"
        })
        assert response.status_code == 400
        data = response.json()
        assert "Invalid plan" in data.get("detail", "")
        print("✓ Checkout rejects invalid plan")


# ============== SIGNALS ROUTES (routes/signals.py) ==============

class TestSignalsRoutes:
    """Tests for /api/signals/* endpoints"""
    
    def test_signals_accuracy(self):
        """GET /api/signals/accuracy returns accuracy data"""
        response = requests.get(f"{BASE_URL}/api/signals/accuracy")
        assert response.status_code == 200
        data = response.json()
        assert "win_rate" in data
        assert "total_signals" in data
        assert "by_symbol" in data
        assert "by_direction" in data
        print(f"✓ Signals accuracy: {data['win_rate']}% win rate")
    
    def test_signals_pending(self):
        """GET /api/signals/pending returns pending signals"""
        response = requests.get(f"{BASE_URL}/api/signals/pending")
        assert response.status_code == 200
        data = response.json()
        assert "pending" in data
        assert isinstance(data["pending"], list)
        print(f"✓ Pending signals: {len(data['pending'])}")
    
    def test_signals_intelligence(self):
        """GET /api/signals/intelligence returns per-symbol intelligence"""
        response = requests.get(f"{BASE_URL}/api/signals/intelligence")
        assert response.status_code == 200
        data = response.json()
        assert "intelligence" in data
        assert isinstance(data["intelligence"], list)
        print(f"✓ Signal intelligence: {len(data['intelligence'])} entries")


# ============== ENGINE ROUTES (routes/engine.py) ==============

class TestEngineRoutes:
    """Tests for /api/engine/* endpoints"""
    
    def test_engine_swarm(self, auth_session):
        """GET /api/engine/swarm returns swarm state"""
        response = auth_session.get(f"{BASE_URL}/api/engine/swarm")
        assert response.status_code == 200
        data = response.json()
        assert "consensus" in data
        print(f"✓ Engine swarm: consensus={data['consensus']}")
    
    def test_engine_optimizer(self, auth_session):
        """GET /api/engine/optimizer returns optimizer state"""
        response = auth_session.get(f"{BASE_URL}/api/engine/optimizer")
        assert response.status_code == 200
        data = response.json()
        # Should have optimizer state fields
        assert isinstance(data, dict)
        print("✓ Engine optimizer endpoint working")
    
    def test_engine_predictions(self, auth_session):
        """GET /api/engine/predictions returns prediction log"""
        response = auth_session.get(f"{BASE_URL}/api/engine/predictions")
        assert response.status_code == 200
        data = response.json()
        assert "predictions" in data
        print(f"✓ Engine predictions: {len(data['predictions'])} predictions")
    
    def test_engine_positions(self, auth_session):
        """GET /api/engine/positions returns positions"""
        response = auth_session.get(f"{BASE_URL}/api/engine/positions")
        assert response.status_code == 200
        data = response.json()
        assert "positions" in data
        print(f"✓ Engine positions: {len(data['positions'])} positions")
    
    def test_engine_pnl(self, auth_session):
        """GET /api/engine/pnl returns realized PnL"""
        response = auth_session.get(f"{BASE_URL}/api/engine/pnl")
        assert response.status_code == 200
        data = response.json()
        assert "realized_pnl_usd" in data
        print(f"✓ Engine PnL: ${data['realized_pnl_usd']}")
    
    def test_engine_orders(self, auth_session):
        """GET /api/engine/orders returns order log"""
        response = auth_session.get(f"{BASE_URL}/api/engine/orders")
        assert response.status_code == 200
        data = response.json()
        assert "orders" in data
        print(f"✓ Engine orders: {len(data['orders'])} orders")
    
    def test_engine_trades(self, auth_session):
        """GET /api/engine/trades returns trade log"""
        response = auth_session.get(f"{BASE_URL}/api/engine/trades")
        assert response.status_code == 200
        data = response.json()
        assert "trades" in data
        print(f"✓ Engine trades: {len(data['trades'])} trades")
    
    def test_engine_config_get(self, auth_session):
        """GET /api/engine/config returns engine configuration"""
        response = auth_session.get(f"{BASE_URL}/api/engine/config")
        assert response.status_code == 200
        data = response.json()
        assert "base_confidence_threshold" in data
        assert "top_signal_count" in data
        assert "max_position_notional_usd" in data
        assert "kill_switch" in data
        print(f"✓ Engine config: threshold={data['base_confidence_threshold']}, kill_switch={data['kill_switch']}")


# ============== DUNGEON ROUTES (routes/dungeon.py) ==============

class TestDungeonRoutes:
    """Tests for /api/dungeon/* endpoints"""
    
    def test_dungeon_agents(self):
        """GET /api/dungeon/agents returns 24 agents"""
        response = requests.get(f"{BASE_URL}/api/dungeon/agents")
        assert response.status_code == 200
        data = response.json()
        assert "agents" in data
        assert len(data["agents"]) == 24
        print(f"✓ Dungeon agents: {len(data['agents'])} agents")
    
    def test_dungeon_agent_by_id(self):
        """GET /api/dungeon/agents/{id} returns specific agent"""
        # First get all agents to get a valid ID
        agents_resp = requests.get(f"{BASE_URL}/api/dungeon/agents")
        agents = agents_resp.json()["agents"]
        agent_id = agents[0]["agent_id"]  # Use agent_id field
        
        response = requests.get(f"{BASE_URL}/api/dungeon/agents/{agent_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["agent_id"] == agent_id
        print(f"✓ Dungeon agent by ID: {data['name']}")
    
    def test_dungeon_agent_not_found(self):
        """GET /api/dungeon/agents/{invalid} returns 404"""
        response = requests.get(f"{BASE_URL}/api/dungeon/agents/invalid_agent_id")
        assert response.status_code == 404
        print("✓ Dungeon agent 404 for invalid ID")
    
    def test_dungeon_debate(self):
        """GET /api/dungeon/debate returns debate stances"""
        response = requests.get(f"{BASE_URL}/api/dungeon/debate?symbol=BTCUSDT")
        assert response.status_code == 200
        data = response.json()
        assert "debate" in data
        assert "symbol" in data
        assert len(data["debate"]) > 0
        print(f"✓ Dungeon debate: {len(data['debate'])} stances")
    
    def test_dungeon_prediction(self):
        """GET /api/dungeon/prediction returns swarm prediction"""
        response = requests.get(f"{BASE_URL}/api/dungeon/prediction?symbol=BTCUSDT&auto_exec=false")
        assert response.status_code == 200
        data = response.json()
        assert "direction" in data
        assert "confidence" in data
        assert "votes" in data
        assert data["direction"] in ["long_bias", "short_bias", "wait"]
        print(f"✓ Dungeon prediction: {data['direction']} @ {data['confidence']*100:.1f}%")
    
    def test_dungeon_predictions_history(self):
        """GET /api/dungeon/predictions returns prediction history"""
        response = requests.get(f"{BASE_URL}/api/dungeon/predictions")
        assert response.status_code == 200
        data = response.json()
        assert "predictions" in data
        print(f"✓ Dungeon predictions history: {len(data['predictions'])} predictions")
    
    def test_dungeon_debates_history(self):
        """GET /api/dungeon/debates returns debate history"""
        response = requests.get(f"{BASE_URL}/api/dungeon/debates")
        assert response.status_code == 200
        data = response.json()
        assert "debates" in data
        print(f"✓ Dungeon debates history: {len(data['debates'])} debates")
    
    def test_auto_exec_config_get(self, auth_session):
        """GET /api/dungeon/auto-exec/config returns config"""
        response = auth_session.get(f"{BASE_URL}/api/dungeon/auto-exec/config")
        assert response.status_code == 200
        data = response.json()
        assert "enabled" in data
        assert "min_confidence" in data
        print(f"✓ Auto-exec config: enabled={data['enabled']}, min_confidence={data['min_confidence']}")
    
    def test_auto_exec_trades(self, auth_session):
        """GET /api/dungeon/auto-exec/trades returns trade history"""
        response = auth_session.get(f"{BASE_URL}/api/dungeon/auto-exec/trades")
        assert response.status_code == 200
        data = response.json()
        assert "trades" in data
        print(f"✓ Auto-exec trades: {len(data['trades'])} trades")
    
    def test_dungeon_rollout(self):
        """GET /api/dungeon/rollout returns rollout summary"""
        response = requests.get(f"{BASE_URL}/api/dungeon/rollout")
        assert response.status_code == 200
        data = response.json()
        assert "stage" in data
        print(f"✓ Dungeon rollout: stage={data['stage']}")
    
    def test_dungeon_rollout_audit(self):
        """GET /api/dungeon/rollout/audit returns audit log"""
        response = requests.get(f"{BASE_URL}/api/dungeon/rollout/audit")
        assert response.status_code == 200
        data = response.json()
        assert "audit" in data
        print(f"✓ Dungeon rollout audit: {len(data['audit'])} entries")


# ============== SCHEDULER BACKGROUND TASK ==============

class TestSchedulerBackgroundTask:
    """Verify scheduler is running and creating entries"""
    
    def test_scheduler_status(self):
        """GET /api/dungeon/scheduler/status shows scheduler running"""
        response = requests.get(f"{BASE_URL}/api/dungeon/scheduler/status")
        assert response.status_code == 200
        data = response.json()
        assert data["scheduler_enabled"] is True
        assert data["interval_minutes"] == 5
        assert len(data["symbols"]) == 6
        print(f"✓ Scheduler: enabled={data['scheduler_enabled']}, interval={data['interval_minutes']}min, symbols={data['symbols']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
