import { useState } from "react";
import { apiRequest } from "./api";
import { useNavigate } from "react-router-dom";
import "../App.css";

export default function Login({ theme, toggleTheme }) {
  const [form, setForm]       = useState({ username: "", password: "" });
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const navigate              = useNavigate();

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await apiRequest("/auth/login", "POST", form);
      localStorage.setItem("token", res.token);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <>
      {/* Animated background */}
      <div className="bg-canvas">
        <div className="bg-orb" />
        <div className="bg-orb" />
        <div className="bg-orb" />
      </div>

      {/* Theme toggle */}
      <button className="theme-toggle" onClick={toggleTheme}>
        <span className="toggle-icon">{theme === "light" ? "☀️" : "🌒"}</span>
        {theme === "light" ? "Light" : "Dark"}
      </button>

      <div className="container">
        <div className="card">
          {/* Brand */}
          <div className="card-logo">
            <div className="logo-icon">🌊</div>
            <div className="logo-title">MOODSCAPE</div>
          </div>

          <h2>Welcome Back</h2>

          {error && <p className="error-msg">⚠ {error}</p>}

          <div className="input-group">
            <span className="input-icon">👤</span>
            <input
              placeholder="Username"
              autoComplete="username"
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </div>

          <div className="input-group">
            <span className="input-icon">🔒</span>
            <input
              type="password"
              placeholder="Password"
              autoComplete="current-password"
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>

          <button onClick={submit} disabled={loading}>
            {loading ? <><span className="spinner" /> Signing in…</> : "Sign In →"}
          </button>

          <button className="link-btn" onClick={() => navigate("/register")}>
            Don't have an account? Create one
          </button>
          <button className="link-btn" onClick={() => navigate("/forgot")}>
            Forgot Password?
          </button>
        </div>
      </div>
    </>
  );
}
