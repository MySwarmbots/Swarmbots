import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";
import { RefreshCw, Settings } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useWs } from "@/contexts/WsContext";
import { formatCurrency } from "@/lib/utils";

const API = process.env.REACT_APP_BACKEND_URL;

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
                <Bar dataKey="value">{biasData.map((e) => <Cell key={e.name} fill={e.fill} />)}</Bar>
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
                    <tr key={p.id || `${p.symbol}-${p.created_at || p.timestamp || i}`} className="border-t border-[#1A1A1A] hover:bg-[#151515]" data-testid={`prediction-${i}`}>
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
                  {enginePositions.map((p) => (
                    <tr key={`${p.symbol}-${p.side}-${p.entry_price}`} className="border-t border-[#1A1A1A]">
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
                      <tr key={t.id || `${t.symbol}-${t.created_at || i}`} className="border-t border-[#1A1A1A]">
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


export default EnginePage;
