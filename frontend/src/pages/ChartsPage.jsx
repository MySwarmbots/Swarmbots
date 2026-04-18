import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { CHART_COLORS } from "@/lib/chart";

const API = process.env.REACT_APP_BACKEND_URL;

function ChartsPage() {
  const [searchParams] = useSearchParams();
  const [portfolio, setPortfolio] = useState(null);
  const [agentPerf, setAgentPerf] = useState(null);
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(searchParams.get("agent") || "");
  const [loading, setLoading] = useState(true);

  // Define callbacks BEFORE useEffect that depends on them
  const fetchPortfolio = useCallback(async () => {
    try { const { data } = await axios.get(`${API}/api/agents/portfolio/summary`, { withCredentials: true }); setPortfolio(data); }
    catch (e) { console.error('Load error:', e); } finally { setLoading(false); }
  }, []);

  const fetchAgents = useCallback(async () => {
    try { const { data } = await axios.get(`${API}/api/agents`, { withCredentials: true }); setAgents(data.agents); if (!selectedAgent && data.agents.length) setSelectedAgent(data.agents[0].id); }
    catch (e) { console.error('Fetch agents error:', e); }
  }, [selectedAgent]);

  const fetchAgentPerf = useCallback(async (id) => {
    try { const { data } = await axios.get(`${API}/api/agents/${id}/performance`, { withCredentials: true }); setAgentPerf(data); }
    catch (e) { console.error('Fetch perf error:', e); setAgentPerf(null); }
  }, []);

  useEffect(() => {
    fetchPortfolio();
    fetchAgents();
  }, [fetchPortfolio, fetchAgents]);

  useEffect(() => {
    if (selectedAgent) fetchAgentPerf(selectedAgent);
  }, [selectedAgent, fetchAgentPerf]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-[#111111] border border-[#333333] p-2">
        <p className="font-mono text-[10px] text-[#8A8A8A]">{label}</p>
        {payload.map((p) => (
          <p key={p.dataKey || p.name} className="font-mono text-xs" style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</p>
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
                      {(portfolio?.portfolio_history || []).map((entry) => (
                        <Cell key={`pnl-${entry.date}`} fill={entry.daily_pnl >= 0 ? "#00FF66" : "#FF3B30"} />
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
                      {(portfolio?.by_strategy || []).map((e) => (<Cell key={`strat-${e.name}`} fill={e.pnl >= 0 ? "#00FF66" : "#FF3B30"} />))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
              <Card className="bg-[#111111] border-[#222222] p-4 rounded-none">
                <h3 className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase mb-4">PNL BY EXCHANGE</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={portfolio?.by_exchange || []} dataKey="pnl" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: $${value}`}>
                      {(portfolio?.by_exchange || []).map((e, i) => (<Cell key={`exch-${e.name}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}
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

export default ChartsPage;
