#!/usr/bin/env python3
"""
MiroFish Backend Test - Iteration 3
Testing WebSocket functionality and email integration
"""

import requests
import websocket
import json
import time
import threading
import sys
from datetime import datetime

class MiroFishTester:
    def __init__(self, base_url="https://mirofish-mobile.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.ws_token = None
        self.ws = None
        self.ws_messages = []
        self.tests_run = 0
        self.tests_passed = 0
        self.session = requests.Session()

    def log(self, message):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")

    def run_test(self, name, test_func):
        """Run a single test"""
        self.tests_run += 1
        self.log(f"🔍 Testing {name}...")
        
        try:
            success = test_func()
            if success:
                self.tests_passed += 1
                self.log(f"✅ {name} - PASSED")
            else:
                self.log(f"❌ {name} - FAILED")
            return success
        except Exception as e:
            self.log(f"❌ {name} - ERROR: {str(e)}")
            return False

    def test_login(self):
        """Test admin login"""
        try:
            response = self.session.post(
                f"{self.base_url}/api/auth/login",
                json={"email": "admin@mirofish.io", "password": "admin123"}
            )
            if response.status_code == 200:
                data = response.json()
                self.log(f"Login successful: {data.get('email')} ({data.get('role')})")
                return True
            else:
                self.log(f"Login failed: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            self.log(f"Login error: {e}")
            return False

    def test_ws_token_endpoint(self):
        """Test GET /api/ws-token returns valid JWT token"""
        try:
            # Make sure we're authenticated with cookies
            response = self.session.get(f"{self.base_url}/api/ws-token")
            if response.status_code == 200:
                data = response.json()
                if 'token' in data and data['token']:
                    self.ws_token = data['token']
                    self.log(f"WS token received: {self.ws_token[:20]}...")
                    return True
                else:
                    self.log("WS token response missing token field")
                    return False
            else:
                self.log(f"WS token failed: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            self.log(f"WS token error: {e}")
            return False

    def on_ws_message(self, ws, message):
        """WebSocket message handler"""
        try:
            if message == "pong":
                return
            data = json.loads(message)
            self.ws_messages.append(data)
            self.log(f"📨 WS Message: {data.get('type', 'unknown')} - {data}")
        except:
            pass

    def on_ws_error(self, ws, error):
        """WebSocket error handler"""
        self.log(f"🔴 WS Error: {error}")

    def on_ws_close(self, ws, close_status_code, close_msg):
        """WebSocket close handler"""
        self.log(f"🔌 WS Closed: {close_status_code} - {close_msg}")

    def on_ws_open(self, ws):
        """WebSocket open handler"""
        self.log("🟢 WS Connected successfully")

    def test_websocket_connection(self):
        """Test WebSocket connection with token"""
        if not self.ws_token:
            self.log("No WS token available")
            return False

        try:
            # Convert HTTP URL to WebSocket URL
            ws_url = self.base_url.replace("https://", "wss://").replace("http://", "ws://")
            ws_endpoint = f"{ws_url}/ws/{self.ws_token}"
            
            self.log(f"Connecting to: {ws_endpoint}")
            
            # Create WebSocket connection
            self.ws = websocket.WebSocketApp(
                ws_endpoint,
                on_message=self.on_ws_message,
                on_error=self.on_ws_error,
                on_close=self.on_ws_close,
                on_open=self.on_ws_open
            )
            
            # Run WebSocket in a separate thread
            ws_thread = threading.Thread(target=self.ws.run_forever)
            ws_thread.daemon = True
            ws_thread.start()
            
            # Wait for connection
            time.sleep(2)
            
            # Test ping/pong
            if self.ws and self.ws.sock and self.ws.sock.connected:
                self.ws.send("ping")
                time.sleep(1)
                self.log("WebSocket connection established and ping sent")
                return True
            else:
                self.log("WebSocket connection failed")
                return False
                
        except Exception as e:
            self.log(f"WebSocket connection error: {e}")
            return False

    def test_forgot_password_email_fallback(self):
        """Test forgot password with email fallback (RESEND_API_KEY is empty)"""
        try:
            response = self.session.post(
                f"{self.base_url}/api/auth/forgot-password",
                json={"email": "admin@mirofish.io"}
            )
            if response.status_code == 200:
                data = response.json()
                if 'reset_token' in data:
                    self.log(f"Password reset token generated: {data['reset_token'][:20]}...")
                    self.log("Email fallback working (check backend logs for EMAIL FALLBACK message)")
                    return True
                else:
                    self.log("Password reset response missing reset_token")
                    return False
            else:
                self.log(f"Forgot password failed: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            self.log(f"Forgot password error: {e}")
            return False

    def test_reset_password(self):
        """Test password reset functionality"""
        try:
            # First get a reset token
            response = self.session.post(
                f"{self.base_url}/api/auth/forgot-password",
                json={"email": "admin@mirofish.io"}
            )
            
            if response.status_code != 200:
                self.log("Failed to get reset token")
                return False
                
            data = response.json()
            reset_token = data.get('reset_token')
            
            if not reset_token:
                self.log("No reset token in response")
                return False
            
            # Test password reset with the token
            reset_response = self.session.post(
                f"{self.base_url}/api/auth/reset-password",
                json={"token": reset_token, "new_password": "admin123"}  # Reset to same password
            )
            
            if reset_response.status_code == 200:
                self.log("Password reset successful")
                return True
            else:
                self.log(f"Password reset failed: {reset_response.status_code} - {reset_response.text}")
                return False
                
        except Exception as e:
            self.log(f"Password reset error: {e}")
            return False

    def test_agent_creation_ws_notification(self):
        """Test that creating an agent triggers WebSocket notification"""
        try:
            # Clear previous messages
            self.ws_messages.clear()
            
            # Create a test agent
            agent_data = {
                "name": f"Test Agent {int(time.time())}",
                "strategy": "momentum",
                "exchange": "binance",
                "trading_pairs": ["BTC/USDT"],
                "risk_level": "medium"
            }
            
            response = self.session.post(
                f"{self.base_url}/api/agents",
                json=agent_data
            )
            
            if response.status_code != 200:
                self.log(f"Agent creation failed: {response.status_code}")
                return False
            
            # Wait for WebSocket message
            time.sleep(2)
            
            # Check for agent_created or notification message
            for msg in self.ws_messages:
                if msg.get('type') in ['agent_created', 'notification']:
                    self.log(f"Received WS message for agent creation: {msg['type']}")
                    return True
            
            self.log("No WebSocket message received for agent creation")
            return False
            
        except Exception as e:
            self.log(f"Agent creation WS test error: {e}")
            return False

    def test_validation_run_ws_update(self):
        """Test that validation runs trigger WebSocket updates"""
        try:
            # Clear previous messages
            self.ws_messages.clear()
            
            # Create a validation run
            validation_data = {
                "symbol": "BTC/USDT",
                "exchange": "binance",
                "expected_price": 50000.0,
                "actual_price": 50100.0,
                "expected_fee_bps": 6.0,
                "actual_fee_bps": 6.0
            }
            
            response = self.session.post(
                f"{self.base_url}/api/validation/run",
                json=validation_data
            )
            
            if response.status_code != 200:
                self.log(f"Validation run failed: {response.status_code}")
                return False
            
            # Wait for WebSocket message
            time.sleep(2)
            
            # Check for validation_run message
            for msg in self.ws_messages:
                if msg.get('type') == 'validation_run':
                    self.log(f"Received WS message for validation run: {msg['data']['symbol']}")
                    return True
            
            self.log("No WebSocket message received for validation run")
            return False
            
        except Exception as e:
            self.log(f"Validation run WS test error: {e}")
            return False

    def test_dashboard_stats(self):
        """Test dashboard stats endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/api/dashboard/stats")
            if response.status_code == 200:
                data = response.json()
                required_fields = ['total_agents', 'active_agents', 'total_pnl', 'validation_summary']
                for field in required_fields:
                    if field not in data:
                        self.log(f"Dashboard stats missing field: {field}")
                        return False
                self.log(f"Dashboard stats: {data['total_agents']} agents, PnL: {data['total_pnl']}")
                return True
            else:
                self.log(f"Dashboard stats failed: {response.status_code}")
                return False
        except Exception as e:
            self.log(f"Dashboard stats error: {e}")
            return False

    def cleanup(self):
        """Clean up WebSocket connection"""
        if self.ws:
            self.ws.close()

    def run_all_tests(self):
        """Run all iteration 3 tests"""
        self.log("🚀 Starting MiroFish Iteration 3 Backend Tests")
        self.log("=" * 60)
        
        # Authentication
        self.run_test("Admin Login", self.test_login)
        
        # WebSocket Token
        self.run_test("WebSocket Token Generation", self.test_ws_token_endpoint)
        
        # WebSocket Connection
        self.run_test("WebSocket Connection", self.test_websocket_connection)
        
        # Email Integration (Fallback)
        self.run_test("Forgot Password Email Fallback", self.test_forgot_password_email_fallback)
        self.run_test("Password Reset Flow", self.test_reset_password)
        
        # Dashboard Stats
        self.run_test("Dashboard Stats", self.test_dashboard_stats)
        
        # Real-time WebSocket Updates
        if self.ws and self.ws.sock and self.ws.sock.connected:
            self.run_test("Agent Creation WebSocket Notification", self.test_agent_creation_ws_notification)
            self.run_test("Validation Run WebSocket Update", self.test_validation_run_ws_update)
        else:
            self.log("⚠️ Skipping WebSocket real-time tests - connection not established")
        
        # Results
        self.log("=" * 60)
        self.log(f"📊 Tests completed: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            self.log("🎉 All tests PASSED!")
            return True
        else:
            self.log(f"⚠️ {self.tests_run - self.tests_passed} tests FAILED")
            return False

def main():
    tester = MiroFishTester()
    try:
        success = tester.run_all_tests()
        return 0 if success else 1
    finally:
        tester.cleanup()

if __name__ == "__main__":
    sys.exit(main())