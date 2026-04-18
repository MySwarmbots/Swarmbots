import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import {
  Activity, Bot, BarChart3, Bell, LogOut,
  Menu, X, TrendingUp,
  Zap, Settings, ArrowUpDown, Layers,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useWs } from "@/contexts/WsContext";
import { logError } from "@/lib/utils";

const API = process.env.REACT_APP_BACKEND_URL;

export function DashboardLayout({ children }) {
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
      } catch (e) { logError('Request failed', e); }
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
