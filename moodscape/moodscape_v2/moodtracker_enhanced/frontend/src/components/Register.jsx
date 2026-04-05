import { useState } from "react";
import { apiRequest } from "./api";
import { useNavigate } from "react-router-dom";
import "../App.css";

export default function Register({ theme, toggleTheme }) {
  const [form, setForm]       = useState({ username: "", email: "", password: "", confirm: "" });
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const navigate              = useNavigate();

  const submit = async () => {
    setError("");
    if (form.password !== form.confirm) return setError("Passwords do not match");
    setLoading(true);
    try {
      await apiRequest("/auth/register", "POST", {
        username: form.username,
        email: form.email,
        password: form.password,
      });
      navigate("/");
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <>
      <div className="bg-canvas">
        <div className="bg-orb" />
        <div className="bg-orb" />
        <div className="bg-orb" />
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

          <h2>Create Account</h2>

          {error && <p className="error-msg">⚠ {error}</p>}

          <div className="input-group">
            <span className="input-icon">👤</span>
            <input placeholder="Username" onChange={(e) => setForm({ ...form, username: e.target.value })} />
          </div>
          <div className="input-group">
            <span className="input-icon">✉</span>
            <input placeholder="Email" type="email" onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="input-group">
            <span className="input-icon">🔒</span>
            <input type="password" placeholder="Password" onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div className="input-group">
            <span className="input-icon">🔒</span>
            <input type="password" placeholder="Confirm Password" onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && submit()} />
          </div>

          <button onClick={submit} disabled={loading}>
            {loading ? <><span className="spinner" /> Creating…</> : "Create Account →"}
          </button>

          <button className="link-btn" onClick={() => navigate("/")}>Already have an account? Sign in</button>
        </div>
      </div>
    </>
  );
}
