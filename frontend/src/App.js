import { useEffect, useState, useCallback } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import axios from "axios";
import { formatApiErrorDetail, formatCurrency, formatNumber, logError } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import {
  Activity, Bot, BarChart3, Shield, Bell, Plus, Trash2, Play, Pause, Send,
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle, XCircle, RefreshCw, Zap, Terminal,
  ChevronRight, KeyRound, MessageCircle, Mail, ArrowUpDown, Layers, X,
} from "lucide-react";

import { AuthProvider } from "@/contexts/AuthContext";
import { useWs } from "@/contexts/WsContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";

import ChartsPage from "@/pages/ChartsPage";
import SignalsPage from "@/pages/SignalsPage";
import DungeonPage from "@/pages/DungeonPage";
import EnginePage from "@/pages/EnginePage";
import ExchangePage from "@/pages/ExchangePage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";


const API = process.env.REACT_APP_BACKEND_URL;

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
    } catch (e) { logError('Request failed', e); } finally { setLoading(false); }
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
          {statCards.map((stat) => (
            <Card key={stat.label} className="bg-[#111111] border-[#222222] p-3 rounded-none hover:border-[#333333] transition-all" data-testid={`stat-${stat.label.toLowerCase().replace(/\s/g, '-')}`}>
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
    catch (e) { logError('error', e); toast.error("Failed to load agents"); } finally { setLoading(false); }
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

  const toggleAgent = async (id) => { try { await axios.patch(`${API}/api/agents/${id}/toggle`, {}, { withCredentials: true }); fetchAgents(); } catch (e) { logError('error', e); toast.error("Failed"); } };
  const deleteAgent = async (id) => { try { await axios.delete(`${API}/api/agents/${id}`, { withCredentials: true }); toast.success("Deleted"); fetchAgents(); } catch (e) { logError('error', e); toast.error("Failed"); } };

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
                  <div className="flex flex-wrap gap-1 mt-2">{newAgent.trading_pairs.map((p) => (<Badge key={p} variant="outline" className="bg-[#1A1A1A] border-[#333333] text-white rounded-none cursor-pointer" onClick={() => setNewAgent({...newAgent, trading_pairs: newAgent.trading_pairs.filter((x) => x !== p)})}>{p} x</Badge>))}</div></div>
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
                <div className="flex flex-wrap gap-1 mb-3">{agent.trading_pairs.map((p) => (<Badge key={p} variant="outline" className="bg-transparent border-[#333333] text-[#8A8A8A] rounded-none text-[10px]">{p}</Badge>))}</div>
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

// ============== VALIDATION PAGE ==============
function ValidationPage() {
  const [runs, setRuns] = useState([]); const [gate, setGate] = useState(null); const [, setLoading] = useState(true);
  const { lastMessage } = useWs();

  const fetchData = useCallback(async () => {
    try {
      const [r, g] = await Promise.all([axios.get(`${API}/api/validation/runs`, { withCredentials: true }), axios.get(`${API}/api/validation/gate`, { withCredentials: true })]);
      setRuns(r.data.runs); setGate(g.data);
    } catch (e) { logError('Request failed', e); } finally { setLoading(false); }
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
    catch (e) { logError('error', e); toast.error("Failed"); }
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
                  <tr key={`${run.ts}-${run.symbol}`} className="border-t border-[#1A1A1A] hover:bg-[#151515] transition-colors" data-testid={`validation-run-${i}`}>
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
              <button key={p} onClick={() => setPrompt(p)} className="font-mono text-[10px] text-[#555555] hover:text-white border border-[#333333] px-2 py-1 transition-colors" data-testid={`sample-prompt-${i}`}>{p}</button>
            ))}
          </div>
        </Card>
        <div className="space-y-4">
          {insights.length === 0 ? (
            <Card className="terminal-bg p-8 rounded-none text-center"><Terminal size={48} className="mx-auto text-[#333333] mb-4" /><p className="font-mono text-sm text-[#8A8A8A]">AWAITING QUERY</p></Card>
          ) : insights.map((item, i) => (
            <Card key={item.timestamp} className="terminal-bg p-4 rounded-none" data-testid={`insight-${i}`}>
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
    catch (e) { logError('Load error', e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // Real-time notifications via WS
  useEffect(() => {
    if (lastMessage?.type === "notification") {
      setNotifications((prev) => [lastMessage.data, ...prev]);
    }
  }, [lastMessage]);
  const markRead = async (id) => { try { await axios.patch(`${API}/api/notifications/${id}/read`, {}, { withCredentials: true }); fetchNotifications(); } catch (e) { logError('Request failed', e); } };
  const markAllRead = async () => { try { await axios.post(`${API}/api/notifications/mark-all-read`, {}, { withCredentials: true }); toast.success("All read"); fetchNotifications(); } catch (e) { logError('Request failed', e); } };

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
  const fetchPlans = async () => { try { const { data } = await axios.get(`${API}/api/payments/plans`, { withCredentials: true }); setPlans(data.plans); } catch (e) { logError('Request failed', e); } finally { setLoading(false); } };

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
                <ul className="mt-4 space-y-2">{plan.features.map((f) => (<li key={f} className="flex items-center gap-2 font-mono text-xs text-[#8A8A8A]"><CheckCircle size={12} className="text-[#00FF66]" />{f}</li>))}</ul>
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
    catch (e) { logError('Load error', e); } finally { setLoading(false); }
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
    catch (e) { logError('error', e); toast.error("Failed"); }
  };

  const testTelegram = async () => {
    try { await axios.post(`${API}/api/telegram/test`, {}, { withCredentials: true }); toast.success("Test message sent! Check Telegram."); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const updatePrefs = async (field, value) => {
    try { await axios.patch(`${API}/api/profile`, { [field]: value }, { withCredentials: true }); fetchProfile(); }
    catch (e) { logError('error', e); toast.error("Failed to update"); }
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
  const poll = useCallback(async (a = 0) => {
    if (a >= 5) { setStatus("timeout"); return; }
    try {
      const { data } = await axios.get(`${API}/api/payments/status/${sessionId}`, { withCredentials: true });
      if (data.payment_status === "paid") setStatus("success");
      else if (data.status === "expired") setStatus("expired");
      else setTimeout(() => poll(a + 1), 2000);
    } catch (e) {
      logError('Request error', e); setStatus("error"); }
  }, [sessionId]);
  useEffect(() => { if (sessionId) poll(); }, [sessionId, poll]);
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
