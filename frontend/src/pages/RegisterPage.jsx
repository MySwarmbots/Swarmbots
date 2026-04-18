import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { formatApiErrorDetail } from "@/lib/utils";

function RegisterPage() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [name, setName] = useState("");
  const [error, setError] = useState(""); const [isLoading, setIsLoading] = useState(false);
  const { register, user } = useAuth(); const navigate = useNavigate();

  useEffect(() => { if (user) navigate("/dashboard"); }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(""); setIsLoading(true);
    try { await register(email, password, name); navigate("/dashboard"); }
    catch (err) { setError(formatApiErrorDetail(err.response?.data?.detail) || err.message); }
    finally { setIsLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-heading text-4xl font-black tracking-tighter text-white">MIROFISH</h1>
          <p className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] mt-2">CREATE ACCOUNT</p>
        </div>
        <Card className="bg-[#111111] border-[#222222] p-6 rounded-none">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><label className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">Name</label>
              <Input type="text" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 bg-[#0A0A0A] border-[#333333] rounded-none text-white" required data-testid="register-name-input" /></div>
            <div><label className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 bg-[#0A0A0A] border-[#333333] rounded-none text-white" required data-testid="register-email-input" /></div>
            <div><label className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">Password</label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 bg-[#0A0A0A] border-[#333333] rounded-none text-white" required data-testid="register-password-input" /></div>
            {error && <p className="text-[#FF3B30] text-sm font-mono">{error}</p>}
            <Button type="submit" className="w-full bg-white text-black hover:bg-gray-200 rounded-none" disabled={isLoading} data-testid="register-submit-btn">
              {isLoading ? "CREATING..." : "CREATE ACCOUNT"}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <button onClick={() => navigate("/login")} className="font-mono text-xs text-[#8A8A8A] hover:text-white transition-colors" data-testid="goto-login-link">ALREADY HAVE ACCOUNT</button>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ============== FORGOT PASSWORD PAGE ==============

export default RegisterPage;
