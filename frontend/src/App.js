import { useEffect, useState } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import axios from "axios";
import { formatApiErrorDetail, formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
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
  Activity, Bot, BarChart3, Shield, Bell, CreditCard, Settings, LogOut, 
  Menu, X, Plus, Trash2, Play, Pause, Send, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle, XCircle, RefreshCw, Zap, Terminal, ChevronRight
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

// Protected Route Component
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="font-mono text-sm text-[#8A8A8A]">INITIALIZING<span className="cursor-blink"></span></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
}

// Login Page
function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate("/dashboard");
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setIsLoading(false);
    }
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
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 bg-[#0A0A0A] border-[#333333] rounded-none focus:ring-1 focus:ring-white focus:border-white text-white"
                required
                data-testid="login-email-input"
              />
            </div>
            <div>
              <label className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 bg-[#0A0A0A] border-[#333333] rounded-none focus:ring-1 focus:ring-white focus:border-white text-white"
                required
                data-testid="login-password-input"
              />
            </div>
            {error && <p className="text-[#FF3B30] text-sm font-mono">{error}</p>}
            <Button 
              type="submit" 
              className="w-full bg-white text-black hover:bg-gray-200 rounded-none font-medium"
              disabled={isLoading}
              data-testid="login-submit-btn"
            >
              {isLoading ? "AUTHENTICATING..." : "LOGIN"}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <button onClick={() => navigate("/register")} className="font-mono text-xs text-[#8A8A8A] hover:text-white transition-colors" data-testid="goto-register-link">
              CREATE ACCOUNT
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}

// Register Page
function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { register, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate("/dashboard");
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await register(email, password, name);
      navigate("/dashboard");
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setIsLoading(false);
    }
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
            <div>
              <label className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">Name</label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 bg-[#0A0A0A] border-[#333333] rounded-none focus:ring-1 focus:ring-white focus:border-white text-white"
                required
                data-testid="register-name-input"
              />
            </div>
            <div>
              <label className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 bg-[#0A0A0A] border-[#333333] rounded-none focus:ring-1 focus:ring-white focus:border-white text-white"
                required
                data-testid="register-email-input"
              />
            </div>
            <div>
              <label className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 bg-[#0A0A0A] border-[#333333] rounded-none focus:ring-1 focus:ring-white focus:border-white text-white"
                required
                data-testid="register-password-input"
              />
            </div>
            {error && <p className="text-[#FF3B30] text-sm font-mono">{error}</p>}
            <Button 
              type="submit" 
              className="w-full bg-white text-black hover:bg-gray-200 rounded-none font-medium"
              disabled={isLoading}
              data-testid="register-submit-btn"
            >
              {isLoading ? "CREATING..." : "CREATE ACCOUNT"}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <button onClick={() => navigate("/login")} className="font-mono text-xs text-[#8A8A8A] hover:text-white transition-colors" data-testid="goto-login-link">
              ALREADY HAVE ACCOUNT
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}

// Dashboard Layout
function DashboardLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const navItems = [
    { icon: Activity, label: "Dashboard", path: "/dashboard" },
    { icon: Bot, label: "Agents", path: "/agents" },
    { icon: BarChart3, label: "Validation", path: "/validation" },
    { icon: Terminal, label: "AI Insights", path: "/insights" },
    { icon: Bell, label: "Notifications", path: "/notifications" },
    { icon: CreditCard, label: "Billing", path: "/billing" },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Header */}
      <header className="bg-[#0A0A0A] border-b border-[#222222] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-4">
              <button className="lg:hidden text-white" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} data-testid="mobile-menu-toggle">
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
              <h1 className="font-heading text-xl font-black tracking-tighter text-white">MIROFISH</h1>
            </div>
            
            <nav className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-[#8A8A8A] hover:text-white hover:bg-[#1A1A1A] transition-all duration-150"
                  data-testid={`nav-${item.label.toLowerCase()}`}
                >
                  <item.icon size={16} strokeWidth={1.5} />
                  <span className="font-mono text-xs tracking-wider uppercase">{item.label}</span>
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-4">
              <span className="hidden sm:block font-mono text-xs text-[#8A8A8A]">{user?.email}</span>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-[#8A8A8A] hover:text-white hover:bg-[#1A1A1A]" data-testid="logout-btn">
                <LogOut size={16} strokeWidth={1.5} />
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <nav className="lg:hidden border-t border-[#222222] bg-[#111111]">
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); setMobileMenuOpen(false); }}
                className="flex items-center gap-3 w-full px-4 py-3 text-[#8A8A8A] hover:text-white hover:bg-[#1A1A1A] transition-all"
                data-testid={`mobile-nav-${item.label.toLowerCase()}`}
              >
                <item.icon size={18} strokeWidth={1.5} />
                <span className="font-mono text-xs tracking-wider uppercase">{item.label}</span>
              </button>
            ))}
          </nav>
        )}
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}

// Dashboard Page
function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const { data } = await axios.get(`${API}/api/dashboard/stats`, { withCredentials: true });
      setStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="font-mono text-sm text-[#8A8A8A]">LOADING DATA<span className="cursor-blink"></span></div>;
  }

  const statCards = [
    { label: "TOTAL AGENTS", value: stats?.total_agents || 0, icon: Bot, color: "text-white" },
    { label: "ACTIVE AGENTS", value: stats?.active_agents || 0, icon: Zap, color: "text-[#00FF66]" },
    { label: "TOTAL PNL", value: formatCurrency(stats?.total_pnl || 0), icon: stats?.total_pnl >= 0 ? TrendingUp : TrendingDown, color: stats?.total_pnl >= 0 ? "text-[#00FF66]" : "text-[#FF3B30]" },
    { label: "AVG WIN RATE", value: `${stats?.avg_win_rate || 0}%`, icon: BarChart3, color: "text-[#FFCC00]" },
    { label: "TOTAL TRADES", value: formatNumber(stats?.total_trades || 0, 0), icon: Activity, color: "text-white" },
    { label: "VALIDATION PASS", value: `${stats?.validation_summary?.passed || 0}/${stats?.validation_summary?.total_runs || 0}`, icon: Shield, color: stats?.validation_summary?.gate?.blocked ? "text-[#FF3B30]" : "text-[#00FF66]" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl font-bold tracking-tight text-white">CONTROL ROOM</h2>
          <div className="flex items-center gap-2">
            <span className={`status-dot ${stats?.validation_summary?.gate?.blocked ? 'status-dot-danger' : 'status-dot-success'}`}></span>
            <span className="font-mono text-xs text-[#8A8A8A] uppercase">
              GATE: {stats?.validation_summary?.gate?.mode || "SHADOW"}
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {statCards.map((stat, i) => (
            <Card key={i} className="bg-[#111111] border-[#222222] p-4 rounded-none hover:border-[#333333] transition-all" data-testid={`stat-${stat.label.toLowerCase().replace(/\s/g, '-')}`}>
              <div className="flex items-center justify-between mb-2">
                <stat.icon size={16} strokeWidth={1.5} className="text-[#555555]" />
              </div>
              <p className={`font-mono text-xl font-medium tabular-nums ${stat.color}`}>{stat.value}</p>
              <p className="font-mono text-[10px] tracking-[0.15em] text-[#555555] mt-1">{stat.label}</p>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-[#111111] border-[#222222] p-4 rounded-none">
            <h3 className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase mb-3">QUICK ACTIONS</h3>
            <div className="space-y-2">
              <Button className="w-full justify-start bg-transparent border border-[#333333] text-white hover:bg-white hover:text-black rounded-none" onClick={() => window.location.href = '/agents'} data-testid="quick-action-agents">
                <Bot size={16} className="mr-2" /> Manage Agents
              </Button>
              <Button className="w-full justify-start bg-transparent border border-[#333333] text-white hover:bg-white hover:text-black rounded-none" onClick={() => window.location.href = '/validation'} data-testid="quick-action-validation">
                <Shield size={16} className="mr-2" /> View Validation
              </Button>
              <Button className="w-full justify-start bg-transparent border border-[#333333] text-white hover:bg-white hover:text-black rounded-none" onClick={() => window.location.href = '/insights'} data-testid="quick-action-insights">
                <Terminal size={16} className="mr-2" /> AI Insights
              </Button>
            </div>
          </Card>

          <Card className="bg-[#111111] border-[#222222] p-4 rounded-none">
            <h3 className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase mb-3">SYSTEM STATUS</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-[#8A8A8A]">GATE MODE</span>
                <span className="font-mono text-xs text-white">{stats?.validation_summary?.gate?.mode?.toUpperCase()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-[#8A8A8A]">GATE STATUS</span>
                <span className={`font-mono text-xs ${stats?.validation_summary?.gate?.blocked ? 'text-[#FF3B30]' : 'text-[#00FF66]'}`}>
                  {stats?.validation_summary?.gate?.blocked ? "BLOCKED" : "OPEN"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-[#8A8A8A]">VALIDATION</span>
                <span className="font-mono text-xs text-white">{stats?.validation_summary?.passed}/{stats?.validation_summary?.total_runs} PASSED</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

// Agents Page
function AgentsPage() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newAgent, setNewAgent] = useState({ name: "", strategy: "momentum", exchange: "binance", trading_pairs: [], risk_level: "medium" });
  const [pairInput, setPairInput] = useState("");

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const { data } = await axios.get(`${API}/api/agents`, { withCredentials: true });
      setAgents(data.agents);
    } catch (err) {
      toast.error("Failed to load agents");
    } finally {
      setLoading(false);
    }
  };

  const createAgent = async () => {
    try {
      await axios.post(`${API}/api/agents`, newAgent, { withCredentials: true });
      toast.success("Agent created");
      setDialogOpen(false);
      setNewAgent({ name: "", strategy: "momentum", exchange: "binance", trading_pairs: [], risk_level: "medium" });
      fetchAgents();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
  };

  const toggleAgent = async (agentId) => {
    try {
      await axios.patch(`${API}/api/agents/${agentId}/toggle`, {}, { withCredentials: true });
      fetchAgents();
    } catch (err) {
      toast.error("Failed to toggle agent");
    }
  };

  const deleteAgent = async (agentId) => {
    try {
      await axios.delete(`${API}/api/agents/${agentId}`, { withCredentials: true });
      toast.success("Agent deleted");
      fetchAgents();
    } catch (err) {
      toast.error("Failed to delete agent");
    }
  };

  const addPair = () => {
    if (pairInput && !newAgent.trading_pairs.includes(pairInput.toUpperCase())) {
      setNewAgent({ ...newAgent, trading_pairs: [...newAgent.trading_pairs, pairInput.toUpperCase()] });
      setPairInput("");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl font-bold tracking-tight text-white">TRADING AGENTS</h2>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-white text-black hover:bg-gray-200 rounded-none" data-testid="create-agent-btn">
                <Plus size={16} className="mr-2" /> NEW AGENT
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#111111] border-[#333333] rounded-none">
              <DialogHeader>
                <DialogTitle className="font-heading text-white">CREATE AGENT</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <label className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">Name</label>
                  <Input value={newAgent.name} onChange={(e) => setNewAgent({...newAgent, name: e.target.value})} className="mt-1 bg-[#0A0A0A] border-[#333333] rounded-none text-white" data-testid="agent-name-input" />
                </div>
                <div>
                  <label className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">Strategy</label>
                  <Select value={newAgent.strategy} onValueChange={(v) => setNewAgent({...newAgent, strategy: v})}>
                    <SelectTrigger className="mt-1 bg-[#0A0A0A] border-[#333333] rounded-none text-white" data-testid="agent-strategy-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#111111] border-[#333333]">
                      <SelectItem value="momentum">Momentum</SelectItem>
                      <SelectItem value="mean_reversion">Mean Reversion</SelectItem>
                      <SelectItem value="arbitrage">Arbitrage</SelectItem>
                      <SelectItem value="grid">Grid Trading</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">Exchange</label>
                  <Select value={newAgent.exchange} onValueChange={(v) => setNewAgent({...newAgent, exchange: v})}>
                    <SelectTrigger className="mt-1 bg-[#0A0A0A] border-[#333333] rounded-none text-white" data-testid="agent-exchange-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#111111] border-[#333333]">
                      <SelectItem value="binance">Binance</SelectItem>
                      <SelectItem value="coinbase">Coinbase</SelectItem>
                      <SelectItem value="kraken">Kraken</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">Trading Pairs</label>
                  <div className="flex gap-2 mt-1">
                    <Input value={pairInput} onChange={(e) => setPairInput(e.target.value)} placeholder="BTC/USDT" className="bg-[#0A0A0A] border-[#333333] rounded-none text-white" data-testid="agent-pair-input" />
                    <Button onClick={addPair} className="bg-[#1A1A1A] text-white hover:bg-[#333333] rounded-none">ADD</Button>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {newAgent.trading_pairs.map((p, i) => (
                      <Badge key={i} variant="outline" className="bg-[#1A1A1A] border-[#333333] text-white rounded-none">{p}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">Risk Level</label>
                  <Select value={newAgent.risk_level} onValueChange={(v) => setNewAgent({...newAgent, risk_level: v})}>
                    <SelectTrigger className="mt-1 bg-[#0A0A0A] border-[#333333] rounded-none text-white" data-testid="agent-risk-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#111111] border-[#333333]">
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={createAgent} className="w-full bg-white text-black hover:bg-gray-200 rounded-none" data-testid="submit-agent-btn">CREATE AGENT</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="font-mono text-sm text-[#8A8A8A]">LOADING AGENTS<span className="cursor-blink"></span></div>
        ) : agents.length === 0 ? (
          <Card className="bg-[#111111] border-[#222222] p-8 rounded-none text-center">
            <Bot size={48} className="mx-auto text-[#333333] mb-4" />
            <p className="font-mono text-sm text-[#8A8A8A]">NO AGENTS DEPLOYED</p>
            <p className="font-mono text-xs text-[#555555] mt-1">Create your first trading agent to get started</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent) => (
              <Card key={agent.id} className="bg-[#111111] border-[#222222] p-4 rounded-none hover:border-[#333333] transition-all" data-testid={`agent-card-${agent.id}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-mono text-sm font-medium text-white">{agent.name}</h3>
                    <p className="font-mono text-xs text-[#555555] mt-1">{agent.strategy.toUpperCase()} • {agent.exchange.toUpperCase()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`status-dot ${agent.status === 'active' ? 'status-dot-success' : 'status-dot-warning'}`}></span>
                    <span className="font-mono text-[10px] text-[#8A8A8A] uppercase">{agent.status}</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div>
                    <p className="font-mono text-xs text-[#555555]">PNL</p>
                    <p className={`font-mono text-sm tabular-nums ${agent.pnl >= 0 ? 'text-[#00FF66]' : 'text-[#FF3B30]'}`}>
                      {formatCurrency(agent.pnl)}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-xs text-[#555555]">WIN RATE</p>
                    <p className="font-mono text-sm tabular-nums text-white">{(agent.win_rate * 100).toFixed(0)}%</p>
                  </div>
                  <div>
                    <p className="font-mono text-xs text-[#555555]">TRADES</p>
                    <p className="font-mono text-sm tabular-nums text-white">{agent.total_trades}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                  {agent.trading_pairs.map((p, i) => (
                    <Badge key={i} variant="outline" className="bg-transparent border-[#333333] text-[#8A8A8A] rounded-none text-[10px]">{p}</Badge>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-[#222222]">
                  <Button variant="ghost" size="sm" onClick={() => toggleAgent(agent.id)} className="text-[#8A8A8A] hover:text-white" data-testid={`toggle-agent-${agent.id}`}>
                    {agent.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteAgent(agent.id)} className="text-[#8A8A8A] hover:text-[#FF3B30]" data-testid={`delete-agent-${agent.id}`}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// Validation Page
function ValidationPage() {
  const [runs, setRuns] = useState([]);
  const [gate, setGate] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [runsRes, gateRes] = await Promise.all([
        axios.get(`${API}/api/validation/runs`, { withCredentials: true }),
        axios.get(`${API}/api/validation/gate`, { withCredentials: true })
      ]);
      setRuns(runsRes.data.runs);
      setGate(gateRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateGate = async (mode, blocked) => {
    try {
      await axios.post(`${API}/api/validation/gate`, { mode, blocked, reason: "" }, { withCredentials: true });
      toast.success("Gate updated");
      fetchData();
    } catch (err) {
      toast.error("Failed to update gate");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl font-bold tracking-tight text-white">VALIDATION ENGINE</h2>
          <Button variant="ghost" onClick={fetchData} className="text-[#8A8A8A] hover:text-white" data-testid="refresh-validation">
            <RefreshCw size={16} />
          </Button>
        </div>

        {/* Gate Control */}
        <Card className="bg-[#111111] border-[#222222] p-4 rounded-none">
          <h3 className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase mb-4">ROLLOUT GATE</h3>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className={`status-dot ${gate?.blocked ? 'status-dot-danger' : 'status-dot-success'}`}></span>
              <span className="font-mono text-sm text-white">{gate?.blocked ? "BLOCKED" : "OPEN"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-[#8A8A8A]">MODE:</span>
              <Select value={gate?.mode || "shadow"} onValueChange={(v) => updateGate(v, gate?.blocked || false)}>
                <SelectTrigger className="w-32 bg-[#0A0A0A] border-[#333333] rounded-none text-white h-8" data-testid="gate-mode-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#111111] border-[#333333]">
                  <SelectItem value="shadow">Shadow</SelectItem>
                  <SelectItem value="live">Live</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-[#8A8A8A]">BLOCKED:</span>
              <Switch checked={gate?.blocked || false} onCheckedChange={(v) => updateGate(gate?.mode || "shadow", v)} data-testid="gate-blocked-switch" />
            </div>
            {gate?.reason && <span className="font-mono text-xs text-[#FF3B30]">REASON: {gate.reason}</span>}
          </div>
        </Card>

        {/* Validation Runs Table */}
        <Card className="bg-[#111111] border-[#222222] rounded-none overflow-hidden">
          <div className="p-4 border-b border-[#222222]">
            <h3 className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">VALIDATION RUNS</h3>
          </div>
          <ScrollArea className="h-[400px]">
            <table className="w-full">
              <thead className="bg-[#0A0A0A] sticky top-0">
                <tr>
                  <th className="font-mono text-[10px] tracking-wider text-[#555555] text-left p-3">TIME</th>
                  <th className="font-mono text-[10px] tracking-wider text-[#555555] text-left p-3">SYMBOL</th>
                  <th className="font-mono text-[10px] tracking-wider text-[#555555] text-left p-3">EXCHANGE</th>
                  <th className="font-mono text-[10px] tracking-wider text-[#555555] text-right p-3">DRIFT %</th>
                  <th className="font-mono text-[10px] tracking-wider text-[#555555] text-right p-3">SLIP BPS</th>
                  <th className="font-mono text-[10px] tracking-wider text-[#555555] text-center p-3">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run, i) => (
                  <tr key={i} className="border-t border-[#1A1A1A] hover:bg-[#151515] transition-colors" data-testid={`validation-run-${i}`}>
                    <td className="font-mono text-xs text-[#8A8A8A] p-3">{new Date(run.ts).toLocaleTimeString()}</td>
                    <td className="font-mono text-xs text-white p-3">{run.symbol}</td>
                    <td className="font-mono text-xs text-[#8A8A8A] p-3">{run.exchange}</td>
                    <td className="font-mono text-xs text-white text-right p-3 tabular-nums">{run.drift_pct.toFixed(4)}</td>
                    <td className="font-mono text-xs text-white text-right p-3 tabular-nums">{run.slippage_bps.toFixed(2)}</td>
                    <td className="p-3 text-center">
                      <span className={`inline-flex items-center gap-1 font-mono text-[10px] uppercase ${run.passed ? 'text-[#00FF66]' : 'text-[#FF3B30]'}`}>
                        <span className={`status-dot ${run.passed ? 'status-dot-success' : 'status-dot-danger'}`}></span>
                        {run.passed ? "PASS" : "FAIL"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </Card>
      </div>
    </DashboardLayout>
  );
}

// AI Insights Page
function InsightsPage() {
  const [prompt, setPrompt] = useState("");
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchInsight = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/api/ai/insights`, { prompt }, { withCredentials: true });
      setInsights([{ prompt, response: data.insight, timestamp: data.timestamp }, ...insights]);
      setPrompt("");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Failed to get insight");
    } finally {
      setLoading(false);
    }
  };

  const samplePrompts = [
    "Analyze current BTC market conditions",
    "What's the best trading strategy for volatile markets?",
    "Review risk factors for ETH swing trading",
    "Explain arbitrage opportunities in DeFi"
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h2 className="font-heading text-2xl font-bold tracking-tight text-white">AI TRADING INSIGHTS</h2>
        
        <Card className="terminal-bg p-4 rounded-none">
          <div className="flex gap-2">
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && fetchInsight()}
              placeholder="Ask MiroFish AI..."
              className="flex-1 bg-transparent border-[#333333] rounded-none text-white font-mono text-sm focus:ring-1 focus:ring-white"
              data-testid="ai-prompt-input"
            />
            <Button onClick={fetchInsight} disabled={loading} className="bg-white text-black hover:bg-gray-200 rounded-none" data-testid="ai-submit-btn">
              {loading ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
            </Button>
          </div>
          
          <div className="flex flex-wrap gap-2 mt-3">
            {samplePrompts.map((p, i) => (
              <button key={i} onClick={() => setPrompt(p)} className="font-mono text-[10px] text-[#555555] hover:text-white border border-[#333333] px-2 py-1 transition-colors" data-testid={`sample-prompt-${i}`}>
                {p}
              </button>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          {insights.length === 0 ? (
            <Card className="terminal-bg p-8 rounded-none text-center">
              <Terminal size={48} className="mx-auto text-[#333333] mb-4" />
              <p className="font-mono text-sm text-[#8A8A8A]">AWAITING QUERY</p>
              <p className="font-mono text-xs text-[#555555] mt-1">Ask MiroFish AI for trading insights and analysis</p>
            </Card>
          ) : (
            insights.map((item, i) => (
              <Card key={i} className="terminal-bg p-4 rounded-none" data-testid={`insight-${i}`}>
                <div className="flex items-center gap-2 mb-2">
                  <ChevronRight size={12} className="text-[#00FF66]" />
                  <span className="font-mono text-xs text-[#00FF66]">{item.prompt}</span>
                </div>
                <pre className="font-mono text-sm text-[#E0E0E0] whitespace-pre-wrap leading-relaxed">{item.response}</pre>
                <p className="font-mono text-[10px] text-[#555555] mt-2">{new Date(item.timestamp).toLocaleString()}</p>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

// Notifications Page
function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const { data } = await axios.get(`${API}/api/notifications`, { withCredentials: true });
      setNotifications(data.notifications);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id) => {
    try {
      await axios.patch(`${API}/api/notifications/${id}/read`, {}, { withCredentials: true });
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'success': return <CheckCircle size={16} className="text-[#00FF66]" />;
      case 'error': return <XCircle size={16} className="text-[#FF3B30]" />;
      case 'warning': return <AlertTriangle size={16} className="text-[#FFCC00]" />;
      default: return <Bell size={16} className="text-[#8A8A8A]" />;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h2 className="font-heading text-2xl font-bold tracking-tight text-white">NOTIFICATIONS</h2>
        
        {loading ? (
          <div className="font-mono text-sm text-[#8A8A8A]">LOADING<span className="cursor-blink"></span></div>
        ) : notifications.length === 0 ? (
          <Card className="bg-[#111111] border-[#222222] p-8 rounded-none text-center">
            <Bell size={48} className="mx-auto text-[#333333] mb-4" />
            <p className="font-mono text-sm text-[#8A8A8A]">NO NOTIFICATIONS</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {notifications.map((notif) => (
              <Card key={notif.id} className={`bg-[#111111] border-[#222222] p-4 rounded-none ${!notif.read ? 'border-l-2 border-l-white' : ''}`} data-testid={`notification-${notif.id}`}>
                <div className="flex items-start gap-3">
                  {getIcon(notif.type)}
                  <div className="flex-1">
                    <p className="font-mono text-sm text-white">{notif.title}</p>
                    <p className="font-mono text-xs text-[#8A8A8A] mt-1">{notif.message}</p>
                    <p className="font-mono text-[10px] text-[#555555] mt-2">{new Date(notif.created_at).toLocaleString()}</p>
                  </div>
                  {!notif.read && (
                    <Button variant="ghost" size="sm" onClick={() => markAsRead(notif.id)} className="text-[#8A8A8A] hover:text-white" data-testid={`mark-read-${notif.id}`}>
                      <CheckCircle size={14} />
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// Billing Page
function BillingPage() {
  const [plans, setPlans] = useState({});
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data } = await axios.get(`${API}/api/payments/plans`, { withCredentials: true });
      setPlans(data.plans);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async (planId) => {
    setCheckoutLoading(planId);
    try {
      const { data } = await axios.post(`${API}/api/payments/checkout`, {
        plan: planId,
        origin_url: window.location.origin
      }, { withCredentials: true });
      window.location.href = data.url;
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Checkout failed");
    } finally {
      setCheckoutLoading(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h2 className="font-heading text-2xl font-bold tracking-tight text-white">BILLING & SUBSCRIPTION</h2>
        
        {loading ? (
          <div className="font-mono text-sm text-[#8A8A8A]">LOADING PLANS<span className="cursor-blink"></span></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(plans).map(([id, plan]) => (
              <Card key={id} className={`bg-[#111111] border-[#222222] p-6 rounded-none hover:border-[#333333] transition-all ${id === 'pro' ? 'border-white' : ''}`} data-testid={`plan-${id}`}>
                {id === 'pro' && <Badge className="bg-white text-black rounded-none mb-4">POPULAR</Badge>}
                <h3 className="font-heading text-xl font-bold text-white">{plan.name}</h3>
                <p className="font-mono text-3xl font-bold text-white mt-2 tabular-nums">{formatCurrency(plan.amount)}<span className="text-sm text-[#8A8A8A]">/mo</span></p>
                <ul className="mt-4 space-y-2">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 font-mono text-xs text-[#8A8A8A]">
                      <CheckCircle size={12} className="text-[#00FF66]" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button 
                  onClick={() => handleCheckout(id)} 
                  disabled={checkoutLoading === id}
                  className={`w-full mt-6 rounded-none ${id === 'pro' ? 'bg-white text-black hover:bg-gray-200' : 'bg-transparent border border-[#333333] text-white hover:bg-white hover:text-black'}`}
                  data-testid={`checkout-${id}`}
                >
                  {checkoutLoading === id ? "PROCESSING..." : "SUBSCRIBE"}
                </Button>
              </Card>
            ))}
          </div>
        )}

        <Card className="bg-[#111111] border-[#222222] p-4 rounded-none">
          <p className="font-mono text-xs text-[#8A8A8A]">
            Payments are processed securely via Stripe. Card and crypto payments accepted.
          </p>
        </Card>
      </div>
    </DashboardLayout>
  );
}

// Payment Success Page
function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("checking");
  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    if (sessionId) {
      pollStatus();
    }
  }, [sessionId]);

  const pollStatus = async (attempts = 0) => {
    if (attempts >= 5) {
      setStatus("timeout");
      return;
    }
    try {
      const { data } = await axios.get(`${API}/api/payments/status/${sessionId}`, { withCredentials: true });
      if (data.payment_status === "paid") {
        setStatus("success");
      } else if (data.status === "expired") {
        setStatus("expired");
      } else {
        setTimeout(() => pollStatus(attempts + 1), 2000);
      }
    } catch (err) {
      setStatus("error");
    }
  };

  return (
    <DashboardLayout>
      <Card className="bg-[#111111] border-[#222222] p-8 rounded-none text-center max-w-md mx-auto">
        {status === "checking" && (
          <>
            <RefreshCw size={48} className="mx-auto text-[#8A8A8A] mb-4 animate-spin" />
            <p className="font-mono text-sm text-[#8A8A8A]">VERIFYING PAYMENT<span className="cursor-blink"></span></p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle size={48} className="mx-auto text-[#00FF66] mb-4" />
            <h2 className="font-heading text-xl font-bold text-white">PAYMENT SUCCESSFUL</h2>
            <p className="font-mono text-xs text-[#8A8A8A] mt-2">Your subscription is now active</p>
            <Button onClick={() => window.location.href = '/dashboard'} className="mt-4 bg-white text-black hover:bg-gray-200 rounded-none" data-testid="go-dashboard-btn">
              GO TO DASHBOARD
            </Button>
          </>
        )}
        {(status === "error" || status === "expired" || status === "timeout") && (
          <>
            <XCircle size={48} className="mx-auto text-[#FF3B30] mb-4" />
            <h2 className="font-heading text-xl font-bold text-white">PAYMENT ISSUE</h2>
            <p className="font-mono text-xs text-[#8A8A8A] mt-2">Please contact support if payment was charged</p>
            <Button onClick={() => window.location.href = '/billing'} className="mt-4 bg-white text-black hover:bg-gray-200 rounded-none" data-testid="retry-btn">
              TRY AGAIN
            </Button>
          </>
        )}
      </Card>
    </DashboardLayout>
  );
}

// Payment Cancel Page
function PaymentCancelPage() {
  return (
    <DashboardLayout>
      <Card className="bg-[#111111] border-[#222222] p-8 rounded-none text-center max-w-md mx-auto">
        <XCircle size={48} className="mx-auto text-[#FFCC00] mb-4" />
        <h2 className="font-heading text-xl font-bold text-white">PAYMENT CANCELLED</h2>
        <p className="font-mono text-xs text-[#8A8A8A] mt-2">No charges were made to your account</p>
        <Button onClick={() => window.location.href = '/billing'} className="mt-4 bg-white text-black hover:bg-gray-200 rounded-none" data-testid="back-billing-btn">
          BACK TO BILLING
        </Button>
      </Card>
    </DashboardLayout>
  );
}

// Main App
function App() {
  return (
    <AuthProvider>
      <div className="App">
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/agents" element={<ProtectedRoute><AgentsPage /></ProtectedRoute>} />
            <Route path="/validation" element={<ProtectedRoute><ValidationPage /></ProtectedRoute>} />
            <Route path="/insights" element={<ProtectedRoute><InsightsPage /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
            <Route path="/billing" element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />
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
