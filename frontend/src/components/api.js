const BASE = "http://localhost:5000/api";

// ─── Auth requests (no token needed) ──────────────────────────────────────────
export const apiRequest = async (url, method, body) => {
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) throw new Error(data.msg || "Request failed");
  return data;
};

// ─── Authenticated requests (JWT injected automatically) ──────────────────────
export const authFetch = async (url, method = "GET", body = null) => {
  const token = localStorage.getItem("token");

  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };

  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${url}`, options);

  // Token expired — redirect to login
  if (res.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "/";
    throw new Error("Session expired. Please log in again.");
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || data.error || "Request failed");
  return data;
};

// ─── Authenticated file/blob fetch (for TTS audio) ────────────────────────────
export const authFetchBlob = async (url, body) => {
  const token = localStorage.getItem("token");

  const res = await fetch(`${BASE}${url}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (res.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "/";
    throw new Error("Session expired.");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Blob fetch failed");
  }

  return res.blob();
};
