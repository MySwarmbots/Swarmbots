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
  Settings, Eye, EyeOff, KeyRound, MessageCircle, Mail, ArrowUpDown, Wallet,
  ArrowUp, ArrowDown, Layers
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

// ============== WEBSOCKET CONTEXT ==============
const WsContext = createContext(null);

function WsProvider({ children }) {
  const { user } = useAuth();
  const wsRef = useRef(null);
  const [lastMessage, setLastMessage] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const reconnectTimeout = useRef(null);
  const reconnectAttempts = useRef(0);

  const connect = useCallback(async () => {
    if (!user?.id) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    try {
      // Get a short-lived WS token from the backend
      const { data } = await axios.get(`${API}/api/ws-token`, { withCredentials: true });
      const wsUrl = API.replace("https://", "wss://").replace("http://", "ws://");
      const ws = new WebSocket(`${wsUrl}/ws/${data.token}`);

      ws.onopen = () => {
        setWsConnected(true);
        reconnectAttempts.current = 0;
        // Keep alive with pings every 30s
        ws._pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send("ping");
        }, 30000);
      };

      ws.onmessage = (event) => {
        if (event.data === "pong") return;
        try {
          const msg = JSON.parse(event.data);
          setLastMessage(msg);

          // Show toast for real-time notifications
          if (msg.type === "notification") {
            const n = msg.data;
            const toastFn = n.type === "error" ? toast.error : n.type === "success" ? toast.success : n.type === "warning" ? toast.warning : toast.info;
            toastFn(n.title, { description: n.message });
          }
        } catch (e) { console.error('Request failed:', e); }
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (ws._pingInterval) clearInterval(ws._pingInterval);
        // Reconnect with exponential backoff (max 30s)
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectAttempts.current += 1;
        reconnectTimeout.current = setTimeout(connect, delay);
      };

      ws.onerror = () => { ws.close(); };
      wsRef.current = ws;
    } catch (e) {
      console.error('Request error:', e);
      // Token fetch failed, retry in 5s
      reconnectTimeout.current = setTimeout(connect, 5000);
    }
  }, [user]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); }
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    };
  }, [connect]);

  return (
    <WsContext.Provider value={{ lastMessage, wsConnected }}>
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
  const { lastMessage, wsConnected } = useWs();

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const { data } = await axios.get(`${API}/api/notifications/unread-count`, { withCredentials: true });
        setUnread(data.count);
      } catch (e) { console.error('Request failed:', e); }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000); // Slower polling since WS handles real-time
    return () => clearInterval(interval);
  }, []);

  // Reactively update unread count from WS notifications
  useEffect(() => {
    if (lastMessage?.type === "notification") {
      setUnread((prev) => prev + 1);
    }
  }, [lastMessage]);

  const handleLogout = async () => { await logout(); navigate("/login"); };

  const navItems = [
    { icon: Activity, label: "Dashboard", path: "/dashboard" },
    { icon: Layers, label: "Dungeon", path: "/dungeon" },
    { icon: ArrowUpDown, label: "Exchange", path: "/exchange" },
    { icon: Zap, label: "Engine", path: "/engine" },
    { icon: TrendingUp, label: "Signals", path: "/signals" },
    { icon: Bot, label: "Agents", path: "/agents" },
    { icon: BarChart3, label: "Charts", path: "/charts" },
    { icon: Bell, label: "Alerts", path: "/notifications", badge: unread },
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
              <span className={`hidden sm:inline-block status-dot ${wsConnected ? 'status-dot-success' : 'status-dot-danger'}`} title={wsConnected ? 'Live' : 'Reconnecting'}></span>
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
  const [dungeon, setDungeon] = useState(null);
  const { lastMessage } = useWs();
  const navigate = useNavigate();

  const fetchStats = useCallback(async () => {
    try {
      const [s, d] = await Promise.all([
        axios.get(`${API}/api/dashboard/stats`, { withCredentials: true }),
        axios.get(`${API}/api/dashboard/dungeon-overview`, { withCredentials: true }),
      ]);
      setStats(s.data); setDungeon(d.data);
    } catch (e) { console.error('Request failed:', e); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 12000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  useEffect(() => {
    if (lastMessage && ["agent_created", "agent_status", "agent_deleted", "gate_update", "validation_run", "scheduler_prediction", "auto_exec_trade"].includes(lastMessage.type)) {
      fetchStats();
    }
  }, [lastMessage, fetchStats]);

  if (loading) return <DashboardLayout><div className="font-mono text-sm text-[#8A8A8A]">LOADING DATA<span className="cursor-blink"></span></div></DashboardLayout>;

  const statCards = [
    { label: "TRADING AGENTS", value: stats?.total_agents || 0, icon: Bot, color: "text-white" },
    { label: "ACTIVE", value: stats?.active_agents || 0, icon: Zap, color: "text-[#00FF66]" },
    { label: "TOTAL PNL", value: formatCurrency(stats?.total_pnl || 0), icon: stats?.total_pnl >= 0 ? TrendingUp : TrendingDown, color: stats?.total_pnl >= 0 ? "text-[#00FF66]" : "text-[#FF3B30]" },
    { label: "WIN RATE", value: `${stats?.avg_win_rate || 0}%`, icon: BarChart3, color: "text-[#FFCC00]" },
    { label: "TRADES", value: formatNumber(stats?.total_trades || 0, 0), icon: Activity, color: "text-white" },
    { label: "GATE", value: stats?.validation_summary?.gate?.blocked ? "BLOCKED" : "OPEN", icon: Shield, color: stats?.validation_summary?.gate?.blocked ? "text-[#FF3B30]" : "text-[#00FF66]" },
  ];

  const statusColor = (s) => ({ patrolling: "#00FF66", debating: "#FFCC00", backtesting: "#002FA7", routing: "#FF6B00", resting: "#555555", "mining-data": "#00BFFF", analyzing: "#FF00FF" }[s] || "#8A8A8A");
  const latestPred = dungeon?.latest_predictions?.[0];

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl font-bold tracking-tight text-white">CONTROL ROOM</h2>
          <div className="flex items-center gap-3">
            {dungeon?.scheduler?.enabled && <Badge className="bg-[#00FF66] text-black rounded-none font-mono text-[10px]">SCHEDULER LIVE</Badge>}
            <span className={`status-dot ${stats?.validation_summary?.gate?.blocked ? 'status-dot-danger' : 'status-dot-success'}`}></span>
            <span className="font-mono text-[10px] text-[#8A8A8A] uppercase">GATE: {stats?.validation_summary?.gate?.mode || "SHADOW"}</span>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {statCards.map((stat, i) => (
            <Card key={i} className="bg-[#111111] border-[#222222] p-3 rounded-none hover:border-[#333333] transition-all" data-testid={`stat-${stat.label.toLowerCase().replace(/\s/g, '-')}`}>
              <stat.icon size={14} strokeWidth={1.5} className="text-[#555555] mb-1" />
              <p className={`font-mono text-lg font-medium tabular-nums ${stat.color}`}>{stat.value}</p>
              <p className="font-mono text-[9px] tracking-[0.15em] text-[#555555] mt-1">{stat.label}</p>
            </Card>
          ))}
        </div>

        {/* Live Dungeon Rooms */}
        <div data-testid="dungeon-rooms-dashboard">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Layers size={14} className="text-[#8A8A8A]" />
              <span className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">SPACE DUNGEON — {dungeon?.agents?.length || 0} AGENTS LIVE</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/dungeon")} className="text-[#8A8A8A] hover:text-white font-mono text-[10px]" data-testid="goto-dungeon">
              OPEN DUNGEON <ChevronRight size={12} className="ml-1" />
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {(() => {
              const sectorGroupsDash = {};
              (dungeon?.agents || []).forEach(a => { if (!sectorGroupsDash[a.sector]) sectorGroupsDash[a.sector] = []; sectorGroupsDash[a.sector].push(a); });
              const roomThemes = {
                "Vault-1": { bg: "linear-gradient(135deg, #0D0022 0%, #1A0044 50%, #0D0022 100%)", border: "#7B2FBE", glow: "rgba(123,47,190,0.3)", accent: "#B06FFF" },
                "Forge-2": { bg: "linear-gradient(135deg, #001A0D 0%, #003322 50%, #001A0D 100%)", border: "#00FF66", glow: "rgba(0,255,102,0.2)", accent: "#00FF66" },
                "Bridge-3": { bg: "linear-gradient(135deg, #001122 0%, #002244 50%, #001122 100%)", border: "#002FA7", glow: "rgba(0,47,167,0.3)", accent: "#4488FF" },
                "Signal-Spire": { bg: "linear-gradient(135deg, #1A1A00 0%, #333300 50%, #1A1A00 100%)", border: "#FFCC00", glow: "rgba(255,204,0,0.2)", accent: "#FFCC00" },
                "Risk-Crypt": { bg: "linear-gradient(135deg, #1A0000 0%, #330011 50%, #1A0000 100%)", border: "#FF3B30", glow: "rgba(255,59,48,0.2)", accent: "#FF6655" },
                "Data-Nexus": { bg: "linear-gradient(135deg, #001A1A 0%, #003333 50%, #001A1A 100%)", border: "#00BFFF", glow: "rgba(0,191,255,0.2)", accent: "#00BFFF" },
              };
              return Object.entries(sectorGroupsDash).map(([sector, bots]) => {
                const theme = roomThemes[sector] || roomThemes["Data-Nexus"];
                return (
                  <div key={sector} className="relative overflow-hidden rounded-sm cursor-pointer group" onClick={() => navigate("/dungeon")}
                    style={{ background: theme.bg, border: `1px solid ${theme.border}30`, minHeight: 110, boxShadow: `inset 0 0 30px ${theme.glow}, 0 0 15px ${theme.glow}` }}
                    data-testid={`room-${sector}`}>
                    {/* Room neon border glow */}
                    <div className="absolute inset-0 opacity-30 group-hover:opacity-50 transition-opacity" style={{ boxShadow: `inset 0 0 20px ${theme.glow}, inset 0 -2px 0 ${theme.border}` }}></div>
                    {/* Holographic grid floor */}
                    <div className="absolute bottom-0 left-0 right-0 h-8 opacity-20" style={{ background: `repeating-linear-gradient(90deg, ${theme.border}20 0px, transparent 1px, transparent 10px), repeating-linear-gradient(0deg, ${theme.border}20 0px, transparent 1px, transparent 10px)` }}></div>
                    {/* Room label */}
                    <div className="relative z-10 p-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-[8px] tracking-[0.15em] uppercase" style={{ color: theme.accent }}>{sector}</span>
                        <span className="font-mono text-[8px]" style={{ color: `${theme.accent}80` }}>{bots.length}</span>
                      </div>
                      {/* Bot avatars in room */}
                      <div className="flex flex-wrap gap-1 justify-center">
                        {bots.map((bot) => (
                          <div key={bot.agent_id} className="relative transition-transform hover:scale-125" title={bot.name}>
                            <div className="w-6 h-6 flex items-center justify-center rounded-full transition-all"
                              style={{ background: `radial-gradient(circle, ${bot.color}30 0%, transparent 70%)`, border: `1px solid ${bot.color}60`, boxShadow: `0 0 6px ${bot.color}40` }}>
                              <Bot size={10} style={{ color: bot.color }} />
                            </div>
                            <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-3 h-0.5 rounded-full opacity-50" style={{ backgroundColor: statusColor(bot.status) }}></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
          {/* Latest Prediction */}
          {latestPred && (
            <div className="flex items-center gap-4 mt-3 pt-2 border-t border-[#1A1A1A]">
              <span className="font-mono text-[10px] text-[#555555]">LATEST:</span>
              <span className="font-mono text-xs text-white">{latestPred.symbol}</span>
              <span className={`font-mono text-xs font-medium ${latestPred.direction === 'long_bias' ? 'text-[#00FF66]' : latestPred.direction === 'short_bias' ? 'text-[#FF3B30]' : 'text-[#FFCC00]'}`}>
                {latestPred.direction === 'long_bias' ? 'LONG' : latestPred.direction === 'short_bias' ? 'SHORT' : 'WAIT'}
              </span>
              <span className="font-mono text-xs text-white tabular-nums">{(latestPred.confidence * 100).toFixed(1)}%</span>
              <span className="font-mono text-[10px] text-[#555555]">{new Date(latestPred.timestamp).toLocaleTimeString()}</span>
            </div>
          )}
        </div>

        {/* Quick Actions + System Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-[#111111] border-[#222222] p-4 rounded-none">
            <h3 className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase mb-3">QUICK ACTIONS</h3>
            <div className="space-y-2">
              {[
                { icon: Layers, label: "Space Dungeon", path: "/dungeon" },
                { icon: ArrowUpDown, label: "Bitget Exchange", path: "/exchange" },
                { icon: Zap, label: "Profit Engine", path: "/engine" },
                { icon: BarChart3, label: "Performance Charts", path: "/charts" },
              ].map((a) => (
                <Button key={a.path} className="w-full justify-start bg-transparent border border-[#222222] text-white hover:bg-white hover:text-black rounded-none transition-all" onClick={() => navigate(a.path)} data-testid={`quick-${a.path.slice(1)}`}>
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
                ["SCHEDULER", dungeon?.scheduler?.enabled ? `ON (${dungeon.scheduler.interval_minutes}m)` : "OFF", dungeon?.scheduler?.enabled ? "text-[#00FF66]" : "text-[#8A8A8A]"],
                ["AUTO-EXEC", dungeon?.scheduler?.auto_exec_enabled ? "LIVE" : "OFF", dungeon?.scheduler?.auto_exec_enabled ? "text-[#00FF66]" : "text-[#8A8A8A]"],
                ["AUTO TRADES", `${dungeon?.scheduler?.total_auto_trades || 0}`, "text-[#FFCC00]"],
                ["UNREAD ALERTS", `${stats?.unread_notifications || 0}`, stats?.unread_notifications > 0 ? "text-[#FFCC00]" : "text-[#8A8A8A]"],
              ].map(([label, value, color]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-[#8A8A8A]">{label}</span>
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
  const { lastMessage } = useWs();

  const fetchAgents = useCallback(async () => {
    try { const { data } = await axios.get(`${API}/api/agents`, { withCredentials: true }); setAgents(data.agents); }
    catch (e) { console.error(e); toast.error("Failed to load agents"); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  // Refresh on WS agent events
  useEffect(() => {
    if (lastMessage && ["agent_created", "agent_status", "agent_deleted"].includes(lastMessage.type)) {
      fetchAgents();
    }
  }, [lastMessage, fetchAgents]);

  const createAgent = async () => {
    if (!newAgent.name.trim()) { toast.error("Agent name is required"); return; }
    try {
      await axios.post(`${API}/api/agents`, newAgent, { withCredentials: true });
      toast.success("Agent deployed"); setDialogOpen(false);
      setNewAgent({ name: "", strategy: "momentum", exchange: "binance", trading_pairs: [], risk_level: "medium" });
      fetchAgents();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const toggleAgent = async (id) => { try { await axios.patch(`${API}/api/agents/${id}/toggle`, {}, { withCredentials: true }); fetchAgents(); } catch (e) { console.error(e); toast.error("Failed"); } };
  const deleteAgent = async (id) => { try { await axios.delete(`${API}/api/agents/${id}`, { withCredentials: true }); toast.success("Deleted"); fetchAgents(); } catch (e) { console.error(e); toast.error("Failed"); } };

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
    catch (e) { console.error('Load error:', e); } finally { setLoading(false); }
  };
  const fetchAgents = async () => {
    try { const { data } = await axios.get(`${API}/api/agents`, { withCredentials: true }); setAgents(data.agents); if (!selectedAgent && data.agents.length) setSelectedAgent(data.agents[0].id); }
    catch (e) { console.error('Fetch agents error:', e); }
  };
  const fetchAgentPerf = async (id) => {
    try { const { data } = await axios.get(`${API}/api/agents/${id}/performance`, { withCredentials: true }); setAgentPerf(data); }
    catch (e) { console.error('Fetch perf error:', e); setAgentPerf(null); }
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
  const { lastMessage } = useWs();

  const fetchData = useCallback(async () => {
    try {
      const [r, g] = await Promise.all([axios.get(`${API}/api/validation/runs`, { withCredentials: true }), axios.get(`${API}/api/validation/gate`, { withCredentials: true })]);
      setRuns(r.data.runs); setGate(g.data);
    } catch (e) { console.error('Request failed:', e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 30000); return () => clearInterval(i); }, [fetchData]);

  // Real-time updates via WS
  useEffect(() => {
    if (lastMessage && ["validation_run", "gate_update"].includes(lastMessage.type)) {
      if (lastMessage.type === "validation_run") {
        setRuns((prev) => [lastMessage.data, ...prev].slice(0, 100));
      }
      if (lastMessage.type === "gate_update") {
        setGate(lastMessage.data);
      }
    }
  }, [lastMessage]);
  const updateGate = async (mode, blocked) => {
    try { await axios.post(`${API}/api/validation/gate`, { mode, blocked, reason: "" }, { withCredentials: true }); toast.success("Gate updated"); fetchData(); }
    catch (e) { console.error(e); toast.error("Failed"); }
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
  const { lastMessage } = useWs();

  const fetchNotifications = useCallback(async () => {
    try { const { data } = await axios.get(`${API}/api/notifications`, { withCredentials: true }); setNotifications(data.notifications); }
    catch (e) { console.error('Load error:', e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // Real-time notifications via WS
  useEffect(() => {
    if (lastMessage?.type === "notification") {
      setNotifications((prev) => [lastMessage.data, ...prev]);
    }
  }, [lastMessage]);
  const markRead = async (id) => { try { await axios.patch(`${API}/api/notifications/${id}/read`, {}, { withCredentials: true }); fetchNotifications(); } catch (e) { console.error('Request failed:', e); } };
  const markAllRead = async () => { try { await axios.post(`${API}/api/notifications/mark-all-read`, {}, { withCredentials: true }); toast.success("All read"); fetchNotifications(); } catch (e) { console.error('Request failed:', e); } };

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
  const fetchPlans = async () => { try { const { data } = await axios.get(`${API}/api/payments/plans`, { withCredentials: true }); setPlans(data.plans); } catch (e) { console.error('Request failed:', e); } finally { setLoading(false); } };

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
    catch (e) { console.error('Load error:', e); } finally { setLoading(false); }
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
    catch (e) { console.error(e); toast.error("Failed"); }
  };

  const testTelegram = async () => {
    try { await axios.post(`${API}/api/telegram/test`, {}, { withCredentials: true }); toast.success("Test message sent! Check Telegram."); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const updatePrefs = async (field, value) => {
    try { await axios.patch(`${API}/api/profile`, { [field]: value }, { withCredentials: true }); fetchProfile(); }
    catch (e) { console.error(e); toast.error("Failed to update"); }
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
    } catch (e) {
      console.error('Request error:', e); setStatus("error"); }
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

// ============== SIGNAL STRENGTH PAGE ==============
function SignalsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { lastMessage } = useWs();

  const fetchData = useCallback(async () => {
    try {
      const { data: d } = await axios.get(`${API}/api/signals/accuracy?limit=200`, { withCredentials: true });
      setData(d);
    } catch (e) { console.error('Signals fetch error:', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 30000); return () => clearInterval(i); }, [fetchData]);

  useEffect(() => {
    if (lastMessage && ["scheduler_prediction"].includes(lastMessage.type)) fetchData();
  }, [lastMessage, fetchData]);

  if (loading) return <DashboardLayout><div className="font-mono text-sm text-[#8A8A8A]">LOADING SIGNALS<span className="cursor-blink"></span></div></DashboardLayout>;

  const winRate = data?.win_rate || 0;
  const winRateColor = winRate >= 55 ? "#00FF66" : winRate >= 45 ? "#FFCC00" : "#FF3B30";

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl font-bold tracking-tight text-white">SIGNAL STRENGTH</h2>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-[#555555]">{data?.pending || 0} pending verification</span>
            <Button variant="ghost" onClick={fetchData} className="text-[#8A8A8A] hover:text-white" data-testid="refresh-signals"><RefreshCw size={16} /></Button>
          </div>
        </div>

        {/* Top Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="bg-[#111111] border-[#222222] p-4 rounded-none" data-testid="stat-win-rate">
            <p className="font-mono text-[10px] tracking-[0.15em] text-[#555555]">WIN RATE</p>
            <p className="font-mono text-3xl font-bold tabular-nums" style={{ color: winRateColor }}>{winRate}%</p>
            <p className="font-mono text-[10px] text-[#555555]">{data?.correct || 0}/{data?.total_signals || 0} correct</p>
          </Card>
          <Card className="bg-[#111111] border-[#222222] p-4 rounded-none" data-testid="stat-total-pnl">
            <p className="font-mono text-[10px] tracking-[0.15em] text-[#555555]">TOTAL PNL</p>
            <p className={`font-mono text-2xl font-bold tabular-nums ${(data?.total_pnl_pct || 0) >= 0 ? 'text-[#00FF66]' : 'text-[#FF3B30]'}`}>{(data?.total_pnl_pct || 0) >= 0 ? '+' : ''}{data?.total_pnl_pct || 0}%</p>
          </Card>
          <Card className="bg-[#111111] border-[#222222] p-4 rounded-none" data-testid="stat-avg-pnl">
            <p className="font-mono text-[10px] tracking-[0.15em] text-[#555555]">AVG PNL/SIGNAL</p>
            <p className={`font-mono text-2xl font-bold tabular-nums ${(data?.avg_pnl_pct || 0) >= 0 ? 'text-[#00FF66]' : 'text-[#FF3B30]'}`}>{(data?.avg_pnl_pct || 0) >= 0 ? '+' : ''}{data?.avg_pnl_pct || 0}%</p>
          </Card>
          <Card className="bg-[#111111] border-[#222222] p-4 rounded-none" data-testid="stat-total-signals">
            <p className="font-mono text-[10px] tracking-[0.15em] text-[#555555]">TOTAL SIGNALS</p>
            <p className="font-mono text-2xl font-bold text-white tabular-nums">{data?.total_signals || 0}</p>
          </Card>
          <Card className="bg-[#111111] border-[#222222] p-4 rounded-none" data-testid="stat-pending">
            <p className="font-mono text-[10px] tracking-[0.15em] text-[#555555]">PENDING</p>
            <p className="font-mono text-2xl font-bold text-[#FFCC00] tabular-nums">{data?.pending || 0}</p>
            <p className="font-mono text-[10px] text-[#555555]">checking in 15m</p>
          </Card>
        </div>

        {/* By Symbol + By Direction */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-[#111111] border-[#222222] p-4 rounded-none">
            <h3 className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase mb-3">ACCURACY BY SYMBOL</h3>
            {(data?.by_symbol || []).length === 0 ? (
              <p className="font-mono text-xs text-[#555555]">No verified signals yet — check back in 15 minutes</p>
            ) : (
              <div className="space-y-3">
                {(data?.by_symbol || []).map((s) => (
                  <div key={s.symbol} className="flex items-center justify-between">
                    <span className="font-mono text-xs text-white font-medium">{s.symbol}</span>
                    <div className="flex items-center gap-4">
                      <div className="w-24 h-2 bg-[#222222] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${s.win_rate}%`, backgroundColor: s.win_rate >= 55 ? '#00FF66' : s.win_rate >= 45 ? '#FFCC00' : '#FF3B30' }}></div>
                      </div>
                      <span className="font-mono text-xs tabular-nums w-12 text-right" style={{ color: s.win_rate >= 55 ? '#00FF66' : s.win_rate >= 45 ? '#FFCC00' : '#FF3B30' }}>{s.win_rate}%</span>
                      <span className="font-mono text-[10px] text-[#555555] w-8 text-right">{s.correct}/{s.total}</span>
                      <span className={`font-mono text-[10px] tabular-nums w-16 text-right ${s.total_pnl >= 0 ? 'text-[#00FF66]' : 'text-[#FF3B30]'}`}>{s.total_pnl >= 0 ? '+' : ''}{s.total_pnl}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="bg-[#111111] border-[#222222] p-4 rounded-none">
            <h3 className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase mb-3">ACCURACY BY DIRECTION</h3>
            {(data?.by_direction || []).length === 0 ? (
              <p className="font-mono text-xs text-[#555555]">No verified signals yet</p>
            ) : (
              <div className="space-y-4">
                {(data?.by_direction || []).map((d) => {
                  const label = d.direction === 'long_bias' ? 'LONG' : d.direction === 'short_bias' ? 'SHORT' : 'WAIT';
                  const color = d.direction === 'long_bias' ? '#00FF66' : d.direction === 'short_bias' ? '#FF3B30' : '#FFCC00';
                  return (
                    <div key={d.direction}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-xs font-medium" style={{ color }}>{label}</span>
                        <span className="font-mono text-xs tabular-nums text-white">{d.win_rate}% ({d.correct}/{d.total})</span>
                      </div>
                      <div className="w-full h-3 bg-[#222222] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${d.win_rate}%`, backgroundColor: color, opacity: 0.7 }}></div>
                      </div>
                      <p className={`font-mono text-[10px] mt-1 tabular-nums ${d.total_pnl >= 0 ? 'text-[#00FF66]' : 'text-[#FF3B30]'}`}>PnL: {d.total_pnl >= 0 ? '+' : ''}{d.total_pnl}%</p>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Signal History Chart */}
        {(data?.signals || []).length > 0 && (
          <Card className="bg-[#111111] border-[#222222] p-4 rounded-none">
            <h3 className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase mb-3">PNL PER SIGNAL (RECENT)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={[...(data?.signals || [])].reverse().slice(-40)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222222" />
                <XAxis dataKey="symbol" tick={{ fontSize: 8, fill: '#555555', fontFamily: 'IBM Plex Mono' }} />
                <YAxis tick={{ fontSize: 9, fill: '#555555', fontFamily: 'IBM Plex Mono' }} />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  const dir = d.direction === 'long_bias' ? 'LONG' : d.direction === 'short_bias' ? 'SHORT' : 'WAIT';
                  return (
                    <div className="bg-[#111111] border border-[#333333] p-2 font-mono text-[10px]">
                      <p className="text-white">{d.symbol} — {dir}</p>
                      <p className="text-[#8A8A8A]">Conf: {(d.confidence * 100).toFixed(0)}%</p>
                      <p className={d.pnl_pct >= 0 ? 'text-[#00FF66]' : 'text-[#FF3B30]'}>PnL: {d.pnl_pct >= 0 ? '+' : ''}{d.pnl_pct}%</p>
                      <p className="text-[#8A8A8A]">${d.entry_price} → ${d.exit_price}</p>
                    </div>
                  );
                }} />
                <Bar dataKey="pnl_pct" name="PnL %">
                  {[...(data?.signals || [])].reverse().slice(-40).map((s, i) => (
                    <Cell key={`pnl-${s.symbol}-${i}`} fill={(s.pnl_pct || 0) >= 0 ? "#00FF66" : "#FF3B30"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Signal History Table */}
        <Card className="bg-[#111111] border-[#222222] rounded-none overflow-hidden">
          <div className="p-4 border-b border-[#222222]">
            <h3 className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">SIGNAL HISTORY ({data?.total_signals || 0})</h3>
          </div>
          {(data?.signals || []).length === 0 ? (
            <div className="p-8 text-center">
              <TrendingUp size={32} className="mx-auto text-[#333333] mb-2" />
              <p className="font-mono text-xs text-[#8A8A8A]">Signals are being tracked — first results appear after 15 minutes</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full min-w-[650px]">
                <thead className="bg-[#0A0A0A] sticky top-0"><tr>
                  {["TIME", "SYMBOL", "DIRECTION", "CONF", "ENTRY", "EXIT", "PNL", "RESULT"].map(h => (
                    <th key={h} className="font-mono text-[10px] text-[#555555] text-left p-2">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {(data?.signals || []).map((s, i) => {
                    const dir = s.direction === 'long_bias' ? 'LONG' : s.direction === 'short_bias' ? 'SHORT' : 'WAIT';
                    const dirColor = s.direction === 'long_bias' ? '#00FF66' : s.direction === 'short_bias' ? '#FF3B30' : '#FFCC00';
                    return (
                      <tr key={`sig-${s.symbol}-${s.created_at}-${i}`} className="border-t border-[#1A1A1A] hover:bg-[#151515]">
                        <td className="font-mono text-[10px] text-[#8A8A8A] p-2">{s.created_at ? new Date(s.created_at).toLocaleString() : '-'}</td>
                        <td className="font-mono text-xs text-white p-2">{s.symbol}</td>
                        <td className="font-mono text-xs p-2 font-medium" style={{ color: dirColor }}>{dir}</td>
                        <td className="font-mono text-xs text-white p-2 tabular-nums">{(s.confidence * 100).toFixed(0)}%</td>
                        <td className="font-mono text-xs text-[#8A8A8A] p-2 tabular-nums">${s.entry_price?.toLocaleString()}</td>
                        <td className="font-mono text-xs text-[#8A8A8A] p-2 tabular-nums">{s.exit_price ? `$${s.exit_price.toLocaleString()}` : '...'}</td>
                        <td className={`font-mono text-xs p-2 tabular-nums ${(s.pnl_pct || 0) >= 0 ? 'text-[#00FF66]' : 'text-[#FF3B30]'}`}>{s.pnl_pct != null ? `${s.pnl_pct >= 0 ? '+' : ''}${s.pnl_pct}%` : '...'}</td>
                        <td className="p-2">{s.correct === true ? <CheckCircle size={14} className="text-[#00FF66]" /> : s.correct === false ? <XCircle size={14} className="text-[#FF3B30]" /> : <RefreshCw size={12} className="text-[#555555] animate-spin" style={{animationDuration:'3s'}} />}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}

// ============== SPACE DUNGEON PAGE ==============
function DungeonPage() {
  const [dungeonAgents, setDungeonAgents] = useState([]);
  const [selectedBot, setSelectedBot] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [debate, setDebate] = useState([]);
  const [rollout, setRollout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [predLoading, setPredLoading] = useState(false);
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [autoExec, setAutoExec] = useState(null);
  const [autoTrades, setAutoTrades] = useState([]);
  const [editAutoExec, setEditAutoExec] = useState({});
  const [editingAE, setEditingAE] = useState(false);
  const { lastMessage } = useWs();

  const fetchAll = useCallback(async () => {
    try {
      const [a, r, ae, at] = await Promise.all([
        axios.get(`${API}/api/dungeon/agents`, { withCredentials: true }),
        axios.get(`${API}/api/dungeon/rollout`, { withCredentials: true }),
        axios.get(`${API}/api/dungeon/auto-exec/config`, { withCredentials: true }),
        axios.get(`${API}/api/dungeon/auto-exec/trades?limit=10`, { withCredentials: true }),
      ]);
      setDungeonAgents(a.data.agents); setRollout(r.data);
      setAutoExec(ae.data); setEditAutoExec(ae.data);
      setAutoTrades(at.data.trades);
    } catch (e) { console.error('Request failed:', e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); const i = setInterval(fetchAll, 8000); return () => clearInterval(i); }, [fetchAll]);

  useEffect(() => {
    if (lastMessage && ["dungeon_debate", "dungeon_prediction", "dungeon_rollout", "auto_exec_trade", "auto_exec_config"].includes(lastMessage.type)) fetchAll();
  }, [lastMessage, fetchAll]);

  const runPrediction = async () => {
    setPredLoading(true);
    try {
      const { data } = await axios.get(`${API}/api/dungeon/prediction?symbol=${symbol}&auto_exec=true`, { withCredentials: true });
      setPrediction(data); setDebate(data.debate);
      if (data.auto_exec?.executed) {
        toast.success(`Auto-trade executed: ${data.auto_exec.order?.side?.toUpperCase()} ${data.auto_exec.order?.symbol}`);
      } else if (data.auto_exec && !data.auto_exec.executed) {
        toast.info(`No auto-trade: ${data.auto_exec.reason?.replace(/_/g, ' ')}`);
      }
      fetchAll();
    } catch (e) {
      console.error('Request error:', e); toast.error("Prediction failed"); }
    finally { setPredLoading(false); }
  };

  const toggleAutoExec = async () => {
    try {
      const { data } = await axios.patch(`${API}/api/dungeon/auto-exec/config`, { enabled: !autoExec?.enabled }, { withCredentials: true });
      setAutoExec(data); setEditAutoExec(data);
      toast.success(data.enabled ? "Auto-execution ENABLED" : "Auto-execution DISABLED");
    } catch (e) {
      console.error('Request error:', e); toast.error("Failed"); }
  };

  const saveAutoExec = async () => {
    try {
      const { data } = await axios.patch(`${API}/api/dungeon/auto-exec/config`, editAutoExec, { withCredentials: true });
      setAutoExec(data); setEditAutoExec(data); setEditingAE(false);
      toast.success("Auto-exec config updated");
    } catch (e) {
      console.error('Request error:', e); toast.error("Failed"); }
  };

  const promoteRollout = async () => {
    try { const { data } = await axios.post(`${API}/api/dungeon/rollout/promote`, {}, { withCredentials: true }); if (data.promoted) toast.success("Stage promoted!"); else toast.warning(data.reason); fetchAll(); }
    catch (e) { console.error(e); toast.error("Promote failed"); }
  };

  // Group agents by sector for the dungeon view
  const sectorGroups = {};
  dungeonAgents.forEach(a => { if (!sectorGroups[a.sector]) sectorGroups[a.sector] = []; sectorGroups[a.sector].push(a); });

  const statusColor = (s) => ({ patrolling: "#00FF66", debating: "#FFCC00", backtesting: "#002FA7", routing: "#FF6B00", resting: "#555555", "mining-data": "#00BFFF", analyzing: "#FF00FF" }[s] || "#8A8A8A");

  if (loading) return <DashboardLayout><div className="font-mono text-sm text-[#8A8A8A]">INITIALIZING DUNGEON<span className="cursor-blink"></span></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="font-heading text-2xl font-bold tracking-tight text-white">SPACE DUNGEON</h2>
            <p className="font-mono text-[10px] text-[#555555]">{dungeonAgents.length} AUTONOMOUS AGENTS ACTIVE</p>
          </div>
          <div className="flex items-center gap-2">
            <Input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} className="w-28 bg-[#0A0A0A] border-[#333333] rounded-none text-white font-mono text-xs h-8" data-testid="dungeon-symbol-input" />
            <Button onClick={runPrediction} disabled={predLoading} className="bg-[#00FF66] text-black hover:bg-[#00DD55] rounded-none h-8 text-xs" data-testid="run-prediction-btn">
              {predLoading ? <RefreshCw size={14} className="animate-spin" /> : <><Zap size={14} className="mr-1" />PREDICT</>}
            </Button>
          </div>
        </div>

        {/* Rollout Stage Bar */}
        <Card className="bg-[#111111] border-[#222222] p-3 rounded-none">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10px] tracking-[0.15em] text-[#555555]">ROLLOUT PIPELINE</span>
            <Button size="sm" onClick={promoteRollout} disabled={!rollout?.promotion_ready} className="bg-transparent border border-[#333333] text-white hover:bg-white hover:text-black rounded-none text-[10px] h-6 px-2" data-testid="promote-btn">PROMOTE</Button>
          </div>
          <div className="flex gap-1">
            {["shadow", "canary", "phase1", "phase2", "full"].map((stage) => {
              const active = rollout?.stage === stage;
              const idx = ["shadow", "canary", "phase1", "phase2", "full"].indexOf(stage);
              const currentIdx = ["shadow", "canary", "phase1", "phase2", "full"].indexOf(rollout?.stage || "shadow");
              const passed = idx < currentIdx;
              return (
                <div key={stage} className={`flex-1 h-2 ${active ? 'bg-[#00FF66]' : passed ? 'bg-[#00FF66] opacity-40' : 'bg-[#222222]'}`} data-testid={`stage-${stage}`}></div>
              );
            })}
          </div>
          <div className="flex justify-between mt-1">
            <span className="font-mono text-[10px] text-[#8A8A8A]">STAGE: {rollout?.stage?.toUpperCase()}</span>
            <span className="font-mono text-[10px] text-[#FFCC00]">CAPITAL: ${rollout?.allocated_capital_usd?.toFixed(0)}</span>
          </div>
        </Card>

        {/* Prediction Result */}
        {prediction && (
          <Card className="bg-[#0A0A0A] border-[#222222] p-4 rounded-none" data-testid="prediction-result">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">SWARM PREDICTION: {prediction.symbol}</span>
              <span className="font-mono text-[10px] text-[#555555]">{new Date(prediction.timestamp).toLocaleTimeString()}</span>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-3">
              <div className="text-center">
                <p className={`font-mono text-2xl font-bold ${prediction.direction === 'long_bias' ? 'text-[#00FF66]' : prediction.direction === 'short_bias' ? 'text-[#FF3B30]' : 'text-[#FFCC00]'}`}>
                  {prediction.direction === 'long_bias' ? 'LONG' : prediction.direction === 'short_bias' ? 'SHORT' : 'WAIT'}
                </p>
                <p className="font-mono text-[10px] text-[#555555]">DIRECTION</p>
              </div>
              <div className="text-center">
                <p className="font-mono text-2xl font-bold text-white tabular-nums">{(prediction.confidence * 100).toFixed(1)}%</p>
                <p className="font-mono text-[10px] text-[#555555]">CONFIDENCE</p>
              </div>
              <div className="text-center">
                <div className="flex justify-center gap-3">
                  <span className="font-mono text-xs text-[#00FF66] tabular-nums">{prediction.votes.bullish_count}B</span>
                  <span className="font-mono text-xs text-[#FF3B30] tabular-nums">{prediction.votes.bearish_count}S</span>
                  <span className="font-mono text-xs text-[#8A8A8A] tabular-nums">{prediction.votes.neutral_count}N</span>
                </div>
                <p className="font-mono text-[10px] text-[#555555]">VOTES</p>
              </div>
            </div>
          </Card>
        )}

        {/* Auto-Execution Control Panel */}
        <Card className={`bg-[#111111] border rounded-none p-4 ${autoExec?.enabled ? 'border-[#00FF66]' : 'border-[#222222]'}`} data-testid="auto-exec-panel">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Zap size={16} className={autoExec?.enabled ? "text-[#00FF66]" : "text-[#555555]"} />
              <h3 className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">AUTO-EXECUTION</h3>
              <Badge className={`rounded-none font-mono text-[10px] ${autoExec?.enabled ? 'bg-[#00FF66] text-black' : 'bg-[#222222] text-[#8A8A8A]'}`}>
                {autoExec?.enabled ? "LIVE" : "OFF"}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {!editingAE ? (
                <Button variant="ghost" size="sm" onClick={() => setEditingAE(true)} className="text-[#8A8A8A] hover:text-white" data-testid="edit-autoexec-btn"><Settings size={14} /></Button>
              ) : (
                <div className="flex gap-1">
                  <Button size="sm" onClick={saveAutoExec} className="bg-[#00FF66] text-black rounded-none text-[10px] h-6 px-2" data-testid="save-autoexec-btn">SAVE</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditingAE(false); setEditAutoExec(autoExec); }} className="text-[#8A8A8A] text-[10px] h-6">CANCEL</Button>
                </div>
              )}
              <Switch checked={autoExec?.enabled || false} onCheckedChange={toggleAutoExec} data-testid="auto-exec-toggle" />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <p className="font-mono text-[10px] text-[#555555]">MAX TRADE</p>
              {editingAE ? <Input value={editAutoExec.max_trade_usd || ""} onChange={(e) => setEditAutoExec({...editAutoExec, max_trade_usd: parseFloat(e.target.value) || 0})} className="h-6 bg-[#0A0A0A] border-[#333333] rounded-none text-white font-mono text-xs p-1 mt-1" /> :
                <p className="font-mono text-sm text-white tabular-nums">${autoExec?.max_trade_usd?.toFixed(2)}</p>}
            </div>
            <div>
              <p className="font-mono text-[10px] text-[#555555]">MIN CONFIDENCE</p>
              {editingAE ? <Input value={editAutoExec.min_confidence || ""} onChange={(e) => setEditAutoExec({...editAutoExec, min_confidence: parseFloat(e.target.value) || 0})} className="h-6 bg-[#0A0A0A] border-[#333333] rounded-none text-white font-mono text-xs p-1 mt-1" /> :
                <p className="font-mono text-sm text-white tabular-nums">{((autoExec?.min_confidence || 0) * 100).toFixed(0)}%</p>}
            </div>
            <div>
              <p className="font-mono text-[10px] text-[#555555]">COOLDOWN</p>
              {editingAE ? <Input value={editAutoExec.cooldown_seconds || ""} onChange={(e) => setEditAutoExec({...editAutoExec, cooldown_seconds: parseInt(e.target.value) || 0})} className="h-6 bg-[#0A0A0A] border-[#333333] rounded-none text-white font-mono text-xs p-1 mt-1" /> :
                <p className="font-mono text-sm text-white tabular-nums">{autoExec?.cooldown_seconds}s</p>}
            </div>
            <div>
              <p className="font-mono text-[10px] text-[#555555]">TOTAL TRADES</p>
              <p className="font-mono text-sm text-[#FFCC00] tabular-nums">{autoExec?.total_trades || 0}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] text-[#555555]">SYMBOLS</p>
              <p className="font-mono text-[10px] text-[#8A8A8A]">{autoExec?.allowed_symbols?.join(", ")}</p>
            </div>
          </div>
        </Card>

        {/* Scheduler Control */}
        <Card className={`bg-[#111111] border rounded-none p-4 ${autoExec?.scheduler_enabled ? 'border-[#002FA7]' : 'border-[#222222]'}`} data-testid="scheduler-panel">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <RefreshCw size={16} className={autoExec?.scheduler_enabled ? "text-[#002FA7] animate-spin" : "text-[#555555]"} style={autoExec?.scheduler_enabled ? {animationDuration: '3s'} : {}} />
              <h3 className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">SCHEDULED PREDICTIONS</h3>
              <Badge className={`rounded-none font-mono text-[10px] ${autoExec?.scheduler_enabled ? 'bg-[#002FA7] text-white' : 'bg-[#222222] text-[#8A8A8A]'}`}>
                {autoExec?.scheduler_enabled ? "RUNNING" : "OFF"}
              </Badge>
            </div>
            <Switch checked={autoExec?.scheduler_enabled || false} onCheckedChange={async (v) => {
              try {
                const { data } = await axios.patch(`${API}/api/dungeon/auto-exec/config`, { scheduler_enabled: v }, { withCredentials: true });
                setAutoExec(data); toast.success(v ? "Scheduler started" : "Scheduler stopped");
              } catch (e) {
      console.error('Request error:', e); toast.error("Failed"); }
            }} data-testid="scheduler-toggle" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <p className="font-mono text-[10px] text-[#555555]">INTERVAL</p>
              {editingAE ? <Input value={editAutoExec.scheduler_interval_minutes || 15} onChange={(e) => setEditAutoExec({...editAutoExec, scheduler_interval_minutes: parseInt(e.target.value) || 15})} className="h-6 bg-[#0A0A0A] border-[#333333] rounded-none text-white font-mono text-xs p-1 mt-1" /> :
                <p className="font-mono text-sm text-white tabular-nums">{autoExec?.scheduler_interval_minutes || 15} min</p>}
            </div>
            <div>
              <p className="font-mono text-[10px] text-[#555555]">SYMBOLS</p>
              <p className="font-mono text-[10px] text-[#8A8A8A]">{(autoExec?.scheduler_symbols || []).join(", ")}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] text-[#555555]">TELEGRAM ALERTS</p>
              <p className="font-mono text-sm text-[#00FF66]">ACTIVE</p>
            </div>
            <div>
              <p className="font-mono text-[10px] text-[#555555]">AUTO-TRADE ON SIGNAL</p>
              <p className={`font-mono text-sm ${autoExec?.enabled ? 'text-[#00FF66]' : 'text-[#8A8A8A]'}`}>{autoExec?.enabled ? "YES" : "NO"}</p>
            </div>
          </div>
          <p className="font-mono text-[9px] text-[#555555] mt-2">Every {autoExec?.scheduler_interval_minutes || 15} minutes, the swarm debates and sends predictions via Telegram. If auto-exec is ON and confidence exceeds threshold, a trade is placed on Bitget.</p>
        </Card>

        {/* Auto-Exec Trade History */}
        {autoTrades.length > 0 && (
          <Card className="bg-[#111111] border-[#222222] rounded-none overflow-hidden">
            <div className="p-3 border-b border-[#222222]"><h3 className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">AUTO-EXEC TRADES ({autoTrades.length})</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px]">
                <thead className="bg-[#0A0A0A]"><tr>
                  {["TIME", "SYMBOL", "SIDE", "QTY", "PRICE", "CONF", "STATUS"].map(h => (<th key={h} className="font-mono text-[10px] text-[#555555] text-left p-2">{h}</th>))}
                </tr></thead>
                <tbody>
                  {autoTrades.map((t, i) => (
                    <tr key={i} className="border-t border-[#1A1A1A] hover:bg-[#151515]" data-testid={`auto-trade-${i}`}>
                      <td className="font-mono text-[10px] text-[#8A8A8A] p-2">{t.created_at ? new Date(t.created_at).toLocaleTimeString() : '-'}</td>
                      <td className="font-mono text-xs text-white p-2">{t.symbol}</td>
                      <td className={`font-mono text-xs p-2 font-medium ${t.side === 'buy' ? 'text-[#00FF66]' : 'text-[#FF3B30]'}`}>{t.side?.toUpperCase()}</td>
                      <td className="font-mono text-xs text-white p-2 tabular-nums">{t.quantity}</td>
                      <td className="font-mono text-xs text-white p-2 tabular-nums">${t.price?.toLocaleString()}</td>
                      <td className="font-mono text-xs text-[#FFCC00] p-2 tabular-nums">{((t.confidence || 0) * 100).toFixed(0)}%</td>
                      <td className="font-mono text-[10px] text-[#00FF66] p-2">{t.order_status?.toUpperCase() || 'FILLED'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* 3D Dungeon Rooms — Cyberpunk Sector Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {(() => {
            const roomThemes = {
              "Vault-1": { bg: "linear-gradient(135deg, #0D0022 0%, #1A0044 50%, #0D0022 100%)", border: "#7B2FBE", glow: "rgba(123,47,190,0.35)", accent: "#B06FFF", particle: "#7B2FBE" },
              "Forge-2": { bg: "linear-gradient(135deg, #001A0D 0%, #003322 50%, #001A0D 100%)", border: "#00FF66", glow: "rgba(0,255,102,0.25)", accent: "#00FF66", particle: "#00FF66" },
              "Bridge-3": { bg: "linear-gradient(135deg, #001122 0%, #002244 50%, #001122 100%)", border: "#002FA7", glow: "rgba(0,47,167,0.35)", accent: "#4488FF", particle: "#002FA7" },
              "Signal-Spire": { bg: "linear-gradient(135deg, #1A1A00 0%, #333300 50%, #1A1A00 100%)", border: "#FFCC00", glow: "rgba(255,204,0,0.25)", accent: "#FFCC00", particle: "#FFCC00" },
              "Risk-Crypt": { bg: "linear-gradient(135deg, #1A0000 0%, #330011 50%, #1A0000 100%)", border: "#FF3B30", glow: "rgba(255,59,48,0.25)", accent: "#FF6655", particle: "#FF3B30" },
              "Data-Nexus": { bg: "linear-gradient(135deg, #001A1A 0%, #003333 50%, #001A1A 100%)", border: "#00BFFF", glow: "rgba(0,191,255,0.25)", accent: "#00BFFF", particle: "#00BFFF" },
            };
            return Object.entries(sectorGroups).map(([sector, bots]) => {
              const theme = roomThemes[sector] || roomThemes["Data-Nexus"];
              return (
                <div key={sector} className="relative overflow-hidden rounded-sm group" style={{ background: theme.bg, border: `1px solid ${theme.border}40`, minHeight: 160, boxShadow: `inset 0 0 40px ${theme.glow}, 0 0 20px ${theme.glow}` }}>
                  {/* Neon border pulse */}
                  <div className="absolute inset-0 transition-opacity group-hover:opacity-60 opacity-30" style={{ boxShadow: `inset 0 0 25px ${theme.glow}, inset 0 2px 0 ${theme.border}60, inset 0 -2px 0 ${theme.border}60, inset 2px 0 0 ${theme.border}30, inset -2px 0 0 ${theme.border}30` }}></div>
                  {/* Holographic grid floor */}
                  <div className="absolute bottom-0 left-0 right-0 h-12 opacity-15" style={{ background: `repeating-linear-gradient(90deg, ${theme.border}15 0px, transparent 1px, transparent 12px), repeating-linear-gradient(0deg, ${theme.border}15 0px, transparent 1px, transparent 12px)`, transform: 'perspective(200px) rotateX(40deg)', transformOrigin: 'bottom' }}></div>
                  {/* Floating particles */}
                  <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(2px 2px at 15% 25%, ${theme.particle}, transparent), radial-gradient(1px 1px at 65% 45%, ${theme.particle}, transparent), radial-gradient(2px 2px at 35% 75%, ${theme.particle}, transparent), radial-gradient(1px 1px at 80% 15%, ${theme.particle}, transparent), radial-gradient(1px 1px at 50% 55%, ${theme.particle}, transparent)` }}></div>
                  {/* Portal/nexus glow center */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full opacity-10 group-hover:opacity-20 transition-opacity" style={{ background: `radial-gradient(circle, ${theme.accent}40 0%, transparent 70%)` }}></div>
                  {/* Room content */}
                  <div className="relative z-10 p-3">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: theme.accent, boxShadow: `0 0 6px ${theme.accent}` }}></div>
                        <span className="font-mono text-[10px] tracking-[0.15em] font-medium uppercase" style={{ color: theme.accent }}>{sector}</span>
                      </div>
                      <span className="font-mono text-[10px]" style={{ color: `${theme.accent}80` }}>{bots.length} BOTS</span>
                    </div>
                    {/* Bot avatars arranged in room */}
                    <div className="flex flex-wrap gap-2 justify-center py-2">
                      {bots.map((bot) => (
                        <button key={bot.agent_id} onClick={() => setSelectedBot(selectedBot?.agent_id === bot.agent_id ? null : bot)}
                          className={`relative group/bot transition-all duration-200 ${selectedBot?.agent_id === bot.agent_id ? 'scale-125 z-20' : 'hover:scale-110'}`}
                          title={`${bot.name} — ${bot.status}`}
                          data-testid={`bot-${bot.agent_id}`}>
                          <div className="w-9 h-9 flex items-center justify-center rounded-full transition-all"
                            style={{
                              background: `radial-gradient(circle, ${bot.color}35 0%, ${bot.color}08 70%)`,
                              border: `1.5px solid ${bot.color}70`,
                              boxShadow: selectedBot?.agent_id === bot.agent_id ? `0 0 12px ${bot.color}, 0 0 24px ${bot.color}40` : `0 0 4px ${bot.color}30`
                            }}>
                            <Bot size={14} style={{ color: bot.color, filter: `drop-shadow(0 0 3px ${bot.color})` }} />
                          </div>
                          {/* Status glow ring */}
                          <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-5 h-1 rounded-full opacity-60" style={{ backgroundColor: statusColor(bot.status), filter: `blur(2px)` }}></div>
                          {/* Energy arc */}
                          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-0.5 rounded-full" style={{ width: `${bot.energy * 0.36}px`, backgroundColor: bot.energy > 50 ? '#00FF66' : bot.energy > 25 ? '#FFCC00' : '#FF3B30', boxShadow: `0 0 4px ${bot.energy > 50 ? '#00FF66' : '#FF3B30'}40` }}></div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            });
          })()}
        </div>

        {/* Selected Bot Detail + Debate Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Bot Detail */}
          <Card className="bg-[#111111] border-[#222222] p-4 rounded-none">
            <h3 className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase mb-3">AGENT INSPECTOR</h3>
            {selectedBot ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 flex items-center justify-center border rounded-sm" style={{ borderColor: selectedBot.color, background: `${selectedBot.color}20`, boxShadow: `0 0 12px ${selectedBot.color}40` }}>
                    <Bot size={24} style={{ color: selectedBot.color }} />
                  </div>
                  <div>
                    <p className="font-mono text-sm font-medium text-white">{selectedBot.name}</p>
                    <p className="font-mono text-[10px] text-[#8A8A8A]">{selectedBot.role} / {selectedBot.personality}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><p className="font-mono text-[10px] text-[#555555]">ENERGY</p><p className="font-mono text-sm text-white">{selectedBot.energy}%</p></div>
                  <div><p className="font-mono text-[10px] text-[#555555]">WIN RATE</p><p className="font-mono text-sm text-[#00FF66]">{(selectedBot.win_rate * 100).toFixed(0)}%</p></div>
                  <div><p className="font-mono text-[10px] text-[#555555]">PREDICTIONS</p><p className="font-mono text-sm text-white">{selectedBot.total_predictions}</p></div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-[#555555]">STATUS:</span>
                  <span className="font-mono text-xs" style={{ color: statusColor(selectedBot.status) }}>{selectedBot.status.toUpperCase()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-[#555555]">SECTOR:</span>
                  <span className="font-mono text-xs text-white">{selectedBot.sector}</span>
                </div>
                <div className="terminal-bg p-2">
                  <p className="font-mono text-[10px] text-[#555555] mb-1">MEMORY LOG:</p>
                  {selectedBot.memory.map((m, i) => (
                    <p key={i} className="font-mono text-[10px] text-[#8A8A8A]">{'>'} {m}</p>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-6"><Bot size={32} className="mx-auto text-[#333333] mb-2" /><p className="font-mono text-xs text-[#8A8A8A]">SELECT A BOT TO INSPECT</p></div>
            )}
          </Card>

          {/* Debate Feed */}
          <Card className="bg-[#111111] border-[#222222] rounded-none overflow-hidden">
            <div className="p-4 border-b border-[#222222]">
              <h3 className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">DEBATE FEED ({debate.length})</h3>
            </div>
            <ScrollArea className="h-[300px]">
              {debate.length === 0 ? (
                <div className="p-6 text-center"><Terminal size={32} className="mx-auto text-[#333333] mb-2" /><p className="font-mono text-xs text-[#8A8A8A]">RUN A PREDICTION TO SEE THE DEBATE</p></div>
              ) : (
                <div className="p-2 space-y-2">
                  {debate.map((d, i) => (
                    <div key={i} className="border border-[#1A1A1A] p-2 hover:bg-[#151515] transition-colors" data-testid={`debate-${i}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 flex items-center justify-center" style={{ color: d.color }}><Bot size={10} /></div>
                          <span className="font-mono text-[10px] text-white font-medium">{d.name}</span>
                          <span className="font-mono text-[8px] text-[#555555]">{d.role}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className={`font-mono text-[10px] font-medium ${d.bias === 'bullish' ? 'text-[#00FF66]' : d.bias === 'bearish' ? 'text-[#FF3B30]' : 'text-[#8A8A8A]'}`}>
                            {d.bias.toUpperCase()}
                          </span>
                          <span className="font-mono text-[10px] text-[#FFCC00] tabular-nums">{(d.confidence * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                      <p className="font-mono text-[10px] text-[#8A8A8A] leading-relaxed">{d.rationale}</p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

// ============== PROFIT ENGINE PAGE ==============
function EnginePage() {
  const [swarm, setSwarm] = useState(null);
  const [config, setConfig] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [enginePositions, setEnginePositions] = useState([]);
  const [trades, setTrades] = useState([]);
  const [pnl, setPnl] = useState(0);
  const [loading, setLoading] = useState(true);
  const [configEditing, setConfigEditing] = useState(false);
  const [editConfig, setEditConfig] = useState({});
  const { lastMessage } = useWs();

  const fetchAll = useCallback(async () => {
    try {
      const [s, c, p, pos, t, pnlRes] = await Promise.all([
        axios.get(`${API}/api/engine/swarm`, { withCredentials: true }),
        axios.get(`${API}/api/engine/config`, { withCredentials: true }),
        axios.get(`${API}/api/engine/predictions`, { withCredentials: true }),
        axios.get(`${API}/api/engine/positions`, { withCredentials: true }),
        axios.get(`${API}/api/engine/trades`, { withCredentials: true }),
        axios.get(`${API}/api/engine/pnl`, { withCredentials: true }),
      ]);
      setSwarm(s.data); setConfig(c.data); setEditConfig(c.data);
      setPredictions(p.data.predictions); setEnginePositions(pos.data.positions);
      setTrades(t.data.trades); setPnl(pnlRes.data.realized_pnl_usd);
    } catch (e) { console.error('Request failed:', e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); const i = setInterval(fetchAll, 10000); return () => clearInterval(i); }, [fetchAll]);

  useEffect(() => {
    if (lastMessage && ["engine_webhook", "engine_prediction", "engine_config"].includes(lastMessage.type)) fetchAll();
  }, [lastMessage, fetchAll]);

  const saveConfig = async () => {
    try {
      await axios.patch(`${API}/api/engine/config`, editConfig, { withCredentials: true });
      toast.success("Engine config updated"); setConfigEditing(false); fetchAll();
    } catch (err) { toast.error("Failed to update config"); }
  };

  const consensus = swarm?.consensus;
  const biasData = swarm?.bias_split ? [
    { name: "BUY", value: swarm.bias_split.buy * 100, fill: "#00FF66" },
    { name: "SELL", value: swarm.bias_split.sell * 100, fill: "#FF3B30" },
    { name: "HOLD", value: swarm.bias_split.hold * 100, fill: "#555555" },
  ] : [];

  if (loading) return <DashboardLayout><div className="font-mono text-sm text-[#8A8A8A]">LOADING ENGINE<span className="cursor-blink"></span></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl font-bold tracking-tight text-white">PROFIT ENGINE</h2>
          <div className="flex items-center gap-2">
            <span className={`status-dot ${config?.kill_switch === 'ON' ? 'status-dot-danger' : 'status-dot-success'}`}></span>
            <span className="font-mono text-[10px] text-[#8A8A8A]">{config?.kill_switch === 'ON' ? 'KILL SWITCH ON' : 'OPERATIONAL'}</span>
            <Button variant="ghost" onClick={fetchAll} className="text-[#8A8A8A] hover:text-white"><RefreshCw size={16} /></Button>
          </div>
        </div>

        {/* Swarm Consensus + Regime */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-[#111111] border-[#222222] p-4 rounded-none" data-testid="consensus-card">
            <p className="font-mono text-[10px] tracking-[0.15em] text-[#555555]">CONSENSUS</p>
            <p className={`font-mono text-2xl font-bold ${consensus?.action === 'buy' ? 'text-[#00FF66]' : consensus?.action === 'sell' ? 'text-[#FF3B30]' : 'text-[#8A8A8A]'}`}>
              {consensus?.action?.toUpperCase() || "—"}
            </p>
            <p className="font-mono text-xs text-[#8A8A8A] tabular-nums">{((consensus?.consensus_score || 0) * 100).toFixed(1)}% confidence</p>
          </Card>
          <Card className="bg-[#111111] border-[#222222] p-4 rounded-none" data-testid="regime-card">
            <p className="font-mono text-[10px] tracking-[0.15em] text-[#555555]">REGIME</p>
            <p className="font-mono text-2xl font-bold text-white">{swarm?.optimizer_state?.market_regime?.toUpperCase() || "—"}</p>
            <p className="font-mono text-xs text-[#8A8A8A] tabular-nums">Threshold: {(swarm?.optimizer_state?.adaptive_threshold || 0.68).toFixed(2)}</p>
          </Card>
          <Card className="bg-[#111111] border-[#222222] p-4 rounded-none" data-testid="pnl-card">
            <p className="font-mono text-[10px] tracking-[0.15em] text-[#555555]">REALIZED PNL</p>
            <p className={`font-mono text-2xl font-bold tabular-nums ${pnl >= 0 ? 'text-[#00FF66]' : 'text-[#FF3B30]'}`}>{formatCurrency(pnl)}</p>
            <p className="font-mono text-xs text-[#8A8A8A]">Max loss: {formatCurrency(config?.max_daily_loss_usd || 250)}</p>
          </Card>
          <Card className="bg-[#111111] border-[#222222] p-4 rounded-none">
            <p className="font-mono text-[10px] tracking-[0.15em] text-[#555555]">SWARM VOTES</p>
            <ResponsiveContainer width="100%" height={60}>
              <BarChart data={biasData} layout="vertical">
                <XAxis type="number" hide domain={[0, 100]} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fill: '#8A8A8A', fontFamily: 'IBM Plex Mono' }} width={35} />
                <Bar dataKey="value">{biasData.map((e, i) => <Cell key={i} fill={e.fill} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Config + Predictions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Config Panel */}
          <Card className="bg-[#111111] border-[#222222] p-4 rounded-none">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">ENGINE CONFIG</h3>
              {!configEditing ? (
                <Button variant="ghost" size="sm" onClick={() => setConfigEditing(true)} className="text-[#8A8A8A] hover:text-white" data-testid="edit-config-btn"><Settings size={14} /></Button>
              ) : (
                <div className="flex gap-1">
                  <Button size="sm" onClick={saveConfig} className="bg-[#00FF66] text-black rounded-none text-[10px] h-6 px-2" data-testid="save-config-btn">SAVE</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setConfigEditing(false); setEditConfig(config); }} className="text-[#8A8A8A] text-[10px] h-6">CANCEL</Button>
                </div>
              )}
            </div>
            <div className="space-y-3">
              {[
                ["Confidence Threshold", "base_confidence_threshold"],
                ["Max Position ($)", "max_position_notional_usd"],
                ["Max Daily Loss ($)", "max_daily_loss_usd"],
                ["Cooldown Bars", "cooldown_bars"],
                ["Top Signal Count", "top_signal_count"],
              ].map(([label, key]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-[#8A8A8A]">{label}</span>
                  {configEditing ? (
                    <Input value={editConfig[key] || ""} onChange={(e) => setEditConfig({...editConfig, [key]: parseFloat(e.target.value) || 0})}
                      className="w-24 h-6 bg-[#0A0A0A] border-[#333333] rounded-none text-white font-mono text-xs text-right p-1" />
                  ) : (
                    <span className="font-mono text-xs text-white tabular-nums">{config?.[key]}</span>
                  )}
                </div>
              ))}
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-[#8A8A8A]">Kill Switch</span>
                {configEditing ? (
                  <Switch checked={editConfig.kill_switch === "ON"} onCheckedChange={(v) => setEditConfig({...editConfig, kill_switch: v ? "ON" : "OFF"})} data-testid="kill-switch-toggle" />
                ) : (
                  <span className={`font-mono text-xs ${config?.kill_switch === 'ON' ? 'text-[#FF3B30]' : 'text-[#00FF66]'}`}>{config?.kill_switch}</span>
                )}
              </div>
            </div>
          </Card>

          {/* Recent Predictions */}
          <Card className="lg:col-span-2 bg-[#111111] border-[#222222] rounded-none overflow-hidden">
            <div className="p-4 border-b border-[#222222]">
              <h3 className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">RECENT PREDICTIONS ({predictions.length})</h3>
            </div>
            <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
              <table className="w-full min-w-[500px]">
                <thead className="bg-[#0A0A0A] sticky top-0"><tr>
                  {["SYMBOL", "ACTION", "CONFIDENCE", "REGIME", "THRESHOLD", "POS MULT"].map(h => (
                    <th key={h} className="font-mono text-[10px] text-[#555555] text-left p-2">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {predictions.slice(0, 20).map((p, i) => (
                    <tr key={i} className="border-t border-[#1A1A1A] hover:bg-[#151515]" data-testid={`prediction-${i}`}>
                      <td className="font-mono text-xs text-white p-2">{p.symbol}</td>
                      <td className={`font-mono text-xs p-2 font-medium ${p.selected_action === 'buy' ? 'text-[#00FF66]' : p.selected_action === 'sell' ? 'text-[#FF3B30]' : 'text-[#8A8A8A]'}`}>{p.selected_action?.toUpperCase()}</td>
                      <td className="font-mono text-xs text-white p-2 tabular-nums">{(p.confidence * 100).toFixed(1)}%</td>
                      <td className="font-mono text-[10px] text-[#8A8A8A] p-2">{p.regime}</td>
                      <td className="font-mono text-xs text-white p-2 tabular-nums">{(p.threshold_used * 100).toFixed(1)}%</td>
                      <td className="font-mono text-xs text-[#FFCC00] p-2 tabular-nums">{p.position_multiplier}x</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {predictions.length === 0 && <div className="p-6 text-center"><p className="font-mono text-xs text-[#8A8A8A]">NO PREDICTIONS YET</p></div>}
            </div>
          </Card>
        </div>

        {/* Engine Positions + Trades */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-[#111111] border-[#222222] rounded-none overflow-hidden">
            <div className="p-4 border-b border-[#222222]"><h3 className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">ENGINE POSITIONS</h3></div>
            {enginePositions.length === 0 ? (
              <div className="p-6 text-center"><p className="font-mono text-xs text-[#8A8A8A]">NO POSITIONS</p></div>
            ) : (
              <table className="w-full">
                <thead className="bg-[#0A0A0A]"><tr>
                  {["SYMBOL", "SIDE", "QTY", "ENTRY", "NOTIONAL"].map(h => (<th key={h} className="font-mono text-[10px] text-[#555555] text-left p-2">{h}</th>))}
                </tr></thead>
                <tbody>
                  {enginePositions.map((p, i) => (
                    <tr key={i} className="border-t border-[#1A1A1A]">
                      <td className="font-mono text-xs text-white p-2">{p.symbol}</td>
                      <td className={`font-mono text-xs p-2 ${p.side === 'long' ? 'text-[#00FF66]' : 'text-[#FF3B30]'}`}>{p.side?.toUpperCase()}</td>
                      <td className="font-mono text-xs text-white p-2 tabular-nums">{p.quantity}</td>
                      <td className="font-mono text-xs text-white p-2 tabular-nums">${p.entry_price}</td>
                      <td className="font-mono text-xs text-[#FFCC00] p-2 tabular-nums">${p.notional_usd}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card className="bg-[#111111] border-[#222222] rounded-none overflow-hidden">
            <div className="p-4 border-b border-[#222222]"><h3 className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">RECENT TRADES ({trades.length})</h3></div>
            {trades.length === 0 ? (
              <div className="p-6 text-center"><p className="font-mono text-xs text-[#8A8A8A]">NO TRADES</p></div>
            ) : (
              <div className="max-h-[200px] overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-[#0A0A0A] sticky top-0"><tr>
                    {["SYMBOL", "SIDE", "PRICE", "QTY", "REGIME"].map(h => (<th key={h} className="font-mono text-[10px] text-[#555555] text-left p-2">{h}</th>))}
                  </tr></thead>
                  <tbody>
                    {trades.slice(0, 20).map((t, i) => (
                      <tr key={i} className="border-t border-[#1A1A1A]">
                        <td className="font-mono text-xs text-white p-2">{t.symbol}</td>
                        <td className={`font-mono text-xs p-2 ${t.side === 'buy' ? 'text-[#00FF66]' : 'text-[#FF3B30]'}`}>{t.side?.toUpperCase()}</td>
                        <td className="font-mono text-xs text-white p-2 tabular-nums">${t.price}</td>
                        <td className="font-mono text-xs text-white p-2 tabular-nums">{t.quantity}</td>
                        <td className="font-mono text-[10px] text-[#8A8A8A] p-2">{t.regime}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

// ============== EXCHANGE (BITGET) PAGE ==============
function ExchangePage() {
  const [exchangeStatus, setExchangeStatus] = useState(null);
  const [tickers, setTickers] = useState([]);
  const [balance, setBalance] = useState(null);
  const [positions, setPositions] = useState([]);
  const [openOrders, setOpenOrders] = useState([]);
  const [orderHistory, setOrderHistory] = useState([]);
  const [ohlcv, setOhlcv] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("market");
  const [marketType, setMarketType] = useState("spot");
  const [selectedSymbol, setSelectedSymbol] = useState("BTC/USDT");
  const [orderForm, setOrderForm] = useState({ side: "buy", type: "market", amount: "", price: "" });
  const [orderLoading, setOrderLoading] = useState(false);
  const { lastMessage } = useWs();

  const fetchStatus = useCallback(async () => {
    try { const { data } = await axios.get(`${API}/api/exchange/status`, { withCredentials: true }); setExchangeStatus(data); } catch (e) { console.error('Request failed:', e); }
  }, []);

  const fetchTickers = useCallback(async () => {
    try {
      const symbols = marketType === "spot" ? "BTC/USDT,ETH/USDT,SOL/USDT,XRP/USDT,DOGE/USDT,ADA/USDT" : "BTC/USDT:USDT,ETH/USDT:USDT,SOL/USDT:USDT";
      const { data } = await axios.get(`${API}/api/exchange/tickers?symbols=${symbols}&market_type=${marketType}`, { withCredentials: true });
      setTickers(data.tickers.filter(t => !t.error));
    } catch (e) { console.error('Request failed:', e); }
  }, [marketType]);

  const fetchBalance = useCallback(async () => {
    try { const { data } = await axios.get(`${API}/api/exchange/balance?market_type=${marketType}`, { withCredentials: true }); setBalance(data); } catch (e) { console.error('Request failed:', e); }
  }, [marketType]);

  const fetchPositions = useCallback(async () => {
    try { const { data } = await axios.get(`${API}/api/exchange/positions`, { withCredentials: true }); setPositions(data.positions); } catch (e) { console.error('Request failed:', e); }
  }, []);

  const fetchOpenOrders = useCallback(async () => {
    try { const { data } = await axios.get(`${API}/api/exchange/open-orders?market_type=${marketType}`, { withCredentials: true }); setOpenOrders(data.orders); } catch (e) { console.error('Request failed:', e); }
  }, [marketType]);

  const fetchOrderHistory = useCallback(async () => {
    try { const { data } = await axios.get(`${API}/api/exchange/order-history?market_type=${marketType}&limit=20`, { withCredentials: true }); setOrderHistory(data.orders); } catch (e) { console.error('Request failed:', e); }
  }, [marketType]);

  const fetchChart = useCallback(async () => {
    try { const { data } = await axios.get(`${API}/api/exchange/ohlcv/${encodeURIComponent(selectedSymbol)}?timeframe=1h&limit=48&market_type=${marketType}`, { withCredentials: true }); setOhlcv(data.candles); } catch (e) { console.error('Request failed:', e); }
  }, [selectedSymbol, marketType]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchStatus();
      await fetchTickers();
      await fetchChart();
      setLoading(false);
    };
    init();
    const interval = setInterval(fetchTickers, 10000);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchTickers, fetchChart]);

  useEffect(() => {
    if (exchangeStatus?.configured) { fetchBalance(); fetchPositions(); fetchOpenOrders(); fetchOrderHistory(); }
  }, [exchangeStatus, fetchBalance, fetchPositions, fetchOpenOrders, fetchOrderHistory]);

  useEffect(() => { fetchChart(); }, [selectedSymbol, fetchChart]);

  // WS order updates
  useEffect(() => {
    if (lastMessage?.type === "order_filled") { fetchBalance(); fetchOpenOrders(); fetchOrderHistory(); }
  }, [lastMessage, fetchBalance, fetchOpenOrders, fetchOrderHistory]);

  const placeOrder = async () => {
    if (!orderForm.amount) { toast.error("Enter amount"); return; }
    setOrderLoading(true);
    try {
      await axios.post(`${API}/api/exchange/order`, {
        symbol: selectedSymbol, side: orderForm.side, order_type: orderForm.type,
        amount: parseFloat(orderForm.amount),
        price: orderForm.price ? parseFloat(orderForm.price) : null,
        market_type: marketType
      }, { withCredentials: true });
      toast.success(`${orderForm.side.toUpperCase()} order placed`);
      setOrderForm({ ...orderForm, amount: "", price: "" });
      fetchBalance(); fetchOpenOrders();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Order failed"); }
    finally { setOrderLoading(false); }
  };

  const cancelOrder = async (orderId, symbol) => {
    try {
      await axios.post(`${API}/api/exchange/cancel`, { order_id: orderId, symbol, market_type: marketType }, { withCredentials: true });
      toast.success("Order cancelled"); fetchOpenOrders();
    } catch (err) { toast.error("Cancel failed"); }
  };

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-[#111111] border border-[#333333] p-2 font-mono text-[10px]">
        <p className="text-[#8A8A8A]">O: {d.open} H: {d.high}</p>
        <p className="text-[#8A8A8A]">L: {d.low} C: {d.close}</p>
        <p className="text-[#8A8A8A]">Vol: {d.volume?.toFixed(2)}</p>
      </div>
    );
  };

  if (loading) return <DashboardLayout><div className="font-mono text-sm text-[#8A8A8A]">LOADING EXCHANGE<span className="cursor-blink"></span></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <h2 className="font-heading text-2xl font-bold tracking-tight text-white">BITGET EXCHANGE</h2>
            <span className={`status-dot ${exchangeStatus?.configured ? 'status-dot-success' : 'status-dot-danger'}`}></span>
            <span className="font-mono text-[10px] text-[#8A8A8A]">{exchangeStatus?.configured ? 'CONNECTED' : 'NOT CONFIGURED'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Select value={marketType} onValueChange={setMarketType}>
              <SelectTrigger className="w-28 bg-[#0A0A0A] border-[#333333] rounded-none text-white h-8" data-testid="market-type-select"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-[#111111] border-[#333333]"><SelectItem value="spot">SPOT</SelectItem><SelectItem value="swap">FUTURES</SelectItem></SelectContent>
            </Select>
            <Button variant="ghost" onClick={() => { fetchTickers(); fetchBalance(); }} className="text-[#8A8A8A] hover:text-white" data-testid="refresh-exchange"><RefreshCw size={16} /></Button>
          </div>
        </div>

        {!exchangeStatus?.configured && (
          <Card className="bg-[#111111] border-[#FFCC00] p-4 rounded-none">
            <div className="flex items-center gap-2 mb-2"><AlertTriangle size={16} className="text-[#FFCC00]" /><span className="font-mono text-xs text-[#FFCC00]">API KEYS NOT CONFIGURED</span></div>
            <p className="font-mono text-xs text-[#8A8A8A]">Add your Bitget API keys to <code className="text-white">backend/.env</code>:</p>
            <pre className="font-mono text-[10px] text-[#00FF66] mt-2 terminal-bg p-2">BITGET_API_KEY=your_key{"\n"}BITGET_API_SECRET=your_secret{"\n"}BITGET_PASSPHRASE=your_passphrase</pre>
            <p className="font-mono text-[10px] text-[#555555] mt-2">Market data (tickers, charts) works without keys. Balance, orders, and positions require API keys.</p>
          </Card>
        )}

        {/* Tickers Strip */}
        <div className="flex gap-3 overflow-x-auto pb-2">
          {tickers.map((t) => (
            <button key={t.symbol} onClick={() => setSelectedSymbol(t.symbol)}
              className={`flex-shrink-0 bg-[#111111] border p-3 rounded-none transition-all min-w-[140px] ${selectedSymbol === t.symbol ? 'border-white' : 'border-[#222222] hover:border-[#333333]'}`}
              data-testid={`ticker-${t.symbol?.replace('/', '-')}`}>
              <p className="font-mono text-xs text-white font-medium">{t.symbol}</p>
              <p className={`font-mono text-sm tabular-nums font-medium ${(t.change_pct || 0) >= 0 ? 'text-[#00FF66]' : 'text-[#FF3B30]'}`}>
                ${t.last?.toLocaleString()}
              </p>
              <p className={`font-mono text-[10px] tabular-nums ${(t.change_pct || 0) >= 0 ? 'text-[#00FF66]' : 'text-[#FF3B30]'}`}>
                {(t.change_pct || 0) >= 0 ? '+' : ''}{t.change_pct?.toFixed(2)}%
              </p>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Chart */}
          <Card className="lg:col-span-2 bg-[#111111] border-[#222222] p-4 rounded-none">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">{selectedSymbol} — 1H</h3>
              <Button variant="ghost" size="sm" onClick={fetchChart} className="text-[#8A8A8A] hover:text-white"><RefreshCw size={12} /></Button>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={ohlcv}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222222" />
                <XAxis dataKey="ts" tick={{ fontSize: 9, fill: '#555555', fontFamily: 'IBM Plex Mono' }} tickFormatter={(v) => new Date(v).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 9, fill: '#555555', fontFamily: 'IBM Plex Mono' }} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="close" stroke="#00FF66" fill="#00FF66" fillOpacity={0.08} strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          {/* Order Panel */}
          <Card className="bg-[#111111] border-[#222222] p-4 rounded-none">
            <h3 className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase mb-3">PLACE ORDER</h3>
            <div className="space-y-3">
              <div className="flex gap-1">
                <Button onClick={() => setOrderForm({...orderForm, side: "buy"})} className={`flex-1 rounded-none text-xs ${orderForm.side === 'buy' ? 'bg-[#00FF66] text-black hover:bg-[#00DD55]' : 'bg-[#1A1A1A] text-[#8A8A8A] hover:bg-[#222222]'}`} data-testid="order-buy-btn">
                  <ArrowUp size={12} className="mr-1" />BUY
                </Button>
                <Button onClick={() => setOrderForm({...orderForm, side: "sell"})} className={`flex-1 rounded-none text-xs ${orderForm.side === 'sell' ? 'bg-[#FF3B30] text-white hover:bg-[#DD2A20]' : 'bg-[#1A1A1A] text-[#8A8A8A] hover:bg-[#222222]'}`} data-testid="order-sell-btn">
                  <ArrowDown size={12} className="mr-1" />SELL
                </Button>
              </div>
              <Select value={orderForm.type} onValueChange={(v) => setOrderForm({...orderForm, type: v})}>
                <SelectTrigger className="bg-[#0A0A0A] border-[#333333] rounded-none text-white h-8" data-testid="order-type-select"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#111111] border-[#333333]"><SelectItem value="market">Market</SelectItem><SelectItem value="limit">Limit</SelectItem></SelectContent>
              </Select>
              <div>
                <label className="font-mono text-[10px] text-[#555555]">AMOUNT</label>
                <Input value={orderForm.amount} onChange={(e) => setOrderForm({...orderForm, amount: e.target.value})} placeholder="0.001" className="bg-[#0A0A0A] border-[#333333] rounded-none text-white font-mono tabular-nums" data-testid="order-amount-input" />
              </div>
              {orderForm.type === "limit" && (
                <div>
                  <label className="font-mono text-[10px] text-[#555555]">PRICE</label>
                  <Input value={orderForm.price} onChange={(e) => setOrderForm({...orderForm, price: e.target.value})} placeholder="50000" className="bg-[#0A0A0A] border-[#333333] rounded-none text-white font-mono tabular-nums" data-testid="order-price-input" />
                </div>
              )}
              <Button onClick={placeOrder} disabled={orderLoading || !exchangeStatus?.configured}
                className={`w-full rounded-none ${orderForm.side === 'buy' ? 'bg-[#00FF66] text-black hover:bg-[#00DD55]' : 'bg-[#FF3B30] text-white hover:bg-[#DD2A20]'}`}
                data-testid="place-order-btn">
                {orderLoading ? "PLACING..." : `${orderForm.side.toUpperCase()} ${selectedSymbol}`}
              </Button>
            </div>
          </Card>
        </div>

        {/* Balance + Positions + Orders tabs */}
        <Tabs defaultValue="balance" className="w-full">
          <TabsList className="bg-[#111111] border border-[#222222] rounded-none p-1">
            <TabsTrigger value="balance" className="rounded-none font-mono text-xs data-[state=active]:bg-white data-[state=active]:text-black" data-testid="tab-balance"><Wallet size={12} className="mr-1" />BALANCE</TabsTrigger>
            <TabsTrigger value="positions" className="rounded-none font-mono text-xs data-[state=active]:bg-white data-[state=active]:text-black" data-testid="tab-positions"><Layers size={12} className="mr-1" />POSITIONS</TabsTrigger>
            <TabsTrigger value="open" className="rounded-none font-mono text-xs data-[state=active]:bg-white data-[state=active]:text-black" data-testid="tab-open-orders">OPEN ORDERS</TabsTrigger>
            <TabsTrigger value="history" className="rounded-none font-mono text-xs data-[state=active]:bg-white data-[state=active]:text-black" data-testid="tab-order-history">HISTORY</TabsTrigger>
          </TabsList>

          <TabsContent value="balance" className="mt-4">
            <Card className="bg-[#111111] border-[#222222] rounded-none overflow-hidden">
              {!balance || balance.error ? (
                <div className="p-6 text-center"><Wallet size={32} className="mx-auto text-[#333333] mb-2" /><p className="font-mono text-xs text-[#8A8A8A]">{balance?.error || "Configure API keys to view balance"}</p></div>
              ) : Object.keys(balance.total).length === 0 ? (
                <div className="p-6 text-center"><p className="font-mono text-xs text-[#8A8A8A]">NO BALANCES</p></div>
              ) : (
                <table className="w-full">
                  <thead className="bg-[#0A0A0A]"><tr>
                    <th className="font-mono text-[10px] text-[#555555] text-left p-3">ASSET</th>
                    <th className="font-mono text-[10px] text-[#555555] text-right p-3">TOTAL</th>
                    <th className="font-mono text-[10px] text-[#555555] text-right p-3">AVAILABLE</th>
                    <th className="font-mono text-[10px] text-[#555555] text-right p-3">IN USE</th>
                  </tr></thead>
                  <tbody>
                    {Object.entries(balance.total).map(([asset, total]) => (
                      <tr key={asset} className="border-t border-[#1A1A1A] hover:bg-[#151515]">
                        <td className="font-mono text-xs text-white p-3 font-medium">{asset}</td>
                        <td className="font-mono text-xs text-white text-right p-3 tabular-nums">{parseFloat(total).toFixed(6)}</td>
                        <td className="font-mono text-xs text-[#00FF66] text-right p-3 tabular-nums">{parseFloat(balance.free[asset] || 0).toFixed(6)}</td>
                        <td className="font-mono text-xs text-[#FFCC00] text-right p-3 tabular-nums">{parseFloat(balance.used[asset] || 0).toFixed(6)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="positions" className="mt-4">
            <Card className="bg-[#111111] border-[#222222] rounded-none overflow-hidden">
              {positions.length === 0 ? (
                <div className="p-6 text-center"><Layers size={32} className="mx-auto text-[#333333] mb-2" /><p className="font-mono text-xs text-[#8A8A8A]">NO OPEN POSITIONS</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px]">
                    <thead className="bg-[#0A0A0A]"><tr>
                      {["SYMBOL","SIDE","SIZE","ENTRY","MARK","PNL","LEVERAGE"].map(h => (
                        <th key={h} className="font-mono text-[10px] text-[#555555] text-left p-3">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {positions.map((p, i) => (
                        <tr key={i} className="border-t border-[#1A1A1A] hover:bg-[#151515]" data-testid={`position-${i}`}>
                          <td className="font-mono text-xs text-white p-3">{p.symbol}</td>
                          <td className={`font-mono text-xs p-3 ${p.side === 'long' ? 'text-[#00FF66]' : 'text-[#FF3B30]'}`}>{p.side?.toUpperCase()}</td>
                          <td className="font-mono text-xs text-white p-3 tabular-nums">{p.contracts}</td>
                          <td className="font-mono text-xs text-white p-3 tabular-nums">{p.entry_price}</td>
                          <td className="font-mono text-xs text-white p-3 tabular-nums">{p.mark_price}</td>
                          <td className={`font-mono text-xs p-3 tabular-nums ${(p.unrealized_pnl || 0) >= 0 ? 'text-[#00FF66]' : 'text-[#FF3B30]'}`}>{p.unrealized_pnl}</td>
                          <td className="font-mono text-xs text-[#FFCC00] p-3">{p.leverage}x</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="open" className="mt-4">
            <Card className="bg-[#111111] border-[#222222] rounded-none overflow-hidden">
              {openOrders.length === 0 ? (
                <div className="p-6 text-center"><p className="font-mono text-xs text-[#8A8A8A]">NO OPEN ORDERS</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead className="bg-[#0A0A0A]"><tr>
                      {["SYMBOL","SIDE","TYPE","AMOUNT","PRICE","FILLED","ACTION"].map(h => (
                        <th key={h} className="font-mono text-[10px] text-[#555555] text-left p-3">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {openOrders.map((o) => (
                        <tr key={o.id} className="border-t border-[#1A1A1A] hover:bg-[#151515]" data-testid={`open-order-${o.id}`}>
                          <td className="font-mono text-xs text-white p-3">{o.symbol}</td>
                          <td className={`font-mono text-xs p-3 ${o.side === 'buy' ? 'text-[#00FF66]' : 'text-[#FF3B30]'}`}>{o.side?.toUpperCase()}</td>
                          <td className="font-mono text-xs text-[#8A8A8A] p-3">{o.type}</td>
                          <td className="font-mono text-xs text-white p-3 tabular-nums">{o.amount}</td>
                          <td className="font-mono text-xs text-white p-3 tabular-nums">{o.price}</td>
                          <td className="font-mono text-xs text-white p-3 tabular-nums">{o.filled}</td>
                          <td className="p-3"><Button size="sm" variant="ghost" onClick={() => cancelOrder(o.id, o.symbol)} className="text-[#FF3B30] hover:bg-[#FF3B30] hover:text-white rounded-none text-[10px]"><X size={12} /></Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <Card className="bg-[#111111] border-[#222222] rounded-none overflow-hidden">
              {orderHistory.length === 0 ? (
                <div className="p-6 text-center"><p className="font-mono text-xs text-[#8A8A8A]">NO ORDER HISTORY</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead className="bg-[#0A0A0A]"><tr>
                      {["TIME","SYMBOL","SIDE","TYPE","AMOUNT","PRICE","STATUS"].map(h => (
                        <th key={h} className="font-mono text-[10px] text-[#555555] text-left p-3">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {orderHistory.map((o) => (
                        <tr key={o.id} className="border-t border-[#1A1A1A] hover:bg-[#151515]">
                          <td className="font-mono text-[10px] text-[#8A8A8A] p-3">{o.timestamp ? new Date(o.timestamp).toLocaleString() : '-'}</td>
                          <td className="font-mono text-xs text-white p-3">{o.symbol}</td>
                          <td className={`font-mono text-xs p-3 ${o.side === 'buy' ? 'text-[#00FF66]' : 'text-[#FF3B30]'}`}>{o.side?.toUpperCase()}</td>
                          <td className="font-mono text-xs text-[#8A8A8A] p-3">{o.type}</td>
                          <td className="font-mono text-xs text-white p-3 tabular-nums">{o.amount}</td>
                          <td className="font-mono text-xs text-white p-3 tabular-nums">{o.price}</td>
                          <td className="p-3"><span className={`font-mono text-[10px] ${o.status === 'closed' ? 'text-[#00FF66]' : 'text-[#8A8A8A]'}`}>{o.status?.toUpperCase()}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
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
            <Route path="/dungeon" element={<ProtectedRoute><DungeonPage /></ProtectedRoute>} />
            <Route path="/exchange" element={<ProtectedRoute><ExchangePage /></ProtectedRoute>} />
            <Route path="/engine" element={<ProtectedRoute><EnginePage /></ProtectedRoute>} />
            <Route path="/signals" element={<ProtectedRoute><SignalsPage /></ProtectedRoute>} />
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
