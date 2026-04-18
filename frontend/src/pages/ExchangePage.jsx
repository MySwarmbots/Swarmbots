import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";


import { useWs } from "@/contexts/WsContext";
import { formatApiErrorDetail } from "@/lib/utils";
import { logError } from "@/lib/utils";

const API = process.env.REACT_APP_BACKEND_URL;

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
  const [marketType, setMarketType] = useState("spot");
  const [selectedSymbol, setSelectedSymbol] = useState("BTC/USDT");
  const [orderForm, setOrderForm] = useState({ side: "buy", type: "market", amount: "", price: "" });
  const [orderLoading, setOrderLoading] = useState(false);
  const { lastMessage } = useWs();

  const fetchStatus = useCallback(async () => {
    try { const { data } = await axios.get(`${API}/api/exchange/status`, { withCredentials: true }); setExchangeStatus(data); } catch (e) { logError('Request failed', e); }
  }, []);

  const fetchTickers = useCallback(async () => {
    try {
      const symbols = marketType === "spot" ? "BTC/USDT,ETH/USDT,SOL/USDT,XRP/USDT,DOGE/USDT,ADA/USDT" : "BTC/USDT:USDT,ETH/USDT:USDT,SOL/USDT:USDT";
      const { data } = await axios.get(`${API}/api/exchange/tickers?symbols=${symbols}&market_type=${marketType}`, { withCredentials: true });
      setTickers(data.tickers.filter(t => !t.error));
    } catch (e) { logError('Request failed', e); }
  }, [marketType]);

  const fetchBalance = useCallback(async () => {
    try { const { data } = await axios.get(`${API}/api/exchange/balance?market_type=${marketType}`, { withCredentials: true }); setBalance(data); } catch (e) { logError('Request failed', e); }
  }, [marketType]);

  const fetchPositions = useCallback(async () => {
    try { const { data } = await axios.get(`${API}/api/exchange/positions`, { withCredentials: true }); setPositions(data.positions); } catch (e) { logError('Request failed', e); }
  }, []);

  const fetchOpenOrders = useCallback(async () => {
    try { const { data } = await axios.get(`${API}/api/exchange/open-orders?market_type=${marketType}`, { withCredentials: true }); setOpenOrders(data.orders); } catch (e) { logError('Request failed', e); }
  }, [marketType]);

  const fetchOrderHistory = useCallback(async () => {
    try { const { data } = await axios.get(`${API}/api/exchange/order-history?market_type=${marketType}&limit=20`, { withCredentials: true }); setOrderHistory(data.orders); } catch (e) { logError('Request failed', e); }
  }, [marketType]);

  const fetchChart = useCallback(async () => {
    try { const { data } = await axios.get(`${API}/api/exchange/ohlcv/${encodeURIComponent(selectedSymbol)}?timeframe=1h&limit=48&market_type=${marketType}`, { withCredentials: true }); setOhlcv(data.candles); } catch (e) { logError('Request failed', e); }
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
    } catch { toast.error("Cancel failed"); }
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
                        <tr key={`${p.symbol}-${p.side}-${i}`} className="border-t border-[#1A1A1A] hover:bg-[#151515]" data-testid={`position-${i}`}>
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


export default ExchangePage;
