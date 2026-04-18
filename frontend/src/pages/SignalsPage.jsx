import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { CheckCircle, XCircle, RefreshCw, Zap, TrendingUp } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useWs } from "@/contexts/WsContext";

const API = process.env.REACT_APP_BACKEND_URL;

// ============== SIGNAL STRENGTH PAGE ==============
function SignalsPage() {
  const [data, setData] = useState(null);
  const [intel, setIntel] = useState([]);
  const [loading, setLoading] = useState(true);
  const { lastMessage } = useWs();

  const fetchData = useCallback(async () => {
    try {
      const [acc, intl] = await Promise.all([
        axios.get(`${API}/api/signals/accuracy?limit=200`, { withCredentials: true }),
        axios.get(`${API}/api/signals/intelligence`, { withCredentials: true }),
      ]);
      setData(acc.data); setIntel(intl.data.intelligence || []);
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
  const longIntel = intel.filter(i => i.direction === "long_bias");
  const shortIntel = intel.filter(i => i.direction === "short_bias");

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl font-bold tracking-tight text-white">SIGNAL STRENGTH</h2>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-[#555555]">{data?.pending || 0} pending</span>
            <Button variant="ghost" onClick={fetchData} className="text-[#8A8A8A] hover:text-white" data-testid="refresh-signals"><RefreshCw size={16} /></Button>
          </div>
        </div>

        {/* Signal Intelligence Panel */}
        {intel.length > 0 && (
          <Card className="bg-[#0A0A0A] border-[#002FA7] p-4 rounded-none" style={{ boxShadow: 'inset 0 0 30px rgba(0,47,167,0.15)' }} data-testid="intelligence-panel">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={14} className="text-[#002FA7]" />
              <h3 className="font-mono text-xs tracking-[0.2em] text-[#002FA7] uppercase">SIGNAL INTELLIGENCE ENGINE</h3>
              <Badge className="bg-[#002FA7] text-white rounded-none font-mono text-[8px]">ACTIVE</Badge>
            </div>
            <p className="font-mono text-[10px] text-[#555555] mb-3">Auto-adjusts confidence based on historical accuracy. LONG signals boosted, SHORT signals penalized.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="font-mono text-[10px] text-[#00FF66] mb-2">LONG SIGNALS (BOOSTED)</p>
                {longIntel.map((item) => (
                  <div key={`long-${item.symbol}`} className="flex items-center justify-between py-1 border-b border-[#1A1A1A]">
                    <span className="font-mono text-xs text-white">{item.symbol}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[10px] text-[#00FF66] tabular-nums">{item.win_rate}%</span>
                      <span className="font-mono text-[10px] text-[#8A8A8A]">{item.correct}/{item.total}</span>
                      <span className={`font-mono text-[10px] tabular-nums ${item.avg_pnl >= 0 ? 'text-[#00FF66]' : 'text-[#FF3B30]'}`}>{item.avg_pnl >= 0 ? '+' : ''}{item.avg_pnl}%</span>
                      <Badge className={`rounded-none font-mono text-[8px] ${item.action === 'boost' ? 'bg-[#00FF66] text-black' : 'bg-[#222222] text-[#8A8A8A]'}`}>{item.action === 'boost' ? 'BOOST' : 'NEUTRAL'}</Badge>
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <p className="font-mono text-[10px] text-[#FF3B30] mb-2">SHORT SIGNALS (PENALIZED)</p>
                {shortIntel.map((item) => (
                  <div key={`short-${item.symbol}`} className="flex items-center justify-between py-1 border-b border-[#1A1A1A]">
                    <span className="font-mono text-xs text-white">{item.symbol}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[10px] text-[#FF3B30] tabular-nums">{item.win_rate}%</span>
                      <span className="font-mono text-[10px] text-[#8A8A8A]">{item.correct}/{item.total}</span>
                      <span className={`font-mono text-[10px] tabular-nums ${item.avg_pnl >= 0 ? 'text-[#00FF66]' : 'text-[#FF3B30]'}`}>{item.avg_pnl >= 0 ? '+' : ''}{item.avg_pnl}%</span>
                      <Badge className={`rounded-none font-mono text-[8px] ${item.action === 'penalize' ? 'bg-[#FF3B30] text-white' : 'bg-[#222222] text-[#8A8A8A]'}`}>{item.action === 'penalize' ? 'PENALIZE' : 'NEUTRAL'}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

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

export default SignalsPage;
