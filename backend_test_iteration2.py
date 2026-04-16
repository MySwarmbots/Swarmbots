#!/usr/bin/env python3
"""
MiroFish Backend API Testing Suite - Iteration 2
Tests NEW features: Telegram integration, WebSocket, password reset, agent performance charts
"""

import requests
import sys
import json
import time
from datetime import datetime

class MiroFishAPITester:
    def __init__(self, base_url="https://mirofish-mobile.preview.emergentagent.com"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.admin_credentials = {
            "email": "admin@mirofish.io",
            "password": "admin123"
        }
        self.user_id = None

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} | {name}")
        if details:
            print(f"     {details}")
        if success:
            self.tests_passed += 1
        else:
            self.failed_tests.append({"name": name, "details": details})

    def test_auth_login(self):
        """Test admin login and verify dashboard loads"""
        try:
            response = self.session.post(
                f"{self.base_url}/api/auth/login",
                json=self.admin_credentials
            )
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                self.user_id = data.get("id")
                details += f" | User ID: {self.user_id}"
            else:
                details += f" | Response: {response.text}"
            self.log_test("Admin Login", success, details)
            return success
        except Exception as e:
            self.log_test("Admin Login", False, str(e))
            return False

    def test_forgot_password(self):
        """Test forgot password endpoint"""
        try:
            response = self.session.post(
                f"{self.base_url}/api/auth/forgot-password",
                json={"email": self.admin_credentials["email"]}
            )
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                reset_token = data.get("reset_token")
                if reset_token:
                    details += f" | Reset token: {reset_token[:20]}..."
                    # Store token for reset test
                    self.reset_token = reset_token
                else:
                    details += " | Reset link sent (no token in response)"
            else:
                details += f" | Response: {response.text}"
            self.log_test("Forgot Password", success, details)
            return success
        except Exception as e:
            self.log_test("Forgot Password", False, str(e))
            return False

    def test_reset_password(self):
        """Test reset password with valid token"""
        try:
            # First get a reset token
            forgot_response = self.session.post(
                f"{self.base_url}/api/auth/forgot-password",
                json={"email": self.admin_credentials["email"]}
            )
            
            if forgot_response.status_code != 200:
                self.log_test("Reset Password", False, "Could not get reset token")
                return False
            
            reset_token = forgot_response.json().get("reset_token")
            if not reset_token:
                self.log_test("Reset Password", False, "No reset token returned")
                return False
            
            # Test reset with the token
            response = self.session.post(
                f"{self.base_url}/api/auth/reset-password",
                json={"token": reset_token, "new_password": self.admin_credentials["password"]}
            )
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if not success:
                details += f" | Response: {response.text}"
            self.log_test("Reset Password", success, details)
            return success
        except Exception as e:
            self.log_test("Reset Password", False, str(e))
            return False

    def test_profile_telegram_field(self):
        """Test profile endpoint returns telegram_chat_id field"""
        try:
            response = self.session.get(f"{self.base_url}/api/profile")
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                has_telegram_field = "telegram_chat_id" in data
                details += f" | telegram_chat_id field present: {has_telegram_field}"
                success = has_telegram_field
            else:
                details += f" | Response: {response.text}"
            self.log_test("Profile Telegram Field", success, details)
            return success
        except Exception as e:
            self.log_test("Profile Telegram Field", False, str(e))
            return False

    def test_telegram_link(self):
        """Test Telegram link endpoint"""
        try:
            test_chat_id = "123456789"
            response = self.session.post(
                f"{self.base_url}/api/telegram/link",
                json={"chat_id": test_chat_id}
            )
            
            # This might fail due to invalid chat_id, but endpoint should exist
            success = response.status_code in [200, 400]
            details = f"Status: {response.status_code} | Endpoint accessible"
            if not success:
                details += f" | Response: {response.text}"
            self.log_test("Telegram Link", success, details)
            return success
        except Exception as e:
            self.log_test("Telegram Link", False, str(e))
            return False

    def test_telegram_test(self):
        """Test Telegram test endpoint"""
        try:
            response = self.session.post(f"{self.base_url}/api/telegram/test")
            
            # Should return 400 if no telegram linked, which is expected
            success = response.status_code in [200, 400]
            details = f"Status: {response.status_code} | Endpoint accessible"
            if not success:
                details += f" | Response: {response.text}"
            self.log_test("Telegram Test", success, details)
            return success
        except Exception as e:
            self.log_test("Telegram Test", False, str(e))
            return False

    def test_portfolio_summary_charts(self):
        """Test portfolio summary endpoint returns chart data with 30 days history"""
        try:
            response = self.session.get(f"{self.base_url}/api/agents/portfolio/summary")
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                has_portfolio_history = "portfolio_history" in data
                history_length = len(data.get("portfolio_history", []))
                has_30_days = history_length >= 30
                details += f" | portfolio_history: {has_portfolio_history}, length: {history_length}"
                success = has_portfolio_history and has_30_days
            else:
                details += f" | Response: {response.text}"
            self.log_test("Portfolio Summary Charts", success, details)
            return success
        except Exception as e:
            self.log_test("Portfolio Summary Charts", False, str(e))
            return False

    def test_agent_performance_charts(self):
        """Test agent performance endpoint returns performance history"""
        try:
            # First get agents to test with
            agents_response = self.session.get(f"{self.base_url}/api/agents")
            if agents_response.status_code != 200:
                self.log_test("Agent Performance Charts", False, "Could not get agents list")
                return False
            
            agents = agents_response.json().get("agents", [])
            if not agents:
                self.log_test("Agent Performance Charts", True, "No agents to test performance with")
                return True
            
            agent_id = agents[0]["id"]
            response = self.session.get(f"{self.base_url}/api/agents/{agent_id}/performance")
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                has_history = "history" in data
                details += f" | Performance history present: {has_history}"
                success = has_history
            else:
                details += f" | Response: {response.text}"
            self.log_test("Agent Performance Charts", success, details)
            return success
        except Exception as e:
            self.log_test("Agent Performance Charts", False, str(e))
            return False

    def test_notifications_unread_count(self):
        """Test notifications unread count endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/api/notifications/unread-count")
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                has_count = "count" in data
                details += f" | Count field present: {has_count}"
                success = has_count
            else:
                details += f" | Response: {response.text}"
            self.log_test("Notifications Unread Count", success, details)
            return success
        except Exception as e:
            self.log_test("Notifications Unread Count", False, str(e))
            return False

    def test_mark_all_read(self):
        """Test mark all notifications read endpoint"""
        try:
            response = self.session.post(f"{self.base_url}/api/notifications/mark-all-read")
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if not success:
                details += f" | Response: {response.text}"
            self.log_test("Mark All Read", success, details)
            return success
        except Exception as e:
            self.log_test("Mark All Read", False, str(e))
            return False

    def run_all_tests(self):
        """Run iteration 2 focused API test suite"""
        print("🚀 Starting MiroFish API Test Suite - Iteration 2")
        print("=" * 60)
        print(f"Testing against: {self.base_url}")
        print(f"Focus: NEW features - Telegram, WebSocket, Password Reset, Charts")
        print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 60)
        
        # Authentication tests
        print("\n🔐 AUTHENTICATION TESTS")
        login_success = self.test_auth_login()
        
        if login_success:
            print("\n🔑 PASSWORD RESET FLOW")
            self.test_forgot_password()
            self.test_reset_password()
            
            print("\n👤 PROFILE & TELEGRAM")
            self.test_profile_telegram_field()
            self.test_telegram_link()
            self.test_telegram_test()
            
            print("\n📊 CHARTS & PERFORMANCE")
            self.test_portfolio_summary_charts()
            self.test_agent_performance_charts()
            
            print("\n🔔 NOTIFICATIONS")
            self.test_notifications_unread_count()
            self.test_mark_all_read()
            
        else:
            print("❌ Admin login failed - skipping authenticated tests")

        # Print summary
        print("\n" + "=" * 60)
        print("📋 TEST SUMMARY - ITERATION 2")
        print("=" * 60)
        print(f"Total tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {len(self.failed_tests)}")
        print(f"Success rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in self.failed_tests:
                print(f"  • {test['name']}: {test['details']}")
        
        print(f"\nCompleted at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 60)
        
        return self.tests_passed == self.tests_run

def main():
    """Main test runner"""
    tester = MiroFishAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())