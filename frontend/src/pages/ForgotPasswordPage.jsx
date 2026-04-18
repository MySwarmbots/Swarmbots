import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import { formatApiErrorDetail } from "@/lib/utils";

const API = process.env.REACT_APP_BACKEND_URL;

function ForgotPasswordPage() {
  const [email, setEmail] = useState(""); const [sent, setSent] = useState(false); const [token, setToken] = useState("");
  const [isLoading, setIsLoading] = useState(false); const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(""); setIsLoading(true);
    try {
      const { data } = await axios.post(`${API}/api/auth/forgot-password`, { email });
      setSent(true);
      if (data.reset_token) setToken(data.reset_token);
      toast.success("Reset link generated");
    } catch (err) { setError(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setIsLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-heading text-4xl font-black tracking-tighter text-white">MIROFISH</h1>
          <p className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] mt-2">PASSWORD RESET</p>
        </div>
        <Card className="bg-[#111111] border-[#222222] p-6 rounded-none">
          {!sent ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">Email</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 bg-[#0A0A0A] border-[#333333] rounded-none text-white" required data-testid="forgot-email-input" /></div>
              {error && <p className="text-[#FF3B30] text-sm font-mono">{error}</p>}
              <Button type="submit" className="w-full bg-white text-black hover:bg-gray-200 rounded-none" disabled={isLoading} data-testid="forgot-submit-btn">
                {isLoading ? "SENDING..." : "SEND RESET LINK"}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <CheckCircle size={32} className="text-[#00FF66] mx-auto" />
              <p className="font-mono text-sm text-[#8A8A8A] text-center">A reset link has been sent to your email.</p>
              {token && (
                <div className="terminal-bg p-3 mt-3">
                  <p className="font-mono text-[10px] text-[#555555] mb-1">RESET TOKEN (also sent via Telegram if linked):</p>
                  <p className="font-mono text-xs text-[#00FF66] break-all" data-testid="reset-token">{token}</p>
                </div>
              )}
              <Button onClick={() => navigate(`/reset-password${token ? `?token=${token}` : ""}`)} className="w-full bg-white text-black hover:bg-gray-200 rounded-none" data-testid="go-reset-btn">RESET PASSWORD</Button>
            </div>
          )}
          <div className="mt-4 text-center">
            <button onClick={() => navigate("/login")} className="font-mono text-xs text-[#8A8A8A] hover:text-white transition-colors">BACK TO LOGIN</button>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ============== RESET PASSWORD PAGE ==============

export default ForgotPasswordPage;
