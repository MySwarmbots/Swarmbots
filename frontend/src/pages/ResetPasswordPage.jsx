import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { formatApiErrorDetail } from "@/lib/utils";

const API = process.env.REACT_APP_BACKEND_URL;

function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState(searchParams.get("token") || "");
  const [newPassword, setNewPassword] = useState(""); const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false); const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(""); setIsLoading(true);
    try {
      await axios.post(`${API}/api/auth/reset-password`, { token, new_password: newPassword });
      setSuccess(true); toast.success("Password reset successful");
    } catch (err) { setError(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setIsLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-heading text-4xl font-black tracking-tighter text-white">MIROFISH</h1>
          <p className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] mt-2">SET NEW PASSWORD</p>
        </div>
        <Card className="bg-[#111111] border-[#222222] p-6 rounded-none">
          {!success ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">Reset Token</label>
                <Input value={token} onChange={(e) => setToken(e.target.value)} className="mt-1 bg-[#0A0A0A] border-[#333333] rounded-none text-white font-mono text-xs" required data-testid="reset-token-input" /></div>
              <div><label className="font-mono text-xs tracking-[0.2em] text-[#8A8A8A] uppercase">New Password</label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-1 bg-[#0A0A0A] border-[#333333] rounded-none text-white" required data-testid="reset-newpassword-input" /></div>
              {error && <p className="text-[#FF3B30] text-sm font-mono">{error}</p>}
              <Button type="submit" className="w-full bg-white text-black hover:bg-gray-200 rounded-none" disabled={isLoading} data-testid="reset-submit-btn">
                {isLoading ? "RESETTING..." : "RESET PASSWORD"}
              </Button>
            </form>
          ) : (
            <div className="text-center space-y-4">
              <CheckCircle size={32} className="text-[#00FF66] mx-auto" />
              <p className="font-mono text-sm text-white">Password reset successful!</p>
              <Button onClick={() => navigate("/login")} className="w-full bg-white text-black hover:bg-gray-200 rounded-none" data-testid="back-login-btn">BACK TO LOGIN</Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ============== DASHBOARD PAGE ==============

export default ResetPasswordPage;
