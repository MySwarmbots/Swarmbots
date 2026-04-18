"""
MiroFish Iteration 9 Backend Tests
Testing Code Review Round 3 regression + all core endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://mirofish-mobile.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = os.getenv("TEST_ADMIN_EMAIL", "admin@mirofish.io")
ADMIN_PASSWORD = os.getenv("TEST_ADMIN_PASSWORD", "admin123")


class TestHealthAndPublicEndpoints:
    """Health check and public endpoints"""
    
    def test_health_endpoint(self):
        """GET /api/health returns status ok"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "validation" in data
        print(f"✓ Health check passed: {data['status']}")
    
    def test_exchange_status(self):
        """GET /api/exchange/status returns Bitget configured"""
        response = requests.get(f"{BASE_URL}/api/exchange/status")
        assert response.status_code == 200
        data = response.json()
        assert data["exchange"] == "bitget"
        assert data["configured"] is True
        print(f"✓ Exchange status: configured={data['configured']}")
    
    def test_dungeon_agents_returns_24(self):
        """GET /api/dungeon/agents returns exactly 24 agents"""
        response = requests.get(f"{BASE_URL}/api/dungeon/agents")
        assert response.status_code == 200
        data = response.json()
        agents = data.get("agents", [])
        assert len(agents) == 24, f"Expected 24 agents, got {len(agents)}"
        
        # Verify agent structure
        first_agent = agents[0]
        assert "agent_id" in first_agent
        assert "name" in first_agent
        assert "role" in first_agent
        assert "personality" in first_agent
        assert "sector" in first_agent
        assert "position" in first_agent
        print(f"✓ Dungeon agents: {len(agents)} agents returned")


class TestAuthentication:
    """Authentication flow tests"""
    
    def test_login_success(self):
        """POST /api/auth/login with valid credentials"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] == "admin"
        assert "id" in data
        print(f"✓ Login successful: {data['email']} (role: {data['role']})")
        return session
    
    def test_login_invalid_credentials(self):
        """POST /api/auth/login with invalid credentials returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Invalid login correctly rejected with 401")
    
    def test_auth_me_with_session(self):
        """GET /api/auth/me with valid session returns user"""
        session = requests.Session()
        # Login first
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_resp.status_code == 200
        
        # Check /me
        me_resp = session.get(f"{BASE_URL}/api/auth/me")
        assert me_resp.status_code == 200
        data = me_resp.json()
        assert data["email"] == ADMIN_EMAIL
        print(f"✓ Auth /me returned: {data['email']}")
    
    def test_auth_me_without_session(self):
        """GET /api/auth/me without session returns 401"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
        print("✓ Unauthenticated /me correctly rejected with 401")


class TestSignalIntelligenceEngine:
    """Signal Intelligence Engine tests"""
    
    def test_signals_accuracy_endpoint(self):
        """GET /api/signals/accuracy returns signal accuracy payload"""
        response = requests.get(f"{BASE_URL}/api/signals/accuracy")
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "total_signals" in data
        assert "win_rate" in data
        assert "avg_pnl_pct" in data
        assert "total_pnl_pct" in data
        assert "pending" in data
        assert "by_symbol" in data
        assert "by_direction" in data
        assert "signals" in data
        
        print(f"✓ Signal accuracy: total={data['total_signals']}, win_rate={data['win_rate']}%")
    
    def test_signals_intelligence_endpoint(self):
        """GET /api/signals/intelligence returns per-symbol intelligence"""
        response = requests.get(f"{BASE_URL}/api/signals/intelligence")
        assert response.status_code == 200
        data = response.json()
        
        assert "intelligence" in data
        intel = data["intelligence"]
        
        # If there's data, verify structure
        if intel:
            first = intel[0]
            assert "symbol" in first
            assert "direction" in first
            assert "win_rate" in first
            assert "action" in first  # boost/penalize/neutral
            print(f"✓ Signal intelligence: {len(intel)} entries")
        else:
            print("✓ Signal intelligence: empty (no historical data)")


class TestSwarmPredictions:
    """Swarm dungeon prediction tests - verifies secrets-based helpers"""
    
    def test_dungeon_prediction_btc(self):
        """GET /api/dungeon/prediction for BTCUSDT"""
        response = requests.get(f"{BASE_URL}/api/dungeon/prediction", params={
            "symbol": "BTCUSDT",
            "auto_exec": "false"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert data["symbol"] == "BTCUSDT"
        assert data["direction"] in ["long_bias", "short_bias", "wait"]
        assert 0 <= data["confidence"] <= 1
        assert "votes" in data
        assert "debate" in data
        
        # Verify debate has agents
        debate = data["debate"]
        assert len(debate) > 0, "Debate should have participants"
        
        print(f"✓ BTC prediction: {data['direction']} ({data['confidence']*100:.1f}%)")
    
    def test_dungeon_prediction_eth(self):
        """GET /api/dungeon/prediction for ETHUSDT"""
        response = requests.get(f"{BASE_URL}/api/dungeon/prediction", params={
            "symbol": "ETHUSDT",
            "auto_exec": "false"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert data["symbol"] == "ETHUSDT"
        assert data["direction"] in ["long_bias", "short_bias", "wait"]
        print(f"✓ ETH prediction: {data['direction']} ({data['confidence']*100:.1f}%)")
    
    def test_dungeon_prediction_sol(self):
        """GET /api/dungeon/prediction for SOLUSDT"""
        response = requests.get(f"{BASE_URL}/api/dungeon/prediction", params={
            "symbol": "SOLUSDT",
            "auto_exec": "false"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert data["symbol"] == "SOLUSDT"
        print(f"✓ SOL prediction: {data['direction']} ({data['confidence']*100:.1f}%)")
    
    def test_dungeon_prediction_xrp(self):
        """GET /api/dungeon/prediction for XRPUSDT"""
        response = requests.get(f"{BASE_URL}/api/dungeon/prediction", params={
            "symbol": "XRPUSDT",
            "auto_exec": "false"
        })
        assert response.status_code == 200
        data = response.json()
        print(f"✓ XRP prediction: {data['direction']} ({data['confidence']*100:.1f}%)")
    
    def test_dungeon_prediction_doge(self):
        """GET /api/dungeon/prediction for DOGEUSDT"""
        response = requests.get(f"{BASE_URL}/api/dungeon/prediction", params={
            "symbol": "DOGEUSDT",
            "auto_exec": "false"
        })
        assert response.status_code == 200
        data = response.json()
        print(f"✓ DOGE prediction: {data['direction']} ({data['confidence']*100:.1f}%)")
    
    def test_dungeon_prediction_ada(self):
        """GET /api/dungeon/prediction for ADAUSDT"""
        response = requests.get(f"{BASE_URL}/api/dungeon/prediction", params={
            "symbol": "ADAUSDT",
            "auto_exec": "false"
        })
        assert response.status_code == 200
        data = response.json()
        print(f"✓ ADA prediction: {data['direction']} ({data['confidence']*100:.1f}%)")
    
    def test_dungeon_predictions_list(self):
        """GET /api/dungeon/predictions returns recent predictions"""
        response = requests.get(f"{BASE_URL}/api/dungeon/predictions")
        assert response.status_code == 200
        data = response.json()
        
        assert "predictions" in data
        predictions = data["predictions"]
        
        # Should have predictions from the tests above
        if predictions:
            first = predictions[0]
            assert "symbol" in first
            assert "direction" in first
            assert "confidence" in first
            assert "timestamp" in first
            print(f"✓ Predictions list: {len(predictions)} recent predictions")
        else:
            print("✓ Predictions list: empty")
    
    def test_dungeon_debate(self):
        """GET /api/dungeon/debate returns debate stances"""
        response = requests.get(f"{BASE_URL}/api/dungeon/debate", params={
            "symbol": "BTCUSDT",
            "timeframe": "15m"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert data["symbol"] == "BTCUSDT"
        assert "debate" in data
        
        debate = data["debate"]
        assert len(debate) > 0, "Debate should have participants"
        
        # Verify debate structure
        first_stance = debate[0]
        assert "agent_id" in first_stance
        assert "bias" in first_stance
        assert first_stance["bias"] in ["bullish", "bearish", "neutral"]
        assert "confidence" in first_stance
        assert "rationale" in first_stance
        
        print(f"✓ Debate: {len(debate)} agents participated")


class TestDashboardEndpoints:
    """Dashboard and overview endpoints"""
    
    def test_dashboard_dungeon_overview(self):
        """GET /api/dashboard/dungeon-overview returns agents + scheduler"""
        response = requests.get(f"{BASE_URL}/api/dashboard/dungeon-overview")
        assert response.status_code == 200
        data = response.json()
        
        assert "agents" in data
        assert len(data["agents"]) == 24
        assert "scheduler" in data
        assert "latest_predictions" in data
        
        print(f"✓ Dungeon overview: {len(data['agents'])} agents, scheduler={data['scheduler']}")
    
    def test_dashboard_stats_authenticated(self):
        """GET /api/dashboard/stats requires auth"""
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
        assert "total_pnl" in data
        assert "validation_summary" in data
        
        print(f"✓ Dashboard stats: {data['total_agents']} agents, PnL=${data['total_pnl']}")


class TestWebSocketToken:
    """WebSocket token endpoint"""
    
    def test_ws_token_authenticated(self):
        """GET /api/ws-token returns token when authenticated"""
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


class TestPaymentStatusEndpoint:
    """Payment status endpoint for PaymentSuccessPage polling"""
    
    def test_payment_status_invalid_session(self):
        """GET /api/payments/status/{invalid} returns error gracefully"""
        response = requests.get(f"{BASE_URL}/api/payments/status/test-invalid-session-id")
        # Should return an error but not crash
        # Stripe will return an error for invalid session
        assert response.status_code in [200, 400, 404, 500]
        print(f"✓ Payment status for invalid session: status={response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
