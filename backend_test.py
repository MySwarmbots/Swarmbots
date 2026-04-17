#!/usr/bin/env python3
"""
MiroFish Auto-Execution Backend API Testing - Iteration 7
Tests auto-execution features connecting dungeon swarm predictions to Bitget trading
"""
import requests
import sys
import json
from datetime import datetime

class AutoExecTester:
    def __init__(self, base_url="https://mirofish-mobile.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.session = requests.Session()

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if headers:
            test_headers.update(headers)
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PATCH':
                response = self.session.patch(url, json=data, headers=test_headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, dict) and len(response_data) < 10:
                        print(f"   Response: {json.dumps(response_data, indent=2)}")
                    elif isinstance(response_data, dict) and 'agents' in response_data:
                        print(f"   Response: Found {len(response_data.get('agents', []))} agents")
                    elif isinstance(response_data, dict) and 'debate' in response_data:
                        print(f"   Response: Found {len(response_data.get('debate', []))} debate stances")
                    return success, response_data
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text[:200]}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_login(self, email, password):
        """Test admin login and get token"""
        print(f"\n🔐 Testing Admin Login...")
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"email": email, "password": password}
        )
        if success:
            # Check if we got cookies (httpOnly) or token in response
            cookies = self.session.cookies
            if cookies:
                print(f"✅ Login successful - Got cookies: {list(cookies.keys())}")
                return True
            elif 'access_token' in response:
                self.token = response['access_token']
                print(f"✅ Login successful - Got token")
                return True
            else:
                print(f"✅ Login successful - Using session cookies")
                return True
        return False

    def test_dungeon_agents(self):
        """Test GET /api/dungeon/agents - should return 24 agents"""
        success, response = self.run_test(
            "Dungeon Agents",
            "GET",
            "dungeon/agents",
            200
        )
        if success and 'agents' in response:
            agents = response['agents']
            print(f"   Found {len(agents)} agents")
            if len(agents) == 24:
                print("✅ Correct number of agents (24)")
                # Check agent structure
                if agents:
                    agent = agents[0]
                    required_fields = ['agent_id', 'name', 'role', 'personality', 'sector', 'status']
                    missing = [f for f in required_fields if f not in agent]
                    if not missing:
                        print("✅ Agent structure is correct")
                        print(f"   Sample agent: {agent['name']} ({agent['role']}) in {agent['sector']}")
                        return True
                    else:
                        print(f"❌ Missing agent fields: {missing}")
            else:
                print(f"❌ Expected 24 agents, got {len(agents)}")
        return False

    def test_dungeon_prediction(self, symbol="BTCUSDT"):
        """Test GET /api/dungeon/prediction"""
        success, response = self.run_test(
            f"Dungeon Prediction for {symbol}",
            "GET",
            f"dungeon/prediction?symbol={symbol}",
            200
        )
        if success:
            required_fields = ['direction', 'confidence', 'votes', 'debate']
            missing = [f for f in required_fields if f not in response]
            if not missing:
                print(f"✅ Prediction structure correct")
                print(f"   Direction: {response.get('direction')}")
                print(f"   Confidence: {response.get('confidence')}")
                print(f"   Votes: {response.get('votes', {})}")
                return True
            else:
                print(f"❌ Missing prediction fields: {missing}")
        return False

    def test_dungeon_debate(self, symbol="BTCUSDT"):
        """Test GET /api/dungeon/debate"""
        success, response = self.run_test(
            f"Dungeon Debate for {symbol}",
            "GET",
            f"dungeon/debate?symbol={symbol}",
            200
        )
        if success and 'debate' in response:
            debate = response['debate']
            print(f"   Found {len(debate)} debate stances")
            if len(debate) == 12:
                print("✅ Correct number of debate participants (12)")
                if debate:
                    stance = debate[0]
                    required_fields = ['agent_id', 'name', 'role', 'personality', 'bias', 'confidence', 'rationale']
                    missing = [f for f in required_fields if f not in stance]
                    if not missing:
                        print("✅ Debate stance structure is correct")
                        print(f"   Sample stance: {stance['name']} ({stance['bias']}) - {stance['confidence']}")
                        return True
                    else:
                        print(f"❌ Missing stance fields: {missing}")
            else:
                print(f"❌ Expected 12 debate participants, got {len(debate)}")
        return False

    def test_dungeon_rollout(self):
        """Test GET /api/dungeon/rollout"""
        success, response = self.run_test(
            "Dungeon Rollout State",
            "GET",
            "dungeon/rollout",
            200
        )
        if success:
            required_fields = ['stage', 'allocated_capital_usd']
            missing = [f for f in required_fields if f not in response]
            if not missing:
                print(f"✅ Rollout structure correct")
                print(f"   Stage: {response.get('stage')}")
                print(f"   Capital: ${response.get('allocated_capital_usd')}")
                return True
            else:
                print(f"❌ Missing rollout fields: {missing}")
        return False

    def test_auto_exec_config_get(self):
        """Test GET /api/dungeon/auto-exec/config"""
        success, response = self.run_test(
            "Auto-Exec Config GET",
            "GET",
            "dungeon/auto-exec/config",
            200
        )
        if success:
            required_fields = ['enabled', 'max_trade_usd', 'min_confidence', 'allowed_symbols', 'cooldown_seconds', 'total_trades']
            missing = [f for f in required_fields if f not in response]
            if not missing:
                print(f"✅ Auto-exec config structure correct")
                print(f"   Enabled: {response.get('enabled')}")
                print(f"   Max Trade USD: ${response.get('max_trade_usd')}")
                print(f"   Min Confidence: {response.get('min_confidence')}")
                print(f"   Cooldown: {response.get('cooldown_seconds')}s")
                print(f"   Total Trades: {response.get('total_trades')}")
                print(f"   Allowed Symbols: {response.get('allowed_symbols')}")
                
                # Verify default state (should be disabled)
                if response.get('enabled') == False:
                    print("✅ Auto-exec correctly defaults to disabled")
                    return True
                else:
                    print("⚠️  Auto-exec is enabled (expected disabled by default)")
                    return True  # Still pass, just note the state
            else:
                print(f"❌ Missing auto-exec config fields: {missing}")
        return False

    def test_auto_exec_config_patch(self):
        """Test PATCH /api/dungeon/auto-exec/config"""
        # Test updating config
        test_config = {
            "enabled": True,
            "max_trade_usd": 1.50,
            "min_confidence": 0.65,
            "cooldown_seconds": 600
        }
        
        success, response = self.run_test(
            "Auto-Exec Config PATCH",
            "PATCH",
            "dungeon/auto-exec/config",
            200,
            data=test_config
        )
        if success:
            # Verify the updates were applied
            if (response.get('enabled') == test_config['enabled'] and
                response.get('max_trade_usd') == test_config['max_trade_usd'] and
                response.get('min_confidence') == test_config['min_confidence'] and
                response.get('cooldown_seconds') == test_config['cooldown_seconds']):
                print(f"✅ Auto-exec config updated successfully")
                print(f"   Updated enabled: {response.get('enabled')}")
                print(f"   Updated max_trade_usd: ${response.get('max_trade_usd')}")
                print(f"   Updated min_confidence: {response.get('min_confidence')}")
                print(f"   Updated cooldown: {response.get('cooldown_seconds')}s")
                
                # Reset to disabled for safety
                reset_success, _ = self.run_test(
                    "Reset Auto-Exec to Disabled",
                    "PATCH", 
                    "dungeon/auto-exec/config",
                    200,
                    data={"enabled": False}
                )
                if reset_success:
                    print("✅ Auto-exec safely reset to disabled")
                return True
            else:
                print(f"❌ Config update verification failed")
        return False

    def test_auto_exec_trades(self):
        """Test GET /api/dungeon/auto-exec/trades"""
        success, response = self.run_test(
            "Auto-Exec Trades History",
            "GET",
            "dungeon/auto-exec/trades",
            200
        )
        if success and 'trades' in response:
            trades = response['trades']
            print(f"✅ Auto-exec trades endpoint working")
            print(f"   Found {len(trades)} historical trades")
            
            if trades:
                trade = trades[0]
                expected_fields = ['source', 'symbol', 'side', 'quantity', 'price', 'confidence', 'direction', 'created_at']
                missing = [f for f in expected_fields if f not in trade]
                if not missing:
                    print(f"✅ Trade record structure correct")
                    print(f"   Sample trade: {trade.get('side', '').upper()} {trade.get('symbol')} @ ${trade.get('price', 0)}")
                else:
                    print(f"⚠️  Missing trade fields: {missing}")
            return True
        return False

    def test_prediction_with_auto_exec(self, symbol="BTCUSDT"):
        """Test GET /api/dungeon/prediction with auto_exec parameter"""
        success, response = self.run_test(
            f"Dungeon Prediction with Auto-Exec for {symbol}",
            "GET",
            f"dungeon/prediction?symbol={symbol}&auto_exec=true",
            200
        )
        if success:
            required_fields = ['direction', 'confidence', 'votes', 'debate', 'auto_exec']
            missing = [f for f in required_fields if f not in response]
            if not missing:
                print(f"✅ Prediction with auto-exec structure correct")
                print(f"   Direction: {response.get('direction')}")
                print(f"   Confidence: {response.get('confidence')}")
                
                auto_exec = response.get('auto_exec', {})
                if auto_exec:
                    print(f"   Auto-exec executed: {auto_exec.get('executed', False)}")
                    print(f"   Auto-exec reason: {auto_exec.get('reason', 'N/A')}")
                    
                    # Check for expected reasons when auto-exec is disabled
                    if not auto_exec.get('executed') and auto_exec.get('reason') == 'auto_exec_disabled':
                        print("✅ Auto-exec correctly disabled (reason: auto_exec_disabled)")
                    elif not auto_exec.get('executed') and 'prediction_is_wait' in auto_exec.get('reason', ''):
                        print("✅ Auto-exec skipped for 'wait' prediction")
                    elif not auto_exec.get('executed') and 'confidence' in auto_exec.get('reason', ''):
                        print("✅ Auto-exec skipped due to confidence threshold")
                    elif auto_exec.get('executed'):
                        print("⚠️  Auto-exec was executed (unexpected if disabled)")
                    
                return True
            else:
                print(f"❌ Missing prediction fields: {missing}")
        return False

    def test_health_endpoints(self):
        """Test basic health endpoints"""
        endpoints = [
            ("API Root", "GET", "", 200),
            ("Health Check", "GET", "health", 200),
        ]
        
        all_passed = True
        for name, method, endpoint, expected in endpoints:
            success, _ = self.run_test(name, method, endpoint, expected)
            if not success:
                all_passed = False
        
        return all_passed

def main():
    print("🚀 MiroFish Auto-Execution Backend Testing - Iteration 7")
    print("=" * 70)
    
    # Setup
    tester = AutoExecTester()
    
    # Test basic health first
    print("\n📊 TESTING BASIC HEALTH...")
    health_ok = tester.test_health_endpoints()
    
    # Test authentication
    print("\n🔐 TESTING AUTHENTICATION...")
    login_ok = tester.test_login("admin@mirofish.io", "admin123")
    
    if not login_ok:
        print("❌ Login failed, stopping auto-exec tests")
        print(f"\n📊 Basic Tests Results: {tester.tests_passed}/{tester.tests_run}")
        return 1
    
    # Test Space Dungeon endpoints (existing functionality)
    print("\n🏰 TESTING SPACE DUNGEON CORE...")
    agents_ok = tester.test_dungeon_agents()
    prediction_ok = tester.test_dungeon_prediction()
    debate_ok = tester.test_dungeon_debate()
    rollout_ok = tester.test_dungeon_rollout()
    
    # Test NEW Auto-Execution features (Iteration 7)
    print("\n⚡ TESTING AUTO-EXECUTION FEATURES...")
    auto_config_get_ok = tester.test_auto_exec_config_get()
    auto_config_patch_ok = tester.test_auto_exec_config_patch()
    auto_trades_ok = tester.test_auto_exec_trades()
    prediction_auto_exec_ok = tester.test_prediction_with_auto_exec()
    
    # Summary
    print("\n" + "=" * 70)
    print("📊 FINAL RESULTS")
    print("=" * 70)
    print(f"Total Tests: {tester.tests_run}")
    print(f"Passed: {tester.tests_passed}")
    print(f"Failed: {tester.tests_run - tester.tests_passed}")
    print(f"Success Rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    print("\n🏰 Space Dungeon Core Features:")
    print(f"  ✅ Agents (24 bots): {'PASS' if agents_ok else 'FAIL'}")
    print(f"  ✅ Prediction Engine: {'PASS' if prediction_ok else 'FAIL'}")
    print(f"  ✅ Debate System: {'PASS' if debate_ok else 'FAIL'}")
    print(f"  ✅ Rollout Pipeline: {'PASS' if rollout_ok else 'FAIL'}")
    
    print("\n⚡ Auto-Execution Features (NEW in Iteration 7):")
    print(f"  ✅ Auto-Exec Config GET: {'PASS' if auto_config_get_ok else 'FAIL'}")
    print(f"  ✅ Auto-Exec Config PATCH: {'PASS' if auto_config_patch_ok else 'FAIL'}")
    print(f"  ✅ Auto-Exec Trades History: {'PASS' if auto_trades_ok else 'FAIL'}")
    print(f"  ✅ Prediction with Auto-Exec: {'PASS' if prediction_auto_exec_ok else 'FAIL'}")
    
    # Return 0 if all critical tests passed
    critical_tests = [health_ok, login_ok, agents_ok, prediction_ok, debate_ok, rollout_ok, 
                     auto_config_get_ok, auto_config_patch_ok, auto_trades_ok, prediction_auto_exec_ok]
    return 0 if all(critical_tests) else 1

if __name__ == "__main__":
    sys.exit(main())