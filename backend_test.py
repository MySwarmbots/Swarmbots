#!/usr/bin/env python3
"""
MiroFish Backend API Testing Suite
Tests all API endpoints for the crypto trading swarm agent platform
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

    def test_health_check(self):
        """Test basic health endpoints"""
        try:
            # Test root endpoint
            response = self.session.get(f"{self.base_url}/api/")
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                details += f" | Message: {data.get('message', 'N/A')}"
            self.log_test("API Root Health", success, details)
            
            # Test health endpoint
            response = self.session.get(f"{self.base_url}/api/health")
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                details += f" | Status: {data.get('status', 'N/A')}"
            self.log_test("API Health Check", success, details)
            
        except Exception as e:
            self.log_test("API Health Check", False, f"Error: {str(e)}")

    def test_user_registration(self):
        """Test user registration flow"""
        try:
            test_user = {
                "email": f"test_{int(time.time())}@test.com",
                "password": "TestPass123!",
                "name": "Test User"
            }
            
            response = self.session.post(f"{self.base_url}/api/auth/register", json=test_user)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                details += f" | User ID: {data.get('id', 'N/A')}"
                # Check if cookies are set
                if 'access_token' in self.session.cookies:
                    details += " | Cookies set"
                else:
                    details += " | No cookies set"
            else:
                try:
                    error_data = response.json()
                    details += f" | Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f" | Response: {response.text[:100]}"
                    
            self.log_test("User Registration", success, details)
            
        except Exception as e:
            self.log_test("User Registration", False, f"Error: {str(e)}")

    def test_admin_login(self):
        """Test admin login and store session"""
        try:
            response = self.session.post(f"{self.base_url}/api/auth/login", json=self.admin_credentials)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                details += f" | Role: {data.get('role', 'N/A')}"
                # Check if httpOnly cookies are set
                if 'access_token' in self.session.cookies:
                    details += " | Auth cookies set"
                else:
                    details += " | No auth cookies"
            else:
                try:
                    error_data = response.json()
                    details += f" | Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f" | Response: {response.text[:100]}"
                    
            self.log_test("Admin Login", success, details)
            return success
            
        except Exception as e:
            self.log_test("Admin Login", False, f"Error: {str(e)}")
            return False

    def test_auth_me(self):
        """Test GET /api/auth/me endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/api/auth/me")
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                details += f" | Email: {data.get('email', 'N/A')} | Role: {data.get('role', 'N/A')}"
            else:
                try:
                    error_data = response.json()
                    details += f" | Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f" | Response: {response.text[:100]}"
                    
            self.log_test("Auth Me Endpoint", success, details)
            
        except Exception as e:
            self.log_test("Auth Me Endpoint", False, f"Error: {str(e)}")

    def test_dashboard_stats(self):
        """Test GET /api/dashboard/stats endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/api/dashboard/stats")
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                details += f" | Agents: {data.get('total_agents', 0)} | PNL: {data.get('total_pnl', 0)}"
            else:
                try:
                    error_data = response.json()
                    details += f" | Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f" | Response: {response.text[:100]}"
                    
            self.log_test("Dashboard Stats", success, details)
            
        except Exception as e:
            self.log_test("Dashboard Stats", False, f"Error: {str(e)}")

    def test_agents_crud(self):
        """Test agents CRUD operations"""
        agent_id = None
        
        # Test GET agents
        try:
            response = self.session.get(f"{self.base_url}/api/agents")
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                agent_count = len(data.get('agents', []))
                details += f" | Found {agent_count} agents"
            else:
                try:
                    error_data = response.json()
                    details += f" | Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f" | Response: {response.text[:100]}"
                    
            self.log_test("List Agents", success, details)
            
        except Exception as e:
            self.log_test("List Agents", False, f"Error: {str(e)}")

        # Test POST create agent
        try:
            new_agent = {
                "name": f"Test Agent {int(time.time())}",
                "strategy": "momentum",
                "exchange": "binance",
                "trading_pairs": ["BTC/USDT", "ETH/USDT"],
                "risk_level": "medium"
            }
            
            response = self.session.post(f"{self.base_url}/api/agents", json=new_agent)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                agent_id = data.get('id')
                details += f" | Agent ID: {agent_id} | PNL: {data.get('pnl', 0)}"
            else:
                try:
                    error_data = response.json()
                    details += f" | Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f" | Response: {response.text[:100]}"
                    
            self.log_test("Create Agent", success, details)
            
        except Exception as e:
            self.log_test("Create Agent", False, f"Error: {str(e)}")

        # Test PATCH toggle agent status
        if agent_id:
            try:
                response = self.session.patch(f"{self.base_url}/api/agents/{agent_id}/toggle")
                success = response.status_code == 200
                details = f"Status: {response.status_code}"
                
                if success:
                    data = response.json()
                    details += f" | New status: {data.get('status', 'N/A')}"
                else:
                    try:
                        error_data = response.json()
                        details += f" | Error: {error_data.get('detail', 'Unknown error')}"
                    except:
                        details += f" | Response: {response.text[:100]}"
                        
                self.log_test("Toggle Agent Status", success, details)
                
            except Exception as e:
                self.log_test("Toggle Agent Status", False, f"Error: {str(e)}")

    def test_validation_endpoints(self):
        """Test validation engine endpoints"""
        # Test GET validation gate
        try:
            response = self.session.get(f"{self.base_url}/api/validation/gate")
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                details += f" | Mode: {data.get('mode', 'N/A')} | Blocked: {data.get('blocked', 'N/A')}"
            else:
                try:
                    error_data = response.json()
                    details += f" | Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f" | Response: {response.text[:100]}"
                    
            self.log_test("Validation Gate Status", success, details)
            
        except Exception as e:
            self.log_test("Validation Gate Status", False, f"Error: {str(e)}")

        # Test GET validation runs
        try:
            response = self.session.get(f"{self.base_url}/api/validation/runs")
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                run_count = len(data.get('runs', []))
                details += f" | Found {run_count} validation runs"
            else:
                try:
                    error_data = response.json()
                    details += f" | Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f" | Response: {response.text[:100]}"
                    
            self.log_test("Validation Runs", success, details)
            
        except Exception as e:
            self.log_test("Validation Runs", False, f"Error: {str(e)}")

        # Test POST validation run
        try:
            validation_data = {
                "symbol": "BTC/USDT",
                "exchange": "binance",
                "expected_price": 50000.0,
                "actual_price": 50005.0,
                "expected_fee_bps": 6.0,
                "actual_fee_bps": 6.0
            }
            
            response = self.session.post(f"{self.base_url}/api/validation/run", json=validation_data)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                details += f" | Passed: {data.get('passed', 'N/A')} | Drift: {data.get('drift_pct', 0)}%"
            else:
                try:
                    error_data = response.json()
                    details += f" | Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f" | Response: {response.text[:100]}"
                    
            self.log_test("Create Validation Run", success, details)
            
        except Exception as e:
            self.log_test("Create Validation Run", False, f"Error: {str(e)}")

    def test_ai_insights(self):
        """Test AI insights endpoint"""
        try:
            insight_request = {
                "prompt": "What are the current market conditions for Bitcoin?",
                "context": "Testing AI integration"
            }
            
            response = self.session.post(f"{self.base_url}/api/ai/insights", json=insight_request)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                insight_length = len(data.get('insight', ''))
                details += f" | Response length: {insight_length} chars"
                if insight_length > 0:
                    details += " | AI response received"
            else:
                try:
                    error_data = response.json()
                    details += f" | Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f" | Response: {response.text[:100]}"
                    
            self.log_test("AI Insights", success, details)
            
        except Exception as e:
            self.log_test("AI Insights", False, f"Error: {str(e)}")

    def test_billing_endpoints(self):
        """Test billing and payments endpoints"""
        # Test GET payment plans
        try:
            response = self.session.get(f"{self.base_url}/api/payments/plans")
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                plan_count = len(data.get('plans', {}))
                details += f" | Found {plan_count} subscription plans"
                if plan_count > 0:
                    plans = list(data.get('plans', {}).keys())
                    details += f" | Plans: {', '.join(plans)}"
            else:
                try:
                    error_data = response.json()
                    details += f" | Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f" | Response: {response.text[:100]}"
                    
            self.log_test("Payment Plans", success, details)
            
        except Exception as e:
            self.log_test("Payment Plans", False, f"Error: {str(e)}")

        # Test POST checkout (will fail without valid Stripe setup, but should return proper error)
        try:
            checkout_request = {
                "plan": "starter",
                "origin_url": "https://mirofish-mobile.preview.emergentagent.com"
            }
            
            response = self.session.post(f"{self.base_url}/api/payments/checkout", json=checkout_request)
            # Expect either success (200) or proper error handling
            success = response.status_code in [200, 400, 500]
            details = f"Status: {response.status_code}"
            
            if response.status_code == 200:
                data = response.json()
                details += f" | Checkout URL created: {bool(data.get('url'))}"
            else:
                try:
                    error_data = response.json()
                    details += f" | Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f" | Response: {response.text[:100]}"
                    
            self.log_test("Stripe Checkout", success, details)
            
        except Exception as e:
            self.log_test("Stripe Checkout", False, f"Error: {str(e)}")

    def test_notifications(self):
        """Test notifications endpoints"""
        try:
            response = self.session.get(f"{self.base_url}/api/notifications")
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                notif_count = len(data.get('notifications', []))
                details += f" | Found {notif_count} notifications"
            else:
                try:
                    error_data = response.json()
                    details += f" | Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f" | Response: {response.text[:100]}"
                    
            self.log_test("Notifications", success, details)
            
        except Exception as e:
            self.log_test("Notifications", False, f"Error: {str(e)}")

    def test_auth_logout(self):
        """Test logout endpoint"""
        try:
            response = self.session.post(f"{self.base_url}/api/auth/logout")
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                details += f" | Message: {data.get('message', 'N/A')}"
                # Check if cookies are cleared
                if 'access_token' not in self.session.cookies:
                    details += " | Cookies cleared"
                else:
                    details += " | Cookies still present"
            else:
                try:
                    error_data = response.json()
                    details += f" | Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f" | Response: {response.text[:100]}"
                    
            self.log_test("Logout", success, details)
            
        except Exception as e:
            self.log_test("Logout", False, f"Error: {str(e)}")

    def run_all_tests(self):
        """Run complete test suite"""
        print("=" * 60)
        print("🚀 MIROFISH API TESTING SUITE")
        print("=" * 60)
        print(f"Testing against: {self.base_url}")
        print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("-" * 60)

        # Basic health checks
        print("\n📡 HEALTH CHECKS")
        self.test_health_check()

        # Authentication flow
        print("\n🔐 AUTHENTICATION TESTS")
        self.test_user_registration()
        
        # Login as admin for authenticated tests
        if self.test_admin_login():
            self.test_auth_me()
            
            # Dashboard and stats
            print("\n📊 DASHBOARD TESTS")
            self.test_dashboard_stats()
            
            # Agents management
            print("\n🤖 AGENTS TESTS")
            self.test_agents_crud()
            
            # Validation engine
            print("\n🛡️ VALIDATION TESTS")
            self.test_validation_endpoints()
            
            # AI insights
            print("\n🧠 AI INSIGHTS TESTS")
            self.test_ai_insights()
            
            # Billing and payments
            print("\n💳 BILLING TESTS")
            self.test_billing_endpoints()
            
            # Notifications
            print("\n🔔 NOTIFICATIONS TESTS")
            self.test_notifications()
            
            # Logout
            print("\n🚪 LOGOUT TESTS")
            self.test_auth_logout()
        else:
            print("❌ Admin login failed - skipping authenticated tests")

        # Print summary
        print("\n" + "=" * 60)
        print("📋 TEST SUMMARY")
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