import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { WsProvider } from "@/contexts/WsContext";

export function ProtectedRoute({ children }) {
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
