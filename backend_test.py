#!/usr/bin/env python3
"""
MiroFish Space Dungeon Swarm Backend API Testing
Tests all dungeon endpoints and authentication
"""
import requests
import sys
import json
from datetime import datetime

class SpaceDungeonTester:
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
    print("🚀 MiroFish Space Dungeon Swarm Backend Testing")
    print("=" * 60)
    
    # Setup
    tester = SpaceDungeonTester()
    
    # Test basic health first
    print("\n📊 TESTING BASIC HEALTH...")
    health_ok = tester.test_health_endpoints()
    
    # Test authentication
    print("\n🔐 TESTING AUTHENTICATION...")
    login_ok = tester.test_login("admin@mirofish.io", "admin123")
    
    if not login_ok:
        print("❌ Login failed, stopping Space Dungeon tests")
        print(f"\n📊 Basic Tests Results: {tester.tests_passed}/{tester.tests_run}")
        return 1
    
    # Test Space Dungeon endpoints
    print("\n🏰 TESTING SPACE DUNGEON SWARM...")
    
    agents_ok = tester.test_dungeon_agents()
    prediction_ok = tester.test_dungeon_prediction()
    debate_ok = tester.test_dungeon_debate()
    rollout_ok = tester.test_dungeon_rollout()
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 FINAL RESULTS")
    print("=" * 60)
    print(f"Total Tests: {tester.tests_run}")
    print(f"Passed: {tester.tests_passed}")
    print(f"Failed: {tester.tests_run - tester.tests_passed}")
    print(f"Success Rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    print("\n🏰 Space Dungeon Features:")
    print(f"  ✅ Agents (24 bots): {'PASS' if agents_ok else 'FAIL'}")
    print(f"  ✅ Prediction Engine: {'PASS' if prediction_ok else 'FAIL'}")
    print(f"  ✅ Debate System: {'PASS' if debate_ok else 'FAIL'}")
    print(f"  ✅ Rollout Pipeline: {'PASS' if rollout_ok else 'FAIL'}")
    
    # Return 0 if all critical tests passed
    critical_tests = [health_ok, login_ok, agents_ok, prediction_ok, debate_ok, rollout_ok]
    return 0 if all(critical_tests) else 1

if __name__ == "__main__":
    sys.exit(main())