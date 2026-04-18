import { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const API = process.env.REACT_APP_BACKEND_URL;

const WsContext = createContext(null);

export function WsProvider({ children }) {
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

  const wsValue = useMemo(() => ({ lastMessage, wsConnected }), [lastMessage, wsConnected]);

  return (
    <WsContext.Provider value={wsValue}>
      {children}
    </WsContext.Provider>
  );
}

export function useWs() {
  return useContext(WsContext);
}
