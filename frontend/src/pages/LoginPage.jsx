import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatApiErrorDetail } from "@/lib/utils";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { if (user) navigate("/dashboard"); }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setIsLoading(true);
    try { await login(email, password); navigate("/dashboard"); }
    catch (err) { setError(formatApiErrorDetail(err.response?.data?.detail) || err.message); }
    finally { setIsLoading(false); }
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
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 bg-[#0A0A0A] border-[#333333] rounded-none focus:ring-1 focus:ring-white focus:border-white text-white" required data-testid="login-email-input" />
            </div>
            <div>
              <label className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">Password</label>
              <div className="relative mt-1">
                <Input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="bg-[#0A0A0A] border-[#333333] rounded-none focus:ring-1 focus:ring-white focus:border-white text-white pr-10" required data-testid="login-password-input" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555555] hover:text-white">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {error && <p data-testid="login-error" className="text-[#FF3B30] text-sm font-mono">{error}</p>}
            <Button type="submit" className="w-full bg-white text-black hover:bg-gray-200 rounded-none font-medium" disabled={isLoading} data-testid="login-submit-btn">
              {isLoading ? "AUTHENTICATING..." : "LOGIN"}
            </Button>
          </form>
          <div className="mt-4 flex justify-between">
            <button onClick={() => navigate("/forgot-password")} className="font-mono text-xs text-[#8A8A8A] hover:text-white transition-colors" data-testid="forgot-password-link">FORGOT PASSWORD</button>
            <button onClick={() => navigate("/register")} className="font-mono text-xs text-[#8A8A8A] hover:text-white transition-colors" data-testid="goto-register-link">CREATE ACCOUNT</button>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ============== REGISTER PAGE ==============

export default LoginPage;
