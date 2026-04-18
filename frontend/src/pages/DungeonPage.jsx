import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, RefreshCw, Settings, Terminal, Zap } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useWs } from "@/contexts/WsContext";
import { logError } from "@/lib/utils";

const API = process.env.REACT_APP_BACKEND_URL;

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
    } catch (e) { logError('Request failed', e); } finally { setLoading(false); }
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
      logError('Request error', e); toast.error("Prediction failed"); }
    finally { setPredLoading(false); }
  };

  const toggleAutoExec = async () => {
    try {
      const { data } = await axios.patch(`${API}/api/dungeon/auto-exec/config`, { enabled: !autoExec?.enabled }, { withCredentials: true });
      setAutoExec(data); setEditAutoExec(data);
      toast.success(data.enabled ? "Auto-execution ENABLED" : "Auto-execution DISABLED");
    } catch (e) {
      logError('Request error', e); toast.error("Failed"); }
  };

  const saveAutoExec = async () => {
    try {
      const { data } = await axios.patch(`${API}/api/dungeon/auto-exec/config`, editAutoExec, { withCredentials: true });
      setAutoExec(data); setEditAutoExec(data); setEditingAE(false);
      toast.success("Auto-exec config updated");
    } catch (e) {
      logError('Request error', e); toast.error("Failed"); }
  };

  const promoteRollout = async () => {
    try { const { data } = await axios.post(`${API}/api/dungeon/rollout/promote`, {}, { withCredentials: true }); if (data.promoted) toast.success("Stage promoted!"); else toast.warning(data.reason); fetchAll(); }
    catch (e) { logError('error', e); toast.error("Promote failed"); }
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
            <div>
              <p className="font-mono text-[10px] text-[#555555]">DIRECTIONS</p>
              <p className="font-mono text-sm text-white">{(autoExec?.allowed_directions || []).map(d => d === 'long_bias' ? 'LONG' : 'SHORT').join(", ") || "ALL"}</p>
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
      logError('Request error', e); toast.error("Failed"); }
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
                    <tr key={t.id || `${t.symbol}-${t.created_at}-${i}`} className="border-t border-[#1A1A1A] hover:bg-[#151515]" data-testid={`auto-trade-${i}`}>
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
                  {selectedBot.memory.map((m) => (
                    <p key={m} className="font-mono text-[10px] text-[#8A8A8A]">{'>'} {m}</p>
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
                  {debate.map((d) => (
                    <div key={d.agent_id} className="border border-[#1A1A1A] p-2 hover:bg-[#151515] transition-colors" data-testid={`debate-${d.agent_id}`}>
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


export default DungeonPage;
