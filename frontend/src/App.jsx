import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login     from "./components/Login";
import Register  from "./components/Register";
import Forgot    from "./components/Forgot";
import Dashboard from "./components/Dashboard";

function PrivateRoute({ children }) {
  return localStorage.getItem("token") ? children : <Navigate to="/" replace />;
}

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("moodscape_theme") || "dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("moodscape_theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");

  const themeProps = { theme, toggleTheme };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"          element={<Login     {...themeProps} />} />
        <Route path="/register"  element={<Register  {...themeProps} />} />
        <Route path="/forgot"    element={<Forgot    {...themeProps} />} />
        <Route path="/dashboard" element={<PrivateRoute><Dashboard {...themeProps} /></PrivateRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
