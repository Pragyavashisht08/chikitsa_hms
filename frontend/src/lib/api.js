// Real backend if VITE_API_BASE is set; otherwise run MOCK mode.
import axios from "axios";

const BASE = import.meta.env.VITE_API_BASE;
let api; // assigned below and exported at end

if (BASE) {
  // ---------- REAL API MODE ----------
  api = axios.create({ baseURL: BASE });

  // Attach token if present
  api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
} else {
  // ---------- MOCK API MODE ----------
  const storage = {
    get: (k, d) => JSON.parse(localStorage.getItem(k) || JSON.stringify(d)),
    set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
  };
  const delay = (v, ms = 250) => new Promise((r) => setTimeout(() => r(v), ms));
  const uid = () => (crypto?.randomUUID?.() || String(Date.now()));

  // in-browser "DB"
  const db = {
    users:       storage.get("users", []),
    patients:    storage.get("patients", []),
    // suggestions: tally of tokens typed/saved
    suggestions: storage.get("suggestions", { SYMPTOM: {}, MEDICINE: {} }),
  };
  const persist = () => {
    storage.set("users", db.users);
    storage.set("patients", db.patients);
    storage.set("suggestions", db.suggestions);
  };

  // helpers
  const norm10 = (s) => String(s || "").replace(/\D+/g, "").slice(0, 10);

  api = {
    // ------------------- POST -------------------
    async post(path, body) {
      // ---------- AUTH ----------
      if (path === "/auth/signup") {
        const email = String(body?.email || "").toLowerCase();
        const exists = db.users.find((u) => u.email === email);
        if (exists) throw { response: { data: { message: "User already exists" } } };
        const user = { id: uid(), ...body, email };
        db.users.push(user); persist();
        const token = btoa(JSON.stringify({ id: user.id, role: user.role }));
        return delay({ data: { token, user } });
      }

      if (path === "/auth/login") {
        const email = String(body?.email || "").toLowerCase();
        const user = db.users.find((u) => u.email === email);
        if (!user || user.password !== body.password) {
          throw { response: { data: { message: "Invalid credentials" } } };
        }
        const token = btoa(JSON.stringify({ id: user.id, role: user.role }));
        return delay({ data: { token, user } });
      }

      // ---------- PATIENTS (CREATE) ----------
      if (path === "/patients") {
        const nameCaps = (body?.name || "").toUpperCase();
        const phone10  = norm10(body?.phone);
        const uniqueId =
          (body?.uniqueId && String(body.uniqueId).toUpperCase())
            || (nameCaps.replace(/\s+/g, "") + "_" + phone10)
            || undefined;

        const p = {
          id: uid(),
          name: nameCaps,
          phone: phone10,
          uniqueId,
          registeredAt: new Date().toISOString(),
          visits: [],
          reports: [],           // patient-level reports container
        };
        db.patients.push(p); persist();
        return delay({ data: p });
      }

      // ---------- VISITS (ADD) ----------
      if (/^\/patients\/[^/]+\/visits$/.test(path)) {
        const id = path.split("/")[2];
        const p = db.patients.find((pp) => (pp.id || pp._id) === id);
        if (!p) throw { response: { data: { message: "Patient not found" } } };

        const v = body || {};
        const toArray = (x) =>
          Array.isArray(x)
            ? x.filter(Boolean).map(String)
            : (x ? String(x).split(",").map((s) => s.trim()).filter(Boolean) : []);

        const visit = {
          id: uid(),
          date: v.date || new Date().toISOString(),

          // frontdesk fields
          symptoms: v.symptoms || "",
          bp: {
            systolic: v?.bp?.systolic != null ? Number(v.bp.systolic) : undefined,
            diastolic: v?.bp?.diastolic != null ? Number(v.bp.diastolic) : undefined,
          },
          payment: {
            amount: v?.payment?.amount != null ? Number(v.payment.amount) : undefined,
            mode:   v?.payment?.mode || "CASH",
            status: v?.payment?.status || "PENDING",
          },
          notes: v.notes || "",

          // doctor fields
          diagnosis: v.diagnosis || "",
          tests:     toArray(v.tests),
          medicines: toArray(v.medicines),
          advice:    v.advice || "",
        };

        // update autocomplete suggestions
        if (visit.symptoms) {
          visit.symptoms
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .forEach((t) => {
              const k = t.toUpperCase();
              db.suggestions.SYMPTOM[k] = (db.suggestions.SYMPTOM[k] || 0) + 1;
            });
        }
        (visit.medicines || []).forEach((m) => {
          const k = String(m).toUpperCase();
          db.suggestions.MEDICINE[k] = (db.suggestions.MEDICINE[k] || 0) + 1;
        });

        p.visits = p.visits || [];
        p.visits.push(visit);
        persist();
        return delay({ data: p });
      }

      // ---------- REPORTS (PATIENT-LEVEL ADD) ----------
      // UI sends { name, dataURL } in mock mode (base64). If you later pass a URL, it will be used instead.
      if (/^\/patients\/[^/]+\/reports$/.test(path)) {
        const id = path.split("/")[2];
        const p = db.patients.find((pp) => (pp.id || pp._id) === id);
        if (!p) throw { response: { data: { message: "Patient not found" } } };

        const { name, dataURL, url } = body || {};
        const report = {
          id: uid(),
          name: name || "REPORT",
          dataURL: url ? undefined : dataURL, // store base64 in mock if no url provided
          url: url || undefined,
        };

        p.reports = p.reports || [];
        p.reports.push(report);
        persist();
        return delay({ data: report });
      }

      throw new Error("Mock POST not implemented: " + path);
    },

    // ------------------- GET -------------------
    async get(path, config = {}) {
      // patients list + filters
      if (path === "/patients") {
        const q = config?.params?.q?.toLowerCase?.() || "";
        const from = config?.params?.from ? new Date(config.params.from) : null;
        const to   = config?.params?.to   ? new Date(config.params.to)   : null;

        const list = db.patients
          .filter((p) => {
            const okText =
              !q ||
              (p.name || "").toLowerCase().includes(q) ||
              (p.phone || "").includes(q) ||
              (p.uniqueId || "").toLowerCase().includes(q);

            const d = new Date(p.registeredAt);
            const okFrom = !from || d >= from;
            const okTo   = !to   || d <= to;

            return okText && okFrom && okTo;
          })
          .slice(-500)
          .reverse();

        return delay({ data: list });
      }

      // visits of a patient
      if (/^\/patients\/[^/]+\/visits$/.test(path)) {
        const id = path.split("/")[2];
        const p = db.patients.find((pp) => (pp.id || pp._id) === id);
        if (!p) throw { response: { data: { message: "Patient not found" } } };
        const visits = [...(p.visits || [])].sort(
          (a, b) => new Date(b.date) - new Date(a.date)
        );
        return delay({ data: { patientId: id, uniqueId: p.uniqueId, name: p.name, visits } });
      }

      // suggestions (autocomplete)
      if (path === "/suggestions") {
        const type = (config?.params?.type || "").toUpperCase();
        const sw   = (config?.params?.startsWith || "").toUpperCase();
        if (!["SYMPTOM", "MEDICINE"].includes(type)) return delay({ data: [] });

        const bag = db.suggestions[type] || {};
        const arr = Object.entries(bag)
          .filter(([k]) => !sw || k.startsWith(sw))
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .slice(0, 10)
          .map(([k]) => k);
        return delay({ data: arr });
      }

      throw new Error("Mock GET not implemented: " + path);
    },

    // ------------------- DELETE -------------------
    async delete(path) {
      // reports (patient-level): delete
      if (/^\/patients\/[^/]+\/reports\/[^/]+$/.test(path)) {
        const [, , patientId, , reportId] = path.split("/");
        const p = db.patients.find((pp) => (pp.id || pp._id) === patientId);
        if (!p) throw { response: { data: { message: "Patient not found" } } };
        p.reports = (p.reports || []).filter((r) => r.id !== reportId);
        persist();
        return delay({ data: { ok: true } });
      }
      throw new Error("Mock DELETE not implemented: " + path);
    },
  };

  // eslint-disable-next-line no-console
  console.log("%cRunning in MOCK API mode (no backend)", "color:#E85002");
}

export { api };
