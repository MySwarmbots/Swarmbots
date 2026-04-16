import { useEffect, useState, useRef, useCallback, createContext, useContext } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import axios from "axios";
import { formatApiErrorDetail, formatCurrency, formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import {
  Activity, Bot, BarChart3, Shield, Bell, CreditCard, LogOut,
  Menu, X, Plus, Trash2, Play, Pause, Send, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle, XCircle, RefreshCw, Zap, Terminal, ChevronRight,
  Settings, Eye, EyeOff, KeyRound, MessageCircle, Mail
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

// ============== WEBSOCKET CONTEXT ==============
const WsContext = createContext(null);

function WsProvider({ children }) {
  const { user } = useAuth();
  const wsRef = useRef(null);
  const [lastMessage, setLastMessage] = useState(null);
  const reconnectTimeout = useRef(null);

  const connect = useCallback(() => {
    if (!user?.id) return;
    // Get access token from a cookie-based auth refresh endpoint
    const wsUrl = API.replace("https://", "wss://").replace("http://", "ws://");
    // We need a token for WS - fetch one via a small trick using the refresh endpoint
    axios.post(`${API}/api/auth/refresh`, {}, { withCredentials: true })
      .then(() => {
        // Use a simple token-less approach by getting a fresh token
        return axios.get(`${API}/api/auth/me`, { withCredentials: true });
      })
      .then(() => {
        // For now, use user id as token placeholder (WS auth via cookie doesn't work in all browsers)
        // The backend WS expects a JWT token in the URL
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    // WebSocket connection handled separately since httpOnly cookies can't be sent to WS
    // Real-time updates will use polling as a fallback
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    };
  }, [user]);

  return (
    <WsContext.Provider value={{ lastMessage }}>
      {children}
    </WsContext.Provider>
  );
}

function useWs() {
  return useContext(WsContext);
}

// ============== PROTECTED ROUTE ==============
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="font-mono text-sm text-[#8A8A8A]">INITIALIZING<span className="cursor-blink"></span></div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <WsProvider>{children}</WsProvider>;
}

// ============== LOGIN PAGE ==============
function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { if (user) navigate("/dashboard"); }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setIsLoading(true);
    try { await login(email, password); navigate("/dashboard"); }
    catch (err) { setError(formatApiErrorDetail(err.response?.data?.detail) || err.message); }
    finally { setIsLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-heading text-4xl font-black tracking-tighter text-white">MIROFISH</h1>
          <p className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] mt-2">SWARM TRADING SYSTEM</p>
        </div>
        <Card className="bg-[#111111] border-[#222222] p-6 rounded-none">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 bg-[#0A0A0A] border-[#333333] rounded-none focus:ring-1 focus:ring-white focus:border-white text-white" required data-testid="login-email-input" />
            </div>
            <div>
              <label className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">Password</label>
              <div className="relative mt-1">
                <Input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="bg-[#0A0A0A] border-[#333333] rounded-none focus:ring-1 focus:ring-white focus:border-white text-white pr-10" required data-testid="login-password-input" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555555] hover:text-white">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {error && <p data-testid="login-error" className="text-[#FF3B30] text-sm font-mono">{error}</p>}
            <Button type="submit" className="w-full bg-white text-black hover:bg-gray-200 rounded-none font-medium" disabled={isLoading} data-testid="login-submit-btn">
              {isLoading ? "AUTHENTICATING..." : "LOGIN"}
            </Button>
          </form>
          <div className="mt-4 flex justify-between">
            <button onClick={() => navigate("/forgot-password")} className="font-mono text-xs text-[#8A8A8A] hover:text-white transition-colors" data-testid="forgot-password-link">FORGOT PASSWORD</button>
            <button onClick={() => navigate("/register")} className="font-mono text-xs text-[#8A8A8A] hover:text-white transition-colors" data-testid="goto-register-link">CREATE ACCOUNT</button>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ============== REGISTER PAGE ==============
function RegisterPage() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [name, setName] = useState("");
  const [error, setError] = useState(""); const [isLoading, setIsLoading] = useState(false);
  const { register, user } = useAuth(); const navigate = useNavigate();

  useEffect(() => { if (user) navigate("/dashboard"); }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(""); setIsLoading(true);
    try { await register(email, password, name); navigate("/dashboard"); }
    catch (err) { setError(formatApiErrorDetail(err.response?.data?.detail) || err.message); }
    finally { setIsLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-heading text-4xl font-black tracking-tighter text-white">MIROFISH</h1>
          <p className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] mt-2">CREATE ACCOUNT</p>
        </div>
        <Card className="bg-[#111111] border-[#222222] p-6 rounded-none">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><label className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">Name</label>
              <Input type="text" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 bg-[#0A0A0A] border-[#333333] rounded-none text-white" required data-testid="register-name-input" /></div>
            <div><label className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 bg-[#0A0A0A] border-[#333333] rounded-none text-white" required data-testid="register-email-input" /></div>
            <div><label className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">Password</label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 bg-[#0A0A0A] border-[#333333] rounded-none text-white" required data-testid="register-password-input" /></div>
            {error && <p className="text-[#FF3B30] text-sm font-mono">{error}</p>}
            <Button type="submit" className="w-full bg-white text-black hover:bg-gray-200 rounded-none" disabled={isLoading} data-testid="register-submit-btn">
              {isLoading ? "CREATING..." : "CREATE ACCOUNT"}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <button onClick={() => navigate("/login")} className="font-mono text-xs text-[#8A8A8A] hover:text-white transition-colors" data-testid="goto-login-link">ALREADY HAVE ACCOUNT</button>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ============== FORGOT PASSWORD PAGE ==============
function ForgotPasswordPage() {
  const [email, setEmail] = useState(""); const [sent, setSent] = useState(false); const [token, setToken] = useState("");
  const [isLoading, setIsLoading] = useState(false); const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(""); setIsLoading(true);
    try {
      const { data } = await axios.post(`${API}/api/auth/forgot-password`, { email });
      setSent(true);
      if (data.reset_token) setToken(data.reset_token);
      toast.success("Reset link generated");
    } catch (err) { setError(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setIsLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-heading text-4xl font-black tracking-tighter text-white">MIROFISH</h1>
          <p className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] mt-2">PASSWORD RESET</p>
        </div>
        <Card className="bg-[#111111] border-[#222222] p-6 rounded-none">
          {!sent ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">Email</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 bg-[#0A0A0A] border-[#333333] rounded-none text-white" required data-testid="forgot-email-input" /></div>
              {error && <p className="text-[#FF3B30] text-sm font-mono">{error}</p>}
              <Button type="submit" className="w-full bg-white text-black hover:bg-gray-200 rounded-none" disabled={isLoading} data-testid="forgot-submit-btn">
                {isLoading ? "SENDING..." : "SEND RESET LINK"}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <CheckCircle size={32} className="text-[#00FF66] mx-auto" />
              <p className="font-mono text-sm text-[#8A8A8A] text-center">A reset link has been sent to your email.</p>
              {token && (
                <div className="terminal-bg p-3 mt-3">
                  <p className="font-mono text-[10px] text-[#555555] mb-1">RESET TOKEN (also sent via Telegram if linked):</p>
                  <p className="font-mono text-xs text-[#00FF66] break-all" data-testid="reset-token">{token}</p>
                </div>
              )}
              <Button onClick={() => navigate(`/reset-password${token ? `?token=${token}` : ""}`)} className="w-full bg-white text-black hover:bg-gray-200 rounded-none" data-testid="go-reset-btn">RESET PASSWORD</Button>
            </div>
          )}
          <div className="mt-4 text-center">
            <button onClick={() => navigate("/login")} className="font-mono text-xs text-[#8A8A8A] hover:text-white transition-colors">BACK TO LOGIN</button>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ============== RESET PASSWORD PAGE ==============
function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState(searchParams.get("token") || "");
  const [newPassword, setNewPassword] = useState(""); const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false); const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(""); setIsLoading(true);
    try {
      await axios.post(`${API}/api/auth/reset-password`, { token, new_password: newPassword });
      setSuccess(true); toast.success("Password reset successful");
    } catch (err) { setError(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setIsLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-heading text-4xl font-black tracking-tighter text-white">MIROFISH</h1>
          <p className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] mt-2">SET NEW PASSWORD</p>
        </div>
        <Card className="bg-[#111111] border-[#222222] p-6 rounded-none">
          {!success ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">Reset Token</label>
                <Input value={token} onChange={(e) => setToken(e.target.value)} className="mt-1 bg-[#0A0A0A] border-[#333333] rounded-none text-white font-mono text-xs" required data-testid="reset-token-input" /></div>
              <div><label className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">New Password</label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-1 bg-[#0A0A0A] border-[#333333] rounded-none text-white" required data-testid="reset-newpassword-input" /></div>
              {error && <p className="text-[#FF3B30] text-sm font-mono">{error}</p>}
              <Button type="submit" className="w-full bg-white text-black hover:bg-gray-200 rounded-none" disabled={isLoading} data-testid="reset-submit-btn">
                {isLoading ? "RESETTING..." : "RESET PASSWORD"}
              </Button>
            </form>
          ) : (
            <div className="text-center space-y-4">
              <CheckCircle size={32} className="text-[#00FF66] mx-auto" />
              <p className="font-mono text-sm text-white">Password reset successful!</p>
              <Button onClick={() => navigate("/login")} className="w-full bg-white text-black hover:bg-gray-200 rounded-none" data-testid="back-login-btn">BACK TO LOGIN</Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ============== DASHBOARD LAYOUT ==============
function DashboardLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const { data } = await axios.get(`${API}/api/notifications/unread-count`, { withCredentials: true });
        setUnread(data.count);
      } catch {}
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => { await logout(); navigate("/login"); };

  const navItems = [
    { icon: Activity, label: "Dashboard", path: "/dashboard" },
    { icon: Bot, label: "Agents", path: "/agents" },
    { icon: BarChart3, label: "Charts", path: "/charts" },
    { icon: Shield, label: "Validation", path: "/validation" },
    { icon: Terminal, label: "AI Insights", path: "/insights" },
    { icon: Bell, label: "Alerts", path: "/notifications", badge: unread },
    { icon: CreditCard, label: "Billing", path: "/billing" },
    { icon: Settings, label: "Settings", path: "/settings" },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <header className="bg-[#0A0A0A] border-b border-[#222222] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-4">
              <button className="lg:hidden text-white" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} data-testid="mobile-menu-toggle">
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
              <h1 className="font-heading text-xl font-black tracking-tighter text-white cursor-pointer" onClick={() => navigate("/dashboard")}>MIROFISH</h1>
            </div>
            <nav className="hidden lg:flex items-center gap-0.5">
              {navItems.map((item) => (
                <button key={item.path} onClick={() => navigate(item.path)}
                  className="relative flex items-center gap-1.5 px-2.5 py-2 text-[#8A8A8A] hover:text-white hover:bg-[#1A1A1A] transition-all duration-150"
                  data-testid={`nav-${item.label.toLowerCase()}`}>
                  <item.icon size={15} strokeWidth={1.5} />
                  <span className="font-mono text-[10px] tracking-wider uppercase">{item.label}</span>
                  {item.badge > 0 && <span className="absolute -top-0.5 -right-0.5 bg-[#FF3B30] text-white text-[8px] font-mono w-4 h-4 flex items-center justify-center rounded-full">{item.badge}</span>}
                </button>
              ))}
            </nav>
            <div className="flex items-center gap-3">
              <span className="hidden sm:block font-mono text-[10px] text-[#555555]">{user?.email}</span>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-[#8A8A8A] hover:text-white hover:bg-[#1A1A1A]" data-testid="logout-btn">
                <LogOut size={16} strokeWidth={1.5} />
              </Button>
            </div>
          </div>
        </div>
        {mobileMenuOpen && (
          <nav className="lg:hidden border-t border-[#222222] bg-[#111111]">
            {navItems.map((item) => (
              <button key={item.path} onClick={() => { navigate(item.path); setMobileMenuOpen(false); }}
                className="flex items-center gap-3 w-full px-4 py-3 text-[#8A8A8A] hover:text-white hover:bg-[#1A1A1A] transition-all"
                data-testid={`mobile-nav-${item.label.toLowerCase()}`}>
                <item.icon size={18} strokeWidth={1.5} />
                <span className="font-mono text-xs tracking-wider uppercase">{item.label}</span>
                {item.badge > 0 && <span className="ml-auto bg-[#FF3B30] text-white text-[8px] font-mono w-4 h-4 flex items-center justify-center rounded-full">{item.badge}</span>}
              </button>
            ))}
          </nav>
        )}
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">{children}</main>
    </div>
  );
}

// ============== DASHBOARD PAGE ==============
function DashboardPage() {
  const [stats, setStats] = useState(null); const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 8000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try { const { data } = await axios.get(`${API}/api/dashboard/stats`, { withCredentials: true }); setStats(data); }
    catch {} finally { setLoading(false); }
  };

  if (loading) return <DashboardLayout><div className="font-mono text-sm text-[#8A8A8A]">LOADING DATA<span className="cursor-blink"></span></div></DashboardLayout>;

  const statCards = [
    { label: "TOTAL AGENTS", value: stats?.total_agents || 0, icon: Bot, color: "text-white" },
    { label: "ACTIVE AGENTS", value: stats?.active_agents || 0, icon: Zap, color: "text-[#00FF66]" },
    { label: "TOTAL PNL", value: formatCurrency(stats?.total_pnl || 0), icon: stats?.total_pnl >= 0 ? TrendingUp : TrendingDown, color: stats?.total_pnl >= 0 ? "text-[#00FF66]" : "text-[#FF3B30]" },
    { label: "AVG WIN RATE", value: `${stats?.avg_win_rate || 0}%`, icon: BarChart3, color: "text-[#FFCC00]" },
    { label: "TOTAL TRADES", value: formatNumber(stats?.total_trades || 0, 0), icon: Activity, color: "text-white" },
    { label: "GATE STATUS", value: stats?.validation_summary?.gate?.blocked ? "BLOCKED" : "OPEN", icon: Shield, color: stats?.validation_summary?.gate?.blocked ? "text-[#FF3B30]" : "text-[#00FF66]" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl font-bold tracking-tight text-white">CONTROL ROOM</h2>
          <div className="flex items-center gap-2">
            <span className={`status-dot ${stats?.validation_summary?.gate?.blocked ? 'status-dot-danger' : 'status-dot-success'}`}></span>
            <span className="font-mono text-xs text-[#8A8A8A] uppercase">GATE: {stats?.validation_summary?.gate?.mode || "SHADOW"}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {statCards.map((stat, i) => (
            <Card key={i} className="bg-[#111111] border-[#222222] p-4 rounded-none hover:border-[#333333] transition-all" data-testid={`stat-${stat.label.toLowerCase().replace(/\s/g, '-')}`}>
              <stat.icon size={16} strokeWidth={1.5} className="text-[#555555] mb-2" />
              <p className={`font-mono text-xl font-medium tabular-nums ${stat.color}`}>{stat.value}</p>
              <p className="font-mono text-[10px] tracking-[0.15em] text-[#555555] mt-1">{stat.label}</p>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-[#111111] border-[#222222] p-4 rounded-none">
            <h3 className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase mb-3">QUICK ACTIONS</h3>
            <div className="space-y-2">
              {[{ icon: Bot, label: "Manage Agents", path: "/agents" }, { icon: BarChart3, label: "Performance Charts", path: "/charts" }, { icon: Terminal, label: "AI Insights", path: "/insights" }, { icon: Settings, label: "Settings & Telegram", path: "/settings" }].map((a) => (
                <Button key={a.path} className="w-full justify-start bg-transparent border border-[#222222] text-white hover:bg-white hover:text-black rounded-none transition-all" onClick={() => window.location.href = a.path} data-testid={`quick-${a.path.slice(1)}`}>
                  <a.icon size={16} className="mr-2" /> {a.label}
                </Button>
              ))}
            </div>
          </Card>
          <Card className="bg-[#111111] border-[#222222] p-4 rounded-none">
            <h3 className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase mb-3">SYSTEM STATUS</h3>
            <div className="space-y-3">
              {[
                ["GATE MODE", stats?.validation_summary?.gate?.mode?.toUpperCase(), "text-white"],
                ["GATE STATUS", stats?.validation_summary?.gate?.blocked ? "BLOCKED" : "OPEN", stats?.validation_summary?.gate?.blocked ? "text-[#FF3B30]" : "text-[#00FF66]"],
                ["VALIDATION", `${stats?.validation_summary?.passed}/${stats?.validation_summary?.total_runs} PASSED`, "text-white"],
                ["UNREAD ALERTS", `${stats?.unread_notifications || 0}`, stats?.unread_notifications > 0 ? "text-[#FFCC00]" : "text-[#8A8A8A]"],
              ].map(([label, value, color]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="font-mono text-xs text-[#8A8A8A]">{label}</span>
                  <span className={`font-mono text-xs ${color}`}>{value}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

// ============== AGENTS PAGE ==============
function AgentsPage() {
  const [agents, setAgents] = useState([]); const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newAgent, setNewAgent] = useState({ name: "", strategy: "momentum", exchange: "binance", trading_pairs: [], risk_level: "medium" });
  const [pairInput, setPairInput] = useState("");

  useEffect(() => { fetchAgents(); }, []);
  const fetchAgents = async () => {
    try { const { data } = await axios.get(`${API}/api/agents`, { withCredentials: true }); setAgents(data.agents); }
    catch { toast.error("Failed to load agents"); } finally { setLoading(false); }
  };

  const createAgent = async () => {
    if (!newAgent.name.trim()) { toast.error("Agent name is required"); return; }
    try {
      await axios.post(`${API}/api/agents`, newAgent, { withCredentials: true });
      toast.success("Agent deployed"); setDialogOpen(false);
      setNewAgent({ name: "", strategy: "momentum", exchange: "binance", trading_pairs: [], risk_level: "medium" });
      fetchAgents();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const toggleAgent = async (id) => { try { await axios.patch(`${API}/api/agents/${id}/toggle`, {}, { withCredentials: true }); fetchAgents(); } catch { toast.error("Failed"); } };
  const deleteAgent = async (id) => { try { await axios.delete(`${API}/api/agents/${id}`, { withCredentials: true }); toast.success("Deleted"); fetchAgents(); } catch { toast.error("Failed"); } };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl font-bold tracking-tight text-white">TRADING AGENTS</h2>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button className="bg-white text-black hover:bg-gray-200 rounded-none" data-testid="create-agent-btn"><Plus size={16} className="mr-2" /> NEW AGENT</Button></DialogTrigger>
            <DialogContent className="bg-[#111111] border-[#333333] rounded-none max-w-md">
              <DialogHeader><DialogTitle className="font-heading text-white">CREATE AGENT</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <div><label className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">Name</label>
                  <Input value={newAgent.name} onChange={(e) => setNewAgent({...newAgent, name: e.target.value})} className="mt-1 bg-[#0A0A0A] border-[#333333] rounded-none text-white" data-testid="agent-name-input" /></div>
                <div><label className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">Strategy</label>
                  <Select value={newAgent.strategy} onValueChange={(v) => setNewAgent({...newAgent, strategy: v})}>
                    <SelectTrigger className="mt-1 bg-[#0A0A0A] border-[#333333] rounded-none text-white" data-testid="agent-strategy-select"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#111111] border-[#333333]"><SelectItem value="momentum">Momentum</SelectItem><SelectItem value="mean_reversion">Mean Reversion</SelectItem><SelectItem value="arbitrage">Arbitrage</SelectItem><SelectItem value="grid">Grid Trading</SelectItem></SelectContent>
                  </Select></div>
                <div><label className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">Exchange</label>
                  <Select value={newAgent.exchange} onValueChange={(v) => setNewAgent({...newAgent, exchange: v})}>
                    <SelectTrigger className="mt-1 bg-[#0A0A0A] border-[#333333] rounded-none text-white" data-testid="agent-exchange-select"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#111111] border-[#333333]"><SelectItem value="binance">Binance</SelectItem><SelectItem value="coinbase">Coinbase</SelectItem><SelectItem value="kraken">Kraken</SelectItem></SelectContent>
                  </Select></div>
                <div><label className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">Pairs</label>
                  <div className="flex gap-2 mt-1"><Input value={pairInput} onChange={(e) => setPairInput(e.target.value)} onKeyPress={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (pairInput) { setNewAgent({...newAgent, trading_pairs: [...newAgent.trading_pairs, pairInput.toUpperCase()]}); setPairInput(""); } }}} placeholder="BTC/USDT" className="bg-[#0A0A0A] border-[#333333] rounded-none text-white" data-testid="agent-pair-input" />
                    <Button onClick={() => { if (pairInput) { setNewAgent({...newAgent, trading_pairs: [...newAgent.trading_pairs, pairInput.toUpperCase()]}); setPairInput(""); }}} className="bg-[#1A1A1A] text-white hover:bg-[#333333] rounded-none">ADD</Button></div>
                  <div className="flex flex-wrap gap-1 mt-2">{newAgent.trading_pairs.map((p, i) => (<Badge key={i} variant="outline" className="bg-[#1A1A1A] border-[#333333] text-white rounded-none cursor-pointer" onClick={() => setNewAgent({...newAgent, trading_pairs: newAgent.trading_pairs.filter((_, idx) => idx !== i)})}>{p} x</Badge>))}</div></div>
                <div><label className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">Risk</label>
                  <Select value={newAgent.risk_level} onValueChange={(v) => setNewAgent({...newAgent, risk_level: v})}>
                    <SelectTrigger className="mt-1 bg-[#0A0A0A] border-[#333333] rounded-none text-white" data-testid="agent-risk-select"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#111111] border-[#333333]"><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent>
                  </Select></div>
                <Button onClick={createAgent} className="w-full bg-white text-black hover:bg-gray-200 rounded-none" data-testid="submit-agent-btn">DEPLOY AGENT</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        {loading ? <div className="font-mono text-sm text-[#8A8A8A]">LOADING<span className="cursor-blink"></span></div> :
          agents.length === 0 ? <Card className="bg-[#111111] border-[#222222] p-8 rounded-none text-center"><Bot size={48} className="mx-auto text-[#333333] mb-4" /><p className="font-mono text-sm text-[#8A8A8A]">NO AGENTS DEPLOYED</p></Card> :
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent) => (
              <Card key={agent.id} className="bg-[#111111] border-[#222222] p-4 rounded-none hover:border-[#333333] transition-all" data-testid={`agent-card-${agent.id}`}>
                <div className="flex items-start justify-between mb-3">
                  <div><h3 className="font-mono text-sm font-medium text-white">{agent.name}</h3><p className="font-mono text-xs text-[#555555] mt-1">{agent.strategy.toUpperCase()} / {agent.exchange.toUpperCase()}</p></div>
                  <div className="flex items-center gap-2"><span className={`status-dot ${agent.status === 'active' ? 'status-dot-success' : 'status-dot-warning'}`}></span><span className="font-mono text-[10px] text-[#8A8A8A] uppercase">{agent.status}</span></div>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div><p className="font-mono text-[10px] text-[#555555]">PNL</p><p className={`font-mono text-sm tabular-nums ${agent.pnl >= 0 ? 'text-[#00FF66]' : 'text-[#FF3B30]'}`}>{formatCurrency(agent.pnl)}</p></div>
                  <div><p className="font-mono text-[10px] text-[#555555]">WIN RATE</p><p className="font-mono text-sm tabular-nums text-white">{(agent.win_rate * 100).toFixed(0)}%</p></div>
                  <div><p className="font-mono text-[10px] text-[#555555]">TRADES</p><p className="font-mono text-sm tabular-nums text-white">{agent.total_trades}</p></div>
                </div>
                <div className="flex flex-wrap gap-1 mb-3">{agent.trading_pairs.map((p, i) => (<Badge key={i} variant="outline" className="bg-transparent border-[#333333] text-[#8A8A8A] rounded-none text-[10px]">{p}</Badge>))}</div>
                <div className="flex items-center justify-between pt-3 border-t border-[#222222]">
                  <Button variant="ghost" size="sm" onClick={() => toggleAgent(agent.id)} className="text-[#8A8A8A] hover:text-white" data-testid={`toggle-agent-${agent.id}`}>
                    {agent.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => window.location.href = `/charts?agent=${agent.id}`} className="text-[#8A8A8A] hover:text-white"><BarChart3 size={14} /></Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteAgent(agent.id)} className="text-[#8A8A8A] hover:text-[#FF3B30]" data-testid={`delete-agent-${agent.id}`}><Trash2 size={14} /></Button>
                </div>
              </Card>
            ))}
          </div>
        }
      </div>
    </DashboardLayout>
  );
}

// ============== CHARTS PAGE ==============
const CHART_COLORS = ["#00FF66", "#FF3B30", "#FFCC00", "#002FA7", "#FFFFFF"];

function ChartsPage() {
  const [searchParams] = useSearchParams();
  const [portfolio, setPortfolio] = useState(null);
  const [agentPerf, setAgentPerf] = useState(null);
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(searchParams.get("agent") || "");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPortfolio();
    fetchAgents();
  }, []);

  useEffect(() => {
    if (selectedAgent) fetchAgentPerf(selectedAgent);
  }, [selectedAgent]);

  const fetchPortfolio = async () => {
    try { const { data } = await axios.get(`${API}/api/agents/portfolio/summary`, { withCredentials: true }); setPortfolio(data); }
    catch {} finally { setLoading(false); }
  };
  const fetchAgents = async () => {
    try { const { data } = await axios.get(`${API}/api/agents`, { withCredentials: true }); setAgents(data.agents); if (!selectedAgent && data.agents.length) setSelectedAgent(data.agents[0].id); }
    catch {}
  };
  const fetchAgentPerf = async (id) => {
    try { const { data } = await axios.get(`${API}/api/agents/${id}/performance`, { withCredentials: true }); setAgentPerf(data); }
    catch { setAgentPerf(null); }
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-[#111111] border border-[#333333] p-2">
        <p className="font-mono text-[10px] text-[#8A8A8A]">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="font-mono text-xs" style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</p>
        ))}
      </div>
    );
  };

  if (loading) return <DashboardLayout><div className="font-mono text-sm text-[#8A8A8A]">LOADING CHARTS<span className="cursor-blink"></span></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h2 className="font-heading text-2xl font-bold tracking-tight text-white">PERFORMANCE CHARTS</h2>

        <Tabs defaultValue="portfolio" className="w-full">
          <TabsList className="bg-[#111111] border border-[#222222] rounded-none p-1">
            <TabsTrigger value="portfolio" className="rounded-none font-mono text-xs data-[state=active]:bg-white data-[state=active]:text-black" data-testid="tab-portfolio">PORTFOLIO</TabsTrigger>
            <TabsTrigger value="agent" className="rounded-none font-mono text-xs data-[state=active]:bg-white data-[state=active]:text-black" data-testid="tab-agent">AGENT</TabsTrigger>
          </TabsList>

          <TabsContent value="portfolio" className="space-y-4 mt-4">
            {/* Portfolio PnL Chart */}
            <Card className="bg-[#111111] border-[#222222] p-4 rounded-none">
              <h3 className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase mb-4">CUMULATIVE PNL</h3>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={portfolio?.portfolio_history || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222222" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#555555', fontFamily: 'IBM Plex Mono' }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10, fill: '#555555', fontFamily: 'IBM Plex Mono' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="cumulative_pnl" name="PnL" stroke="#00FF66" fill="#00FF66" fillOpacity={0.1} strokeWidth={1.5} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Daily PnL */}
              <Card className="bg-[#111111] border-[#222222] p-4 rounded-none">
                <h3 className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase mb-4">DAILY PNL</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={portfolio?.portfolio_history || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222222" />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#555555', fontFamily: 'IBM Plex Mono' }} tickFormatter={(v) => v.slice(8)} />
                    <YAxis tick={{ fontSize: 9, fill: '#555555', fontFamily: 'IBM Plex Mono' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="daily_pnl" name="Daily PnL" fill="#00FF66">
                      {(portfolio?.portfolio_history || []).map((entry, i) => (
                        <Cell key={i} fill={entry.daily_pnl >= 0 ? "#00FF66" : "#FF3B30"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* Win Rate */}
              <Card className="bg-[#111111] border-[#222222] p-4 rounded-none">
                <h3 className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase mb-4">WIN RATE TREND</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={portfolio?.portfolio_history || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222222" />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#555555', fontFamily: 'IBM Plex Mono' }} tickFormatter={(v) => v.slice(8)} />
                    <YAxis tick={{ fontSize: 9, fill: '#555555', fontFamily: 'IBM Plex Mono' }} domain={[0, 100]} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="win_rate" name="Win %" stroke="#FFCC00" dot={false} strokeWidth={1.5} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </div>

            {/* Strategy & Exchange Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-[#111111] border-[#222222] p-4 rounded-none">
                <h3 className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase mb-4">PNL BY STRATEGY</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={portfolio?.by_strategy || []} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#222222" />
                    <XAxis type="number" tick={{ fontSize: 9, fill: '#555555', fontFamily: 'IBM Plex Mono' }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#8A8A8A', fontFamily: 'IBM Plex Mono' }} width={100} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="pnl" name="PnL" fill="#002FA7">
                      {(portfolio?.by_strategy || []).map((e, i) => (<Cell key={i} fill={e.pnl >= 0 ? "#00FF66" : "#FF3B30"} />))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
              <Card className="bg-[#111111] border-[#222222] p-4 rounded-none">
                <h3 className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase mb-4">PNL BY EXCHANGE</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={portfolio?.by_exchange || []} dataKey="pnl" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: $${value}`}>
                      {(portfolio?.by_exchange || []).map((_, i) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="agent" className="space-y-4 mt-4">
            <div className="flex items-center gap-4">
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger className="w-64 bg-[#0A0A0A] border-[#333333] rounded-none text-white" data-testid="agent-perf-select"><SelectValue placeholder="Select agent" /></SelectTrigger>
                <SelectContent className="bg-[#111111] border-[#333333]">
                  {agents.map((a) => (<SelectItem key={a.id} value={a.id}>{a.name} ({a.strategy})</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            {agentPerf ? (
              <>
                <Card className="bg-[#111111] border-[#222222] p-4 rounded-none">
                  <h3 className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase mb-4">AGENT CUMULATIVE PNL</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={agentPerf.history}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#222222" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#555555', fontFamily: 'IBM Plex Mono' }} tickFormatter={(v) => v.slice(5)} />
                      <YAxis tick={{ fontSize: 10, fill: '#555555', fontFamily: 'IBM Plex Mono' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="cumulative_pnl" name="Cumulative PnL" stroke="#00FF66" fill="#00FF66" fillOpacity={0.1} strokeWidth={1.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="bg-[#111111] border-[#222222] p-4 rounded-none">
                    <h3 className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase mb-4">TRADE VOLUME</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={agentPerf.history}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222222" />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#555555', fontFamily: 'IBM Plex Mono' }} tickFormatter={(v) => v.slice(8)} />
                        <YAxis tick={{ fontSize: 9, fill: '#555555', fontFamily: 'IBM Plex Mono' }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="volume" name="Volume ($)" stroke="#002FA7" fill="#002FA7" fillOpacity={0.15} strokeWidth={1} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Card>
                  <Card className="bg-[#111111] border-[#222222] p-4 rounded-none">
                    <h3 className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase mb-4">DAILY TRADES & WINS</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={agentPerf.history}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222222" />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#555555', fontFamily: 'IBM Plex Mono' }} tickFormatter={(v) => v.slice(8)} />
                        <YAxis tick={{ fontSize: 9, fill: '#555555', fontFamily: 'IBM Plex Mono' }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="trades" name="Trades" fill="#333333" />
                        <Bar dataKey="wins" name="Wins" fill="#00FF66" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                </div>
              </>
            ) : (
              <Card className="bg-[#111111] border-[#222222] p-8 rounded-none text-center">
                <BarChart3 size={48} className="mx-auto text-[#333333] mb-4" />
                <p className="font-mono text-sm text-[#8A8A8A]">SELECT AN AGENT TO VIEW PERFORMANCE</p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// ============== VALIDATION PAGE ==============
function ValidationPage() {
  const [runs, setRuns] = useState([]); const [gate, setGate] = useState(null); const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 5000); return () => clearInterval(i); }, []);
  const fetchData = async () => {
    try {
      const [r, g] = await Promise.all([axios.get(`${API}/api/validation/runs`, { withCredentials: true }), axios.get(`${API}/api/validation/gate`, { withCredentials: true })]);
      setRuns(r.data.runs); setGate(g.data);
    } catch {} finally { setLoading(false); }
  };
  const updateGate = async (mode, blocked) => {
    try { await axios.post(`${API}/api/validation/gate`, { mode, blocked, reason: "" }, { withCredentials: true }); toast.success("Gate updated"); fetchData(); }
    catch { toast.error("Failed"); }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl font-bold tracking-tight text-white">VALIDATION ENGINE</h2>
          <Button variant="ghost" onClick={fetchData} className="text-[#8A8A8A] hover:text-white" data-testid="refresh-validation"><RefreshCw size={16} /></Button>
        </div>
        <Card className="bg-[#111111] border-[#222222] p-4 rounded-none">
          <h3 className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase mb-4">ROLLOUT GATE</h3>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2"><span className={`status-dot ${gate?.blocked ? 'status-dot-danger' : 'status-dot-success'}`}></span><span className="font-mono text-sm text-white">{gate?.blocked ? "BLOCKED" : "OPEN"}</span></div>
            <div className="flex items-center gap-2"><span className="font-mono text-xs text-[#8A8A8A]">MODE:</span>
              <Select value={gate?.mode || "shadow"} onValueChange={(v) => updateGate(v, gate?.blocked || false)}>
                <SelectTrigger className="w-32 bg-[#0A0A0A] border-[#333333] rounded-none text-white h-8" data-testid="gate-mode-select"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#111111] border-[#333333]"><SelectItem value="shadow">Shadow</SelectItem><SelectItem value="live">Live</SelectItem></SelectContent>
              </Select></div>
            <div className="flex items-center gap-2"><span className="font-mono text-xs text-[#8A8A8A]">BLOCKED:</span><Switch checked={gate?.blocked || false} onCheckedChange={(v) => updateGate(gate?.mode || "shadow", v)} data-testid="gate-blocked-switch" /></div>
          </div>
        </Card>
        <Card className="bg-[#111111] border-[#222222] rounded-none overflow-hidden">
          <div className="p-4 border-b border-[#222222]"><h3 className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">VALIDATION RUNS ({runs.length})</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="bg-[#0A0A0A]"><tr>
                {["TIME", "SYMBOL", "EXCHANGE", "DRIFT %", "SLIP BPS", "STATUS"].map((h) => (
                  <th key={h} className={`font-mono text-[10px] tracking-wider text-[#555555] p-3 ${h === "DRIFT %" || h === "SLIP BPS" ? "text-right" : h === "STATUS" ? "text-center" : "text-left"}`}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {runs.map((run, i) => (
                  <tr key={i} className="border-t border-[#1A1A1A] hover:bg-[#151515] transition-colors" data-testid={`validation-run-${i}`}>
                    <td className="font-mono text-xs text-[#8A8A8A] p-3">{new Date(run.ts).toLocaleTimeString()}</td>
                    <td className="font-mono text-xs text-white p-3">{run.symbol}</td>
                    <td className="font-mono text-xs text-[#8A8A8A] p-3">{run.exchange}</td>
                    <td className="font-mono text-xs text-white text-right p-3 tabular-nums">{run.drift_pct?.toFixed(4)}</td>
                    <td className="font-mono text-xs text-white text-right p-3 tabular-nums">{run.slippage_bps?.toFixed(2)}</td>
                    <td className="p-3 text-center"><span className={`inline-flex items-center gap-1 font-mono text-[10px] uppercase ${run.passed ? 'text-[#00FF66]' : 'text-[#FF3B30]'}`}><span className={`status-dot ${run.passed ? 'status-dot-success' : 'status-dot-danger'}`}></span>{run.passed ? "PASS" : "FAIL"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}

// ============== AI INSIGHTS PAGE ==============
function InsightsPage() {
  const [prompt, setPrompt] = useState(""); const [insights, setInsights] = useState([]); const [loading, setLoading] = useState(false);

  const fetchInsight = async () => {
    if (!prompt.trim()) return; setLoading(true);
    try {
      const { data } = await axios.post(`${API}/api/ai/insights`, { prompt }, { withCredentials: true });
      setInsights([{ prompt, response: data.insight, timestamp: data.timestamp }, ...insights]); setPrompt("");
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Failed"); }
    finally { setLoading(false); }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h2 className="font-heading text-2xl font-bold tracking-tight text-white">AI TRADING INSIGHTS</h2>
        <Card className="terminal-bg p-4 rounded-none">
          <div className="flex gap-2">
            <Input value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && fetchInsight()} placeholder="Ask MiroFish AI..." className="flex-1 bg-transparent border-[#333333] rounded-none text-white font-mono text-sm" data-testid="ai-prompt-input" />
            <Button onClick={fetchInsight} disabled={loading} className="bg-white text-black hover:bg-gray-200 rounded-none" data-testid="ai-submit-btn">
              {loading ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {["Analyze BTC market conditions", "Best strategy for volatile markets?", "Risk factors for ETH swing trading", "DeFi arbitrage opportunities"].map((p, i) => (
              <button key={i} onClick={() => setPrompt(p)} className="font-mono text-[10px] text-[#555555] hover:text-white border border-[#333333] px-2 py-1 transition-colors" data-testid={`sample-prompt-${i}`}>{p}</button>
            ))}
          </div>
        </Card>
        <div className="space-y-4">
          {insights.length === 0 ? (
            <Card className="terminal-bg p-8 rounded-none text-center"><Terminal size={48} className="mx-auto text-[#333333] mb-4" /><p className="font-mono text-sm text-[#8A8A8A]">AWAITING QUERY</p></Card>
          ) : insights.map((item, i) => (
            <Card key={i} className="terminal-bg p-4 rounded-none" data-testid={`insight-${i}`}>
              <div className="flex items-center gap-2 mb-2"><ChevronRight size={12} className="text-[#00FF66]" /><span className="font-mono text-xs text-[#00FF66]">{item.prompt}</span></div>
              <pre className="font-mono text-sm text-[#E0E0E0] whitespace-pre-wrap leading-relaxed">{item.response}</pre>
              <p className="font-mono text-[10px] text-[#555555] mt-2">{new Date(item.timestamp).toLocaleString()}</p>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}

// ============== NOTIFICATIONS PAGE ==============
function NotificationsPage() {
  const [notifications, setNotifications] = useState([]); const [loading, setLoading] = useState(true);

  useEffect(() => { fetchNotifications(); }, []);
  const fetchNotifications = async () => {
    try { const { data } = await axios.get(`${API}/api/notifications`, { withCredentials: true }); setNotifications(data.notifications); }
    catch {} finally { setLoading(false); }
  };
  const markRead = async (id) => { try { await axios.patch(`${API}/api/notifications/${id}/read`, {}, { withCredentials: true }); fetchNotifications(); } catch {} };
  const markAllRead = async () => { try { await axios.post(`${API}/api/notifications/mark-all-read`, {}, { withCredentials: true }); toast.success("All read"); fetchNotifications(); } catch {} };

  const getIcon = (t) => {
    switch (t) { case 'success': return <CheckCircle size={16} className="text-[#00FF66]" />; case 'error': return <XCircle size={16} className="text-[#FF3B30]" />; case 'warning': return <AlertTriangle size={16} className="text-[#FFCC00]" />; default: return <Bell size={16} className="text-[#8A8A8A]" />; }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl font-bold tracking-tight text-white">NOTIFICATIONS</h2>
          {notifications.length > 0 && <Button onClick={markAllRead} className="bg-transparent border border-[#333333] text-white hover:bg-white hover:text-black rounded-none text-xs" data-testid="mark-all-read-btn">MARK ALL READ</Button>}
        </div>
        {loading ? <div className="font-mono text-sm text-[#8A8A8A]">LOADING<span className="cursor-blink"></span></div> :
          notifications.length === 0 ? <Card className="bg-[#111111] border-[#222222] p-8 rounded-none text-center"><Bell size={48} className="mx-auto text-[#333333] mb-4" /><p className="font-mono text-sm text-[#8A8A8A]">NO NOTIFICATIONS</p></Card> :
          <div className="space-y-2">
            {notifications.map((n) => (
              <Card key={n.id} className={`bg-[#111111] border-[#222222] p-4 rounded-none ${!n.read ? 'border-l-2 border-l-white' : ''}`} data-testid={`notification-${n.id}`}>
                <div className="flex items-start gap-3">
                  {getIcon(n.type)}
                  <div className="flex-1">
                    <p className="font-mono text-sm text-white">{n.title}</p>
                    <p className="font-mono text-xs text-[#8A8A8A] mt-1">{n.message}</p>
                    <p className="font-mono text-[10px] text-[#555555] mt-2">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                  {!n.read && <Button variant="ghost" size="sm" onClick={() => markRead(n.id)} className="text-[#8A8A8A] hover:text-white"><CheckCircle size={14} /></Button>}
                </div>
              </Card>
            ))}
          </div>
        }
      </div>
    </DashboardLayout>
  );
}

// ============== BILLING PAGE ==============
function BillingPage() {
  const [plans, setPlans] = useState({}); const [loading, setLoading] = useState(true); const [checkoutLoading, setCheckoutLoading] = useState(null);

  useEffect(() => { fetchPlans(); }, []);
  const fetchPlans = async () => { try { const { data } = await axios.get(`${API}/api/payments/plans`, { withCredentials: true }); setPlans(data.plans); } catch {} finally { setLoading(false); } };

  const handleCheckout = async (planId) => {
    setCheckoutLoading(planId);
    try { const { data } = await axios.post(`${API}/api/payments/checkout`, { plan: planId, origin_url: window.location.origin }, { withCredentials: true }); window.location.href = data.url; }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Checkout failed"); }
    finally { setCheckoutLoading(null); }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h2 className="font-heading text-2xl font-bold tracking-tight text-white">BILLING & SUBSCRIPTION</h2>
        {loading ? <div className="font-mono text-sm text-[#8A8A8A]">LOADING<span className="cursor-blink"></span></div> :
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(plans).map(([id, plan]) => (
              <Card key={id} className={`bg-[#111111] border-[#222222] p-6 rounded-none hover:border-[#333333] transition-all ${id === 'pro' ? 'border-white' : ''}`} data-testid={`plan-${id}`}>
                {id === 'pro' && <Badge className="bg-white text-black rounded-none mb-4">POPULAR</Badge>}
                <h3 className="font-heading text-xl font-bold text-white">{plan.name}</h3>
                <p className="font-mono text-3xl font-bold text-white mt-2 tabular-nums">{formatCurrency(plan.amount)}<span className="text-sm text-[#8A8A8A]">/mo</span></p>
                <ul className="mt-4 space-y-2">{plan.features.map((f, i) => (<li key={i} className="flex items-center gap-2 font-mono text-xs text-[#8A8A8A]"><CheckCircle size={12} className="text-[#00FF66]" />{f}</li>))}</ul>
                <Button onClick={() => handleCheckout(id)} disabled={checkoutLoading === id}
                  className={`w-full mt-6 rounded-none ${id === 'pro' ? 'bg-white text-black hover:bg-gray-200' : 'bg-transparent border border-[#333333] text-white hover:bg-white hover:text-black'}`}
                  data-testid={`checkout-${id}`}>{checkoutLoading === id ? "PROCESSING..." : "SUBSCRIBE"}</Button>
              </Card>
            ))}
          </div>
        }
      </div>
    </DashboardLayout>
  );
}

// ============== SETTINGS PAGE ==============
function SettingsPage() {
  const [profile, setProfile] = useState(null); const [loading, setLoading] = useState(true);
  const [chatId, setChatId] = useState(""); const [saving, setSaving] = useState(false);

  useEffect(() => { fetchProfile(); }, []);
  const fetchProfile = async () => {
    try { const { data } = await axios.get(`${API}/api/profile`, { withCredentials: true }); setProfile(data); setChatId(data.telegram_chat_id || ""); }
    catch {} finally { setLoading(false); }
  };

  const linkTelegram = async () => {
    if (!chatId.trim()) { toast.error("Enter your Telegram Chat ID"); return; }
    setSaving(true);
    try { await axios.post(`${API}/api/telegram/link`, { chat_id: chatId }, { withCredentials: true }); toast.success("Telegram linked! Check your Telegram for a confirmation."); fetchProfile(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  const unlinkTelegram = async () => {
    try { await axios.post(`${API}/api/telegram/unlink`, {}, { withCredentials: true }); toast.success("Telegram unlinked"); setChatId(""); fetchProfile(); }
    catch { toast.error("Failed"); }
  };

  const testTelegram = async () => {
    try { await axios.post(`${API}/api/telegram/test`, {}, { withCredentials: true }); toast.success("Test message sent! Check Telegram."); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const updatePrefs = async (field, value) => {
    try { await axios.patch(`${API}/api/profile`, { [field]: value }, { withCredentials: true }); fetchProfile(); }
    catch { toast.error("Failed to update"); }
  };

  if (loading) return <DashboardLayout><div className="font-mono text-sm text-[#8A8A8A]">LOADING<span className="cursor-blink"></span></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl">
        <h2 className="font-heading text-2xl font-bold tracking-tight text-white">SETTINGS</h2>

        {/* Profile */}
        <Card className="bg-[#111111] border-[#222222] p-6 rounded-none">
          <h3 className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase mb-4">PROFILE</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center"><span className="font-mono text-xs text-[#8A8A8A]">EMAIL</span><span className="font-mono text-sm text-white">{profile?.email}</span></div>
            <div className="flex justify-between items-center"><span className="font-mono text-xs text-[#8A8A8A]">NAME</span><span className="font-mono text-sm text-white">{profile?.name}</span></div>
            <div className="flex justify-between items-center"><span className="font-mono text-xs text-[#8A8A8A]">ROLE</span><Badge variant="outline" className="border-[#333333] text-white rounded-none font-mono text-[10px]">{profile?.role?.toUpperCase()}</Badge></div>
          </div>
        </Card>

        {/* Telegram */}
        <Card className="bg-[#111111] border-[#222222] p-6 rounded-none">
          <div className="flex items-center gap-2 mb-4">
            <MessageCircle size={16} className="text-[#0088cc]" />
            <h3 className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">TELEGRAM NOTIFICATIONS</h3>
          </div>
          {profile?.telegram_chat_id ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2"><span className="status-dot status-dot-success"></span><span className="font-mono text-sm text-[#00FF66]">CONNECTED</span></div>
              <div className="flex justify-between items-center"><span className="font-mono text-xs text-[#8A8A8A]">CHAT ID</span><span className="font-mono text-sm text-white tabular-nums">{profile.telegram_chat_id}</span></div>
              <div className="flex gap-2">
                <Button onClick={testTelegram} className="bg-transparent border border-[#333333] text-white hover:bg-white hover:text-black rounded-none flex-1" data-testid="test-telegram-btn"><Send size={14} className="mr-2" />TEST</Button>
                <Button onClick={unlinkTelegram} className="bg-transparent border border-[#FF3B30] text-[#FF3B30] hover:bg-[#FF3B30] hover:text-white rounded-none flex-1" data-testid="unlink-telegram-btn"><X size={14} className="mr-2" />UNLINK</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="font-mono text-xs text-[#8A8A8A]">Link your Telegram to receive trading alerts, agent notifications, and password resets.</p>
              <div className="terminal-bg p-3">
                <p className="font-mono text-[10px] text-[#555555] mb-2">HOW TO GET YOUR CHAT ID:</p>
                <ol className="font-mono text-xs text-[#8A8A8A] space-y-1 list-decimal pl-4">
                  <li>Open Telegram and search for <span className="text-white">@TraderGMONYbot</span></li>
                  <li>Send <span className="text-[#00FF66]">/start</span> to the bot</li>
                  <li>Send <span className="text-[#00FF66]">/id</span> to get your Chat ID</li>
                  <li>Paste the Chat ID below</li>
                </ol>
              </div>
              <div className="flex gap-2">
                <Input value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="Your Telegram Chat ID" className="flex-1 bg-[#0A0A0A] border-[#333333] rounded-none text-white font-mono" data-testid="telegram-chatid-input" />
                <Button onClick={linkTelegram} disabled={saving} className="bg-white text-black hover:bg-gray-200 rounded-none" data-testid="link-telegram-btn">{saving ? "LINKING..." : "LINK"}</Button>
              </div>
            </div>
          )}
        </Card>

        {/* Notification Preferences */}
        <Card className="bg-[#111111] border-[#222222] p-6 rounded-none">
          <h3 className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase mb-4">NOTIFICATION PREFERENCES</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Mail size={16} className="text-[#8A8A8A]" /><span className="font-mono text-sm text-white">Email Notifications</span></div>
              <Switch checked={profile?.email_notifications ?? true} onCheckedChange={(v) => updatePrefs("email_notifications", v)} data-testid="email-notif-switch" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><MessageCircle size={16} className="text-[#0088cc]" /><span className="font-mono text-sm text-white">Telegram Notifications</span></div>
              <Switch checked={profile?.telegram_notifications ?? true} onCheckedChange={(v) => updatePrefs("telegram_notifications", v)} data-testid="telegram-notif-switch" />
            </div>
          </div>
        </Card>

        {/* Password */}
        <Card className="bg-[#111111] border-[#222222] p-6 rounded-none">
          <h3 className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase mb-4">SECURITY</h3>
          <Button onClick={() => window.location.href = "/forgot-password"} className="bg-transparent border border-[#333333] text-white hover:bg-white hover:text-black rounded-none" data-testid="change-password-btn">
            <KeyRound size={14} className="mr-2" /> CHANGE PASSWORD
          </Button>
        </Card>
      </div>
    </DashboardLayout>
  );
}

// ============== PAYMENT SUCCESS/CANCEL ==============
function PaymentSuccessPage() {
  const [searchParams] = useSearchParams(); const [status, setStatus] = useState("checking"); const sessionId = searchParams.get("session_id");
  useEffect(() => { if (sessionId) poll(); }, [sessionId]);
  const poll = async (a = 0) => {
    if (a >= 5) { setStatus("timeout"); return; }
    try {
      const { data } = await axios.get(`${API}/api/payments/status/${sessionId}`, { withCredentials: true });
      if (data.payment_status === "paid") setStatus("success");
      else if (data.status === "expired") setStatus("expired");
      else setTimeout(() => poll(a + 1), 2000);
    } catch { setStatus("error"); }
  };
  return (
    <DashboardLayout>
      <Card className="bg-[#111111] border-[#222222] p-8 rounded-none text-center max-w-md mx-auto">
        {status === "checking" && <><RefreshCw size={48} className="mx-auto text-[#8A8A8A] mb-4 animate-spin" /><p className="font-mono text-sm text-[#8A8A8A]">VERIFYING PAYMENT<span className="cursor-blink"></span></p></>}
        {status === "success" && <><CheckCircle size={48} className="mx-auto text-[#00FF66] mb-4" /><h2 className="font-heading text-xl font-bold text-white">PAYMENT SUCCESSFUL</h2><Button onClick={() => window.location.href = '/dashboard'} className="mt-4 bg-white text-black hover:bg-gray-200 rounded-none" data-testid="go-dashboard-btn">GO TO DASHBOARD</Button></>}
        {(status === "error" || status === "expired" || status === "timeout") && <><XCircle size={48} className="mx-auto text-[#FF3B30] mb-4" /><h2 className="font-heading text-xl font-bold text-white">PAYMENT ISSUE</h2><Button onClick={() => window.location.href = '/billing'} className="mt-4 bg-white text-black hover:bg-gray-200 rounded-none">TRY AGAIN</Button></>}
      </Card>
    </DashboardLayout>
  );
}

function PaymentCancelPage() {
  return (
    <DashboardLayout>
      <Card className="bg-[#111111] border-[#222222] p-8 rounded-none text-center max-w-md mx-auto">
        <XCircle size={48} className="mx-auto text-[#FFCC00] mb-4" /><h2 className="font-heading text-xl font-bold text-white">PAYMENT CANCELLED</h2>
        <Button onClick={() => window.location.href = '/billing'} className="mt-4 bg-white text-black hover:bg-gray-200 rounded-none">BACK TO BILLING</Button>
      </Card>
    </DashboardLayout>
  );
}

// ============== MAIN APP ==============
function App() {
  return (
    <AuthProvider>
      <div className="App">
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/agents" element={<ProtectedRoute><AgentsPage /></ProtectedRoute>} />
            <Route path="/charts" element={<ProtectedRoute><ChartsPage /></ProtectedRoute>} />
            <Route path="/validation" element={<ProtectedRoute><ValidationPage /></ProtectedRoute>} />
            <Route path="/insights" element={<ProtectedRoute><InsightsPage /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
            <Route path="/billing" element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="/payment/success" element={<ProtectedRoute><PaymentSuccessPage /></ProtectedRoute>} />
            <Route path="/payment/cancel" element={<ProtectedRoute><PaymentCancelPage /></ProtectedRoute>} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="bottom-right" theme="dark" />
      </div>
    </AuthProvider>
  );
}

export default App;
