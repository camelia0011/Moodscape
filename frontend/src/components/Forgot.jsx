import { useState } from "react";
import { apiRequest } from "./api";
import { useNavigate } from "react-router-dom";
import "../App.css";

export default function Forgot({ theme, toggleTheme }) {
  const [email, setEmail]     = useState("");
  const [otp, setOtp]         = useState("");
  const [pass, setPass]       = useState("");
  const [step, setStep]       = useState(1);
  const [msg, setMsg]         = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const navigate              = useNavigate();

  const send = async () => {
    setError(""); setMsg(""); setLoading(true);
    try {
      await apiRequest("/auth/forgot-password", "POST", { email });
      setMsg("OTP sent to your email. Check your inbox.");
      setStep(2);
    } catch (err) { setError(err.message); }
    setLoading(false);
  };

  const reset = async () => {
    setError(""); setMsg(""); setLoading(true);
    try {
      await apiRequest("/auth/reset-password", "POST", { email, otp, newPassword: pass });
      setMsg("Password reset successfully!");
      setTimeout(() => navigate("/"), 1500);
    } catch (err) { setError(err.message); }
    setLoading(false);
  };

  return (
    <>
      <div className="bg-canvas">
        <div className="bg-orb" /><div className="bg-orb" /><div className="bg-orb" />
      </div>
      <button className="theme-toggle" onClick={toggleTheme}>
        <span className="toggle-icon">{theme === "light" ? "☀️" : "🌒"}</span>
        {theme === "light" ? "Light" : "Dark"}
      </button>

      <div className="container">
        <div className="card">
          <div className="card-logo">
            <div className="logo-icon">🌊</div>
            <div className="logo-title">MOODSCAPE</div>
          </div>

          <h2>Reset Password</h2>

          {error && <p className="error-msg">⚠ {error}</p>}
          {msg   && <p className="success-msg">✓ {msg}</p>}

          {step === 1 && (
            <>
              <div className="input-group">
                <span className="input-icon">✉</span>
                <input placeholder="Email address" type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)} />
              </div>
              <button onClick={send} disabled={loading}>
                {loading ? <><span className="spinner" /> Sending…</> : "Send OTP →"}
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <div className="input-group">
                <span className="input-icon">🔑</span>
                <input placeholder="Enter OTP" value={otp} onChange={(e) => setOtp(e.target.value)} />
              </div>
              <div className="input-group">
                <span className="input-icon">🔒</span>
                <input type="password" placeholder="New Password" value={pass}
                  onChange={(e) => setPass(e.target.value)} />
              </div>
              <button onClick={reset} disabled={loading}>
                {loading ? <><span className="spinner" /> Resetting…</> : "Reset Password →"}
              </button>
              <button className="link-btn" onClick={() => setStep(1)}>Re-send OTP</button>
            </>
          )}

          <button className="link-btn" onClick={() => navigate("/")}>← Back to Login</button>
        </div>
      </div>
    </>
  );
}
