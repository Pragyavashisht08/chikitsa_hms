// If VITE_API_BASE is set, use axios to hit your real backend.
// If not set, we run in "mock mode" so you can test UI without a server.
import axios from "axios";

const BASE = import.meta.env.VITE_API_BASE;

if (BASE) {
  // Real API mode
  export const api = axios.create({ baseURL: BASE });
  api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
} else {
  // Mock API mode (in-memory/localStorage)
  const storage = {
    get: (k, d) => JSON.parse(localStorage.getItem(k) || JSON.stringify(d)),
    set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
  };

  const delay = (v) => new Promise((r) => setTimeout(() => r(v), 300));

  const db = {
    users: storage.get("users", []),
    patients: storage.get("patients", []),
  };
  function persist() {
    storage.set("users", db.users);
    storage.set("patients", db.patients);
  }

  // Minimal axios-like interface
  export const api = {
    async post(path, body) {
      if (path === "/auth/signup") {
        const exists = db.users.find((u) => u.email === body.email);
        if (exists) throw { response: { data: { message: "User already exists" } } };
        const user = { id: crypto.randomUUID(), ...body };
        db.users.push(user); persist();
        const token = btoa(JSON.stringify({ id: user.id, role: user.role }));
        return delay({ data: { token, user } });
      }
      if (path === "/auth/login") {
        const user = db.users.find((u) => u.email === body.email);
        if (!user || user.password !== body.password) {
          throw { response: { data: { message: "Invalid credentials" } } };
        }
        const token = btoa(JSON.stringify({ id: user.id, role: user.role }));
        return delay({ data: { token, user } });
      }
      if (path.startsWith("/patients")) {
        const p = { id: crypto.randomUUID(), registeredAt: new Date().toISOString(), visits: [], ...body };
        db.patients.push(p); persist();
        return delay({ data: p });
      }
      throw new Error("Mock POST not implemented: " + path);
    },
    async get(path, config = {}) {
      if (path === "/patients") {
        const q = config?.params?.q?.toLowerCase?.() || "";
        const list = db.patients.filter(
          (p) =>
            !q ||
            p.name.toLowerCase().includes(q) ||
            (p.phone || "").includes(q) ||
            (p.uniqueId || "").toLowerCase().includes(q)
        ).slice(-100).reverse();
        return delay({ data: list });
      }
      throw new Error("Mock GET not implemented: " + path);
    },
  };
  console.log("%cRunning in MOCK API mode (no backend)", "color: #E85002");
}
