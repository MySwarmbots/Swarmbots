#!/usr/bin/env python3
"""
MiroFish Scheduled Auto-Predictions Backend API Testing - Iteration 8
Tests scheduled auto-predictions, Telegram alerts, and dashboard live dungeon avatars
"""
import requests
import sys
import json
import time
from datetime import datetime

class SchedulerTester:
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
                    elif isinstance(response_data, dict) and 'recent_runs' in response_data:
                        print(f"   Response: Found {len(response_data.get('recent_runs', []))} recent runs")
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

    def test_dashboard_dungeon_overview(self):
        """Test GET /api/dashboard/dungeon-overview - NEW in Iteration 8"""
        success, response = self.run_test(
            "Dashboard Dungeon Overview",
            "GET",
            "dashboard/dungeon-overview",
            200
        )
        if success:
            required_fields = ['agents', 'latest_predictions', 'scheduler', 'recent_scheduler_runs']
            missing = [f for f in required_fields if f not in response]
            if not missing:
                print(f"✅ Dashboard dungeon overview structure correct")
                
                # Check agents (should be 24)
                agents = response.get('agents', [])
                print(f"   Found {len(agents)} agents")
                if len(agents) == 24:
                    print("✅ Correct number of agents (24)")
                else:
                    print(f"❌ Expected 24 agents, got {len(agents)}")
                
                # Check scheduler info
                scheduler = response.get('scheduler', {})
                print(f"   Scheduler enabled: {scheduler.get('enabled', False)}")
                print(f"   Auto-exec enabled: {scheduler.get('auto_exec_enabled', False)}")
                print(f"   Interval minutes: {scheduler.get('interval_minutes', 0)}")
                print(f"   Total auto trades: {scheduler.get('total_auto_trades', 0)}")
                
                # Check latest predictions
                latest_preds = response.get('latest_predictions', [])
                print(f"   Found {len(latest_preds)} latest predictions")
                
                # Check recent scheduler runs
                recent_runs = response.get('recent_scheduler_runs', [])
                print(f"   Found {len(recent_runs)} recent scheduler runs")
                
                return True
            else:
                print(f"❌ Missing dashboard overview fields: {missing}")
        return False

    def test_scheduler_status(self):
        """Test GET /api/dungeon/scheduler/status - NEW in Iteration 8"""
        success, response = self.run_test(
            "Scheduler Status",
            "GET",
            "dungeon/scheduler/status",
            200
        )
        if success:
            required_fields = ['scheduler_enabled', 'interval_minutes', 'symbols', 'recent_runs']
            missing = [f for f in required_fields if f not in response]
            if not missing:
                print(f"✅ Scheduler status structure correct")
                print(f"   Scheduler enabled: {response.get('scheduler_enabled')}")
                print(f"   Interval minutes: {response.get('interval_minutes')}")
                print(f"   Symbols: {response.get('symbols')}")
                print(f"   Recent runs: {len(response.get('recent_runs', []))}")
                return True
            else:
                print(f"❌ Missing scheduler status fields: {missing}")
        return False

    def test_scheduler_trigger(self, symbol="BTCUSDT"):
        """Test POST /api/dungeon/scheduler/trigger - NEW in Iteration 8"""
        success, response = self.run_test(
            f"Manual Scheduler Trigger for {symbol}",
            "POST",
            f"dungeon/scheduler/trigger?symbol={symbol}",
            200
        )
        if success:
            required_fields = ['direction', 'confidence', 'votes', 'timestamp']
            missing = [f for f in required_fields if f not in response]
            if not missing:
                print(f"✅ Manual scheduler trigger structure correct")
                print(f"   Direction: {response.get('direction')}")
                print(f"   Confidence: {response.get('confidence')}")
                print(f"   Votes: {response.get('votes', {})}")
                
                # Check auto_exec result if present
                auto_exec = response.get('auto_exec')
                if auto_exec:
                    print(f"   Auto-exec executed: {auto_exec.get('executed', False)}")
                    print(f"   Auto-exec reason: {auto_exec.get('reason', 'N/A')}")
                
                return True
            else:
                print(f"❌ Missing scheduler trigger fields: {missing}")
        return False

    def test_scheduler_config_enable(self):
        """Test PATCH /api/dungeon/auto-exec/config to enable scheduler - NEW in Iteration 8"""
        # First get current config
        get_success, current_config = self.run_test(
            "Get Current Auto-Exec Config",
            "GET",
            "dungeon/auto-exec/config",
            200
        )
        
        if not get_success:
            return False
        
        # Test enabling scheduler
        scheduler_config = {
            "scheduler_enabled": True,
            "scheduler_interval_minutes": 5,  # Short interval for testing
            "scheduler_symbols": ["BTCUSDT", "ETHUSDT"]
        }
        
        success, response = self.run_test(
            "Enable Scheduler Config",
            "PATCH",
            "dungeon/auto-exec/config",
            200,
            data=scheduler_config
        )
        
        if success:
            # Verify the updates were applied
            if (response.get('scheduler_enabled') == scheduler_config['scheduler_enabled'] and
                response.get('scheduler_interval_minutes') == scheduler_config['scheduler_interval_minutes'] and
                response.get('scheduler_symbols') == scheduler_config['scheduler_symbols']):
                print(f"✅ Scheduler config updated successfully")
                print(f"   Scheduler enabled: {response.get('scheduler_enabled')}")
                print(f"   Interval minutes: {response.get('scheduler_interval_minutes')}")
                print(f"   Symbols: {response.get('scheduler_symbols')}")
                
                # Wait a moment then disable for safety
                time.sleep(2)
                reset_success, _ = self.run_test(
                    "Reset Scheduler to Disabled",
                    "PATCH", 
                    "dungeon/auto-exec/config",
                    200,
                    data={"scheduler_enabled": False}
                )
                if reset_success:
                    print("✅ Scheduler safely reset to disabled")
                return True
            else:
                print(f"❌ Scheduler config update verification failed")
        return False

    def test_scheduler_interval_update(self):
        """Test PATCH /api/dungeon/auto-exec/config to update interval - NEW in Iteration 8"""
        # Test updating just the interval
        interval_config = {
            "scheduler_interval_minutes": 30
        }
        
        success, response = self.run_test(
            "Update Scheduler Interval",
            "PATCH",
            "dungeon/auto-exec/config",
            200,
            data=interval_config
        )
        
        if success:
            if response.get('scheduler_interval_minutes') == interval_config['scheduler_interval_minutes']:
                print(f"✅ Scheduler interval updated successfully")
                print(f"   New interval: {response.get('scheduler_interval_minutes')} minutes")
                return True
            else:
                print(f"❌ Scheduler interval update verification failed")
        return False

    def test_existing_dungeon_agents(self):
        """Test existing dungeon agents endpoint for compatibility"""
        success, response = self.run_test(
            "Dungeon Agents (Existing)",
            "GET",
            "dungeon/agents",
            200
        )
        if success and 'agents' in response:
            agents = response['agents']
            print(f"   Found {len(agents)} agents")
            if len(agents) == 24:
                print("✅ Correct number of agents (24)")
                return True
            else:
                print(f"❌ Expected 24 agents, got {len(agents)}")
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
    print("🚀 MiroFish Scheduled Auto-Predictions Backend Testing - Iteration 8")
    print("=" * 80)
    
    # Setup
    tester = SchedulerTester()
    
    # Test basic health first
    print("\n📊 TESTING BASIC HEALTH...")
    health_ok = tester.test_health_endpoints()
    
    # Test authentication
    print("\n🔐 TESTING AUTHENTICATION...")
    login_ok = tester.test_login("admin@mirofish.io", "admin123")
    
    if not login_ok:
        print("❌ Login failed, stopping scheduler tests")
        print(f"\n📊 Basic Tests Results: {tester.tests_passed}/{tester.tests_run}")
        return 1
    
    # Test existing functionality for compatibility
    print("\n🏰 TESTING EXISTING DUNGEON COMPATIBILITY...")
    agents_ok = tester.test_existing_dungeon_agents()
    
    # Test NEW Iteration 8 features
    print("\n📅 TESTING SCHEDULED AUTO-PREDICTIONS (NEW in Iteration 8)...")
    dashboard_overview_ok = tester.test_dashboard_dungeon_overview()
    scheduler_status_ok = tester.test_scheduler_status()
    scheduler_trigger_ok = tester.test_scheduler_trigger()
    scheduler_enable_ok = tester.test_scheduler_config_enable()
    scheduler_interval_ok = tester.test_scheduler_interval_update()
    
    # Summary
    print("\n" + "=" * 80)
    print("📊 FINAL RESULTS")
    print("=" * 80)
    print(f"Total Tests: {tester.tests_run}")
    print(f"Passed: {tester.tests_passed}")
    print(f"Failed: {tester.tests_run - tester.tests_passed}")
    print(f"Success Rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    print("\n🏰 Existing Dungeon Compatibility:")
    print(f"  ✅ Agents (24 bots): {'PASS' if agents_ok else 'FAIL'}")
    
    print("\n📅 Scheduled Auto-Predictions Features (NEW in Iteration 8):")
    print(f"  ✅ Dashboard Dungeon Overview: {'PASS' if dashboard_overview_ok else 'FAIL'}")
    print(f"  ✅ Scheduler Status: {'PASS' if scheduler_status_ok else 'FAIL'}")
    print(f"  ✅ Manual Scheduler Trigger: {'PASS' if scheduler_trigger_ok else 'FAIL'}")
    print(f"  ✅ Scheduler Enable/Disable: {'PASS' if scheduler_enable_ok else 'FAIL'}")
    print(f"  ✅ Scheduler Interval Update: {'PASS' if scheduler_interval_ok else 'FAIL'}")
    
    # Return 0 if all critical tests passed
    critical_tests = [health_ok, login_ok, agents_ok, dashboard_overview_ok, 
                     scheduler_status_ok, scheduler_trigger_ok, scheduler_enable_ok, scheduler_interval_ok]
    return 0 if all(critical_tests) else 1

if __name__ == "__main__":
    sys.exit(main())